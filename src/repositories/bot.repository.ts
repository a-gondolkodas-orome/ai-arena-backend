import { Getter, inject } from "@loopback/core";
import { BelongsToAccessor, repository } from "@loopback/repository";
import { MongoDataSource } from "../datasources";
import { Bot, BotInput, BotRelations, BotSubmitStage } from "../models/bot";
import { DataObject, Options } from "@loopback/repository/src/common-types";
import { convertObjectIdsToString } from "../utils";
import { GameRepository } from "./game.repository";
import { ValidationError } from "../errors";
import { User } from "../models/user";
import { UserRepository } from "./user.repository";
import { Game } from "../models/game";
import { MongodbRepository } from "./mongodb.repository";

export class BotRepository extends MongodbRepository<Bot, typeof Bot.prototype.id, BotRelations> {
  constructor(
    @inject("datasources.mongo") dataSource: MongoDataSource,
    @repository.getter("UserRepository") readonly getUserRepository: Getter<UserRepository>,
    @repository.getter("GameRepository") readonly getGameRepository: Getter<GameRepository>,
  ) {
    super(Bot, dataSource);
    this.user = this.createBelongsToAccessorFor("user", getUserRepository);
    this.registerInclusionResolver("user", this.user.inclusionResolver);
    this.game = this.createBelongsToAccessorFor("game", getGameRepository);
    this.registerInclusionResolver("game", this.game.inclusionResolver);
  }

  readonly user: BelongsToAccessor<User, typeof Bot.prototype.id>;
  readonly game: BelongsToAccessor<Game, typeof Bot.prototype.id>;

  async validateAndCreate(user: User, bot: BotInput, options?: Options) {
    const nameErrors = [];
    if (bot.name.length === 0) nameErrors.push("Bot name must not be empty");
    const botCount = await this.count({
      userId: user.id,
      gameId: bot.gameId,
      name: bot.name,
      deleted: false,
    });
    if (botCount.count > 0) nameErrors.push("Bot name already in use");
    const gameIdErrors = [];
    if (!(await (await this.getGameRepository()).exists(bot.gameId)))
      gameIdErrors.push("Game not found.");
    if (nameErrors.length || gameIdErrors.length) {
      throw new ValidationError({
        fieldErrors: {
          ...(nameErrors.length && { name: nameErrors }),
          ...(gameIdErrors.length && { gameId: gameIdErrors }),
        },
      });
    }

    return convertObjectIdsToString(
      await super.create(
        {
          ...bot,
          userId: user.id,
          submitStatus: { stage: BotSubmitStage.REGISTERED },
          versionNumber: 0,
          deleted: false,
        },
        options,
      ),
    );
  }

  async create(entity: DataObject<Bot>, options?: Options) {
    return convertObjectIdsToString(await super.create(entity));
  }
}
