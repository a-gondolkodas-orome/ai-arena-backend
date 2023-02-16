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
  CreateContestResponse,
} from "../models/contest";
import { ContestRepository } from "../repositories/contest.repository";
import { ValidationError, validationErrorCodec } from "../errors";
import * as t from "io-ts";
import { Game } from "../models/game";
import { Bot } from "../models/bot";
import { User } from "../models/user";
import { Match } from "../models/match";
import { AuthorizationService } from "../services/authorization.service";
import { BotRepository, GameRepository, MatchRepository, UserRepository } from "../repositories";

@resolver(() => Contest)
export class ContestResolver extends BaseResolver implements ResolverInterface<Contest> {
  constructor(
    @service() protected authorizationService: AuthorizationService,
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

  @fieldResolver(() => [Match])
  async matches(@root() contest: Contest) {
    return contest.getMatchesAuthorized(
      this.actor,
      this.authorizationService,
      this.matchRepository,
    );
  }

  @fieldResolver()
  async status(@root() contest: Contest) {
    return contest.getStatusAuthorized(this.actor, this.authorizationService);
  }
}
