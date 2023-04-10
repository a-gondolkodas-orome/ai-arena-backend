import { CoreBindings, inject, LifeCycleObserver } from "@loopback/core";
import { DefaultCrudRepository } from "@loopback/repository";
import { MongoDataSource } from "../datasources";
import { Game } from "../models/game";
import { User } from "../models/user";
import path from "path";
import fsp from "fs/promises";
import { promisify } from "util";
import child_process from "child_process";
import * as t from "io-ts";
import { decodeJson } from "../codec";
import md5 from "md5";
import { EXECUTOR_SYSTEM, Role } from "../services/authorization.service";
import { MatchService } from "../services/match.service";
import { AiArenaBackendApplication } from "../application";
import fs from "fs";

const exec = promisify(child_process.exec);

export class DatabaseSeedObserver implements LifeCycleObserver {
  constructor(
    @inject("datasources.mongo")
    dataSource: MongoDataSource,
    @inject(CoreBindings.APPLICATION_INSTANCE)
    protected app: AiArenaBackendApplication,
  ) {
    this.userRepo = new DefaultCrudRepository(User, dataSource);
    this.gameRepo = new DefaultCrudRepository(Game, dataSource);
  }

  protected userRepo: DefaultCrudRepository<User, typeof User.prototype.id>;
  protected gameRepo: DefaultCrudRepository<Game, typeof Game.prototype.id>;

  async start(): Promise<void> {
    if ((await this.userRepo.count({ username: EXECUTOR_SYSTEM })).count === 0) {
      await this.userRepo.create({
        username: EXECUTOR_SYSTEM,
        email: "",
        password: "",
        roles: [Role.ADMIN],
      });
    }
    if ((await this.userRepo.count({ username: "admin" })).count === 0) {
      await this.userRepo.create({
        username: "admin",
        email: "admin@ai-arena.com",
        password: "admin",
        roles: [Role.ADMIN],
      });
    }
    await this.loadGames();
  }

  protected static readonly GAME_CONFIG_FILE_NAME = "ai-arena.game.config.json";

  protected static readonly gameConfigCodec = t.type({
    name: t.string,
    shortDescription: t.string,
    picturePath: t.string,
    fullDescriptionPath: t.string,
    playerCount: t.type({
      min: t.number,
      max: t.number,
    }),
    mapsFolderPath: t.string,
    packageServer: t.type({
      command: t.string,
      result: t.string,
    }),
  });

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
      );
      const mapsFolderPath = path.join(gamePath, gameConfig.mapsFolderPath);
      const maps = [];
      for (const mapFile of await fsp.readdir(mapsFolderPath, { withFileTypes: true })) {
        if (!mapFile.isFile()) continue;
        maps.push((await fsp.readFile(path.join(mapsFolderPath, mapFile.name))).toString());
      }
      const publicFolderPath = path.join(gamePath, "public");
      if (fs.existsSync(publicFolderPath))
        this.app.static(`/public/games/${file.name}`, publicFolderPath);
      await exec(gameConfig.packageServer.command, { cwd: gamePath });
      const game = {
        id: md5(gameConfig.name).substring(0, 24),
        name: gameConfig.name,
        shortDescription: gameConfig.shortDescription,
        pictureBuffer: await fsp.readFile(path.join(gamePath, gameConfig.picturePath)),
        fullDescription: (
          await fsp.readFile(path.join(gamePath, gameConfig.fullDescriptionPath))
        ).toString(),
        playerCount: gameConfig.playerCount,
        maps,
        server: {
          file: await fsp.readFile(path.join(gamePath, gameConfig.packageServer.result)),
          fileName: path.basename(gameConfig.packageServer.result),
        },
      };

      if (await this.gameRepo.exists(game.id)) {
        await fsp.rm(MatchService.getGamePath(game.id), { recursive: true, force: true });
        await this.gameRepo.updateById(game.id, game);
      } else {
        await this.gameRepo.create(game);
      }
    }
  }
}
