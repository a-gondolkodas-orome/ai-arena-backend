import { AssertException } from "./errors";
import * as t from "io-ts";
import { either } from "fp-ts";

export function notNull<T>(value: T): Exclude<T, null | undefined> {
  if (value === null || value === undefined)
    throw new AssertException({
      message: "notNull violated",
      values: { value },
    });
  return value as Exclude<T, null | undefined>;
}

export function assertValue<T>(
  value: T,
): asserts value is Exclude<T, null | undefined> {
  notNull(value);
}

export function catchWithInfo(
  promise: Promise<unknown>,
  filename: string,
  location: string,
) {
  promise.catch((error) => {
    throw new AssertException({
      message: error.message(),
      values: { filename, location },
    });
  });
}

export function decode<A, O, I>(codec: t.Type<A, O, I>, input: I): A {
  const decodeResult = codec.decode(input);
  if (either.isLeft(decodeResult)) {
    throw new Error("decode: invalid input");
  }
  return decodeResult.right;
}

export function enumCodec<T extends object>(enumType: T, enumName: string) {
  const isEnumValue = (input: unknown): input is T[keyof T] =>
    Object.values(enumType).includes(input);

  return new t.Type<T[keyof T]>(
    enumName,
    isEnumValue,
    (input, context) =>
      isEnumValue(input) ? t.success(input) : t.failure(input, context),
    t.identity,
  );
}

// TODO this conversion should not be necessary. See https://github.com/loopbackio/loopback-next/issues/3720
export function convertObjectIdsToString<T extends object>(entity: T) {
  const object = entity as { [key: string]: unknown };
  for (const key of Object.keys(object)) {
    const value = object[key];
    if (
      value &&
      typeof value === "object" &&
      (value as { _bsontype: string })._bsontype === "ObjectID"
    )
      object[key] = value.toString();
  }
  return entity;
}

export type GqlValue = { __typename: string };
