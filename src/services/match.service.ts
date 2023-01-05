import { injectable, BindingScope } from "@loopback/core";
import { repository } from "@loopback/repository";
import { BotRepository, GameRepository, MatchRepository } from "../repositories";
import { Executor } from "../authorization";
import { Match } from "../models/match";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import { decodeJson } from "../codec";
import { promisify } from "util";
import child_process from "child_process";
import * as t from "io-ts";
import { ProgramSource } from "../models/base";
import { ValidationError } from "../errors";
import { Game } from "../models/game";

const exec = promisify(child_process.exec);

@injectable({ scope: BindingScope.TRANSIENT })
export class MatchService {
  static aiArenaConfigCodec = t.type({
    build: t.string,
    programPath: t.string,
    run: t.string,
  });

  static readonly AI_ARENA_CONFIG_FILE_NAME = "ai-arena.config.json";

  static getGamePath(gameId: string) {
    return path.resolve("container", "games", gameId);
  }

  static getBotPath(botId: string) {
    return path.resolve("container", "bots", botId);
  }

  static getMatchPath(matchId: string) {
    return path.resolve("container", "matches", matchId);
  }

  constructor(
    @repository("GameRepository") protected gameRepository: GameRepository,
    @repository("BotRepository") protected botRepository: BotRepository,
    @repository("MatchRepository") protected matchRepository: MatchRepository,
  ) {}

  async startMatch(executor: Executor, match: Match) {
    const game = await this.gameRepository.findById(executor, match.gameId);
    const serverConfig = await this.prepareGameServer(executor, game);
    const botConfigs = [];
    for (const botId of match.botIds) {
      botConfigs.push(await this.prepareBot(executor, botId));
    }
    const matchPath = MatchService.getMatchPath(match.id);
    await fsp.mkdir(matchPath, { recursive: true });
    const mapPath = path.join(matchPath, "map.txt");
    await fsp.writeFile(mapPath, game.maps[0]);
    const botsCommandLineParam = botConfigs
      .map((botConfig) => `"${botConfig.runCommand.replace("%program", botConfig.programPath)}"`)
      .join(" ");
    const serverRunCommand = serverConfig.runCommand.replaceAll(/%program|%map|%bots/g, (token) => {
      if (token === "%program") return `"${serverConfig.programPath}"`;
      if (token === "%map") return "map.txt";
      if (token === "%bots") return botsCommandLineParam;
      throw new ValidationError({
        fieldErrors: {
          runCommand: [`unknown replacement pattern: ${token}`],
        },
      });
    });
    await exec(serverRunCommand, { cwd: matchPath });
    const logFileName = "match.log";
    await this.matchRepository._systemAccess.updateById(match.id, {
      log: {
        file: await fsp.readFile(path.join(matchPath, logFileName)),
        fileName: logFileName,
      },
    });
  }

  async prepareGameServer(executor: Executor, game: Game) {
    const serverBuildPath = path.join(MatchService.getGamePath(game.id), "server", "build");
    return this.prepareProgram(serverBuildPath, game.server, "server");
  }

  async prepareBot(executor: Executor, botId: string) {
    const bot = await this.botRepository.findById(executor, botId);
    const botBuildPath = path.join(MatchService.getBotPath(botId), "build");
    return this.prepareProgram(botBuildPath, bot.source, "bot");
  }

  protected async prepareProgram(
    buildPath: string,
    programSource: ProgramSource,
    targetProgramName: string,
  ) {
    const configFilePath = path.join(buildPath, "..", MatchService.AI_ARENA_CONFIG_FILE_NAME);
    const targetProgramPath = path.join(buildPath, "..", targetProgramName);
    const parseConfig = async () =>
      decodeJson(MatchService.aiArenaConfigCodec, (await fsp.readFile(configFilePath)).toString());
    let config;
    if (fs.existsSync(configFilePath) && fs.existsSync(targetProgramPath)) {
      config = await parseConfig();
    } else {
      await fsp.rm(buildPath, { recursive: true, force: true });
      await fsp.mkdir(buildPath, { recursive: true });
      await fsp.writeFile(path.join(buildPath, programSource.fileName), programSource.file);
      if (programSource.fileName.endsWith(".zip")) {
        await exec(`unzip ${programSource.fileName}`, { cwd: buildPath });
        await fsp.rename(
          path.join(buildPath, MatchService.AI_ARENA_CONFIG_FILE_NAME),
          configFilePath,
        );
      } else if (programSource.fileName.endsWith(".cpp")) {
        await fsp.writeFile(
          configFilePath,
          JSON.stringify(
            MatchService.aiArenaConfigCodec.encode({
              build: `g++ -std=c++17 -O2 ${programSource.fileName} -o ${targetProgramName}`,
              programPath: targetProgramName,
              run: targetProgramName,
            }),
          ),
        );
      }
      config = await parseConfig();
      await exec(config.build, { cwd: buildPath });
      await fsp.rename(path.join(buildPath, config.programPath), targetProgramPath);
    }
    return { runCommand: config.run, programPath: targetProgramPath };
  }

  async deleteMatch(executor: Executor, matchId: string) {
    await this.matchRepository.deleteMatch(executor, matchId);
    await fsp.rm(MatchService.getMatchPath(matchId), { recursive: true, force: true });
  }
}
