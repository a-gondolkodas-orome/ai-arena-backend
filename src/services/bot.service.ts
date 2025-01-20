import { injectable, BindingScope, service } from "@loopback/core";
import { Bot } from "../models/bot";
import { JwtService } from "./jwt.service";
import * as t from "io-ts";
import { repository } from "@loopback/repository";
import { AuthorizationError } from "../../shared/errors";
import fsp from "fs/promises";
import EventEmitter from "events";
import { BotRepository } from "../repositories/bot.repository";
import { MatchRepository } from "../repositories/match.repository";
import { ContestRepository } from "../repositories/contest.repository";
import { ContestStatus } from "../models/contest";
import { botCheckResultCodec, botCheckWorkCodec, getBotPath, RedisKey } from "../../shared/common";
import { createClient } from "@redis/client";
import { AiArenaBackendApplication } from "../application";
import { decodeJson } from "../../shared/codec";

@injectable({ scope: BindingScope.SINGLETON })
export class BotService {
  static readonly ENDPOINT_PREFIX__UPLOAD_BOT_SOURCE = "/bot-source";

  static readonly botSourceUploadTokenCodec = t.type(
    {
      userId: t.string,
      bot: t.type({ id: t.string, versionNumber: t.number }),
    },
    "botSourceUploadTokenCodec",
  );

  constructor(
    @repository(BotRepository) protected botRepository: BotRepository,
    @repository(MatchRepository) protected matchRepository: MatchRepository,
    @repository(ContestRepository) protected contestRepository: ContestRepository,
    @service() protected jwtService: JwtService,
  ) {}

  async getBotSourceUploadLink(bot: Bot) {
    const newVersionNumber = bot.versionNumber + 1;
    await this.botRepository.updateById(bot.id, {
      versionNumber: newVersionNumber,
    });
    const token = await this.jwtService.generateUniversalToken(
      BotService.botSourceUploadTokenCodec,
      {
        userId: bot.userId,
        bot: { id: bot.id, versionNumber: newVersionNumber },
      },
      { expiresIn: "5m" },
    );
    return `${BotService.ENDPOINT_PREFIX__UPLOAD_BOT_SOURCE}/${token}`;
  }

  async verifyBotSourceUploadToken(token: string) {
    const tokenData = await this.jwtService.verifyUniversalToken(
      BotService.botSourceUploadTokenCodec,
      token,
    );
    const bot = await this.botRepository.findOne({
      where: {
        id: tokenData.bot.id,
        versionNumber: tokenData.bot.versionNumber,
        userId: tokenData.userId,
      },
    });
    if (!bot) {
      throw new AuthorizationError({
        message: "No matching bot found for upload token",
      });
    }
    return tokenData;
  }

  protected redis?: ReturnType<typeof createClient>;
  protected subscriberRedis?: ReturnType<typeof createClient>;
  protected static readonly CALLBACK_CHANNEL = "BOT";

  async checkBot(botId: string) {
    if (!this.redis) {
      this.redis = createClient({
        url: AiArenaBackendApplication.config.redisUrl,
      });
      await this.redis.connect();
    }
    if (!this.subscriberRedis) {
      this.subscriberRedis = createClient({
        url: AiArenaBackendApplication.config.redisUrl,
      });
      await this.subscriberRedis.connect();
      await this.subscriberRedis.subscribe(BotService.CALLBACK_CHANNEL, (message) => {
        const { userId, botId: checkedBotId } = decodeJson(botCheckResultCodec, message);
        this.sse.emit(userId, { botUpdate: checkedBotId });
      });
    }
    await this.redis.lPush(
      RedisKey.WORK_QUEUE__BOT_CHECK,
      JSON.stringify(
        botCheckWorkCodec.encode({
          botId: botId,
          callbackChannel: BotService.CALLBACK_CHANNEL,
        }),
      ),
    );
  }

  async deleteBotBuild(botId: string) {
    await fsp.rm(getBotPath(botId), { recursive: true, force: true });
  }

  async canDeleteBot(id: string) {
    return !(
      await this.contestRepository.count({
        botIds: id as string[] & string,
        status: {
          inq: [
            ContestStatus.OPEN,
            ContestStatus.CLOSED,
            ContestStatus.RUNNING,
            ContestStatus.RUN_ERROR,
          ],
        },
      })
    ).count;
  }

  sse = new EventEmitter();
}
