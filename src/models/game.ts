import { field, ID, inputType, objectType } from "@loopback/graphql";
import { Entity, model, property } from "@loopback/repository";

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
  @property({ id: true })
  id: string;

  @field()
  @property()
  name: string;

  @field()
  @property()
  shortDescription: string;

  /** base64 representation of a "profile" picture for the game */
  @field()
  @property()
  picture: string;

  /** The complete definition of the game, including the communication protocol. */
  @field()
  @property()
  fullDescription: string;

  @field()
  @property()
  playerCount: PlayerCount;
}

@inputType()
export class GameData {
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
