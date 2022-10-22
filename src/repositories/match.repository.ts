import { inject } from "@loopback/core";
import { DefaultCrudRepository, repository } from "@loopback/repository";
import { MongoDataSource } from "../datasources";
import { Match, MatchInput } from "../models/match";
import { Filter } from "@loopback/filter";
import { Options } from "@loopback/repository/src/common-types";
import { AccessLevel, authorize, Executor } from "../authorization";
import { assertValue, convertObjectIdsToString } from "../utils";
import { GameRepository } from "./game.repository";
import { AuthorizationError, ValidationError } from "../errors";
import { User } from "../models/user";
import { BotRepository } from "./bot.repository";

export class MatchRepository {
  constructor(
    @inject("datasources.mongo") dataSource: MongoDataSource,
    @repository("GameRepository") readonly gameRepository: GameRepository,
    @repository("BotRepository") readonly botRepository: BotRepository,
  ) {
    this.repo = new DefaultCrudRepository(Match, dataSource);
  }

  protected repo: DefaultCrudRepository<Match, typeof Match.prototype.id, {}>;

  get _systemAccess() {
    return this.repo;
  }

  async getUserMatches(
    executor: Executor,
    filter?: Filter<Match>,
    options?: Options,
  ) {
    authorize(AccessLevel.USER, executor);
    assertValue(executor);
    return (
      await this.repo.find(
        { ...filter, where: { ...filter?.where, userId: executor.id } },
        options,
      )
    ).map((match) => convertObjectIdsToString(match));
  }

  async findOne(executor: Executor, filter?: Filter<Match>, options?: Options) {
    authorize(AccessLevel.ADMIN, executor);
    const match = await this.repo.findOne(filter, options);
    return match ? convertObjectIdsToString(match) : match;
  }

  async create(executor: Executor, match: MatchInput, options?: Options) {
    authorize(AccessLevel.USER, executor);
    assertValue(executor);
    await this.validateCreate(executor, match);
    return convertObjectIdsToString(
      await this.repo.create(
        {
          ...match,
          userId: executor.id,
        },
        options,
      ),
    );
  }

  async deleteMatch(executor: Executor, matchId: string, options?: Options) {
    let match;
    try {
      match = convertObjectIdsToString(await this.repo.findById(matchId));
    } catch (error) {
      throw new AuthorizationError({});
    }
    authorize(AccessLevel.OWNER, executor, match.userId);
    await this.repo.deleteById(matchId, options);
  }

  protected async validateCreate(owner: User, match: MatchInput) {
    const gameIdErrors = [];
    if (!(await this.gameRepository._systemAccess.exists(match.gameId)))
      gameIdErrors.push("Game not found.");
    const botIdErrors = [];
    for (const botId of match.botIds) {
      if (!(await this.botRepository._systemAccess.exists(botId)))
        botIdErrors.push(`Bot not found (${botId}).`);
    }
    if (gameIdErrors.length || botIdErrors.length) {
      throw new ValidationError({
        fieldErrors: {
          ...(gameIdErrors.length && { gameId: gameIdErrors }),
          ...(botIdErrors.length && { botIds: botIdErrors }),
        },
      });
    }
  }
}
