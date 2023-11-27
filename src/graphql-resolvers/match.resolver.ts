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
import { Match, MatchInput, MatchResponse, CreateMatchResponse } from "../models/match";
import { BaseResolver } from "./base.resolver";
import { handleAuthErrors } from "../models/auth";
import { ValidationError, validationErrorCodec } from "../errors";
import * as t from "io-ts";
import { MatchesResponse } from "../models/match";
import { User } from "../models/user";
import { Game } from "../models/game";
import { AuthorizationService } from "../services/authorization.service";
import { BotOrDeleted } from "../models/bot";
import { MatchRepository } from "../repositories/match.repository";
import { MatchService } from "../services/match.service";
import { BotService } from "../services/bot.service";
import { ValidatedNoContentResponse } from "../models/base";

@resolver(() => Match)
export class MatchResolver extends BaseResolver implements ResolverInterface<Match> {
  constructor(
    @repository("MatchRepository") protected matchRepository: MatchRepository,
    @service() protected authorizationService: AuthorizationService,
    @service() protected botService: BotService,
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
            this.context,
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
        this.context,
        gameId,
        this.authorizationService,
        this.matchRepository,
      ),
    }));
  }

  @query(() => MatchResponse)
  async getMatch(@arg("id") id: string) {
    return handleAuthErrors(async () => {
      const match = await Match.getMatch(this.context, id, this.authorizationService);
      return match ? Object.assign(match, { __typename: "Match" }) : null;
    });
  }

  @mutation(() => ValidatedNoContentResponse, { nullable: true })
  async deleteMatch(@arg("id") id: string) {
    return handleAuthErrors(async () => {
      try {
        return await Match.delete(
          this.context,
          id,
          this.authorizationService,
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

  @fieldResolver()
  async id(@root() match: Match) {
    return match.getIdAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver(() => User)
  async user(@root() match: Match) {
    return match.getUserAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver(() => Game)
  async game(@root() match: Match) {
    return match.getGameAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver(() => Game)
  async mapName(@root() match: Match) {
    return match.getMapNameAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver(() => [BotOrDeleted])
  async bots(@root() match: Match) {
    return match.getBotsAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async runStatus(@root() match: Match) {
    return match.getRunStatusAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async logBase64(@root() match: Match) {
    return match.getLogBase64Authorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async scoreJson(@root() match: Match) {
    return match.getScoreJsonAuthorized(this.context, this.authorizationService);
  }
}
