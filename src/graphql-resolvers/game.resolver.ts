import { inject } from "@loopback/core";
import {
  arg,
  GraphQLBindings,
  mutation,
  query,
  resolver,
  ResolverData,
} from "@loopback/graphql";
import { repository } from "@loopback/repository";
import { Game, GameInput, GameResponse, GamesResponse } from "../models/game";
import { GameRepository } from "../repositories";
import { BaseResolver } from "./base.resolver";
import { handleAuthErrors } from "../models/auth";

@resolver((of) => Game)
export class GameResolver extends BaseResolver {
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
    return handleAuthErrors(() =>
      this.gameRepository.findOne(this.executor, { where: { id } }),
    );
  }

  @mutation((returns) => GameResponse)
  async createGame(@arg("game") game: GameInput): Promise<typeof GameResponse> {
    return handleAuthErrors(() =>
      this.gameRepository.create(this.executor, game),
    );
  }
}
