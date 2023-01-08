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
import { inject, intercept } from "@loopback/core";
import { repository } from "@loopback/repository";
import { BotRepository } from "../repositories";
import { AiArenaBindings } from "../keys";
import { BotService, MatchService } from "../services";
import { HttpStatusCode } from "../errors";
import { BotSubmitStage } from "../models/bot";

const multerInterceptor = toInterceptor(
  multer({ storage: multer.memoryStorage() }).single("sourceFile"),
);

export class BotController {
  static readonly ENDPOINT_PREFIX__UPLOAD_BOT_SOURCE = "/bot-source";
  static readonly SOURCE_FILE_MAX_SIZE = 1000000;

  constructor(
    @inject(AiArenaBindings.BOT_SERVICE) protected botService: BotService,
    @inject(AiArenaBindings.MATCH_SERVICE) protected matchService: MatchService,
    @repository("BotRepository") protected botRepository: BotRepository,
    @inject(RestBindings.Http.RESPONSE) protected response: Response,
  ) {}

  @post(`${BotController.ENDPOINT_PREFIX__UPLOAD_BOT_SOURCE}/{token}`, {
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
    if (!request.executor) {
      this.response.status(HttpStatusCode.HTTP_401_UNAUTHORIZED);
      return;
    }
    const userId = request.executor.id;
    const tokenData = await this.botService.verifyBotSourceUploadToken(token);
    const bot = await this.botRepository.findById(request.executor, tokenData.bot.id);
    const handleUploadError = async (message: string) => {
      this.response.statusMessage = message;
      this.response.status(HttpStatusCode.HTTP_400_BAD_REQUEST).send();
      await this.botRepository.update(request.executor, {
        id: tokenData.bot.id,
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

    await this.botRepository.update(request.executor, {
      id: tokenData.bot.id,
      source: {
        fileName: request.file.originalname,
        file: request.file.buffer,
      },
      submitStatus: {
        stage: BotSubmitStage.SOURCE_UPLOAD_SUCCESS,
        log: bot.submitStatus.log,
      },
    });
    this.response.status(HttpStatusCode.HTTP_201_CREATED).send();
    this.matchService
      .checkBot(request.executor, tokenData.bot.id)
      .catch((error) => console.error(error));
    return this.response;
  }
}
