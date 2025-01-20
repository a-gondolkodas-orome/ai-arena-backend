import { createClient } from "@redis/client";
import {
  botCheckResultCodec,
  botCheckWorkCodec,
  EXECUTOR_SYSTEM,
  getBotPath,
  isErrorWithMessage,
  MONGODB_DATABASE,
  RedisKey,
} from "../../shared/common";
import { notNull, Time } from "../../shared/utils";
import { decodeJson } from "../../shared/codec";
import * as t from "io-ts";
import path from "path";
import { ObjectId } from "mongodb";
import * as mongodb from "mongodb";
import { Bot, BotSubmitStage } from "./models/bot";
import { AssertException } from "../../shared/errors";
import { prepareProgram } from "./prepare-program";

export class BotChecker {
  static async create(redisUrl: string, mongodbUrl: string) {
    const redisClient = createClient({
      url: redisUrl,
    });
    await redisClient.connect();
    console.log("BotChecker: Connected to Redis");
    const mongo = await mongodb.MongoClient.connect(mongodbUrl);
    console.log("BotChecker: Connected to MongoDB");
    const systemUserId = notNull(
      await mongo.db(MONGODB_DATABASE).collection("User").findOne({ username: EXECUTOR_SYSTEM }),
    )._id.toString();
    return new BotChecker(redisClient, mongo, systemUserId);
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
    console.log("Starting bot checker");
    for (;;) {
      const workMessage = await this.redis.brPop(
        RedisKey.WORK_QUEUE__BOT_CHECK,
        BotChecker.POP_TIMEOUT,
      );
      if (workMessage == null) continue;
      const work = decodeJson(botCheckWorkCodec, workMessage.element);
      console.log("BotChecker: work received", work);
      const botData = await this.mongoDb
        .collection("Bot")
        .findOne({ _id: new ObjectId(work.botId) });
      if (!botData) {
        console.error("BotChecker: bot not found", work);
        continue;
      }
      const bot = new Bot(botData);
      await this.checkBot(bot);
      console.log("BotChecker: work done", work);
      await this.redis.publish(
        work.callbackChannel,
        JSON.stringify(botCheckResultCodec.encode({ userId: bot.userId, botId: work.botId })),
      );
    }
  }

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

  async checkBot(bot: Bot) {
    try {
      if (!bot.source)
        throw new AssertException({
          message: "MatchService.checkBot: bot has no source code (check the upload request)",
          values: { id: bot._id },
        });
      const botBuildPath = path.join(getBotPath(bot._id), "build");
      const { buildLog } = await prepareProgram(botBuildPath, bot.source, "bot");
      await this.mongoDb.collection("Bot").updateOne(
        { _id: new ObjectId(bot._id) },
        {
          $set: {
            submitStatus: {
              stage: BotSubmitStage.CHECK_SUCCESS,
              log: (bot.submitStatus?.log ?? "") + (buildLog ?? ""),
            },
          },
        },
      );
    } catch (error: unknown) {
      const message = isErrorWithMessage(error) ? error.message : "Unknown error";
      await this.mongoDb.collection("Bot").updateOne(
        { _id: new ObjectId(bot._id) },
        {
          $set: {
            submitStatus: {
              stage: BotSubmitStage.CHECK_ERROR,
              log: (bot.submitStatus?.log ?? "") + message,
            },
          },
        },
      );
    }
  }
}
