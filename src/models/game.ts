import { field, ID, inputType, objectType } from "@loopback/graphql";
import { Entity, model, property } from "@loopback/repository";
import { createAuthErrorUnionType } from "./auth";
import { ProgramSource } from "./base";

@objectType("PlayerCount")
@inputType("PlayerCountInput")
@model()
export class PlayerCount {
  @field()
  @property()
  min: number;

  @field()
  @property()
  max: number;
}

@objectType()
@model()
export class Game extends Entity {
  @field((type) => ID)
  @property({ id: true, type: "string", mongodb: { dataType: "ObjectId" } })
  id: string;

  @field()
  @property()
  name: string;

  @field()
  @property()
  shortDescription: string;

  /** base64 representation of a "profile" picture for the game */
  @field()
  picture: string;
  @property()
  pictureBuffer: Buffer;

  /** The complete definition of the game, including the communication protocol. */
  @field()
  @property()
  fullDescription: string;

  @field()
  @property()
  playerCount: PlayerCount;

  @property.array(String)
  maps: string[];

  @property()
  server: ProgramSource;
}

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
  typeof value === "object" && value && "shortDescription" in value ? Game : undefined,
);

@objectType()
export class Games {
  @field((type) => [Game])
  games: Game[];
}

export const GamesResponse = createAuthErrorUnionType("GamesResponse", [Games], (value: unknown) =>
  typeof value === "object" && value && "games" in value ? Games : undefined,
);