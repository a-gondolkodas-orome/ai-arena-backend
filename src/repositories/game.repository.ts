import { inject } from "@loopback/core";
import { MongoDataSource } from "../datasources";
import { Game, GameRelations } from "../models/game";
import { MongodbRepository } from "./mongodb.repository";

export class GameRepository extends MongodbRepository<
  Game,
  typeof Game.prototype.id,
  GameRelations
> {
  constructor(@inject("datasources.mongo") dataSource: MongoDataSource) {
    super(Game, dataSource);
  }
}
