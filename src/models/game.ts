import { field, ID, inputType, objectType } from "@loopback/graphql";
import { Entity, Model, model, property } from "@loopback/repository";
import { createAuthErrorUnionType } from "./auth";
import { File } from "./base";
import { GqlValue } from "../utils";
import { fromByteArray } from "base64-js";
import {
  Action,
  Actor,
  AuthorizationService,
  ResourceCollection,
} from "../services/authorization.service";
import { GameRepository } from "../repositories/game.repository";

@objectType("PlayerCount")
@inputType("PlayerCountInput")
@model()
export class PlayerCount extends Model {
  @field()
  @property()
  min: number;

  @field()
  @property()
  max: number;
}

@objectType()
@model()
export class GameMap extends Model {
  @field()
  @property()
  playerCount: PlayerCount;

  @field()
  @property()
  name: string;

  @property()
  file: string;
}

@objectType()
@model()
export class Game extends Entity {
  static async getGames(
    actor: Actor,
    authorizationService: AuthorizationService,
    gameRepository: GameRepository,
  ) {
    await authorizationService.authorize(actor, Action.READ, ResourceCollection.GAMES);
    return gameRepository.find();
  }

  static async getGame(
    actor: Actor,
    id: string,
    authorizationService: AuthorizationService,
    gameRepository: GameRepository,
  ) {
    return gameRepository.findOne({ where: { id } });
  }

  @field(() => ID)
  @property({ id: true, type: "string", mongodb: { dataType: "ObjectId" } })
  id: string;

  async getIdAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "id");
    return this.id;
  }

  @field()
  @property()
  name: string;

  async getNameAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "name");
    return this.name;
  }

  @field()
  @property()
  shortDescription: string;

  async getShortDescriptionAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "shortDescription");
    return this.shortDescription;
  }

  @property()
  pictureBuffer: Buffer;

  get picture() {
    return fromByteArray(this.pictureBuffer);
  }

  /** base64 representation of a "profile" picture for the game */
  async getPictureAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "picture");
    return this.picture;
  }

  /** The complete definition of the game, including the communication protocol. */
  @field()
  @property()
  fullDescription: string;

  async getFullDescriptionAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "fullDescription");
    return this.fullDescription;
  }

  @field()
  @property()
  playerCount: PlayerCount;

  async getPlayerCountAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "playerCount");
    return this.playerCount;
  }

  @field(() => [GameMap])
  @property.array(GameMap)
  maps: GameMap[];

  async getMapsAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "maps");
    return this.maps;
  }

  @property()
  server: File;
}

export interface GameRelations {}

export type GameWithRelations = Game & GameRelations;

@inputType()
export class GameInput {
  @field()
  name: string;

  @field()
  shortDescription: string;

  /** base64 representation of a "profile" picture for the game */
  @field()
  picture: string;

  /** The complete definition of the game, including the communication protocol. */
  @field()
  fullDescription: string;

  @field()
  playerCount: PlayerCount;
}

export const GameResponse = createAuthErrorUnionType("GameResponse", [Game], (value: unknown) =>
  (value as GqlValue).__typename === "Game" ? Game : undefined,
);

@objectType()
export class Games {
  @field(() => [Game])
  games: Game[];
}

export const GamesResponse = createAuthErrorUnionType("GamesResponse", [Games], (value: unknown) =>
  (value as GqlValue).__typename === "Games" ? Games : undefined,
);
