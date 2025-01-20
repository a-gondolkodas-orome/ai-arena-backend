import * as t from "io-ts";
import { bufferFromBinary } from "../../../shared/codec";

export type File = {
  content: Buffer;
  fileName: string;
};

export const fileCodec = t.type({
  content: bufferFromBinary,
  fileName: t.string,
});
