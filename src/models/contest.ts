import { field, ID, inputType, objectType } from "@loopback/graphql";
import { belongsTo, Entity, model, property, referencesMany } from "@loopback/repository";
import { createAuthErrorUnionType, GraphqlError } from "./auth";
import { Game, GameWithRelations } from "./game";
import { User } from "./user";
import { Bot, BotOrDeleted, BotSubmitStage, BotWithRelations } from "./bot";
import { Match, MatchWithRelations } from "./match";
import { registerEnumType } from "type-graphql";
import { GqlValue } from "../common";
import { UserWithRelations } from "@loopback/authentication-jwt";
import { AssertException, ValidationError } from "../errors";
import {
  Action,
  AuthorizationService,
  ResourceCollection,
} from "../services/authorization.service";
import { MatchRepository } from "../repositories/match.repository";
import { BotRepository } from "../repositories/bot.repository";
import { ContestService } from "../services/contest.service";
import { ContestRepository } from "../repositories/contest.repository";
import { MatchService } from "../services/match.service";
import { assertValue } from "../utils";
import { AiArenaGraphqlContext } from "../graphql-resolvers/graphql-context-resolver.provider";
import { GraphqlValidationError } from "./base";

export enum ContestStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  RUNNING = "RUNNING",
  FINISHED = "FINISHED",
  RUN_ERROR = "RUN_ERROR",
}

registerEnumType(ContestStatus, {
  name: "ContestStatus",
});

@objectType()
@model()
export class ContestProgress {
  @field()
  @property()
  totalMatchCount: number;

  @field()
  @property()
  completedMatchCount: number;

  @field({ nullable: true })
  @property()
  timeRemaining?: number;
}

@objectType()
@model()
export class Contest extends Entity {
  static async create(
    context: AiArenaGraphqlContext & { actor: User },
    contestInput: ContestInput,
    authorizationService: AuthorizationService,
    contestRepository: ContestRepository,
  ) {
    await authorizationService.authorize(context.actor, Action.CREATE, contestInput);
    return contestRepository.validateAndCreate(context.actor, contestInput);
  }

  static async getContests(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
    contestRepository: ContestRepository,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, ResourceCollection.CONTESTS);
    return contestRepository.find();
  }

  static async getContest(
    context: AiArenaGraphqlContext,
    id: string,
    authorizationService: AuthorizationService,
  ) {
    const contest = await context.loaders.contest.load(id);
    await authorizationService.authorize(context.actor, Action.READ, contest);
    return contest;
  }

  static async delete(
    context: AiArenaGraphqlContext,
    id: string,
    authorizationService: AuthorizationService,
    contestRepository: ContestRepository,
    matchRepository: MatchRepository,
    matchService: MatchService,
  ) {
    const contest = await contestRepository.findOne({ where: { id } });
    await authorizationService.authorize(context.actor, Action.DELETE, contest);
    if (contest === null) throw new ValidationError({ message: "Contest not found" });
    await this.deleteMatches(context, contest, matchRepository, matchService);
    await contestRepository.deleteById(id);
    context.loaders.contest.clear(id);
  }

  static async flipArchivedStatus(
    context: AiArenaGraphqlContext,
    id: string,
    authorizationService: AuthorizationService,
    contestRepository: ContestRepository,
    matchRepository: MatchRepository,
    matchService: MatchService,
  ) {
    const contest = await contestRepository.findOne({ where: { id } });
    await authorizationService.authorize(context.actor, Action.CONTEST_ARCHIVE, contest);
    if (contest === null) throw new ValidationError({ message: "Contest not found" });
    contest.isArchived = !contest.isArchived;
    if (contest.isArchived)
      await this.deleteMatches(context, contest, matchRepository, matchService);
    await contestRepository.update(contest);
    context.loaders.contest.clear(id);
    return contest;
  }

  protected static async deleteMatches(
    context: AiArenaGraphqlContext,
    contest: Contest,
    matchRepository: MatchRepository,
    matchService: MatchService,
  ) {
    await matchRepository.deleteAll({ id: { inq: contest.matchIds } });
    contest.matchIds.forEach((matchId) => context.loaders.match.clear(matchId));
    await Promise.all(contest.matchIds.map((matchId) => matchService.deleteMatchBuild(matchId)));
  }

  static async register(
    context: AiArenaGraphqlContext & { actor: User },
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
    else {
      if (bot.submitStatus.stage !== BotSubmitStage.CHECK_SUCCESS)
        botIdErrors.push(`Bot ${botId} can not be executed. Check failed.`);
      if (bot.userId !== context.actor.id)
        botIdErrors.push(`Contest registration is allowed only with own bots.`);
    }
    if (contestIdErrors.length || botIdErrors.length) {
      throw new ValidationError({
        fieldErrors: {
          ...(contestIdErrors.length && { contestId: contestIdErrors }),
          ...(botIdErrors.length && { botId: botIdErrors }),
        },
      });
    }
    assertValue(contest);
    await authorizationService.authorize(
      context.actor,
      Action.CONTEST_REGISTER,
      contest,
      undefined,
      bot,
    );
    this.removeUserBotFromContest(context.actor, contest);
    contest.botIds.push(botId);
    // Navigational properties are not allowed in model data (https://github.com/loopbackio/loopback-next/issues/4354)
    delete (contest as Contest & Partial<ContestRelations>).bots;
    context.loaders.contest.clear(contestId);
    await contestRepository.update(contest);
    return contest;
  }

  static async unregister(
    context: AiArenaGraphqlContext & { actor: User },
    contestId: string,
    authorizationService: AuthorizationService,
    contestRepository: ContestRepository,
  ) {
    const contest = await contestRepository.findOne({
      where: { id: contestId },
      include: ["bots"],
    });
    if (!contest) {
      throw new ValidationError({ message: "Contest not found." });
    }
    await authorizationService.authorize(context.actor, Action.CONTEST_UNREGISTER, contest);
    if (!this.removeUserBotFromContest(context.actor, contest)) {
      throw new ValidationError({ message: "User not registered to contest." });
    }
    // Navigational properties are not allowed in model data (https://github.com/loopbackio/loopback-next/issues/4354)
    delete (contest as Contest & Partial<ContestRelations>).bots;
    context.loaders.contest.clear(contestId);
    await contestRepository.update(contest);
    return contest;
  }

  static async updateStatus(
    context: AiArenaGraphqlContext & { actor: User },
    contestId: string,
    status: ContestStatus,
    authorizationService: AuthorizationService,
    matchService: MatchService,
    contestRepository: ContestRepository,
  ) {
    const contest = await context.loaders.contest.load(contestId);
    if (!contest) {
      throw new ValidationError({ message: "Contest not found" });
    }
    await authorizationService.authorize(context.actor, Action.UPDATE, contest, "status");
    if (
      (contest.status === ContestStatus.OPEN && status === ContestStatus.CLOSED) ||
      (contest.status === ContestStatus.CLOSED && status === ContestStatus.OPEN) ||
      ([ContestStatus.FINISHED, ContestStatus.RUN_ERROR].includes(contest.status) &&
        status === ContestStatus.OPEN)
    ) {
      if ([ContestStatus.FINISHED, ContestStatus.RUN_ERROR].includes(contest.status)) {
        for (const matchId of contest.matchIds) {
          await matchService.deleteMatchBuild(matchId);
        }
        contest.matchIds = [];
      }
      contest.status = status;
      context.loaders.contest.clear(contestId);
      await contestRepository.update(contest);
      return contest;
    } else {
      return { from: contest.status, to: status };
    }
  }

  static async start(
    context: AiArenaGraphqlContext & { actor: User },
    contestId: string,
    authorizationService: AuthorizationService,
    contestService: ContestService,
    contestRepository: ContestRepository,
  ) {
    const contest = await context.loaders.contest.load(contestId);
    if (!contest) {
      throw new ValidationError({ message: "Contest not found" });
    }
    await authorizationService.authorize(context.actor, Action.CONTEST_START, contest);
    if (contest.status === ContestStatus.OPEN || contest.status === ContestStatus.CLOSED) {
      contest.status = ContestStatus.RUNNING;
      context.loaders.contest.clear(contestId);
      await contestRepository.update(contest);
      contestService.runContest(contest).catch((error) => console.error(error));
      return contest;
    } else {
      return { from: contest.status };
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

  async getIdAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "id");
    return this.id;
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

  @belongsTo(() => User, {}, { type: "string", mongodb: { dataType: "ObjectId" } })
  ownerId: string;

  async getOwnerAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "owner");
    return context.loaders.user.load(this.ownerId);
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
  date: Date;

  async getDateAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "date");
    return this.date;
  }

  @field(() => [String!])
  @property.array(String)
  mapNames: string[];

  async getMapNamesAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "mapNames");
    return this.mapNames;
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

  @referencesMany(() => Match, { name: "matches" })
  matchIds: string[];

  async getMatchesAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
    matchRepository: MatchRepository,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "matches");
    return matchRepository.find({ where: { id: { inq: this.matchIds } }, fields: { log: false } });
  }

  _matchSizeTotal: never;

  async getMatchSizeTotalAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
    matchRepository: MatchRepository,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "_matchSizeTotal");
    const matches = await matchRepository.find({
      where: { id: { inq: this.matchIds } },
    });
    return matches.reduce((sumSize, match) => sumSize + match.logSize, 0);
  }

  @field(() => ContestStatus)
  @property()
  status: ContestStatus;

  async getStatusAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "status");
    return this.status;
  }

  @field({ nullable: true })
  @property()
  progress?: ContestProgress;

  async getProgressAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "progress");
    return this.progress;
  }

  @field({ nullable: true })
  @property()
  scoreJson?: string;

  async getScoreJsonAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "scoreJson");
    return this.scoreJson;
  }

  @field(() => Boolean, { nullable: true })
  @property({ type: "boolean" })
  isArchived: boolean | null;

  async getIsArchivedAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "isArchived");
    return this.isArchived;
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

  @field(() => [String!])
  mapNames: string[];

  @field()
  name: string;

  @field()
  date: Date;
}

export const ContestResponse = createAuthErrorUnionType(
  "ContestResponse",
  [Contest, GraphqlValidationError],
  (value: unknown) => ((value as GqlValue).__typename === "Contest" ? "Contest" : undefined),
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
  (value: unknown) => ((value as GqlValue).__typename === "Contests" ? "Contests" : undefined),
);

export const CreateContestResponse = createAuthErrorUnionType(
  "CreateContestResponse",
  [Contest, CreateContestError],
  (value: unknown) =>
    (value as GqlValue).__typename === "Contest"
      ? "Contest"
      : (value as GqlValue).__typename === "CreateContestError"
      ? "CreateContestError"
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
      ? "Contest"
      : (value as GqlValue).__typename === "RegisterToContestError"
      ? "RegisterToContestError"
      : undefined,
);

export const UnregisterFromContestResponse = createAuthErrorUnionType(
  "UnregisterFromContestResponse",
  [Contest, GraphqlValidationError],
  (value: unknown) =>
    (value as GqlValue).__typename === "Contest"
      ? "Contest"
      : (value as GqlValue).__typename === "GraphqlValidationError"
      ? "GraphqlValidationError"
      : undefined,
);

@objectType({ implements: GraphqlError })
export class UpdateContestStatusError extends GraphqlError {
  @field(() => ContestStatus)
  from: ContestStatus;
  @field(() => ContestStatus)
  to: ContestStatus;
}

export const UpdateContestStatusResponse = createAuthErrorUnionType(
  "UpdateContestStatusResponse",
  [Contest, GraphqlValidationError, UpdateContestStatusError],
  (value: unknown) =>
    (value as GqlValue).__typename === "Contest"
      ? "Contest"
      : (value as GqlValue).__typename === "GraphqlValidationError"
      ? "GraphqlValidationError"
      : (value as GqlValue).__typename === "UpdateContestStatusError"
      ? "UpdateContestStatusError"
      : undefined,
);

@objectType({ implements: GraphqlError })
export class StartContestError extends GraphqlError {
  @field(() => ContestStatus)
  status: ContestStatus;
}

export const StartContestResponse = createAuthErrorUnionType(
  "StartContestResponse",
  [Contest, GraphqlValidationError, StartContestError],
  (value: unknown) =>
    (value as GqlValue).__typename === "Contest"
      ? "Contest"
      : (value as GqlValue).__typename === "GraphqlValidationError"
      ? "GraphqlValidationError"
      : (value as GqlValue).__typename === "StartContestError"
      ? "StartContestError"
      : undefined,
);
