import { inject } from "@loopback/core";
import { DefaultCrudRepository, repository } from "@loopback/repository";
import { MongoDataSource } from "../datasources";
import { Match, MatchInput, MatchRelations, MatchRunStage } from "../models/match";
import { Options } from "@loopback/repository/src/common-types";
import { convertObjectIdsToString } from "../utils";
import { GameRepository } from "./game.repository";
import { ValidationError } from "../errors";
import { BotRepository } from "./bot.repository";
import { User } from "../models/user";

export class MatchRepository extends DefaultCrudRepository<
  Match,
  typeof Match.prototype.id,
  MatchRelations
> {
  constructor(
    @inject("datasources.mongo") dataSource: MongoDataSource,
    @repository("GameRepository") readonly gameRepository: GameRepository,
    @repository("BotRepository") readonly botRepository: BotRepository,
  ) {
    super(Match, dataSource);
  }

  async validateAndCreate(actor: User, match: MatchInput, options?: Options) {
    const gameIdErrors = [];
    if (!(await this.gameRepository.exists(match.gameId))) gameIdErrors.push("Game not found.");
    const botIdErrors = [];
    for (const botId of match.botIds) {
      const bot = await this.botRepository.findOne({ where: { id: botId } });
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
