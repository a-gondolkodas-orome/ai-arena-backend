import { field, ID, inputType, objectType } from "@loopback/graphql";
import { belongsTo, Entity, Model, model, property, referencesMany } from "@loopback/repository";
import { createAuthErrorUnionType, GraphqlError } from "./auth";
import { User } from "./user";
import { Game, GameWithRelations } from "./game";
import { GqlValue } from "../common";
import { Bot, BotOrDeleted, BotWithRelations } from "./bot";
import { registerEnumType } from "type-graphql";
import { UserWithRelations } from "@loopback/authentication-jwt";
import {
  Action,
  AuthorizationService,
  ResourceCollection,
} from "../services/authorization.service";
import { MatchRepository } from "../repositories/match.repository";
import { MatchService } from "../services/match.service";
import { AiArenaGraphqlContext } from "../graphql-resolvers/graphql-context-resolver.provider";
import * as mongodb from "mongodb";
import { ValidationError } from "../errors";

export enum MatchRunStage {
  REGISTERED = "REGISTERED",
  PREPARE_GAME_SERVER_DONE = "PREPARE_GAME_SERVER_DONE",
  PREPARE_GAME_SERVER_ERROR = "PREPARE_GAME_SERVER_ERROR",
  PREPARE_BOTS_DONE = "PREPARE_BOTS_DONE",
  PREPARE_BOTS_ERROR = "PREPARE_BOTS_ERROR",
  RUN_SUCCESS = "RUN_SUCCESS",
  RUN_ERROR = "RUN_ERROR",
}

registerEnumType(MatchRunStage, {
  name: "MatchRunStage",
});

@objectType()
@model()
export class MatchRunStatus extends Model {
  @field(() => MatchRunStage)
  @property()
  stage: MatchRunStage;

  @field({ nullable: true })
  @property()
  log: string;
}

@objectType()
@model()
export class Match extends Entity {
  static async create(
    context: AiArenaGraphqlContext & { actor: User },
    matchInput: MatchInput,
    authorizationService: AuthorizationService,
    matchRepository: MatchRepository,
    matchService: MatchService,
  ) {
    await authorizationService.authorize(context.actor, Action.CREATE, matchInput);
    const match = await matchRepository.validateAndCreate(context.actor, matchInput);
    matchService.runMatch(match).catch((e) => console.error(e)); // TODO improve logging
    return match;
  }

  static async getMatches(
    context: AiArenaGraphqlContext & { actor: User },
    gameId: string,
    authorizationService: AuthorizationService,
    matchRepository: MatchRepository,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, ResourceCollection.MATCHES);
    return matchRepository.find({
      where: { gameId, userId: context.actor.id },
    });
  }

  static async getMatch(
    context: AiArenaGraphqlContext,
    id: string,
    authorizationService: AuthorizationService,
  ) {
    const match = await context.loaders.match.load(id);
    await authorizationService.authorize(context.actor, Action.READ, match);
    return match;
  }

  static async delete(
    context: AiArenaGraphqlContext,
    id: string,
    authorizationService: AuthorizationService,
    matchRepository: MatchRepository,
    matchService: MatchService,
  ) {
    const match = await matchRepository.findOne({ where: { id }, include: ["bots"] });
    await authorizationService.authorize(context.actor, Action.DELETE, match);
    if (match === null)
      throw new ValidationError({
        message: "Match not found",
      });
    context.loaders.match.clear(id);
    await matchService.deleteMatchBuild(id);
    await matchRepository.deleteById(id);
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
    return context.loaders.game.load(this.gameId);
  }

  @field()
  @property()
  mapName: string;

  async getMapNameAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "mapName");
    return this.mapName;
  }

  @referencesMany(() => Bot)
  botIds: string[];

  // noinspection DuplicatedCode
  async getBotsAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "bots");
    const botsById = new Map(
      (await context.loaders.bot.loadMany(this.botIds))
        .filter((bot) => bot)
        .map((bot) => {
          if (bot instanceof Error) throw bot;
          return [bot.id, bot];
        }),
    );
    return this.botIds.map<typeof BotOrDeleted>((botId) => {
      const bot = botsById.get(botId);
      return bot
        ? Object.assign(bot, { __typename: "Bot" })
        : { __typename: "DeletedBot", id: botId };
    });
  }

  @field()
  @property()
  runStatus: MatchRunStatus;

  async getRunStatusAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "runStatus");
    return this.runStatus;
  }

  @field(() => String, { nullable: true })
  get logBase64() {
    return this.log?.file?.toString("base64");
  }

  get logSize() {
    const logFile = this.log?.file;
    if (!logFile) return 0;
    if (logFile instanceof mongodb.Binary) return logFile.buffer.byteLength; // stupidLoopback: the stored Binary isn't converted back to Buffer automatically :(
    return logFile.length;
  }

  @property()
  log?: {
    file: Buffer;
    fileName: string;
  };

  async getLogBase64Authorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "logBase64");
    return this.logBase64;
  }

  @property()
  @field({ nullable: true })
  scoreJson?: string;

  async getScoreJsonAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "scoreJson");
    return this.scoreJson;
  }
}

export interface MatchRelations {
  user: UserWithRelations;
  game: GameWithRelations;
  bots: BotWithRelations[];
}

export type MatchWithRelations = Match & MatchRelations;

@inputType()
export class MatchInput {
  @field()
  gameId: string;

  @field()
  mapName: string;

  @field(() => [String])
  botIds: string[];
}

@objectType()
export class CreateMatchFieldErrors {
  @field(() => [String!], { nullable: true })
  gameId?: string[];
  @field(() => [String!], { nullable: true })
  mapName?: string[];
  @field(() => [String!], { nullable: true })
  botIds?: string[];
}

@objectType({ implements: GraphqlError })
export class CreateMatchError extends GraphqlError {
  @field()
  fieldErrors: CreateMatchFieldErrors;
}

export const CreateMatchResponse = createAuthErrorUnionType(
  "CreateMatchResponse",
  [Match, CreateMatchError],
  (value: unknown) =>
    (value as GqlValue).__typename === "Match"
      ? "Match"
      : (value as GqlValue).__typename === "CreateMatchError"
      ? "CreateMatchError"
      : undefined,
);

@objectType()
export class Matches {
  @field(() => [Match])
  matches: Match[];
}

export const MatchesResponse = createAuthErrorUnionType(
  "MatchesResponse",
  [Matches],
  (value: unknown) => ((value as GqlValue).__typename === "Matches" ? "Matches" : undefined),
);

export const MatchResponse = createAuthErrorUnionType("MatchResponse", [Match], (value: unknown) =>
  (value as GqlValue).__typename === "Match" ? "Match" : undefined,
);
