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
import {
  Match,
  MatchInput,
  MatchResponse,
  CreateMatchResponse,
  MatchResult,
} from "../models/match";
import { BotRepository, GameRepository, MatchRepository, UserRepository } from "../repositories";
import { BaseResolver } from "./base.resolver";
import { AuthError, handleAuthErrors } from "../models/auth";
import { ValidationError, validationErrorCodec } from "../errors";
import * as t from "io-ts";
import { MatchesResponse } from "../models/match";
import { MatchService } from "../services";
import { User } from "../models/user";
import { Game } from "../models/game";
import { AuthorizationService } from "../services/authorization.service";
import { Bot } from "../models/bot";

@resolver(() => Match)
export class MatchResolver extends BaseResolver implements ResolverInterface<Match> {
  constructor(
    @repository("MatchRepository") protected matchRepository: MatchRepository,
    @repository("UserRepository") protected userRepository: UserRepository,
    @repository("GameRepository") protected gameRepository: GameRepository,
    @repository("BotRepository") protected botRepository: BotRepository,
    @service() protected authorizationService: AuthorizationService,
    @service() protected matchService: MatchService,
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    super(resolverData);
  }

  @mutation(() => CreateMatchResponse)
  async createMatch(@arg("matchInput") matchInput: MatchInput) {
    return handleAuthErrors(async () => {
      try {
        return Object.assign(
          await Match.create(
            this.actor,
            matchInput,
            this.authorizationService,
            this.matchRepository,
            this.matchService,
          ),
          { __typename: "Match" },
        );
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
            __typename: "CreateMatchError",
            message: error.data.message,
            fieldErrors: (error.data as t.TypeOf<typeof validationErrorCodec>).fieldErrors,
          };
        }
        throw error;
      }
    });
  }

  @query(() => MatchesResponse)
  async getMatches(@arg("gameId") gameId: string): Promise<typeof MatchesResponse> {
    return handleAuthErrors(async () => ({
      __typename: "Matches",
      matches: await Match.getMatches(
        this.actor,
        gameId,
        this.authorizationService,
        this.matchRepository,
      ),
    }));
  }

  @query(() => MatchResponse)
  async getMatch(@arg("id") id: string) {
    return handleAuthErrors(async () => {
      const match = await Match.getMatch(
        this.actor,
        id,
        this.authorizationService,
        this.matchRepository,
      );
      return match ? Object.assign(match, { __typename: "Match" }) : null;
    });
  }

  @mutation(() => AuthError, { nullable: true })
  async deleteMatch(@arg("id") id: string) {
    return handleAuthErrors(async () =>
      Match.delete(
        this.actor,
        id,
        this.authorizationService,
        this.matchRepository,
        this.matchService,
      ),
    );
  }

  @fieldResolver()
  async id(@root() match: Match) {
    return match.getIdAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver(() => User)
  async user(@root() match: Match) {
    return match.getUserAuthorized(this.actor, this.authorizationService, this.userRepository);
  }

  @fieldResolver(() => Game)
  async game(@root() match: Match) {
    return match.getGameAuthorized(this.actor, this.authorizationService, this.gameRepository);
  }

  @fieldResolver(() => [Bot])
  async bots(@root() match: Match) {
    return match.getBotsAuthorized(this.actor, this.authorizationService, this.botRepository);
  }

  @fieldResolver()
  async runStatus(@root() match: Match) {
    return match.getRunStatusAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver(() => MatchResult, { nullable: true })
  async result(@root() match: Match) {
    return match.getResultAuthorized(this.actor, this.authorizationService);
  }
}
