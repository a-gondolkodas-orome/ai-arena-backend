import { File, fileCodec } from "./base";
import * as t from "io-ts";
import { bufferFromBinary, decode, stringFromObjectId } from "../../../shared/codec";

type PlayerCount = {
  min: number;
  max: number;
};

const playerCountCodec = t.type({
  min: t.number,
  max: t.number,
});

type GameMap = {
  playerCount: PlayerCount;
  name: string;
  file: string;
};

const gameMapCodec = t.type({
  playerCount: playerCountCodec,
  name: t.string,
  file: t.string,
});

export class Game {
  static readonly classCodec = t.type({
    _id: stringFromObjectId,
    name: t.string,
    shortDescription: t.string,
    pictureBuffer: bufferFromBinary,
    fullDescription: t.string,
    playerCount: playerCountCodec,
    maps: t.array(gameMapCodec),
    server: fileCodec,
  });

  constructor(initial: unknown) {
    Object.assign(this, decode(Game.classCodec, initial, "Game"));
  }

  _id: string;
  name: string;
  shortDescription: string;
  pictureBuffer: Buffer;
  /** The complete definition of the game, including the communication protocol. */
  fullDescription: string;
  playerCount: PlayerCount;
  maps: GameMap[];
  server: File;
}
