import { User, UserWithRelations } from "../models/user";
import { Match, MatchInput, MatchWithRelations } from "../models/match";
import { Bot, BotInput, BotWithRelations } from "../models/bot";
import { RegistrationInput } from "../models/auth";
import { repository } from "@loopback/repository";
import { AuthenticationError, AuthorizationError } from "../errors";
import { Contest, ContestInput, ContestWithRelations } from "../models/contest";
import { Game, GameInput, GameWithRelations } from "../models/game";
import { BindingScope, injectable } from "@loopback/core";
import { BotRepository } from "../repositories/bot.repository";
import { ContestRepository } from "../repositories/contest.repository";
import { UserRepository } from "../repositories/user.repository";

export const EXECUTOR_SYSTEM = "EXECUTOR_SYSTEM";

export type Actor = User | null;

export function isActor(value: unknown): value is Actor {
  return value instanceof User || value === null;
}

export enum Action {
  CREATE = "CREATE",
  READ = "READ",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  CONTEST_REGISTER = "CONTEST_REGISTER",
  CONTEST_UNREGISTER = "CONTEST_UNREGISTER",
  CONTEST_START = "CONTEST_START",
}

export type ResourceObject = User | Game | Bot | Match | Contest;
type ResourceObjectWithRelations<T> = T extends User
  ? UserWithRelations
  : T extends Game
  ? GameWithRelations
  : T extends Bot
  ? BotWithRelations
  : T extends Match
  ? MatchWithRelations
  : T extends Contest
  ? ContestWithRelations
  : never;

export type CreateResourceObject =
  | RegistrationInput
  | GameInput
  | BotInput
  | MatchInput
  | ContestInput;

export enum ResourceCollection {
  USERS = "USERS",
  GAMES = "GAMES",
  BOTS = "BOTS",
  MATCHES = "MATCHES",
  CONTESTS = "CONTESTS",
}

export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
}

@injectable({ scope: BindingScope.SINGLETON })
export class AuthorizationService {
  constructor(@repository("UserRepository") protected userRepository: UserRepository) {}

  async authorize<T extends ResourceObject>(
    actor: Actor,
    action: Action,
    object: T | CreateResourceObject | ResourceCollection | null,
    field?: keyof ResourceObjectWithRelations<T>,
    value?: unknown,
  ) {
    if (action === Action.CREATE && object instanceof RegistrationInput) return;
    if (await this.checkRoleBasedAccess(actor, action, object, field, value)) return;
    if (await this.checkRelationshipBasedAccess(actor, action, object, field)) return;
    if (!actor) throw new AuthenticationError({});
    throw new AuthorizationError({});
  }

  protected async checkRoleBasedAccess<T extends ResourceObject>(
    actor: Actor,
    action: Action,
    object: T | CreateResourceObject | ResourceCollection | null,
    field?: keyof ResourceObjectWithRelations<T>,
    value?: unknown,
  ) {
    if (!actor) return false;
    for (const role of actor.roles)
      switch (role) {
        case Role.ADMIN:
          return true;
        case Role.USER: {
          if (object instanceof User) {
            if (action === Action.READ && field === "id") return true;
            if (action === Action.READ && field === "username") return true;
          }
          if (action === Action.READ && object === ResourceCollection.GAMES) return true;
          if (object instanceof Game) {
            if (action === Action.READ && field === "id") return true;
            if (action === Action.READ && field === "name") return true;
            if (action === Action.READ && field === "shortDescription") return true;
            if (action === Action.READ && field === "picture") return true;
            if (action === Action.READ && field === "fullDescription") return true;
            if (action === Action.READ && field === "playerCount") return true;
            if (action === Action.READ && field === "maps") return true;
          }
          if (action === Action.READ && object === ResourceCollection.BOTS) return true;
          if (action === Action.CREATE && object instanceof BotInput) return true;
          if (object instanceof Bot) {
            if (action === Action.READ && field === "id") return true;
            if (action === Action.READ && field === "user") return true;
            if (action === Action.READ && field === "game") return true;
            if (action === Action.READ && field === "name") return true;
            if (action === Action.READ && field === "deleted") return true;
          }
          if (action === Action.READ && object === ResourceCollection.MATCHES) return true;
          if (action === Action.READ && object === ResourceCollection.CONTESTS) return true;
          if (object instanceof Contest) {
            if (action === Action.READ && field === "id") return true;
            if (action === Action.READ && field === "game") return true;
            if (action === Action.READ && field === "owner") return true;
            if (action === Action.READ && field === "name") return true;
            if (action === Action.READ && field === "date") return true;
            if (action === Action.READ && field === "mapNames") return true;
            if (action === Action.READ && field === "bots") return true;
            if (action === Action.READ && field === "status") return true;
            if (action === Action.READ && field === "progress") return true;
            if (action === Action.READ && field === "scoreJson") return true;
            if (
              action === Action.CONTEST_REGISTER &&
              value instanceof Bot &&
              (await this.canUseBots(actor, [value.id], false))
            )
              return true;
            if (action === Action.CONTEST_UNREGISTER) return true;
          }
        }
      }
    return false;
  }

  @repository("BotRepository") protected botRepository: BotRepository;
  @repository("ContestRepository") protected contestRepository: ContestRepository;

  async checkRelationshipBasedAccess<T extends ResourceObject>(
    actor: Actor,
    action: Action,
    object: T | CreateResourceObject | ResourceCollection | null,
    field?: keyof ResourceObjectWithRelations<T>,
  ) {
    if (!actor) return false;
    if (object instanceof User && actor.id === object.id) {
      if (action === Action.READ && field === "email") return true;
      if (action === Action.UPDATE && field === "email") return true;
      if (action === Action.READ && field === "roles") return true;
      if (action === Action.DELETE) return true;
    }
    if (
      object instanceof Bot &&
      (actor.id === object.userId || object.userId === (await this.getSystemUser()).id)
    ) {
      if (action === Action.READ && field === "submitStatus") return true;
      if (action === Action.READ && field === "source") return true;
      if (action === Action.UPDATE && field === "source") return true;
      if (action === Action.DELETE) return true;
    }
    if (
      action === Action.CREATE &&
      object instanceof MatchInput &&
      (await this.canUseBots(actor, object.botIds, true))
    )
      return true;
    if (object instanceof Match) {
      const bots = await this.botRepository.find({ where: { id: { inq: object.botIds } } });
      const isMatchParticipant = bots.some((bot) => bot.userId === actor.id);
      let isContestParticipant = false;
      if (!isMatchParticipant) {
        const contest = await this.contestRepository.findOne({
          where: { matchIds: object.id as string[] & string },
          include: ["bots"],
        });
        isContestParticipant = !!contest?.bots?.some((bot) => bot.userId === actor.id);
      }
      if (object.userId === actor.id || isMatchParticipant || isContestParticipant) {
        if (action === Action.READ && field === "id") return true;
        if (action === Action.READ && field === "user") return true;
        if (action === Action.READ && field === "game") return true;
        if (action === Action.READ && field === "mapName") return true;
        if (action === Action.READ && field === "bots") return true;
        if (action === Action.READ && field === "date") return true;
        if (action === Action.READ && field === "runStatus") return true;
        if (action === Action.READ && field === "logString") return true;
        if (action === Action.READ && field === "scoreJson") return true;
      }
      if (object.userId === actor.id && action === Action.DELETE) return true;
    }
    if (action === Action.READ && object instanceof Contest && field === "matches") {
      const registeredBots = await this.botRepository.find({
        where: { id: { inq: object.botIds }, userId: actor.id },
      });
      if (registeredBots.length) return true;
    }
    return false;
  }

  protected async canUseBots(actor: User, botIds: string[], allowTestBots: boolean) {
    botIds = Array.from(new Set(botIds));
    const bots = await this.botRepository.find({ where: { id: { inq: botIds } } });
    const systemUser = await this.getSystemUser();
    return (
      bots.length === botIds.length &&
      bots.every(
        (bot) => bot.userId === actor.id || (allowTestBots && bot.userId === systemUser.id),
      )
    );
  }

  protected _systemUser?: User;
  protected async getSystemUser() {
    if (this._systemUser) return this._systemUser;
    return (this._systemUser = await this.userRepository._getSystemUser());
  }
}
