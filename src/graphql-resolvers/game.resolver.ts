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
import { Game, GameInput, GameResponse, GamesResponse } from "../models/game";
import { GameRepository } from "../repositories";
import { BaseResolver } from "./base.resolver";
import { handleAuthErrors } from "../models/auth";
import { fromByteArray } from "base64-js";

@resolver((of) => Game)
export class GameResolver extends BaseResolver implements ResolverInterface<Game> {
  constructor(
    @repository("GameRepository") readonly gameRepository: GameRepository,
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    super(resolverData);
  }

  @query((returns) => GamesResponse)
  async getGames(): Promise<typeof GamesResponse> {
    return handleAuthErrors(async () => ({
      games: await this.gameRepository.find(this.executor),
    }));
  }

  @query((returns) => GameResponse, { nullable: true })
  async findGame(@arg("id") id: string): Promise<typeof GameResponse | null> {
    return handleAuthErrors(() => this.gameRepository.findOne(this.executor, { where: { id } }));
  }

  @mutation((returns) => GameResponse)
  async createGame(@arg("game") game: GameInput): Promise<typeof GameResponse> {
    return handleAuthErrors(() => this.gameRepository.create(this.executor, game));
  }

  @fieldResolver()
  async picture(@root() game: Game) {
    return fromByteArray(game.pictureBuffer);
  }
}
