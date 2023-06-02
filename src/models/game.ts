import { field, ID, inputType, objectType } from "@loopback/graphql";
import { Entity, Model, model, property } from "@loopback/repository";
import { createAuthErrorUnionType } from "./auth";
import { File } from "./base";
import { GqlValue } from "../common";
import { fromByteArray } from "base64-js";
import {
  Action,
  AuthorizationService,
  ResourceCollection,
} from "../services/authorization.service";
import { GameRepository } from "../repositories/game.repository";
import { AiArenaGraphqlContext } from "../graphql-resolvers/graphql-context-resolver.provider";

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
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
    gameRepository: GameRepository,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, ResourceCollection.GAMES);
    return gameRepository.find();
  }

  static async getGame(
    context: AiArenaGraphqlContext,
    id: string,
    authorizationService: AuthorizationService,
  ) {
    const game = await context.loaders.game.load(id);
    await authorizationService.authorize(context.actor, Action.READ, game);
    return game;
  }

  @field(() => ID)
  @property({ id: true, type: "string", mongodb: { dataType: "ObjectId" } })
  id: string;

  async getIdAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "id");
    return this.id;
  }

  @field()
  @property()
  name: string;

  async getNameAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "name");
    return this.name;
  }

  @field()
  @property()
  shortDescription: string;

  async getShortDescriptionAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "shortDescription");
    return this.shortDescription;
  }

  @property()
  pictureBuffer: Buffer;

  get picture() {
    return fromByteArray(this.pictureBuffer);
  }

  /** base64 representation of a "profile" picture for the game */
  async getPictureAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "picture");
    return this.picture;
  }

  /** The complete definition of the game, including the communication protocol. */
  @field()
  @property()
  fullDescription: string;

  async getFullDescriptionAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "fullDescription");
    return this.fullDescription;
  }

  @field()
  @property()
  playerCount: PlayerCount;

  async getPlayerCountAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "playerCount");
    return this.playerCount;
  }

  @field(() => [GameMap])
  @property.array(GameMap)
  maps: GameMap[];

  async getMapsAuthorized(
    context: AiArenaGraphqlContext,
    authorizationService: AuthorizationService,
  ) {
    await authorizationService.authorize(context.actor, Action.READ, this, "maps");
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
  (value as GqlValue).__typename === "Game" ? "Game" : undefined,
);

@objectType()
export class Games {
  @field(() => [Game])
  games: Game[];
}

export const GamesResponse = createAuthErrorUnionType("GamesResponse", [Games], (value: unknown) =>
  (value as GqlValue).__typename === "Games" ? "Games" : undefined,
);
