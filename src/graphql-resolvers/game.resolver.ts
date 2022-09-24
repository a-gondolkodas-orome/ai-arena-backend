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
import { Game, GameData } from "../models/game";
import { GameRepository } from "../repositories";
import { Executor, isExecutor } from "../authorization";
import { AssertException } from "../errors";

@resolver((of) => Game)
export class GameResolver {
  constructor(
    @repository("GameRepository") readonly gameRepository: GameRepository,
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    const context = resolverData.context;
    if (!this.isContextWithExecutor(context)) {
      throw new AssertException({
        message: "GameResolver: unhandled context structure",
        values: { context },
      });
    }
    this.executor = context.executor;
  }

  protected readonly executor: Executor;

  protected isContextWithExecutor(
    value: unknown,
  ): value is { executor: Executor } {
    const context = value as { executor: unknown };
    return isExecutor(context.executor);
  }

  @query((returns) => [Game])
  async games(): Promise<Game[]> {
    return this.gameRepository.find(this.executor);
  }

  @query((returns) => Game, { nullable: true })
  async findGame(@arg("id") id: string): Promise<Game | null> {
    return this.gameRepository.findOne(this.executor, { where: { id } });
  }

  @mutation((returns) => Game)
  async createGame(@arg("game") game: GameData): Promise<Game> {
    return this.gameRepository.create(this.executor, game);
  }
}
