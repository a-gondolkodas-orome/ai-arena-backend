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
import { BotService } from "../services";
import { HttpStatusCode, UserException } from "../errors";

const multerInterceptor = toInterceptor(
  multer({ storage: multer.memoryStorage() }).single("sourceFile"),
);

export class BotController {
  static readonly ENDPOINT_PREFIX__UPLOAD_BOT_SOURCE = "/bot-source";

  constructor(
    @inject(AiArenaBindings.BOT_SERVICE) protected botService: BotService,
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
    },
  })
  @intercept(multerInterceptor)
  async uploadBotSource(
    @param.path.string("token") token: string,
    @requestBody.file() request: Request,
  ) {
    const tokenData = await this.botService.verifyBotSourceUploadToken(token);
    if (!request.file) {
      throw new UserException({
        message: "uploadBotSource: source file not provided",
      });
    }
    await this.botRepository.update(request.executor, {
      id: tokenData.bot.id,
      source: {
        fileName: request.file.originalname,
        file: request.file.buffer,
      },
    });
    this.response.status(HttpStatusCode.HTTP_201_CREATED);
  }
}
