import { AssertException } from "./errors";

export function notNull<T>(value: T): Exclude<T, null | undefined> {
  if (value === null || value === undefined)
    throw new AssertException({
      message: "notNull violated",
      values: { value },
    });
  return value as Exclude<T, null | undefined>;
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
