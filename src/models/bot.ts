import { field, ID, inputType, objectType } from "@loopback/graphql";
import { belongsTo, Entity, Model, model, property } from "@loopback/repository";
import { createAuthErrorUnionType, GraphqlError } from "./auth";
import { User, UserWithRelations } from "./user";
import { Game, GameWithRelations } from "./game";
import { GqlValue } from "../common";
import { File } from "./base";
import { createUnionType, registerEnumType } from "type-graphql";
import {
  Action,
  Actor,
  AuthorizationService,
  ResourceCollection,
} from "../services/authorization.service";
import { BotService } from "../services/bot.service";
import { GameRepository } from "../repositories/game.repository";
import { BotRepository } from "../repositories/bot.repository";
import { UserRepository } from "../repositories/user.repository";
import { UserService } from "../services/user.service";

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
    actor: User,
    botInput: BotInput,
    authorizationService: AuthorizationService,
    botRepository: BotRepository,
  ) {
    await authorizationService.authorize(actor, Action.CREATE, botInput);
    return botRepository.validateAndCreate(actor, botInput);
  }

  static async getBots(
    actor: User,
    gameId: string,
    includeTestBots: boolean,
    authorizationService: AuthorizationService,
    botRepository: BotRepository,
    userService: UserService,
  ) {
    await authorizationService.authorize(actor, Action.READ, ResourceCollection.BOTS);
    const systemUser = await userService.getSystemUser();
    const userIds = includeTestBots ? [actor.id, systemUser.id] : [actor.id];
    return (
      await botRepository.find({
        where: { gameId, userId: { inq: userIds }, deleted: { neq: true } },
      })
    ).sort((a, b) => {
      if ((a.userId === systemUser.id) === (b.userId === systemUser.id))
        return a.name.localeCompare(b.name);
      return a.userId === systemUser.id ? 1 : -1;
    });
  }

  static async getBot(
    actor: Actor,
    id: string,
    authorizationService: AuthorizationService,
    botRepository: BotRepository,
  ) {
    return botRepository.findOne({ where: { id } });
  }

  static async delete(
    actor: Actor,
    id: string,
    authorizationService: AuthorizationService,
    botRepository: BotRepository,
    botService: BotService,
  ) {
    const bot = await botRepository.findOne({ where: { id } });
    await authorizationService.authorize(actor, Action.DELETE, bot);
    await botService.deleteBotBuild(id);
    if (!(await botService.tryDeleteBot(id))) {
      await botRepository.updateById(id, { deleted: true });
    }
  }

  @field(() => ID)
  @property({ id: true, type: "string", mongodb: { dataType: "ObjectId" } })
  id: string;

  async getIdAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "id");
    return this.id;
  }

  @belongsTo(() => User, {}, { type: "string", mongodb: { dataType: "ObjectId" } })
  userId: string;

  async getUserAuthorized(
    actor: Actor,
    authorizationService: AuthorizationService,
    userRepository: UserRepository,
  ) {
    await authorizationService.authorize(actor, Action.READ, this, "user");
    return userRepository.findById(this.userId);
  }

  @belongsTo(() => Game, {}, { type: "string", mongodb: { dataType: "ObjectId" } })
  gameId: string;

  async getGameAuthorized(
    actor: Actor,
    authorizationService: AuthorizationService,
    gameRepository: GameRepository,
  ) {
    await authorizationService.authorize(actor, Action.READ, this, "game");
    return gameRepository.findById(this.userId);
  }

  @field()
  @property()
  name: string;

  async getNameAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "name");
    return this.name;
  }

  @field()
  @property()
  submitStatus: BotSubmitStatus;

  async getSubmitStatusAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "submitStatus");
    return this.submitStatus;
  }

  @field()
  @property()
  deleted: boolean;

  async getDeletedAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "deleted");
    return this.deleted;
  }

  @property()
  source?: File;

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
  @field(() => [String!], { nullable: true })
  name?: string[];
  @field(() => [String!], { nullable: true })
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
