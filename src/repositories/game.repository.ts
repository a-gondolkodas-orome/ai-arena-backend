import { inject } from "@loopback/core";
import { DefaultCrudRepository, Where } from "@loopback/repository";
import { MongoDataSource } from "../datasources";
import { Game, GameInput } from "../models/game";
import { Filter } from "@loopback/filter";
import { Options } from "@loopback/repository/src/common-types";
import { AccessLevel, Executor, authorize } from "../authorization";

export class GameRepository {
  constructor(@inject("datasources.mongo") dataSource: MongoDataSource) {
    this.repo = new DefaultCrudRepository<Game, typeof Game.prototype.id, {}>(
      Game,
      dataSource,
    );
  }
  protected repo: DefaultCrudRepository<Game, typeof Game.prototype.id, {}>;

  get _systemAccess() {
    return this.repo;
  }

  async exists(executor: Executor, gameId: string, options?: Options) {
    authorize(AccessLevel.USER, executor);
    return this.repo.exists(gameId, options);
  }

  async count(executor: Executor, where?: Where<Game>, options?: Options) {
    authorize(AccessLevel.USER, executor);
    return this.repo.count(where, options);
  }

  async find(executor: Executor, filter?: Filter<Game>, options?: Options) {
    authorize(AccessLevel.USER, executor);
    return this.repo.find(filter, options);
  }

  async findOne(executor: Executor, filter?: Filter<Game>, options?: Options) {
    authorize(AccessLevel.USER, executor);
    return this.repo.findOne(filter, options);
  }

  async create(executor: Executor, game: GameInput, options?: Options) {
    authorize(AccessLevel.ADMIN, executor);
    return this.repo.create(game, options);
  }
}
