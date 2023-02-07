import { inject } from "@loopback/core";
import { DefaultCrudRepository, repository } from "@loopback/repository";
import { MongoDataSource } from "../datasources";
import { Filter } from "@loopback/filter";
import { Options } from "@loopback/repository/src/common-types";
import { AccessLevel, authorize, Executor } from "../authorization";
import { Contest, ContestInput, ContestStatus } from "../models/contest";
import { assertValue, convertObjectIdsToString } from "../utils";
import { GameRepository } from "./game.repository";
import { ValidationError } from "../errors";

export class ContestRepository {
  constructor(
    @inject("datasources.mongo") dataSource: MongoDataSource,
    @repository("GameRepository") readonly gameRepository: GameRepository,
  ) {
    this.repo = new DefaultCrudRepository(Contest, dataSource);
  }

  protected repo: DefaultCrudRepository<Contest, typeof Contest.prototype.id, {}>;

  get _systemAccess() {
    return this.repo;
  }

  async find(executor: Executor, filter?: Filter<Contest>, options?: Options) {
    authorize(AccessLevel.USER, executor);
    return this.repo.find(filter, options);
  }

  // async findById(executor: Executor, botId: string) {
  //   const bot = convertObjectIdsToString(await this.repo.findById(botId));
  //   authorize(AccessLevel.OWNER, executor, bot.userId);
  //   return bot;
  // }
  //
  // async findOne(executor: Executor, filter?: Filter<Bot>, options?: Options) {
  //   authorize(AccessLevel.ADMIN, executor);
  //   const bot = await this.repo.findOne(filter, options);
  //   return bot ? convertObjectIdsToString(bot) : bot;
  // }
  //
  async create(executor: Executor, contest: ContestInput, options?: Options) {
    authorize(AccessLevel.ADMIN, executor);
    assertValue(executor);
    await this.validateCreate(contest);
    return convertObjectIdsToString(
      await this.repo.create(
        {
          ...contest,
          ownerId: executor.id,
          botIds: [],
          matchIds: [],
          status: ContestStatus.OPEN,
        },
        options,
      ),
    );
  }
  //
  // async update(
  //   executor: Executor,
  //   botUpdate: Partial<Pick<Bot, "name" | "source" | "versionNumber" | "submitStatus">> &
  //     Pick<Bot, "id">,
  //   options?: Options,
  // ) {
  //   let bot;
  //   try {
  //     bot = convertObjectIdsToString(await this.repo.findById(botUpdate.id));
  //   } catch (error) {
  //     throw new AuthorizationError({});
  //   }
  //   authorize(AccessLevel.OWNER, executor, bot.userId);
  //   await this.repo.updateById(botUpdate.id, botUpdate, options);
  // }
  //
  // async deleteBot(executor: Executor, botId: string, options?: Options) {
  //   let bot;
  //   try {
  //     bot = convertObjectIdsToString(await this.repo.findById(botId));
  //   } catch (error) {
  //     throw new AuthorizationError({});
  //   }
  //   authorize(AccessLevel.OWNER, executor, bot.userId);
  //   await this.repo.deleteById(botId, options);
  // }
  //
  protected async validateCreate(contest: ContestInput) {
    const gameIdErrors = [];
    if (!(await this.gameRepository._systemAccess.exists(contest.gameId)))
      gameIdErrors.push("Game not found.");
    const nameErrors = [];
    if (contest.name.length === 0) nameErrors.push("Contest name must not be empty");
    const contestCount = await this.repo.count({
      name: contest.name,
    });
    if (contestCount.count > 0) nameErrors.push("A contest with this name already exists");
    const dateErrors = [];
    try {
      new Date(contest.date);
    } catch (error) {
      dateErrors.push("Contest date invalid: " + error.message);
    }
    if (nameErrors.length || gameIdErrors.length || dateErrors.length) {
      throw new ValidationError({
        fieldErrors: {
          ...(gameIdErrors.length && { gameId: gameIdErrors }),
          ...(nameErrors.length && { name: nameErrors }),
          ...(dateErrors.length && { date: dateErrors }),
        },
      });
    }
  }
}
