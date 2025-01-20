import * as t from "io-ts";
import { File, fileCodec } from "./base";
import { decode, enumCodec, stringFromObjectId } from "../../../shared/codec";

export enum BotSubmitStage {
  REGISTERED = "REGISTERED",
  SOURCE_UPLOAD_DONE = "SOURCE_UPLOAD_DONE",
  SOURCE_UPLOAD_ERROR = "SOURCE_UPLOAD_ERROR",
  CHECK_SUCCESS = "CHECK_SUCCESS",
  CHECK_ERROR = "CHECK_ERROR",
}

type BotSubmitStatus = {
  stage: BotSubmitStage;
  log?: string;
};

const botSubmitStatusCodec = t.intersection([
  t.type({ stage: enumCodec(BotSubmitStage, "BotSubmitStage") }),
  t.partial({ log: t.union([t.string, t.null]) }),
]);

export class Bot {
  static readonly classCodec = t.intersection([
    t.type({
      _id: stringFromObjectId,
      userId: stringFromObjectId,
      gameId: stringFromObjectId,
      name: t.string,
      submitStatus: botSubmitStatusCodec,
      versionNumber: t.number,
    }),
    t.partial({
      source: fileCodec,
    }),
  ]);

  constructor(initial: unknown) {
    Object.assign(this, decode(Bot.classCodec, initial, "Bot"));
  }

  _id: string;
  userId: string;
  gameId: string;
  name: string;
  submitStatus: BotSubmitStatus;
  source?: File;
  versionNumber: number;
}
