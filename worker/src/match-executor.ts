import { createClient } from "@redis/client";
import {
  EXECUTOR_SYSTEM,
  getBotPath,
  isErrorWithMessage,
  matchConfigCodec,
  matchExecutionResultCodec,
  matchExecutionWorkCodec,
  MONGODB_DATABASE,
  RedisKey,
} from "../../shared/common";
import { notNull, Time } from "../../shared/utils";
import { decodeJson } from "../../shared/codec";
import path from "path";
import { Binary, ObjectId } from "mongodb";
import * as mongodb from "mongodb";
import { Match, MatchRunStage } from "./models/match";
import { Game } from "./models/game";
import { Bot } from "./models/bot";
import { User } from "./models/user";
import { AssertException, ExecError } from "../../shared/errors";
import fsp from "fs/promises";
import { exec } from "../../shared/utils";
import { prepareProgram } from "./prepare-program";

export class MatchExecutor {
  static async create(redisUrl: string, mongodbUrl: string) {
    const redisClient = createClient({
      url: redisUrl,
    });
    await redisClient.connect();
    console.log("Connected to Redis");
    const mongo = await mongodb.MongoClient.connect(mongodbUrl);
    console.log("Connected to MongoDB");
    const systemUserId = notNull(
      await mongo.db(MONGODB_DATABASE).collection("User").findOne({ username: EXECUTOR_SYSTEM }),
    )._id.toString();
    return new MatchExecutor(redisClient, mongo, systemUserId);
  }

  constructor(
    protected redis: ReturnType<typeof createClient>,
    protected mongo: mongodb.MongoClient,
    protected systemUserId: string,
  ) {
    this.mongoDb = mongo.db(MONGODB_DATABASE);
    redis.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });
  }

  protected mongoDb: mongodb.Db;

  protected static readonly POP_TIMEOUT = 10 * Time.second;

  async run() {
    console.log("Starting match executor");
    for (;;) {
      const workMessage = await this.redis.brPop(
        RedisKey.WORK_QUEUE__MATCH,
        MatchExecutor.POP_TIMEOUT,
      );
      if (workMessage == null) continue;
      const work = decodeJson(matchExecutionWorkCodec, workMessage.element);
      console.log("MatchExecutor: work received", work);
      const matchData = await this.mongoDb
        .collection("Match")
        .findOne({ _id: new ObjectId(work.matchId) }, { projection: { log: 0 } });
      if (matchData == null) {
        console.log("MatchExecutor: match not found", work);
        continue;
      }
      const match = new Match(matchData);
      await this.runMatch(match);
      console.log("MatchExecutor: work done", work);
      await this.redis.publish(
        work.callbackChannel,
        JSON.stringify(
          matchExecutionResultCodec.encode({ userId: match.userId, matchId: work.matchId }),
        ),
      );
    }
  }

  static getGamePath(gameId: string) {
    return path.resolve("container", "games", gameId);
  }

  static getMatchPath(matchId: string) {
    return path.resolve("container", "matches", matchId);
  }

  async runMatch(match: Match) {
    let serverConfig: { runCommand: string; programPath: string; buildLog: string | undefined };
    let game;
    try {
      game = new Game(await this.mongoDb.collection("Game").findOne(new ObjectId(match.gameId)));
      serverConfig = await this.prepareGameServer(game);
      this.logMatchRunEvent(match, MatchRunStage.PREPARE_GAME_SERVER_DONE).catch((e) =>
        console.error(e),
      );
    } catch (error: unknown) {
      await this.logMatchRunEvent(match, MatchRunStage.PREPARE_GAME_SERVER_ERROR, error);
      return;
    }
    const botConfigs = [];
    try {
      const botCounter = new Map<string, number>();
      const isContest = match.userId === this.systemUserId;
      for (const botId of match.botIds) {
        const { runCommand, programPath } = await this.prepareBot(botId);
        const bot = new Bot(await this.mongoDb.collection("Bot").findOne(new ObjectId(botId)));
        const user = new User(
          await this.mongoDb.collection("User").findOne(new ObjectId(bot.userId)),
        );
        const botName = isContest ? user.username : bot.name;
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
      return;
    }
    try {
      const matchPath = MatchExecutor.getMatchPath(match._id);
      await fsp.mkdir(matchPath, { recursive: true });
      const mapPath = path.join(matchPath, match.mapName);
      const gameMap = game.maps.find((map) => map.name === match.mapName);
      if (!gameMap) {
        throw new AssertException({
          message: "MatchService.runMatch: map not found",
          values: { mapName: match.mapName, matchId: match._id, game: game.name },
        });
      }
      await fsp.writeFile(mapPath, gameMap.file);
      const matchConfigPath = path.join(matchPath, "match-config.json");
      await fsp.writeFile(
        matchConfigPath,
        JSON.stringify(matchConfigCodec.encode({ map: mapPath, bots: botConfigs }), undefined, 2),
      );
      const serverRunCommand =
        serverConfig.runCommand.replace("%program", `"${serverConfig.programPath}"`) +
        ` "${matchConfigPath}"`;
      console.info("running", serverRunCommand);
      const { stdout, stderr } = await exec(serverRunCommand, { cwd: matchPath });
      console.log(stdout);
      console.error(stderr);
      const logFileName = "match.log";
      await this.mongoDb.collection("Match").updateOne(
        { _id: new ObjectId(match._id) },
        {
          $set: {
            log: {
              file: new Binary(await fsp.readFile(path.join(matchPath, logFileName))),
              fileName: logFileName,
            },
            scoreJson: await fsp.readFile(path.join(matchPath, "score.json"), { encoding: "utf8" }),
            runStatus: {
              stage: MatchRunStage.RUN_SUCCESS,
            },
          },
        },
      );
    } catch (error: unknown) {
      if (error instanceof ExecError) {
        console.log(error.stdout);
        console.error(error.stderr);
      }
      await this.logMatchRunEvent(match, MatchRunStage.RUN_ERROR, error);
    }
  }

  protected async logMatchRunEvent(match: Match, stage: MatchRunStage, event?: unknown) {
    const message =
      event === undefined
        ? undefined
        : typeof event === "string"
          ? event
          : event instanceof Error || isErrorWithMessage(event)
            ? event.message
            : "Unknown error";
    console.log(message);
    await this.mongoDb.collection("Match").updateOne(
      { _id: new ObjectId(match._id) },
      {
        $set: {
          "runStatus.stage": stage,
          ...(message && { "runStatus.log": (match.runStatus?.log ?? "") + message + "\n" }),
        },
      },
    );
  }

  async prepareGameServer(game: Game) {
    const serverBuildPath = path.join(MatchExecutor.getGamePath(game._id), "server", "build");
    return prepareProgram(serverBuildPath, game.server, "server");
  }

  async prepareBot(botId: string) {
    const bot = new Bot(await this.mongoDb.collection("Bot").findOne(new ObjectId(botId)));
    if (!bot.source)
      throw new AssertException({
        message: "MatchService.prepareBot: bot has no source code (check the upload request)",
        values: { id: bot._id },
      });
    const botBuildPath = path.join(getBotPath(botId), "build");
    const { runCommand, programPath } = await prepareProgram(botBuildPath, bot.source, "bot");
    return { runCommand, programPath };
  }
}
