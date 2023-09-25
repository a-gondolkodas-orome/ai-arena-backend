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
import { AuthorizationError, ValidationError, validationErrorCodec } from "../errors";
import * as t from "io-ts";
import { Game } from "../models/game";
import { BotOrDeleted } from "../models/bot";
import { User } from "../models/user";
import { Match } from "../models/match";
import { AuthorizationService } from "../services/authorization.service";
import { ContestService } from "../services/contest.service";
import { MatchRepository } from "../repositories/match.repository";
import { BotRepository } from "../repositories/bot.repository";
import { ContestRepository } from "../repositories/contest.repository";
import { MatchService } from "../services/match.service";
import { ValidatedNoContentResponse } from "../models/base";

@resolver(() => Contest)
export class ContestResolver extends BaseResolver implements ResolverInterface<Contest> {
  constructor(
    @service() protected authorizationService: AuthorizationService,
    @service() protected matchService: MatchService,
    @service() protected contestService: ContestService,
    @repository(BotRepository) protected botRepository: BotRepository,
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
            this.context,
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
        this.context,
        this.authorizationService,
        this.contestRepository,
      ),
    }));
  }

  @query(() => ContestResponse, { nullable: true })
  async getContest(@arg("id") id: string) {
    return handleAuthErrors(async () => {
      const contest = await Contest.getContest(this.context, id, this.authorizationService);
      return contest ? Object.assign(contest, { __typename: "Contest" }) : null;
    });
  }

  @mutation(() => ValidatedNoContentResponse, { nullable: true })
  async deleteContest(@arg("id") id: string) {
    return handleAuthErrors(async () => {
      try {
        await Contest.delete(
          this.context,
          id,
          this.authorizationService,
          this.contestRepository,
          this.matchRepository,
          this.matchService,
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

  @mutation(() => ContestResponse, { nullable: true })
  async flipContestArchivedStatus(@arg("id") id: string) {
    return handleAuthErrors(async () => {
      try {
        const contest = await Contest.flipArchivedStatus(
          this.context,
          id,
          this.authorizationService,
          this.contestRepository,
          this.matchRepository,
          this.matchService,
        );
        return Object.assign(contest, { __typename: "Contest" });
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

  @mutation(() => RegisterToContestResponse)
  async registerToContest(@arg("registration") registration: ContestRegistration) {
    return handleAuthErrors(async () => {
      try {
        return Object.assign(
          await Contest.register(
            this.context,
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
            this.context,
            contestId,
            this.authorizationService,
            this.contestRepository,
          ),
          { __typename: "Contest" },
        );
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
            __typename: "GraphqlValidationError",
            message: error.message,
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
          this.context,
          contestId,
          status,
          this.authorizationService,
          this.matchService,
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
        if (error instanceof ValidationError) {
          return {
            __typename: "GraphqlValidationError",
            message: error.message,
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
          this.context,
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
        if (error instanceof ValidationError) {
          return {
            __typename: "GraphqlValidationError",
            message: error.message,
          };
        }
        throw error;
      }
    });
  }

  @fieldResolver()
  async id(@root() contest: Contest) {
    return contest.getIdAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver(() => Game)
  async game(@root() contest: Contest) {
    return contest.getGameAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver(() => User)
  async owner(@root() contest: Contest) {
    return contest.getOwnerAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async name(@root() contest: Contest) {
    return contest.getNameAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async date(@root() contest: Contest) {
    return contest.getDateAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async mapNames(@root() contest: Contest) {
    return contest.getMapNamesAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver(() => [BotOrDeleted])
  async bots(@root() contest: Contest) {
    return contest.getBotsAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver(() => [Match], { nullable: true })
  async matches(@root() contest: Contest) {
    try {
      return await contest.getMatchesAuthorized(
        this.context,
        this.authorizationService,
        this.matchRepository,
      );
    } catch (error) {
      if (error instanceof AuthorizationError) return null;
      throw error;
    }
  }

  @fieldResolver(() => Number, { nullable: true })
  async matchSizeTotal(@root() contest: Contest) {
    try {
      return await contest.getMatchSizeTotalAuthorized(
        this.context,
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
    return contest.getStatusAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async progress(@root() contest: Contest) {
    return contest.getProgressAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async scoreJson(@root() contest: Contest) {
    return contest.getScoreJsonAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver(() => Boolean, { nullable: true })
  async isArchived(@root() contest: Contest) {
    try {
      return await contest.getIsArchivedAuthorized(this.context, this.authorizationService);
    } catch (error) {
      if (error instanceof AuthorizationError) return null;
      throw error;
    }
  }
}
