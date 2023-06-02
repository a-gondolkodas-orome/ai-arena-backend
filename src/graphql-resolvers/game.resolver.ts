import { inject, service } from "@loopback/core";
import {
  arg,
  fieldResolver,
  GraphQLBindings,
  query,
  resolver,
  ResolverData,
  ResolverInterface,
  root,
} from "@loopback/graphql";
import { repository } from "@loopback/repository";
import { Game, GameResponse, GamesResponse } from "../models/game";
import { BaseResolver } from "./base.resolver";
import { handleAuthErrors } from "../models/auth";
import { AuthorizationService } from "../services/authorization.service";
import { GameRepository } from "../repositories/game.repository";

@resolver(() => Game)
export class GameResolver extends BaseResolver implements ResolverInterface<Game> {
  constructor(
    @service() protected authorizationService: AuthorizationService,
    @repository("GameRepository") readonly gameRepository: GameRepository,
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    super(resolverData);
  }

  @query(() => GamesResponse)
  async getGames(): Promise<typeof GamesResponse> {
    return handleAuthErrors(async () => ({
      __typename: "Games",
      games: await Game.getGames(this.context, this.authorizationService, this.gameRepository),
    }));
  }

  @query(() => GameResponse, { nullable: true })
  async getGame(@arg("id") id: string): Promise<typeof GameResponse | null> {
    return handleAuthErrors(async () => {
      const game = await Game.getGame(this.context, id, this.authorizationService);
      return game ? Object.assign(game, { __typename: "Game" }) : null;
    });
  }

  @fieldResolver()
  async id(@root() game: Game) {
    return game.getIdAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async name(@root() game: Game) {
    return game.getNameAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async shortDescription(@root() game: Game) {
    return game.getShortDescriptionAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver(() => String)
  async picture(@root() game: Game) {
    return game.getPictureAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async fullDescription(@root() game: Game) {
    return game.getFullDescriptionAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async playerCount(@root() game: Game) {
    return game.getPlayerCountAuthorized(this.context, this.authorizationService);
  }

  @fieldResolver()
  async maps(@root() game: Game) {
    return game.getMapsAuthorized(this.context, this.authorizationService);
  }
}
