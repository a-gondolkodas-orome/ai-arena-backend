import * as t from "io-ts";
import { ApolloError } from "apollo-server-errors";
import { registerEnumType } from "type-graphql";

export enum ErrorType {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  ASSERT_EXCEPTION = "ASSERT_EXCEPTION",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
}
registerEnumType(ErrorType, { name: "ErrorType" });

export const validationErrorCodec = t.partial(
  {
    fieldErrors: t.record(t.string, t.array(t.string)),
    nonFieldErrors: t.array(t.string),
  },
  "validationErrorCodec",
);

export const assertExceptionCodec = t.partial(
  { message: t.string, values: t.record(t.string, t.unknown) },
  "assertExceptionCodec",
);

export const authenticationErrorCodec = t.partial(
  { message: t.string },
  "authenticationErrorCodec",
);

export const authorizationErrorCodec = t.partial(
  { message: t.string },
  "authorizationErrorCodec",
);

export const aiArenaExceptionCodec = t.intersection([
  t.union([
    t.intersection([
      t.type({ type: t.literal(ErrorType.VALIDATION_ERROR) }),
      validationErrorCodec,
    ]),
    t.intersection([
      t.type({ type: t.literal(ErrorType.ASSERT_EXCEPTION) }),
      assertExceptionCodec,
    ]),
    t.intersection([
      t.type({ type: t.literal(ErrorType.AUTHENTICATION_ERROR) }),
      authenticationErrorCodec,
    ]),
    t.intersection([
      t.type({ type: t.literal(ErrorType.AUTHORIZATION_ERROR) }),
      authorizationErrorCodec,
    ]),
  ]),
  t.type({ message: t.string }),
]);

export class AiArenaException extends ApolloError {
  constructor(public data: t.TypeOf<typeof aiArenaExceptionCodec>) {
    super(JSON.stringify(data), data.type, data);
  }
}

export class ValidationError extends AiArenaException {
  constructor(data: t.TypeOf<typeof validationErrorCodec>) {
    super({
      type: ErrorType.VALIDATION_ERROR,
      message: "The provided data is invalid",
      ...data,
    });
  }
}

export class AssertException extends AiArenaException {
  constructor(data: t.TypeOf<typeof assertExceptionCodec>) {
    super({
      type: ErrorType.ASSERT_EXCEPTION,
      message: "Unexpected error",
      ...data,
    });
  }
}

export class AuthenticationError extends AiArenaException {
  constructor(data: t.TypeOf<typeof authenticationErrorCodec> = {}) {
    super({
      type: ErrorType.AUTHENTICATION_ERROR,
      message: "Not authenticated",
      ...data,
    });
  }
}

export class AuthorizationError extends AiArenaException {
  constructor(data: t.TypeOf<typeof authorizationErrorCodec> = {}) {
    super({
      type: ErrorType.AUTHORIZATION_ERROR,
      message: "Not authorized",
      ...data,
    });
  }
}
