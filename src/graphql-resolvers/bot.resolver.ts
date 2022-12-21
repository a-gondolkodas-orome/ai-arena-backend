import { inject } from "@loopback/core";
import {
  arg,
  fieldResolver,
  GraphQLBindings,
  mutation,
  query,
  resolver,
  ResolverData,
  ResolverInterface,
  root,
} from "@loopback/graphql";
import { repository } from "@loopback/repository";
import { AddBotResponse, Bot, BotInput, BotsResponse } from "../models/bot";
import { BotRepository, GameRepository, UserRepository } from "../repositories";
import { BaseResolver } from "./base.resolver";
import { AuthError, handleAuthErrors } from "../models/auth";
import { ValidationError, validationErrorCodec } from "../errors";
import * as t from "io-ts";
import { AiArenaBindings } from "../keys";
import { BotService } from "../services";

@resolver((of) => Bot)
export class BotResolver extends BaseResolver implements ResolverInterface<Bot> {
  constructor(
    @repository("BotRepository") protected botRepository: BotRepository,
    @repository("UserRepository") protected userRepository: UserRepository,
    @repository("GameRepository") protected gameRepository: GameRepository,
    @inject(AiArenaBindings.BOT_SERVICE) protected botService: BotService,
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    super(resolverData);
  }

  @query((returns) => BotsResponse)
  async getBots(@arg("gameId") gameId: string): Promise<typeof BotsResponse> {
    return handleAuthErrors(async () => ({
      __typename: "Bots",
      bots: await this.botRepository.getUserBots(this.executor, {
        where: { gameId },
      }),
    }));
  }

  @mutation((returns) => AddBotResponse)
  async createBot(@arg("bot") botInput: BotInput): Promise<typeof AddBotResponse> {
    return handleAuthErrors(async () => {
      try {
        const bot = await this.botRepository.create(this.executor, botInput);
        return {
          __typename: "BotWithUploadLink",
          bot,
          uploadLink: await this.botService.getBotSourceUploadLink(bot),
        };
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
            __typename: "AddBotError",
            message: error.data.message,
            fieldErrors: (error.data as t.TypeOf<typeof validationErrorCodec>).fieldErrors,
          };
        }
        throw error;
      }
    });
  }

  @mutation((returns) => AuthError, { nullable: true })
  async deleteBot(@arg("botId") botId: string) {
    return handleAuthErrors(async () => {
      await this.botService.deleteBot(this.executor, botId);
    });
  }

  @fieldResolver()
  async user(@root() bot: Bot) {
    return this.userRepository.findById(this.executor, bot.userId);
  }

  @fieldResolver()
  async game(@root() bot: Bot) {
    return this.gameRepository.findById(this.executor, bot.gameId);
  }
}
