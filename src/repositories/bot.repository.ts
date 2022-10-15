import { inject } from "@loopback/core";
import { DefaultCrudRepository, repository } from "@loopback/repository";
import { MongoDataSource } from "../datasources";
import { Bot, BotInput } from "../models/bot";
import { Filter } from "@loopback/filter";
import { Options } from "@loopback/repository/src/common-types";
import { AccessLevel, authorize, Executor } from "../authorization";
import { AiArenaBindings } from "../keys";
import { UserService } from "../services";
import { assertValue, convertObjectIdsToString } from "../utils";
import { GameRepository } from "./game.repository";
import { UserException, ValidationError } from "../errors";
import { User } from "../models/user";

export class BotRepository {
  constructor(
    @inject("datasources.mongo") dataSource: MongoDataSource,
    @inject(AiArenaBindings.USER_SERVICE) public userService: UserService,
    @repository("GameRepository") readonly gameRepository: GameRepository,
  ) {
    this.repo = new DefaultCrudRepository<Bot, typeof Bot.prototype.id, {}>(
      Bot,
      dataSource,
    );
  }

  protected repo: DefaultCrudRepository<Bot, typeof Bot.prototype.id, {}>;

  get _systemAccess() {
    return this.repo;
  }

  async getUserBots(
    executor: Executor,
    filter?: Filter<Bot>,
    options?: Options,
  ) {
    authorize(AccessLevel.USER, executor);
    assertValue(executor);
    return (
      await this.repo.find(
        { ...filter, where: { ...filter?.where, userId: executor.id } },
        options,
      )
    ).map((bot) => convertObjectIdsToString(bot));
  }

  async findOne(executor: Executor, filter?: Filter<Bot>, options?: Options) {
    authorize(AccessLevel.ADMIN, executor);
    const bot = await this.repo.findOne(filter, options);
    return bot ? convertObjectIdsToString(bot) : bot;
  }

  async create(executor: Executor, bot: BotInput, options?: Options) {
    authorize(AccessLevel.USER, executor);
    assertValue(executor);
    await this.validateCreate(executor, bot);
    return convertObjectIdsToString(
      await this.repo.create(
        {
          ...bot,
          userId: executor.id,
          versionNumber: 0,
        },
        options,
      ),
    );
  }

  async update(
    executor: Executor,
    botUpdate: Partial<Pick<Bot, "name" | "source" | "versionNumber">> &
      Pick<Bot, "id">,
    options?: Options,
  ) {
    let bot;
    try {
      bot = convertObjectIdsToString(await this.repo.findById(botUpdate.id));
    } catch (error) {
      throw new UserException({
        message: "BotRepository.update: Bot not found",
        values: { id: botUpdate.id, originalError: error.message },
      });
    }
    authorize(AccessLevel.OWNER, executor, bot.userId);
    await this.repo.updateById(botUpdate.id, botUpdate, options);
  }

  protected async validateCreate(owner: User, bot: BotInput) {
    const nameErrors = [];
    if (bot.name.length === 0) nameErrors.push("Bot name must not be empty");
    const botCount = await this.repo.count({
      userId: owner.id,
      gameId: bot.gameId,
      name: bot.name,
    });
    if (botCount.count > 0) nameErrors.push("Bot name already in use");
    const gameIdErrors = [];
    if (!(await this.gameRepository._systemAccess.exists(bot.gameId)))
      gameIdErrors.push("Game not found.");
    if (nameErrors.length || gameIdErrors.length) {
      throw new ValidationError({
        fieldErrors: {
          ...(nameErrors.length && { name: nameErrors }),
          ...(gameIdErrors.length && { gameId: gameIdErrors }),
        },
      });
    }
  }
}
