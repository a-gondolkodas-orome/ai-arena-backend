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
import { BaseResolver } from "./base.resolver";
import { handleAuthErrors } from "../models/auth";
import {
  Contest,
  ContestInput,
  ContestResponse,
  ContestsResponse,
  ContestStatus,
  CreateContestResponse,
  ContestRegistration,
  RegisterToContestResponse,
  UnregisterFromContestResponse,
  UpdateContestStatusResponse,
  StartContestResponse,
} from "../models/contest";
import { ContestRepository } from "../repositories";
import { AuthorizationError, ValidationError, validationErrorCodec } from "../errors";
import * as t from "io-ts";
import { Game } from "../models/game";
import { Bot } from "../models/bot";
import { User } from "../models/user";
import { Match } from "../models/match";
import { AuthorizationService } from "../services/authorization.service";
import { BotRepository, GameRepository, MatchRepository, UserRepository } from "../repositories";
import { ContestService } from "../services/contest.service";

@resolver(() => Contest)
export class ContestResolver extends BaseResolver implements ResolverInterface<Contest> {
  constructor(
    @service() protected authorizationService: AuthorizationService,
    @service() protected contestService: ContestService,
    @repository(BotRepository) protected botRepository: BotRepository,
    @repository(UserRepository) protected userRepository: UserRepository,
    @repository(GameRepository) protected gameRepository: GameRepository,
    @repository(MatchRepository) protected matchRepository: MatchRepository,
    @repository(ContestRepository) protected contestRepository: ContestRepository,
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    super(resolverData);
  }

  @mutation(() => CreateContestResponse)
  async createContest(@arg("contestInput") contestInput: ContestInput) {
    return handleAuthErrors(async () => {
      try {
        return Object.assign(
          await Contest.create(
            this.actor,
            contestInput,
            this.authorizationService,
            this.contestRepository,
          ),
          { __typename: "Contest" },
        );
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
            __typename: "CreateContestError",
            message: error.data.message,
            fieldErrors: (error.data as t.TypeOf<typeof validationErrorCodec>).fieldErrors,
          };
        }
        throw error;
      }
    });
  }

  @query(() => ContestsResponse)
  async getContests(): Promise<typeof ContestsResponse> {
    return handleAuthErrors(async () => ({
      __typename: "Contests",
      contests: await Contest.getContests(
        this.actor,
        this.authorizationService,
        this.contestRepository,
      ),
    }));
  }

  @query(() => ContestResponse, { nullable: true })
  async getContest(@arg("id") id: string) {
    return handleAuthErrors(async () => {
      const contest = await Contest.getContest(
        this.actor,
        id,
        this.authorizationService,
        this.contestRepository,
      );
      return contest ? Object.assign(contest, { __typename: "Contest" }) : null;
    });
  }

  @mutation(() => RegisterToContestResponse)
  async registerToContest(@arg("registration") registration: ContestRegistration) {
    return handleAuthErrors(async () => {
      try {
        return Object.assign(
          await Contest.register(
            this.actor,
            registration.contestId,
            registration.botId,
            this.authorizationService,
            this.contestRepository,
            this.botRepository,
          ),
          { __typename: "Contest" },
        );
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
            __typename: "RegisterToContestError",
            message: error.data.message,
            fieldErrors: (error.data as t.TypeOf<typeof validationErrorCodec>).fieldErrors,
          };
        }
        throw error;
      }
    });
  }

  @mutation(() => UnregisterFromContestResponse)
  async unregisterFromContest(@arg("contestId") contestId: string) {
    return handleAuthErrors(async () => {
      try {
        return Object.assign(
          await Contest.unregister(
            this.actor,
            contestId,
            this.authorizationService,
            this.contestRepository,
          ),
          { __typename: "Contest" },
        );
      } catch (error) {
        if (
          error instanceof ValidationError &&
          error.hasCode(Contest.EXCEPTION_CODE__CONTEST_NOT_FOUND)
        ) {
          return {
            __typename: "ContestNotFoundError",
            message:
              (error.data as t.TypeOf<typeof validationErrorCodec>)?.fieldErrors?.contestId?.[0] ??
              "Contest not found.",
          };
        }
        throw error;
      }
    });
  }

  @mutation(() => UpdateContestStatusResponse)
  async updateStatus(
    @arg("contestId") contestId: string,
    @arg("status", () => ContestStatus) status: ContestStatus,
  ) {
    return handleAuthErrors(async () => {
      try {
        const result = await Contest.updateStatus(
          this.actor,
          contestId,
          status,
          this.authorizationService,
          this.contestRepository,
        );
        return result instanceof Contest
          ? Object.assign(result, { __typename: "Contest" })
          : {
              __typename: "UpdateContestStatusError",
              message: "Invalid contest status update.",
              ...result,
            };
      } catch (error) {
        if (
          error instanceof ValidationError &&
          error.hasCode(Contest.EXCEPTION_CODE__CONTEST_NOT_FOUND)
        ) {
          return {
            __typename: "ContestNotFoundError",
            message:
              (error.data as t.TypeOf<typeof validationErrorCodec>)?.fieldErrors?.contestId?.[0] ??
              "Contest not found.",
          };
        }
        throw error;
      }
    });
  }

  @mutation(() => StartContestResponse)
  async startContest(@arg("contestId") contestId: string) {
    return handleAuthErrors(async () => {
      try {
        const result = await Contest.start(
          this.actor,
          contestId,
          this.authorizationService,
          this.contestService,
          this.contestRepository,
        );
        if (result instanceof Contest) return Object.assign(result, { __typename: "Contest" });
        else
          return {
            __typename: "StartContestError",
            message: "Can't start contest in current status.",
            ...result,
          };
      } catch (error) {
        if (
          error instanceof ValidationError &&
          error.hasCode(Contest.EXCEPTION_CODE__CONTEST_NOT_FOUND)
        ) {
          return {
            __typename: "ContestNotFoundError",
            message:
              (error.data as t.TypeOf<typeof validationErrorCodec>)?.fieldErrors?.contestId?.[0] ??
              "Contest not found.",
          };
        }
        throw error;
      }
    });
  }

  @fieldResolver()
  async id(@root() contest: Contest) {
    return contest.getIdAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver(() => Game)
  async game(@root() contest: Contest) {
    return contest.getGameAuthorized(this.actor, this.authorizationService, this.gameRepository);
  }

  @fieldResolver(() => User)
  async owner(@root() contest: Contest) {
    return contest.getOwnerAuthorized(this.actor, this.authorizationService, this.userRepository);
  }

  @fieldResolver()
  async name(@root() contest: Contest) {
    return contest.getNameAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver()
  async date(@root() contest: Contest) {
    return contest.getDateAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver(() => [Bot])
  async bots(@root() contest: Contest) {
    return contest.getBotsAuthorized(this.actor, this.authorizationService, this.botRepository);
  }

  @fieldResolver(() => [Match], { nullable: true })
  async matches(@root() contest: Contest) {
    try {
      return await contest.getMatchesAuthorized(
        this.actor,
        this.authorizationService,
        this.matchRepository,
      );
    } catch (error) {
      if (error instanceof AuthorizationError) return null;
      throw error;
    }
  }

  @fieldResolver(() => ContestStatus)
  async status(@root() contest: Contest) {
    return contest.getStatusAuthorized(this.actor, this.authorizationService);
  }
}
