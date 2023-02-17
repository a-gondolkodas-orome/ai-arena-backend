import {
  param,
  post,
  requestBody,
  Request,
  Response,
  toInterceptor,
  RestBindings,
} from "@loopback/rest";
import multer from "multer";
import { inject, intercept, service } from "@loopback/core";
import { repository } from "@loopback/repository";
import { BotRepository } from "../repositories";
import { BotService, MatchService } from "../services";
import { HttpStatusCode } from "../errors";
import { BotSubmitStage } from "../models/bot";
import { Action, AuthorizationService } from "../services/authorization.service";

const multerInterceptor = toInterceptor(
  multer({ storage: multer.memoryStorage() }).single("sourceFile"),
);

export class BotController {
  static readonly SOURCE_FILE_MAX_SIZE = 1000000;

  constructor(
    @service() protected authorizationService: AuthorizationService,
    @service() protected botService: BotService,
    @service() protected matchService: MatchService,
    @repository("BotRepository") protected botRepository: BotRepository,
    @inject(RestBindings.Http.RESPONSE) protected response: Response,
  ) {}

  @post(`${BotService.ENDPOINT_PREFIX__UPLOAD_BOT_SOURCE}/{token}`, {
    parameters: [{ name: "token", schema: { type: "string" }, in: "path" }],
    responses: {
      "201": {
        description: "Source saved",
      },
      "401": {
        description: "Not authenticated",
      },
      "403": {
        description: "Not authorized",
      },
      "404": {
        description: "Invalid source file",
      },
    },
  })
  @intercept(multerInterceptor)
  async uploadBotSource(
    @param.path.string("token") token: string,
    @requestBody.file() request: Request,
  ) {
    if (!request.actor) {
      this.response.status(HttpStatusCode.HTTP_401_UNAUTHORIZED);
      return;
    }
    const tokenData = await this.botService.verifyBotSourceUploadToken(token);
    const bot = await this.botRepository.findById(tokenData.bot.id);
    await this.authorizationService.authorize(request.actor, Action.UPDATE, bot, "source");
    const userId = request.actor.id;
    const handleUploadError = async (message: string) => {
      this.response.statusMessage = message;
      this.response.status(HttpStatusCode.HTTP_400_BAD_REQUEST).send();
      await this.botRepository.updateById(tokenData.bot.id, {
        submitStatus: {
          stage: BotSubmitStage.SOURCE_UPLOAD_ERROR,
          log: (bot.submitStatus?.log ?? "") + message,
        },
      });
      this.botService.sse.emit(userId, { botUpdate: tokenData.bot.id });
      return this.response;
    };
    if (!request.file) return handleUploadError("source file not provided");
    if (request.file.size > BotController.SOURCE_FILE_MAX_SIZE)
      return handleUploadError("source file too big");

    await this.botRepository.updateById(tokenData.bot.id, {
      source: {
        fileName: request.file.originalname,
        file: request.file.buffer,
      },
      submitStatus: {
        stage: BotSubmitStage.SOURCE_UPLOAD_DONE,
        log: bot.submitStatus.log,
      },
    });
    this.response.status(HttpStatusCode.HTTP_201_CREATED).send();
    this.matchService.checkBot(tokenData.bot.id).catch((error) => console.error(error));
    return this.response;
  }
}
