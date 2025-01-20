import { Getter, inject } from "@loopback/core";
import { BelongsToAccessor, ReferencesManyAccessor, repository } from "@loopback/repository";
import { MongoDataSource } from "../datasources";
import { Options } from "@loopback/repository/src/common-types";
import { Contest, ContestInput, ContestRelations, ContestStatus } from "../models/contest";
import { convertObjectIdsToString } from "../../shared/utils";
import { GameRepository } from "./game.repository";
import { ValidationError } from "../../shared/errors";
import { Game } from "../models/game";
import { User } from "../models/user";
import { UserRepository } from "./user.repository";
import { Bot } from "../models/bot";
import { BotRepository } from "./bot.repository";
import { MatchRepository } from "./match.repository";
import { Match, MatchRunStage } from "../models/match";
import { MongodbRepository } from "./mongodb.repository";
import * as mongodb from "mongodb";
import { MONGODB_DATABASE } from "../../shared/common";

export class ContestRepository extends MongodbRepository<
  Contest,
  typeof Contest.prototype.id,
  ContestRelations
> {
  constructor(
    @inject("datasources.mongo") dataSource: MongoDataSource,
    @repository.getter("GameRepository") readonly getGameRepository: Getter<GameRepository>,
    @repository.getter("UserRepository") readonly getUserRepository: Getter<UserRepository>,
    @repository.getter("BotRepository") readonly getBotRepository: Getter<BotRepository>,
    @repository.getter("MatchRepository") readonly getMatchRepository: Getter<MatchRepository>,
  ) {
    super(Contest, dataSource);
    this.game = this.createBelongsToAccessorFor("game", getGameRepository);
    this.registerInclusionResolver("game", this.game.inclusionResolver);
    this.owner = this.createBelongsToAccessorFor("owner", getUserRepository);
    this.registerInclusionResolver("owner", this.owner.inclusionResolver);
    this.bots = this.createReferencesManyAccessorFor("bots", getBotRepository);
    this.registerInclusionResolver("bots", this.bots.inclusionResolver);
    this.matches = this.createReferencesManyAccessorFor("matches", getMatchRepository);
    this.registerInclusionResolver("matches", this.matches.inclusionResolver);
  }

  readonly game: BelongsToAccessor<Game, typeof Contest.prototype.id>;
  readonly owner: BelongsToAccessor<User, typeof Contest.prototype.id>;
  readonly bots: ReferencesManyAccessor<Bot, typeof Contest.prototype.id>;
  readonly matches: ReferencesManyAccessor<Match, typeof Contest.prototype.id>;

  async validateAndCreate(actor: User, contest: ContestInput, options?: Options) {
    const gameIdErrors = [];
    const mapNameErrors = [];
    const game = await (await this.getGameRepository()).findOne({ where: { id: contest.gameId } });
    if (!game) gameIdErrors.push("Game not found.");
    else {
      const gameMapNames = game.maps.map((map) => map.name);
      for (const contestMapName of contest.mapNames)
        if (!gameMapNames.includes(contestMapName)) {
          mapNameErrors.push(`Map ${contestMapName} not found.`);
        }
    }
    const nameErrors = [];
    if (contest.name.length === 0) nameErrors.push("Contest name must not be empty");
    const contestCount = await this.count({ name: contest.name });
    if (contestCount.count > 0) nameErrors.push("A contest with this name already exists");
    const dateErrors = [];
    try {
      new Date(contest.date);
    } catch (error: unknown) {
      dateErrors.push(
        `Contest date invalid: ${error instanceof Error ? error.message : "unknown exception"}`,
      );
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

    return convertObjectIdsToString(
      await this.create(
        {
          ...contest,
          ownerId: actor.id,
          botIds: [],
          matchIds: [],
          status: ContestStatus.OPEN,
          isArchived: false,
        },
        options,
      ),
    );
  }

  async updateWithVersionCheck(entity: Contest, options?: Options): Promise<boolean> {
    return !!(await this.updateAll(entity, { id: entity.id, _version: entity._version++ }, options))
      .count;
  }

  async getMatchSizeTotal(contest: Contest) {
    const mongo = (this.dataSource.connector as unknown as { client: mongodb.MongoClient }).client;
    const result = await mongo
      .db(MONGODB_DATABASE)
      .collection(MatchRepository.COLLECTION_NAME)
      .aggregate([
        { $match: { _id: { $in: contest.matchIds.map((id) => new mongodb.ObjectId(id)) } } },
        { $group: { _id: 1, matchSizeTotal: { $sum: { $binarySize: "$log.file" } } } },
      ])
      .toArray();
    return result.length ? (result[0].matchSizeTotal as number) : 0;
  }

  async getCompletedMatchCount(contest: Contest) {
    const mongo = (this.dataSource.connector as unknown as { client: mongodb.MongoClient }).client;
    return mongo
      .db(MONGODB_DATABASE)
      .collection(MatchRepository.COLLECTION_NAME)
      .countDocuments({
        _id: { $in: contest.matchIds.map((id) => new mongodb.ObjectId(id)) },
        "runStatus.stage": {
          $in: [
            MatchRunStage.RUN_SUCCESS,
            MatchRunStage.PREPARE_GAME_SERVER_ERROR,
            MatchRunStage.PREPARE_BOTS_ERROR,
            MatchRunStage.RUN_ERROR,
          ],
        },
      });
  }
}
