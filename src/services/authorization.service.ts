import { User } from "../models/user";
import { Match, MatchInput, MatchWithRelations } from "../models/match";
import { Bot, BotInput, BotWithRelations } from "../models/bot";
import { RegistrationInput } from "../models/auth";
import { repository } from "@loopback/repository";
import { AuthenticationError, AuthorizationError } from "../errors";
import { Contest, ContestInput, ContestWithRelations } from "../models/contest";
import { Game, GameInput, GameWithRelations } from "../models/game";
import { BotRepository } from "../repositories";
import { BindingScope, injectable } from "@loopback/core";
import { UserWithRelations } from "@loopback/authentication-jwt";

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
  async authorize<T extends ResourceObject>(
    actor: Actor,
    action: Action,
    object: T | CreateResourceObject | ResourceCollection | null,
    field?: keyof ResourceObjectWithRelations<T>,
  ) {
    if (action === Action.CREATE && object instanceof RegistrationInput) return;
    if (this.checkRoleBasedAccess(actor, action, object, field)) return;
    if (await this.checkRelationshipBasedAccess(actor, action, object, field)) return;
    if (!actor) throw new AuthenticationError({});
    throw new AuthorizationError({});
  }

  protected checkRoleBasedAccess<T extends ResourceObject>(
    actor: Actor,
    action: Action,
    object: T | CreateResourceObject | ResourceCollection | null,
    field?: keyof ResourceObjectWithRelations<T>,
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
          if (object instanceof Game) {
            if (action === Action.READ && field === "id") return true;
            if (action === Action.READ && field === "name") return true;
            if (action === Action.READ && field === "shortDescription") return true;
            if (action === Action.READ && field === "picture") return true;
            if (action === Action.READ && field === "fullDescription") return true;
            if (action === Action.READ && field === "playerCount") return true;
          }
          if (action === Action.READ && object === ResourceCollection.BOTS) return true;
          if (action === Action.CREATE && object instanceof BotInput) return true;
          if (object instanceof Bot) {
            if (action === Action.READ && field === "id") return true;
            if (action === Action.READ && field === "user") return true;
            if (action === Action.READ && field === "game") return true;
            if (action === Action.READ && field === "name") return true;
          }
          if (object instanceof Contest) {
            if (action === Action.READ && field === "id") return true;
            if (action === Action.READ && field === "game") return true;
            if (action === Action.READ && field === "owner") return true;
            if (action === Action.READ && field === "name") return true;
            if (action === Action.READ && field === "date") return true;
            if (action === Action.READ && field === "bots") return true;
            if (action === Action.READ && field === "status") return true;
          }
        }
      }
    return false;
  }

  @repository("BotRepository") protected botRepository: BotRepository;

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
      if (action === Action.DELETE) return true;
    }
    if (object instanceof Bot && actor.id === object.userId) {
      if (action === Action.READ && field === "submitStatus") return true;
      if (action === Action.READ && field === "source") return true;
      if (action === Action.UPDATE && field === "source") return true;
      if (action === Action.DELETE) return true;
    }
    if (action === Action.CREATE && object instanceof MatchInput) {
      const bots = await this.botRepository.find({ where: { id: { inq: object.botIds } } });
      if (bots.every((bot) => bot.userId === actor.id)) return true; // TODO handle system bots
    }
    if (object instanceof Match) {
      const bots = await this.botRepository.find({ where: { id: { inq: object.botIds } } });
      const isParticipant = bots.some((bot) => bot.userId === actor.id);
      if (object.userId === actor.id || isParticipant) {
        if (action === Action.READ && field === "id") return true;
        if (action === Action.READ && field === "user") return true;
        if (action === Action.READ && field === "game") return true;
        if (action === Action.READ && field === "bots") return true;
        if (action === Action.READ && field === "date") return true;
        if (action === Action.READ && field === "runStatus") return true;
        if (action === Action.READ && field === "result") return true;
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
}
