import * as t from "io-ts";
import { bufferFromBinary, decode, enumCodec, stringFromObjectId } from "../../../shared/codec";

export enum MatchRunStage {
  REGISTERED = "REGISTERED",
  PREPARE_GAME_SERVER_DONE = "PREPARE_GAME_SERVER_DONE",
  PREPARE_GAME_SERVER_ERROR = "PREPARE_GAME_SERVER_ERROR",
  PREPARE_BOTS_DONE = "PREPARE_BOTS_DONE",
  PREPARE_BOTS_ERROR = "PREPARE_BOTS_ERROR",
  RUN_SUCCESS = "RUN_SUCCESS",
  RUN_ERROR = "RUN_ERROR",
}

export class Match {
  static classCodec = t.intersection([
    t.type({
      _id: stringFromObjectId,
      userId: stringFromObjectId,
      gameId: stringFromObjectId,
      mapName: t.string,
      botIds: t.array(stringFromObjectId),
      runStatus: t.intersection([
        t.type({
          stage: enumCodec(MatchRunStage, "MatchRunStage"),
        }),
        t.partial({
          log: t.string,
        }),
      ]),
    }),
    t.partial({
      log: t.union([t.undefined, t.type({ file: bufferFromBinary, fileName: t.string })]),
      scoreJson: t.union([t.undefined, t.string]),
    }),
  ]);

  constructor(initial: unknown) {
    Object.assign(this, decode(Match.classCodec, initial, "Match"));
  }

  _id: string;
  userId: string;
  gameId: string;
  mapName: string;
  botIds: string[];
  runStatus: {
    stage: MatchRunStage;
    log?: string;
  };
  scoreJson?: string;

  get logBase64() {
    return this.log?.file?.toString("base64");
  }
  log?: {
    file: Buffer;
    fileName: string;
  };
}
