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
import { Match, MatchInput, StartMatchResponse } from "../models/match";
import {
  BotRepository,
  GameRepository,
  MatchRepository,
  UserRepository,
} from "../repositories";
import { BaseResolver } from "./base.resolver";
import { AuthError, handleAuthErrors } from "../models/auth";
import { ValidationError, validationErrorCodec } from "../errors";
import * as t from "io-ts";
import { MatchesResponse } from "../models/match";
import { AiArenaBindings } from "../keys";
import { MatchService } from "../services";

@resolver((of) => Match)
export class MatchResolver
  extends BaseResolver
  implements ResolverInterface<Match>
{
  constructor(
    @repository("MatchRepository") protected matchRepository: MatchRepository,
    @repository("UserRepository") protected userRepository: UserRepository,
    @repository("GameRepository") protected gameRepository: GameRepository,
    @repository("BotRepository") protected botRepository: BotRepository,
    @inject(AiArenaBindings.MATCH_SERVICE) protected matchService: MatchService,
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    super(resolverData);
  }

  @query((returns) => MatchesResponse)
  async getMatches(
    @arg("gameId") gameId: string,
  ): Promise<typeof MatchesResponse> {
    return handleAuthErrors(async () => ({
      __typename: "Matches",
      matches: await this.matchRepository.getUserMatches(this.executor, {
        where: { gameId },
      }),
    }));
  }

  @mutation((returns) => StartMatchResponse)
  async startMatch(@arg("matchInput") matchInput: MatchInput) {
    return handleAuthErrors(async () => {
      try {
        const match = await this.matchRepository.create(
          this.executor,
          matchInput,
        );
        await this.matchService.startMatch(this.executor, match);
        return { __typename: "Match", ...match };
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
            __typename: "StartMatchError",
            message: error.data.message,
            fieldErrors: (error.data as t.TypeOf<typeof validationErrorCodec>)
              .fieldErrors,
          };
        }
        throw error;
      }
    });
  }

  @mutation((returns) => AuthError, { nullable: true })
  async deleteMatch(@arg("matchId") matchId: string) {
    return handleAuthErrors(async () => {
      await this.matchRepository.deleteMatch(this.executor, matchId);
    });
  }

  @fieldResolver()
  async user(@root() match: Match) {
    return this.userRepository.findById(this.executor, match.userId);
  }

  @fieldResolver()
  async game(@root() match: Match) {
    return this.gameRepository.findById(this.executor, match.gameId);
  }

  // TODO implement Match.bots resolver
  // @fieldResolver()
  // async bots(@root() match: Match) {
  //   return await this.botRepository.getAnyBots(this.executor, {
  //     where: { id: 1 },
  //   });
  // }
}
