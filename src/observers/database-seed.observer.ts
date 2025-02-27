import { CoreBindings, inject, LifeCycleObserver, service } from "@loopback/core";
import { repository } from "@loopback/repository";
import { MongoDataSource } from "../datasources";
import path from "path";
import fsp from "fs/promises";
import { promisify } from "util";
import child_process from "child_process";
import * as t from "io-ts";
import { decodeJson } from "../../shared/codec";
import md5 from "md5";
import { EXECUTOR_SYSTEM, Role } from "../../shared/common";
import { MatchService } from "../services/match.service";
import { AiArenaBackendApplication } from "../application";
import fs from "fs";
import { BotSubmitStage } from "../models/bot";
import { BotRepository } from "../repositories/bot.repository";
import { UserRepository } from "../repositories/user.repository";
import { GameRepository } from "../repositories/game.repository";
import { UserService } from "../services/user.service";
import * as crypto from "crypto";
import { BotService } from "../services/bot.service";

const exec = promisify(child_process.exec);

export class DatabaseSeedObserver implements LifeCycleObserver {
  constructor(
    @inject("datasources.mongo")
    dataSource: MongoDataSource,
    @inject(CoreBindings.APPLICATION_INSTANCE)
    protected app: AiArenaBackendApplication,
    @repository(UserRepository) protected userRepository: UserRepository,
    @repository(GameRepository) protected gameRepository: GameRepository,
    @repository(BotRepository) protected botRepository: BotRepository,
    @service() protected userService: UserService,
    @service() protected botService: BotService,
  ) {}

  async start(): Promise<void> {
    if ((await this.userRepository.count({ username: EXECUTOR_SYSTEM })).count === 0) {
      await this.userRepository.create({
        username: EXECUTOR_SYSTEM,
        email: "",
        password: "",
        roles: [Role.ADMIN],
      });
    }
    if ((await this.userRepository.count({ username: "admin" })).count === 0) {
      const password = process.env.NODE_ENV === "production" ? process.env.ADMIN_PASSWORD : "4dm1n";
      if (password)
        await this.userRepository.validateAndCreate(
          {
            username: "admin",
            email: "admin",
            password,
          },
          [Role.ADMIN],
        );
    }
    await this.loadGames();
  }

  protected static readonly GAME_CONFIG_FILE_NAME = "ai-arena.game.config.json";

  protected static readonly playerCountCodec = t.type({ min: t.number, max: t.number });
  protected static readonly gameConfigCodec = t.intersection([
    t.type({
      name: t.string,
      shortDescription: t.string,
      picturePath: t.string,
      fullDescription: t.record(t.string, t.string),
      playerCount: DatabaseSeedObserver.playerCountCodec,
      maps: t.array(
        t.type({
          name: t.string,
          path: t.string,
          playerCount: DatabaseSeedObserver.playerCountCodec,
        }),
      ),
      bots: t.array(t.type({ name: t.string, path: t.string })),
      packageServer: t.type({
        command: t.string,
        result: t.string,
      }),
    }),
    t.partial({
      disabled: t.boolean,
    }),
  ]);

  protected async loadGames() {
    const gamesDirPath = path.resolve("games");
    for (const file of await fsp.readdir(gamesDirPath, { withFileTypes: true })) {
      if (!file.isDirectory()) continue;
      const gamePath = path.join(gamesDirPath, file.name);
      const gameConfig = decodeJson(
        DatabaseSeedObserver.gameConfigCodec,
        (
          await fsp.readFile(path.join(gamePath, DatabaseSeedObserver.GAME_CONFIG_FILE_NAME))
        ).toString(),
        "loading " + gamePath,
      );
      if (gameConfig.disabled) continue;
      const gameId = md5(gameConfig.name).substring(0, 24);
      const maps = [];
      for (const map of gameConfig.maps) {
        maps.push({
          name: map.name,
          playerCount: map.playerCount,
          file: await fsp.readFile(path.join(gamePath, map.path), { encoding: "utf8" }),
        });
      }
      const systemUser = await this.userService.getSystemUser();
      await this.botRepository.deleteAll({ gameId, userId: systemUser.id });
      for (const botConfig of gameConfig.bots) {
        const sourceCode = await fsp.readFile(path.join(gamePath, botConfig.path));
        const bot = await this.botRepository.create({
          id: crypto
            .createHash("md5")
            .update(gameConfig.name + botConfig.name)
            .update(sourceCode)
            .digest("hex")
            .substring(0, 24),
          gameId,
          name: botConfig.name,
          userId: systemUser.id,
          submitStatus: { stage: BotSubmitStage.CHECK_SUCCESS },
          versionNumber: 1,
          source: {
            fileName: path.basename(botConfig.path),
            content: sourceCode,
          },
        });
        await this.botService.checkBot(bot.id);
      }
      const publicFolderPath = path.join(gamePath, "public");
      if (fs.existsSync(publicFolderPath))
        this.app.static(`/public/games/${file.name}`, publicFolderPath);
      await exec(gameConfig.packageServer.command, { cwd: gamePath });
      const fullDescription: Record<string, string> = {};
      for (const [languageCode, descriptionPath] of Object.entries(gameConfig.fullDescription)) {
        fullDescription[languageCode] = (
          await fsp.readFile(path.join(gamePath, descriptionPath))
        ).toString();
      }
      const game = {
        id: gameId,
        name: gameConfig.name,
        shortDescription: gameConfig.shortDescription,
        pictureBuffer: await fsp.readFile(path.join(gamePath, gameConfig.picturePath)),
        fullDescription: JSON.stringify(fullDescription),
        playerCount: gameConfig.playerCount,
        maps,
        server: {
          content: await fsp.readFile(path.join(gamePath, gameConfig.packageServer.result)),
          fileName: path.basename(gameConfig.packageServer.result),
        },
      };
      if (await this.gameRepository.exists(game.id)) {
        await fsp.rm(MatchService.getGamePath(game.id), { recursive: true, force: true });
        await this.gameRepository.updateById(game.id, game);
      } else {
        await this.gameRepository.create(game);
      }
    }
  }
}
