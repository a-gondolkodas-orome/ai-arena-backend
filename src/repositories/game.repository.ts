import { inject } from "@loopback/core";
import { DefaultCrudRepository } from "@loopback/repository";
import { MongoDataSource } from "../datasources";
import { Game, GameRelations } from "../models/game";

export class GameRepository extends DefaultCrudRepository<
  Game,
  typeof Game.prototype.id,
  GameRelations
> {
  constructor(@inject("datasources.mongo") dataSource: MongoDataSource) {
    super(Game, dataSource);
  }
}
