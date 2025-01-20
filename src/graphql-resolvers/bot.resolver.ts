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
import { handleAuthErrors } from "../models/auth";
import { ValidationError, validationErrorCodec } from "../../shared/errors";
import * as t from "io-ts";
import { User } from "../models/user";
import { Game } from "../models/game";
import { AuthorizationService } from "../services/authorization.service";
import { BotService } from "../services/bot.service";
import { BotRepository } from "../repositories/bot.repository";
import { UserService } from "../services/user.service";
import { ValidatedNoContentResponse } from "../models/base";

@resolver(() => Bot)
export class BotResolver extends BaseResolver implements ResolverInterface<Bot> {
  constructor(
    @service() protected authorizationService: AuthorizationService,
    @service() protected botService: BotService,
    @service() protected userService: UserService,
    @repository(BotRepository) protected botRepository: BotRepository,
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    super(resolverData);
  }

  @mutation(() => CreateBotResponse)
  async createBot(@arg("bot") botInput: BotInput): Promise<typeof CreateBotResponse> {
    return handleAuthErrors(async () => {
      try {
        const bot = await Bot.create(
          this.context,
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
        this.context,
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
      const bot = await Bot.getBot(this.context, id, this.authorizationService);
      return bot ? Object.assign(bot, { __typename: "Bot" }) : null;
    });
  }

  @mutation(() => ValidatedNoContentResponse, { nullable: true })
  async deleteBot(@arg("id") id: string) {
    return handleAuthErrors(async () => {
      try {
        await Bot.delete(
          this.context,
          id,
          this.authorizationService,
          this.botRepository,
          this.botService,
        );
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
            __typename: "GraphqlValidationError",
            message: error.data.message,
          };
        }
        throw error;
      }
    });
  }

  @fieldResolver()
  async id(@root() bot: Bot) {
    return bot.getIdAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver(() => User)
  async user(@root() bot: Bot) {
    return bot.getUserAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver(() => Game)
  async game(@root() bot: Bot) {
    return bot.getGameAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async name(@root() bot: Bot) {
    return bot.getNameAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async submitStatus(@root() bot: Bot) {
    return bot.getSubmitStatusAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async source(@root() bot: Bot) {
    return bot.getSourceAuthorized(this.context, this.authorizationService);
  }
}
