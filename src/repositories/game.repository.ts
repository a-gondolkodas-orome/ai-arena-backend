import { inject } from "@loopback/core";
import { DefaultCrudRepository, Where } from "@loopback/repository";
import { MongoDataSource } from "../datasources";
import { Game, GameData } from "../models/game";
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

  async count(executor: Executor, where?: Where<Game>, options?: Options) {
    authorize(AccessLevel.ADMIN, executor);
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

  async create(executor: Executor, game: GameData, options?: Options) {
    authorize(AccessLevel.ADMIN, executor);
    return this.repo.create(game, options);
  }
}
