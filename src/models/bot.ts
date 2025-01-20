import { field, ID, inputType, objectType } from "@loopback/graphql";
import { belongsTo, Entity, Model, model, property } from "@loopback/repository";
import { createAuthErrorUnionType, GraphqlError } from "./auth";
import { User, UserWithRelations } from "./user";
import { Game, GameWithRelations } from "./game";
import { GqlValue } from "../../shared/common";
import { File } from "./base";
import { createUnionType, registerEnumType } from "type-graphql";
import {
  Action,
  AuthorizationService,
  ResourceCollection,
} from "../services/authorization.service";
import { BotService } from "../services/bot.service";
import { BotRepository } from "../repositories/bot.repository";
import { UserService } from "../services/user.service";
import { AiArenaGraphqlContext } from "../graphql-resolvers/graphql-context-resolver.provider";
import { ValidationError } from "../../shared/errors";

export enum BotSubmitStage {
  REGISTERED = "REGISTERED",
  SOURCE_UPLOAD_DONE = "SOURCE_UPLOAD_DONE",
  SOURCE_UPLOAD_ERROR = "SOURCE_UPLOAD_ERROR",
  CHECK_SUCCESS = "CHECK_SUCCESS",
  CHECK_ERROR = "CHECK_ERROR",
}

registerEnumType(BotSubmitStage, {
  name: "BotSubmitStage",
});

@objectType()
@model()
export class BotSubmitStatus extends Model {
  @field(() => BotSubmitStage)
  @property()
  stage: BotSubmitStage;

  @field({ nullable: true })
  @property()
  log?: string;
}

@objectType()
@model()
export class Bot extends Entity {
  static async create(
    context: AiArenaGraphqlContext & { actor: User },
    botInput: BotInput,
    authorizationService: AuthorizationService,
    botRepository: BotRepository,
  ) {
    await authorizationService.authorize(context.actor, Action.CREATE, botInput);
    return botRepository.validateAndCreate(context.actor, botInput);
  }

  static async getBots(
    context: AiArenaGraphqlContext & { actor: User },
    gameId: string,
    includeTestBots: boolean,
    authorizationService: AuthorizationService,
    botRepository: BotRepository,
    userService: UserService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, ResourceCollection.BOTS);
    const systemUser = await userService.getSystemUser();
    const userIds = includeTestBots ? [context.actor.id, systemUser.id] : [context.actor.id];
    return (
      await botRepository.find({
        where: { gameId, userId: { inq: userIds } },
      })
    ).sort((a, b) => {
      if ((a.userId === systemUser.id) === (b.userId === systemUser.id))
        return a.name.localeCompare(b.name);
      return a.userId === systemUser.id ? 1 : -1;
    });
  }

  static async getBot(
    context: AiArenaGraphqlContext,
    id: string,
    authorizationService: AuthorizationService,
  ) {
    const bot = await context.loaders.bot.load(id);
    await authorizationService.authorize(context.actor, Action.READ, bot);
    return bot;
  }

  static async delete(
    context: AiArenaGraphqlContext,
    id: string,
    authorizationService: AuthorizationService,
    botRepository: BotRepository,
    botService: BotService,
  ) {
    const bot = await botRepository.findOne({ where: { id } });
    await authorizationService.authorize(context.actor, Action.DELETE, bot);
    if (!(await botService.canDeleteBot(id)))
      throw new ValidationError({
        message: "The bot is registered to an in-progress contest. Unregister before deleting.",
      });
    context.loaders.bot.clear(id);
    await botService.deleteBotBuild(id);
    await botRepository.deleteById(id);
  }

  @field(() => ID)
  @property({ id: true, type: "string", mongodb: { dataType: "ObjectId" } })
  id: string;

  async getIdAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "id");
    return this.id;
  }

  @belongsTo(() => User, {}, { type: "string", mongodb: { dataType: "ObjectId" } })
  userId: string;

  async getUserAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "user");
    return context.loaders.user.load(this.userId);
  }

  @belongsTo(() => Game, {}, { type: "string", mongodb: { dataType: "ObjectId" } })
  gameId: string;

  async getGameAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "game");
    return context.loaders.game.load(this.userId);
  }

  @field()
  @property()
  name: string;

  async getNameAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "name");
    return this.name;
  }

  @field()
  @property()
  submitStatus: BotSubmitStatus;

  async getSubmitStatusAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "submitStatus");
    return this.submitStatus;
  }

  @field({ nullable: true })
  @property()
  source?: File;

  async getSourceAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "source");
    return this.source;
  }

  @property()
  versionNumber: number;
}

export interface BotRelations {
  user: UserWithRelations;
  game: GameWithRelations;
}

export type BotWithRelations = Bot & BotRelations;

@inputType()
export class BotInput {
  @field()
  name: string;

  @field()
  gameId: string;
}

@objectType()
export class BotWithUploadLink {
  @field()
  bot: Bot;

  @field()
  uploadLink: string;
}

@objectType()
export class CreateBotFieldErrors {
  @field(() => [String], { nullable: true })
  name?: string[];
  @field(() => [String], { nullable: true })
  gameId?: string[];
}

@objectType({ implements: GraphqlError })
export class CreateBotError extends GraphqlError {
  @field()
  fieldErrors: CreateBotFieldErrors;
}

export const CreateBotResponse = createAuthErrorUnionType(
  "CreateBotResponse",
  [BotWithUploadLink, CreateBotError],
  (value: unknown) =>
    (value as GqlValue).__typename === "BotWithUploadLink"
      ? "BotWithUploadLink"
      : (value as GqlValue).__typename === "CreateBotError"
        ? "CreateBotError"
        : undefined,
);

@objectType()
export class Bots {
  @field(() => [Bot])
  bots: Bot[];
}

export const BotResponse = createAuthErrorUnionType("BotResponse", [Bot], (value: unknown) =>
  (value as GqlValue).__typename === "Bot" ? "Bot" : undefined,
);

export const BotsResponse = createAuthErrorUnionType("BotsResponse", [Bots], (value: unknown) =>
  (value as GqlValue).__typename === "Bots" ? "Bots" : undefined,
);

@objectType()
export class DeletedBot {
  @field(() => ID)
  id: string;
}

export const BotOrDeleted = createUnionType({
  name: "BotOrDeleted",
  types: () => [Bot, DeletedBot] as const,
  resolveType: (value: unknown) => (value as GqlValue).__typename,
});
