import { injectable, BindingScope, service } from "@loopback/core";
import { Bot } from "../models/bot";
import { JwtService } from "./jwt.service";
import * as t from "io-ts";
import { repository } from "@loopback/repository";
import { AuthorizationError } from "../errors";
import fsp from "fs/promises";
import EventEmitter from "events";
import path from "path";
import { BotRepository } from "../repositories/bot.repository";
import { MatchRepository } from "../repositories/match.repository";
import { ContestRepository } from "../repositories/contest.repository";

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

  static getBotPath(botId: string) {
    return path.resolve("container", "bots", botId);
  }

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

  async deleteBotBuild(botId: string) {
    await fsp.rm(BotService.getBotPath(botId), { recursive: true, force: true });
  }

  async tryDeleteBot(id: string) {
    if (
      (await this.matchRepository.count({ botIds: id as string[] & string })).count ||
      (await this.contestRepository.count({ botIds: id as string[] & string })).count
    )
      return false;
    await this.botRepository.deleteById(id);
    return true;
  }

  sse = new EventEmitter();
}
