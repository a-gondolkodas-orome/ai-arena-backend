import { BindingScope, injectable, service } from "@loopback/core";
import { repository } from "@loopback/repository";
import { Match, MatchRunStage } from "../models/match";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import { decodeJson } from "../codec";
import * as t from "io-ts";
import { ProgramSource } from "../models/base";
import { Game } from "../models/game";
import { BotSubmitStage } from "../models/bot";
import { BotService } from "./bot.service";
import EventEmitter from "events";
import { GameRepository } from "../repositories/game.repository";
import { MatchRepository } from "../repositories/match.repository";
import { BotRepository } from "../repositories/bot.repository";
import { matchConfigCodec } from "../common";
import { exec } from "../utils";
import { UserService } from "./user.service";

@injectable({ scope: BindingScope.SINGLETON })
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

  static getMatchPath(matchId: string) {
    return path.resolve("container", "matches", matchId);
  }

  constructor(
    @service() protected botService: BotService,
    @service() protected userService: UserService,
    @repository("GameRepository") protected gameRepository: GameRepository,
    @repository("BotRepository") protected botRepository: BotRepository,
    @repository("MatchRepository") protected matchRepository: MatchRepository,
  ) {}

  sse = new EventEmitter();

  async runMatch(match: Match) {
    let serverConfig: { runCommand: string; programPath: string; buildLog: string | undefined };
    let game;
    try {
      game = await this.gameRepository.findById(match.gameId);
      serverConfig = await this.prepareGameServer(game);
      this.logMatchRunEvent(match, MatchRunStage.PREPARE_GAME_SERVER_DONE).catch((e) =>
        console.error(e),
      );
    } catch (error: unknown) {
      await this.logMatchRunEvent(match, MatchRunStage.PREPARE_GAME_SERVER_ERROR, error);
      this.sse.emit(match.userId, { matchUpdate: match.id });
      return;
    }
    const botConfigs = [];
    try {
      const botCounter = new Map<string, number>();
      const isContest = match.userId === (await this.userService.getSystemUser()).id;
      for (const botId of match.botIds) {
        const { runCommand, programPath } = await this.prepareBot(botId);
        const bot = await this.botRepository.findById(botId, { include: ["user"] });
        const botName = isContest ? bot.user.username : bot.name;
        const index = botCounter.get(botName) ?? 0;
        botCounter.set(botName, index + 1);
        botConfigs.push({
          id: index ? `${botId}.${index}` : botId,
          name: index ? `${botName}.${index}` : botName,
          runCommand: `${runCommand.replace("%program", programPath)}`,
        });
      }
      this.logMatchRunEvent(match, MatchRunStage.PREPARE_BOTS_DONE).catch((e) => console.error(e));
    } catch (error: unknown) {
      await this.logMatchRunEvent(match, MatchRunStage.PREPARE_BOTS_ERROR, error);
      this.sse.emit(match.userId, { matchUpdate: match.id });
      return;
    }
    try {
      const matchPath = MatchService.getMatchPath(match.id);
      await fsp.mkdir(matchPath, { recursive: true });
      const mapPath = path.join(matchPath, "map.txt");
      await fsp.writeFile(mapPath, game.maps[0]);
      const matchConfigPath = path.join(matchPath, "match-config.json");
      await fsp.writeFile(
        matchConfigPath,
        JSON.stringify(matchConfigCodec.encode({ map: mapPath, bots: botConfigs }), undefined, 2),
      );
      const serverRunCommand =
        serverConfig.runCommand.replace("%program", `"${serverConfig.programPath}"`) +
        ` "${matchConfigPath}"`;
      console.info("running", serverRunCommand);
      await exec(serverRunCommand, { cwd: matchPath });
      const logFileName = "match.log";
      await this.matchRepository.updateById(match.id, {
        log: {
          file: await fsp.readFile(path.join(matchPath, logFileName)),
          fileName: logFileName,
        },
        scoreJson: await fsp.readFile(path.join(matchPath, "score.json"), { encoding: "utf8" }),
        runStatus: {
          stage: MatchRunStage.RUN_SUCCESS,
        },
      });
    } catch (error: unknown) {
      await this.logMatchRunEvent(match, MatchRunStage.RUN_ERROR, error);
    } finally {
      this.sse.emit(match.userId, { matchUpdate: match.id });
    }
  }

  protected async logMatchRunEvent(match: Match, stage: MatchRunStage, event?: unknown) {
    const message =
      event === undefined
        ? undefined
        : typeof event === "string"
        ? event
        : event instanceof Error || this.isErrorWithMessage(event)
        ? event.message
        : "Unknown error";
    await this.matchRepository.updateById(match.id, {
      runStatus: {
        stage,
        ...(message && { log: (match.runStatus?.log ?? "") + message + "\n" }),
      },
    });
  }

  async prepareGameServer(game: Game) {
    const serverBuildPath = path.join(MatchService.getGamePath(game.id), "server", "build");
    return this.prepareProgram(serverBuildPath, game.server, "server");
  }

  async prepareBot(botId: string) {
    const bot = await this.botRepository.findById(botId);
    const botBuildPath = path.join(BotService.getBotPath(botId), "build");
    const { runCommand, programPath } = await this.prepareProgram(botBuildPath, bot.source, "bot");
    return { runCommand, programPath };
  }

  async checkBot(botId: string) {
    const bot = await this.botRepository.findById(botId);
    try {
      const botBuildPath = path.join(BotService.getBotPath(botId), "build");
      const { buildLog } = await this.prepareProgram(botBuildPath, bot.source, "bot");
      await this.botRepository.updateById(botId, {
        submitStatus: {
          stage: BotSubmitStage.CHECK_SUCCESS,
          log: (bot.submitStatus?.log ?? "") + buildLog,
        },
      });
    } catch (error: unknown) {
      const message = this.isErrorWithMessage(error) ? error.message : "Unknown error";
      await this.botRepository.updateById(botId, {
        submitStatus: {
          stage: BotSubmitStage.CHECK_ERROR,
          log: (bot.submitStatus?.log ?? "") + message,
        },
      });
    } finally {
      this.botService.sse.emit(bot.userId, { botUpdate: bot.id });
    }
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
    let buildLog;
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
      buildLog = (await exec(config.build, { cwd: buildPath })).stdout;
      await fsp.rename(path.join(buildPath, config.programPath), targetProgramPath);
    }
    return { runCommand: config.run, programPath: targetProgramPath, buildLog };
  }

  protected isErrorWithMessage(error: unknown): error is { message: string } {
    return !!error && typeof (error as { message: string }).message === "string";
  }

  async deleteMatch(matchId: string) {
    await this.matchRepository.deleteById(matchId);
    await fsp.rm(MatchService.getMatchPath(matchId), { recursive: true, force: true });
  }
}
