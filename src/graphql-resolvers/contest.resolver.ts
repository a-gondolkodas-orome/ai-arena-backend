import { inject } from "@loopback/core";
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
import { GameRepository, UserRepository } from "../repositories";
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

@resolver((of) => Contest)
export class ContestResolver extends BaseResolver implements ResolverInterface<Contest> {
  constructor(
    // @repository("BotRepository") protected botRepository: BotRepository,
    @repository("UserRepository") protected userRepository: UserRepository,
    @repository("GameRepository") protected gameRepository: GameRepository,
    @repository("ContestRepository") protected contestRepository: ContestRepository,
    // @inject(AiArenaBindings.BOT_SERVICE) protected botService: BotService,
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    super(resolverData);
  }

  @query((returns) => ContestsResponse)
  async getContests(): Promise<typeof ContestsResponse> {
    return handleAuthErrors(async () => ({
      __typename: "Contests",
      contests: await this.contestRepository.find(this.executor),
    }));
  }

  @query((returns) => ContestResponse, { nullable: true })
  async getContest(@arg("id") id: string) {
    return handleAuthErrors(async () => {
      const contests = await this.contestRepository.find(this.executor, {
        where: { id },
      });
      return contests.length ? { __typename: "Contest", ...contests[0] } : null;
    });
  }

  @mutation((returns) => CreateContestResponse)
  async createContest(@arg("contestInput") contestInput: ContestInput) {
    return handleAuthErrors(async () => {
      try {
        const contest = await this.contestRepository.create(this.executor, contestInput);
        return {
          __typename: "Contest",
          ...contest,
        };
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
  //
  // @mutation((returns) => AuthError, { nullable: true })
  // async deleteBot(@arg("botId") botId: string) {
  //   return handleAuthErrors(async () => {
  //     await this.botService.deleteBot(this.executor, botId);
  //   });
  // }
  //
  @fieldResolver()
  async owner(@root() contest: Contest) {
    return this.userRepository.findById(this.executor, contest.ownerId);
  }

  @fieldResolver()
  async game(@root() contest: Contest) {
    return this.gameRepository.findById(this.executor, contest.gameId);
  }
}
