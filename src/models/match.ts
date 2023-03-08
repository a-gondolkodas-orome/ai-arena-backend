import { field, ID, inputType, objectType } from "@loopback/graphql";
import { belongsTo, Entity, model, property, referencesMany } from "@loopback/repository";
import { createAuthErrorUnionType, GraphqlError } from "./auth";
import { User } from "./user";
import { Game, GameWithRelations } from "./game";
import { GqlValue } from "../utils";
import { Bot, BotWithRelations } from "./bot";
import { registerEnumType } from "type-graphql";
import { UserWithRelations } from "@loopback/authentication-jwt";
import { Action, Actor, AuthorizationService, MatchService, ResourceCollection } from "../services";
import { BotRepository, GameRepository, MatchRepository, UserRepository } from "../repositories";

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
export class MatchRunStatus {
  @field(() => MatchRunStage)
  @property()
  stage: MatchRunStage;

  @field({ nullable: true })
  @property()
  log: string;
}

@objectType()
export class MatchResult {
  @field()
  log: string;
}

@objectType()
@model()
export class Match extends Entity {
  static async create(
    actor: User,
    matchInput: MatchInput,
    authorizationService: AuthorizationService,
    matchRepository: MatchRepository,
    matchService: MatchService,
  ) {
    await authorizationService.authorize(actor, Action.CREATE, matchInput);
    const match = await matchRepository.validateAndCreate(actor, matchInput);
    matchService.runMatch(match).catch((e) => console.error(e)); // TODO improve logging
    return match;
  }

  static async getMatches(
    actor: User,
    gameId: string,
    authorizationService: AuthorizationService,
    matchRepository: MatchRepository,
  ) {
    await authorizationService.authorize(actor, Action.READ, ResourceCollection.MATCHES);
    return matchRepository.find({
      where: { gameId, userId: actor.id },
    });
  }

  static async getMatch(
    actor: Actor,
    id: string,
    authorizationService: AuthorizationService,
    matchRepository: MatchRepository,
  ) {
    return matchRepository.findOne({ where: { id } });
  }

  static async delete(
    actor: Actor,
    id: string,
    authorizationService: AuthorizationService,
    matchRepository: MatchRepository,
    matchService: MatchService,
  ) {
    const match = await matchRepository.findOne({ where: { id } });
    await authorizationService.authorize(actor, Action.DELETE, match);
    await matchService.deleteMatch(id);
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

  @referencesMany(() => Bot)
  botIds: string[];

  async getBotsAuthorized(
    actor: Actor,
    authorizationService: AuthorizationService,
    botRepository: BotRepository,
  ) {
    await authorizationService.authorize(actor, Action.READ, this, "bots");
    return botRepository.find({ where: { id: { inq: this.botIds } } });
  }

  @field()
  @property()
  runStatus: MatchRunStatus;

  async getRunStatusAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "runStatus");
    return this.runStatus;
  }

  get result() {
    return this.log && { __typename: "MatchResult", log: this.log.file.toString() };
  }

  async getResultAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "result");
    return this.result;
  }

  @property()
  log:
    | {
        file: Buffer;
        fileName: string;
      }
    | undefined;
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

  @field(() => [String])
  botIds: string[];
}

@objectType()
export class CreateMatchFieldErrors {
  @field(() => [String!], { nullable: true })
  gameId?: string[];
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
      ? Match
      : (value as GqlValue).__typename === "CreateMatchError"
      ? CreateMatchError
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
  (value: unknown) => ((value as GqlValue).__typename === "Matches" ? Matches : undefined),
);

export const MatchResponse = createAuthErrorUnionType("MatchResponse", [Match], (value: unknown) =>
  (value as GqlValue).__typename === "Match" ? Match : undefined,
);
