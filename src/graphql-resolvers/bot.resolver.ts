import { inject, service } from "@loopback/core";
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
import { CreateBotResponse, Bot, BotInput, BotResponse, BotsResponse } from "../models/bot";
import { BaseResolver } from "./base.resolver";
import { AuthError, handleAuthErrors } from "../models/auth";
import { ValidationError, validationErrorCodec } from "../errors";
import * as t from "io-ts";
import { User } from "../models/user";
import { Game } from "../models/game";
import { AuthorizationService } from "../services/authorization.service";
import { BotService } from "../services/bot.service";
import { GameRepository } from "../repositories/game.repository";
import { BotRepository } from "../repositories/bot.repository";
import { UserRepository } from "../repositories/user.repository";
import { UserService } from "../services/user.service";

@resolver(() => Bot)
export class BotResolver extends BaseResolver implements ResolverInterface<Bot> {
  constructor(
    @service() protected authorizationService: AuthorizationService,
    @service() protected botService: BotService,
    @service() protected userService: UserService,
    @repository(BotRepository) protected botRepository: BotRepository,
    @repository(UserRepository) protected userRepository: UserRepository,
    @repository(GameRepository) protected gameRepository: GameRepository,
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    super(resolverData);
  }

  @mutation(() => CreateBotResponse)
  async createBot(@arg("bot") botInput: BotInput): Promise<typeof CreateBotResponse> {
    return handleAuthErrors(async () => {
      try {
        const bot = await Bot.create(
          this.actor,
          botInput,
          this.authorizationService,
          this.botRepository,
        );
        return {
          __typename: "BotWithUploadLink",
          bot,
          uploadLink: await this.botService.getBotSourceUploadLink(bot),
        };
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
            __typename: "CreateBotError",
            message: error.data.message,
            fieldErrors: (error.data as t.TypeOf<typeof validationErrorCodec>).fieldErrors,
          };
        }
        throw error;
      }
    });
  }

  @query(() => BotsResponse)
  async getBots(
    @arg("gameId") gameId: string,
    @arg("includeTestBots") includeTestBots: boolean,
  ): Promise<typeof BotsResponse> {
    return handleAuthErrors(async () => ({
      __typename: "Bots",
      bots: await Bot.getBots(
        this.actor,
        gameId,
        includeTestBots,
        this.authorizationService,
        this.botRepository,
        this.userService,
      ),
    }));
  }

  @query(() => BotResponse, { nullable: true })
  async getBot(@arg("id") id: string) {
    return handleAuthErrors(async () => {
      const bot = await Bot.getBot(this.actor, id, this.authorizationService, this.botRepository);
      return bot ? Object.assign(bot, { __typename: "Bot" }) : null;
    });
  }

  @mutation(() => AuthError, { nullable: true })
  async deleteBot(@arg("id") id: string) {
    return handleAuthErrors(async () =>
      Bot.delete(this.actor, id, this.authorizationService, this.botRepository, this.botService),
    );
  }

  @fieldResolver()
  async id(@root() bot: Bot) {
    return bot.getIdAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver(() => User)
  async user(@root() bot: Bot) {
    return bot.getUserAuthorized(this.actor, this.authorizationService, this.userRepository);
  }

  @fieldResolver(() => Game)
  async game(@root() bot: Bot) {
    return bot.getGameAuthorized(this.actor, this.authorizationService, this.gameRepository);
  }

  @fieldResolver()
  async name(@root() bot: Bot) {
    return bot.getNameAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver()
  async submitStatus(@root() bot: Bot) {
    return bot.getSubmitStatusAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver()
  async deleted(@root() bot: Bot) {
    return bot.getDeletedAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver({ nullable: true })
  async source(@root() bot: Bot) {
    return bot.getSourceAuthorized(this.actor, this.authorizationService);
  }
}
