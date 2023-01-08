import { AssertException } from "./errors";
import { ObjectId } from "mongodb";

export namespace Time {
  export const msec = 1;
  export const second = 1000 * msec;
  export const minute = 60 * second;
  export const hour = 60 * minute;
  export const day = 24 * hour;
}

export function notNull<T>(value: T): Exclude<T, null | undefined> {
  if (value === null || value === undefined)
    throw new AssertException({
      message: "notNull violated",
      values: { value },
    });
  return value as Exclude<T, null | undefined>;
}

export function assertValue<T>(value: T): asserts value is Exclude<T, null | undefined> {
  notNull(value);
}

export function catchWithInfo(promise: Promise<unknown>, filename: string, location: string) {
  promise.catch((error) => {
    throw new AssertException({
      message: error.message(),
      values: { filename, location },
    });
  });
}

// TODO this conversion should not be necessary. See https://github.com/loopbackio/loopback-next/issues/3720
export function convertObjectIdsToString<T extends object>(entity: T) {
  const isObjectId = (value: unknown): value is ObjectId =>
    (value as { _bsontype: string })._bsontype === "ObjectID";
  const object = entity as { [key: string]: unknown };
  for (const key of Object.keys(object)) {
    const value = object[key];
    if (Array.isArray(value) && value.length && isObjectId(value[0]))
      object[key] = value.map((item: unknown) => (isObjectId(item) ? item.toString() : item));
    else if (value && typeof value === "object" && isObjectId(value))
      object[key] = value.toString();
  }
  return entity;
}

export type GqlValue = { __typename: string };
