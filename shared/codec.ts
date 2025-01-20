import * as t from "io-ts";
import { PathReporter } from "io-ts/PathReporter";
import { either } from "fp-ts";
import { Binary, ObjectId } from "mongodb";

export function decode<A, O, I>(codec: t.Type<A, O, I>, input: I, errorMessage?: string): A {
  const decodeResult = codec.decode(input);
  if (either.isLeft(decodeResult)) {
    let inputStr;
    try {
      inputStr = JSON.stringify(input);
      if (inputStr.length > 1000) {
        inputStr = inputStr.substring(0, 1000);
      }
    } catch {
      // pass
    }
    throw new Error(
      `decode error: ${errorMessage} from ${inputStr ?? input}\n` +
        PathReporter.report(decodeResult).join("\n"),
    );
  }
  return decodeResult.right;
}

export function decodeJson<A, O, I>(
  codec: t.Type<A, O, I>,
  input: string,
  errorMessage?: string,
): A {
  return decode(codec, JSON.parse(input), errorMessage);
}

export function enumCodec<T extends object>(enumType: T, enumName: string) {
  const isEnumValue = (input: unknown): input is T[keyof T] =>
    Object.values(enumType).includes(input);

  return new t.Type<T[keyof T]>(
    enumName,
    isEnumValue,
    (input, context) => (isEnumValue(input) ? t.success(input) : t.failure(input, context)),
    t.identity,
  );
}

export const stringFromObjectId = new t.Type<string, ObjectId, unknown>(
  "stringFromObjectId",
  (u): u is string => typeof u === "string" && /^[0-9a-fA-F]{24}$/.test(u),
  (u, c) => (u instanceof ObjectId ? t.success(u.toHexString()) : t.failure(u, c)),
  (a) => new ObjectId(a),
);

export const bufferFromBinary = new t.Type<Buffer, Binary, unknown>(
  "bufferFromBinary",
  (u): u is Buffer => Buffer.isBuffer(u),
  (u, c) => (u instanceof Binary ? t.success(Buffer.from(u.buffer)) : t.failure(u, c)),
  (a) => new Binary(a),
);
