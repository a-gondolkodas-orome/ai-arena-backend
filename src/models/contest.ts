import { field, ID, inputType, objectType } from "@loopback/graphql";
import { belongsTo, Entity, model, property, referencesMany } from "@loopback/repository";
import { createAuthErrorUnionType, GraphqlError } from "./auth";
import { Game, GameWithRelations } from "./game";
import { User } from "./user";
import { Bot, BotWithRelations } from "./bot";
import { Match, MatchWithRelations } from "./match";
import { registerEnumType } from "type-graphql";
import { GqlValue } from "../utils";
import { UserWithRelations } from "@loopback/authentication-jwt";
import {
  Action,
  Actor,
  AuthorizationService,
  ResourceCollection,
} from "../services/authorization.service";
import { BotRepository, GameRepository, MatchRepository, UserRepository } from "../repositories";
import { ContestRepository } from "../repositories/contest.repository";

export enum ContestStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  RUNNING = "RUNNING",
  FINISHED = "FINISHED",
}

registerEnumType(ContestStatus, {
  name: "ContestStatus",
});

@objectType()
@model()
export class Contest extends Entity {
  static async create(
    actor: User,
    contestInput: ContestInput,
    authorizationService: AuthorizationService,
    contestRepository: ContestRepository,
  ) {
    await authorizationService.authorize(actor, Action.CREATE, contestInput);
    return contestRepository.validateAndCreate(actor, contestInput);
  }

  static async getContests(
    actor: Actor,
    authorizationService: AuthorizationService,
    contestRepository: ContestRepository,
  ) {
    await authorizationService.authorize(actor, Action.READ, ResourceCollection.CONTESTS);
    return contestRepository.find();
  }

  static async getContest(
    actor: Actor,
    id: string,
    authorizationService: AuthorizationService,
    contestRepository: ContestRepository,
  ) {
    const contest = await contestRepository.findOne({
      where: { id },
    });
    if (contest) await authorizationService.authorize(actor, Action.READ, contest);
    return contest;
  }

  @field(() => ID)
  @property({ id: true, type: "string", mongodb: { dataType: "ObjectId" } })
  id: string;

  async getIdAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "id");
    return this.id;
  }

  @belongsTo(() => Game, {}, { type: "string", mongodb: { dataType: "ObjectId" } })
  gameId: string;

  async getGameAuthorized(
    actor: Actor,
    authorizationService: AuthorizationService,
    gameRepository: GameRepository,
  ) {
    await authorizationService.authorize(actor, Action.READ, this, "game");
    return gameRepository.findById(this.gameId);
  }

  @belongsTo(() => User, {}, { type: "string", mongodb: { dataType: "ObjectId" } })
  ownerId: string;

  async getOwnerAuthorized(
    actor: Actor,
    authorizationService: AuthorizationService,
    userRepository: UserRepository,
  ) {
    await authorizationService.authorize(actor, Action.READ, this, "owner");
    return userRepository.findById(this.ownerId);
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
  date: Date;

  async getDateAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "date");
    return this.date;
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

  @referencesMany(() => Match, { name: "matches" })
  matchIds: string[];

  async getMatchesAuthorized(
    actor: Actor,
    authorizationService: AuthorizationService,
    matchRepository: MatchRepository,
  ) {
    await authorizationService.authorize(actor, Action.READ, this, "matches");
    return matchRepository.find({ where: { id: { inq: this.matchIds } } });
  }

  @field()
  @property()
  status: ContestStatus;

  async getStatusAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "status");
    return this.status;
  }
}

export interface ContestRelations {
  game: GameWithRelations;
  owner: UserWithRelations;
  bots: BotWithRelations[];
  matches: MatchWithRelations[];
}

export type ContestWithRelations = Contest & ContestRelations;

@inputType()
export class ContestInput {
  @field()
  gameId: string;

  @field()
  name: string;

  @field()
  date: Date;
}

export const ContestResponse = createAuthErrorUnionType(
  "ContestResponse",
  [Contest],
  (value: unknown) => ((value as GqlValue).__typename === "Contest" ? Contest : undefined),
);

@objectType()
export class Contests {
  @field(() => [Contest])
  contests: Contest[];
}

@objectType()
export class CreateContestFieldErrors {
  @field(() => [String!], { nullable: true })
  gameId?: string[];
  @field(() => [String!], { nullable: true })
  name?: string[];
  @field(() => [String!], { nullable: true })
  date?: string[];
}

@objectType({ implements: GraphqlError })
export class CreateContestError extends GraphqlError {
  @field()
  fieldErrors: CreateContestFieldErrors;
}

export const ContestsResponse = createAuthErrorUnionType(
  "ContestsResponse",
  [Contests],
  (value: unknown) => ((value as GqlValue).__typename === "Contests" ? Contests : undefined),
);

export const CreateContestResponse = createAuthErrorUnionType(
  "CreateContestResponse",
  [Contest, CreateContestError],
  (value: unknown) =>
    (value as GqlValue).__typename === "Contest"
      ? Contest
      : (value as GqlValue).__typename === "CreateContestError"
      ? CreateContestError
      : undefined,
);
