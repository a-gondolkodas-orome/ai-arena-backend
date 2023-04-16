import { Getter, inject } from "@loopback/core";
import { BelongsToAccessor, ReferencesManyAccessor, repository } from "@loopback/repository";
import { MongoDataSource } from "../datasources";
import { Match, MatchInput, MatchRelations, MatchRunStage } from "../models/match";
import { Options } from "@loopback/repository/src/common-types";
import { convertObjectIdsToString } from "../utils";
import { GameRepository } from "./game.repository";
import { ValidationError } from "../errors";
import { BotRepository } from "./bot.repository";
import { User } from "../models/user";
import { MongodbRepository } from "./mongodb.repository";
import { Bot } from "../models/bot";
import { Game } from "../models/game";
import { UserRepository } from "./user.repository";

export class MatchRepository extends MongodbRepository<
  Match,
  typeof Match.prototype.id,
  MatchRelations
> {
  constructor(
    @inject("datasources.mongo") dataSource: MongoDataSource,
    @repository.getter("UserRepository") readonly getUserRepository: Getter<UserRepository>,
    @repository.getter("GameRepository") readonly getGameRepository: Getter<GameRepository>,
    @repository.getter("BotRepository") readonly getBotRepository: Getter<BotRepository>,
  ) {
    super(Match, dataSource);
    this.user = this.createBelongsToAccessorFor("user", getUserRepository);
    this.registerInclusionResolver("user", this.user.inclusionResolver);
    this.game = this.createBelongsToAccessorFor("game", getGameRepository);
    this.registerInclusionResolver("game", this.game.inclusionResolver);
    this.bots = this.createReferencesManyAccessorFor("bots", getBotRepository);
    this.registerInclusionResolver("bots", this.bots.inclusionResolver);
  }

  readonly user: BelongsToAccessor<User, typeof Bot.prototype.id>;
  readonly game: BelongsToAccessor<Game, typeof Bot.prototype.id>;
  readonly bots: ReferencesManyAccessor<Bot, typeof Bot.prototype.id>;

  async validateAndCreate(actor: User, match: MatchInput, options?: Options) {
    const gameIdErrors = [];
    if (!(await (await this.getGameRepository()).exists(match.gameId)))
      gameIdErrors.push("Game not found.");
    const botIdErrors = [];
    if (!match.botIds.length) botIdErrors.push("No bot specified.");
    for (const botId of match.botIds) {
      const bot = await (await this.getBotRepository()).findOne({ where: { id: botId } });
      if (!bot) botIdErrors.push(`Bot not found (${botId}).`);
    }
    if (gameIdErrors.length || botIdErrors.length) {
      throw new ValidationError({
        fieldErrors: {
          ...(gameIdErrors.length && { gameId: gameIdErrors }),
          ...(botIdErrors.length && { botIds: botIdErrors }),
        },
      });
    }

    return convertObjectIdsToString(
      await this.create(
        {
          ...match,
          userId: actor.id,
          runStatus: { stage: MatchRunStage.REGISTERED },
        },
        options,
      ),
    );
  }
}
