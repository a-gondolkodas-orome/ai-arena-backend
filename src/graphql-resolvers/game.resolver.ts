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
import { GameRepository } from "../repositories";
import { BaseResolver } from "./base.resolver";
import { handleAuthErrors } from "../models/auth";
import { AuthorizationService } from "../services/authorization.service";

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
      games: await Game.getGames(this.actor, this.authorizationService, this.gameRepository),
    }));
  }

  @query(() => GameResponse, { nullable: true })
  async getGame(@arg("id") id: string): Promise<typeof GameResponse | null> {
    return handleAuthErrors(async () => {
      const game = await Game.getGame(
        this.actor,
        id,
        this.authorizationService,
        this.gameRepository,
      );
      return game ? Object.assign(game, { __typename: "Game" }) : null;
    });
  }

  @fieldResolver()
  async id(@root() game: Game) {
    return game.getIdAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver()
  async name(@root() game: Game) {
    return game.getNameAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver()
  async shortDescription(@root() game: Game) {
    return game.getShortDescriptionAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver(() => String)
  async picture(@root() game: Game) {
    return game.getPictureAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver()
  async fullDescription(@root() game: Game) {
    return game.getFullDescriptionAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver()
  async playerCount(@root() game: Game) {
    return game.getPlayerCountAuthorized(this.actor, this.authorizationService);
  }
}
