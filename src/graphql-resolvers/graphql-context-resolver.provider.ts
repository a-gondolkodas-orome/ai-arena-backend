import { inject, Provider } from "@loopback/core";
import { AiArenaBindings } from "../keys";
import { AuthenticationStrategy } from "@loopback/authentication";
import { ContextFunction, ExpressContext } from "@loopback/graphql/src/types";
import { Condition, Entity, repository } from "@loopback/repository";
import { authenticateRequest } from "../authentication/authentication";
import { UserRepository } from "../repositories/user.repository";
import DataLoader from "dataloader";
import { AssertException } from "../errors";
import { MongodbRepository } from "../repositories/mongodb.repository";
import { User } from "../models/user";
import { Game } from "../models/game";
import { Bot } from "../models/bot";
import { Match } from "../models/match";
import { Contest } from "../models/contest";
import { BotRepository } from "../repositories/bot.repository";
import { GameRepository } from "../repositories/game.repository";
import { ContestRepository } from "../repositories/contest.repository";
import { MatchRepository } from "../repositories/match.repository";
import { Actor, isActor } from "../services/authorization.service";

export class GraphqlContextResolverProvider implements Provider<ContextFunction<ExpressContext>> {
  constructor(
    @inject(AiArenaBindings.AUTH_STRATEGY)
    protected authStrategy: AuthenticationStrategy,
    @repository(UserRepository) public userRepository: UserRepository,
    @repository(GameRepository) public gameRepository: GameRepository,
    @repository(BotRepository) public botRepository: BotRepository,
    @repository(MatchRepository) public matchRepository: MatchRepository,
    @repository(ContestRepository) public contestRepository: ContestRepository,
  ) {}

  value(): ContextFunction<ExpressContext> {
    return async (context: ExpressContext) => {
      return {
        ...context,
        actor: await authenticateRequest(this.authStrategy, this.userRepository, context.req),
        loaders: {
          user: this.createDataLoader(this.userRepository),
          game: this.createDataLoader(this.gameRepository),
          bot: this.createDataLoader(this.botRepository),
          match: this.createDataLoader(this.matchRepository),
          contest: this.createDataLoader(this.contestRepository),
        },
      };
    };
  }

  protected isIdArray(ids: readonly unknown[]): ids is string[] {
    return ids.every((id) => typeof id === "string");
  }

  protected createDataLoader<T extends Entity & { id: string }, Relations extends {}>(
    mongodbRepository: MongodbRepository<T, string, Relations>,
  ) {
    return new DataLoader<string, T | null>(async (ids) => {
      if (!this.isIdArray(ids))
        throw new AssertException({
          message: `${mongodbRepository.entityClass.modelName} DataLoader: invalid ids`,
          values: { ids },
        });
      const entitiesById = new Map(
        (await mongodbRepository.find({ where: { id: { inq: ids } } as Condition<T> })).map(
          (entity) => [entity.id, entity],
        ),
      );
      return ids.map((id) => entitiesById.get(id) ?? null);
    });
  }
}

export type GraphqlDataLoaders = {
  // TODO make result type optional & handle missing entities
  user: DataLoader<typeof User.prototype.id, User>;
  game: DataLoader<typeof Game.prototype.id, Game>;
  bot: DataLoader<typeof Bot.prototype.id, Bot>;
  match: DataLoader<typeof Match.prototype.id, Match>;
  contest: DataLoader<typeof Contest.prototype.id, Contest>;
};

export type AiArenaGraphqlContext = {
  actor: Actor;
  loaders: GraphqlDataLoaders;
};

export function isAiArenaGraphqlContext(value: unknown): value is AiArenaGraphqlContext {
  const context = value as AiArenaGraphqlContext;
  return (
    isActor(context.actor) &&
    context.loaders &&
    context.loaders.user instanceof DataLoader &&
    context.loaders.game instanceof DataLoader &&
    context.loaders.bot instanceof DataLoader &&
    context.loaders.match instanceof DataLoader &&
    context.loaders.contest instanceof DataLoader
  );
}
