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
import { AssertException, ValidationError } from "../errors";

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
  static readonly EXCEPTION_CODE__CONTEST_NOT_FOUND = "CONTEST_NOT_FOUND";

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
    return contestRepository.findOne({ where: { id } });
  }

  static async register(
    actor: User,
    contestId: string,
    botId: string,
    authorizationService: AuthorizationService,
    contestRepository: ContestRepository,
    botRepository: BotRepository,
  ) {
    const contestIdErrors = [];
    const botIdErrors = [];
    const contest = await contestRepository.findOne({
      where: { id: contestId },
      include: ["bots"],
    });
    const bot = await botRepository.findOne({ where: { id: botId } });
    if (!contest) contestIdErrors.push("Contest not found.");
    if (!bot) botIdErrors.push("Bot not found.");
    if (!contest || !bot) {
      throw new ValidationError({
        fieldErrors: {
          ...(contestIdErrors.length && { contestId: contestIdErrors }),
          ...(botIdErrors.length && { botId: botIdErrors }),
        },
      });
    }
    await authorizationService.authorize(actor, Action.CONTEST_REGISTER, contest, undefined, bot);
    this.removeUserBotFromContest(actor, contest);
    contest.botIds.push(botId);
    // Navigational properties are not allowed in model data (https://github.com/loopbackio/loopback-next/issues/4354)
    delete (contest as Contest & Partial<ContestRelations>).bots;
    await contestRepository.update(contest);
    return contest;
  }

  static async unregister(
    actor: User,
    contestId: string,
    authorizationService: AuthorizationService,
    contestRepository: ContestRepository,
  ) {
    const contest = await contestRepository.findOne({
      where: { id: contestId },
      include: ["bots"],
    });
    if (!contest) {
      throw new ValidationError({ fieldErrors: { contestId: ["Contest not found."] } }).withCode(
        this.EXCEPTION_CODE__CONTEST_NOT_FOUND,
      );
    }
    await authorizationService.authorize(actor, Action.CONTEST_UNREGISTER, contest);
    if (!this.removeUserBotFromContest(actor, contest)) {
      throw new ValidationError({ fieldErrors: { contestId: ["User not registered."] } });
    }
    // Navigational properties are not allowed in model data (https://github.com/loopbackio/loopback-next/issues/4354)
    delete (contest as Contest & Partial<ContestRelations>).bots;
    await contestRepository.update(contest);
    return contest;
  }

  static async updateStatus(
    actor: User,
    contestId: string,
    status: ContestStatus,
    authorizationService: AuthorizationService,
    contestRepository: ContestRepository,
  ) {
    const contest = await contestRepository.findOne({ where: { id: contestId } });
    if (!contest) {
      throw new ValidationError({ fieldErrors: { contestId: ["Contest not found."] } }).withCode(
        this.EXCEPTION_CODE__CONTEST_NOT_FOUND,
      );
    }
    await authorizationService.authorize(actor, Action.UPDATE, contest, "status");
    if (
      (contest.status === ContestStatus.OPEN && status === ContestStatus.CLOSED) ||
      (contest.status === ContestStatus.CLOSED && status === ContestStatus.OPEN)
    ) {
      contest.status = status;
      await contestRepository.update(contest);
      return contest;
    } else {
      return { from: contest.status, to: status };
    }
  }

  protected static removeUserBotFromContest(actor: User, contest: ContestWithRelations) {
    const existingBot = contest.bots.find((registeredBot) => registeredBot.userId === actor.id);
    if (existingBot) {
      const existingBotIdx = contest.botIds.findIndex(
        (registeredBotId) => registeredBotId === existingBot.id,
      );
      if (existingBotIdx < 0)
        throw new AssertException({
          message: "Contest.removeUserBotFromContest: existing registration bot not found",
          values: { existingBotId: existingBot.id },
        });
      contest.botIds.splice(existingBotIdx, 1);
    }
    return !!existingBot;
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

  @field(() => ContestStatus)
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

@inputType()
export class ContestRegistration {
  @field()
  contestId: string;
  @field()
  botId: string;
}

@objectType()
export class RegisterToContestFieldErrors {
  @field(() => [String!], { nullable: true })
  contestId?: string[];
  @field(() => [String!], { nullable: true })
  botId?: string[];
}

@objectType({ implements: GraphqlError })
export class RegisterToContestError extends GraphqlError {
  @field()
  fieldErrors: RegisterToContestFieldErrors;
}

export const RegisterToContestResponse = createAuthErrorUnionType(
  "RegisterToContestResponse",
  [Contest, RegisterToContestError],
  (value: unknown) =>
    (value as GqlValue).__typename === "Contest"
      ? Contest
      : (value as GqlValue).__typename === "RegisterToContestError"
      ? RegisterToContestError
      : undefined,
);

@objectType({ implements: GraphqlError })
export class ContestNotFoundError extends GraphqlError {}

export const UnregisterFromContestResponse = createAuthErrorUnionType(
  "UnregisterFromContestResponse",
  [Contest, ContestNotFoundError],
  (value: unknown) =>
    (value as GqlValue).__typename === "Contest"
      ? Contest
      : (value as GqlValue).__typename === "ContestNotFoundError"
      ? ContestNotFoundError
      : undefined,
);

@objectType({ implements: GraphqlError })
export class UpdateContestStatusError extends GraphqlError {
  @field()
  from: ContestStatus;
  @field()
  to: ContestStatus;
}

export const UpdateContestStatusResponse = createAuthErrorUnionType(
  "UpdateContestStatusResponse",
  [Contest, ContestNotFoundError, UpdateContestStatusError],
  (value: unknown) =>
    (value as GqlValue).__typename === "Contest"
      ? Contest
      : (value as GqlValue).__typename === "ContestNotFoundError"
      ? ContestNotFoundError
      : (value as GqlValue).__typename === "UpdateContestStatusError"
      ? UpdateContestStatusError
      : undefined,
);
