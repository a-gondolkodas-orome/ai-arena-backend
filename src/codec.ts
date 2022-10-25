import * as t from "io-ts";
import { either } from "fp-ts";

export function decode<A, O, I>(codec: t.Type<A, O, I>, input: I): A {
  const decodeResult = codec.decode(input);
  if (either.isLeft(decodeResult)) {
    throw new Error("decode: invalid input");
  }
  return decodeResult.right;
}

export function decodeJson<A, O, I>(codec: t.Type<A, O, I>, input: string): A {
  return decode(codec, JSON.parse(input));
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
