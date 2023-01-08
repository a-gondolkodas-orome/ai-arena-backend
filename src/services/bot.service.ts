import { injectable, BindingScope, inject } from "@loopback/core";
import { Bot } from "../models/bot";
import { JwtService } from "./jwt.service";
import { AiArenaBindings } from "../keys";
import * as t from "io-ts";
import { BotController } from "../controllers";
import { repository } from "@loopback/repository";
import { BotRepository } from "../repositories";
import { AuthorizationError } from "../errors";
import { Executor } from "../authorization";
import fsp from "fs/promises";
import { MatchService } from "./match.service";
import EventEmitter from "events";

@injectable({ scope: BindingScope.SINGLETON })
export class BotService {
  static readonly botSourceUploadTokenCodec = t.type(
    {
      userId: t.string,
      bot: t.type({ id: t.string, versionNumber: t.number }),
    },
    "botSourceUploadTokenCodec",
  );

  constructor(
    @repository("BotRepository") protected botRepository: BotRepository,
    @inject(AiArenaBindings.JWT_SERVICE) protected jwtService: JwtService,
  ) {}

  async getBotSourceUploadLink(bot: Bot) {
    const newVersionNumber = bot.versionNumber + 1;
    await this.botRepository._systemAccess.updateById(bot.id, {
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
    return `${BotController.ENDPOINT_PREFIX__UPLOAD_BOT_SOURCE}/${token}`;
  }

  async verifyBotSourceUploadToken(token: string) {
    const tokenData = await this.jwtService.verifyUniversalToken(
      BotService.botSourceUploadTokenCodec,
      token,
    );
    const bot = await this.botRepository._systemAccess.findOne({
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

  async deleteBot(executor: Executor, botId: string) {
    await this.botRepository.deleteBot(executor, botId);
    await fsp.rm(MatchService.getBotPath(botId), { recursive: true, force: true });
  }

  sse = new EventEmitter();
}
