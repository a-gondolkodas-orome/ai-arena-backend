import * as t from "io-ts";
import { ApolloError } from "apollo-server-errors";
import { registerEnumType } from "type-graphql";
import { enumCodec } from "./codec";

export enum ErrorType {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  ASSERT_EXCEPTION = "ASSERT_EXCEPTION",
  USER_EXCEPTION = "USER_EXCEPTION",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
}

registerEnumType(ErrorType, { name: "ErrorType" });

export enum HttpStatusCode {
  HTTP_200_OK = 200,
  HTTP_201_CREATED = 201,
  HTTP_204_NO_CONTENT = 204,
  HTTP_400_BAD_REQUEST = 400,
  HTTP_401_UNAUTHORIZED = 401,
  HTTP_403_FORBIDDEN = 403,
  HTTP_500_INTERNAL_SERVER_ERROR = 500,
}

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

export const userExceptionCodec = t.partial(
  { message: t.string, values: t.record(t.string, t.unknown) },
  "userExceptionCodec",
);

export const authenticationErrorCodec = t.partial(
  { message: t.string },
  "authenticationErrorCodec",
);

export const authorizationErrorCodec = t.partial({ message: t.string }, "authorizationErrorCodec");

export const aiArenaExceptionCodec = t.intersection([
  t.union([
    t.intersection([t.type({ type: t.literal(ErrorType.VALIDATION_ERROR) }), validationErrorCodec]),
    t.intersection([t.type({ type: t.literal(ErrorType.ASSERT_EXCEPTION) }), assertExceptionCodec]),
    t.intersection([t.type({ type: t.literal(ErrorType.USER_EXCEPTION) }), userExceptionCodec]),
    t.intersection([
      t.type({ type: t.literal(ErrorType.AUTHENTICATION_ERROR) }),
      authenticationErrorCodec,
    ]),
    t.intersection([
      t.type({ type: t.literal(ErrorType.AUTHORIZATION_ERROR) }),
      authorizationErrorCodec,
    ]),
  ]),
  t.type({
    message: t.string,
    statusCode: enumCodec(HttpStatusCode, "HttpStatusCode"),
  }),
]);

export class AiArenaException extends ApolloError {
  statusCode: HttpStatusCode;

  constructor(public data: t.TypeOf<typeof aiArenaExceptionCodec>) {
    super(JSON.stringify(data), data.type, data);
    this.statusCode = data.statusCode;
  }
}

export class ValidationError extends AiArenaException {
  constructor(data: t.TypeOf<typeof validationErrorCodec>) {
    super({
      type: ErrorType.VALIDATION_ERROR,
      message: "The provided data is invalid",
      statusCode: 400,
      ...data,
    });
  }
}

export class AssertException extends AiArenaException {
  constructor(data: t.TypeOf<typeof assertExceptionCodec>) {
    super({
      type: ErrorType.ASSERT_EXCEPTION,
      message: "Unexpected error",
      statusCode: HttpStatusCode.HTTP_500_INTERNAL_SERVER_ERROR,
      ...data,
    });
  }
}

export class UserException extends AiArenaException {
  constructor(data: t.TypeOf<typeof userExceptionCodec>) {
    super({
      type: ErrorType.USER_EXCEPTION,
      message: "User error",
      statusCode: HttpStatusCode.HTTP_400_BAD_REQUEST,
      ...data,
    });
  }
}

export class AuthenticationError extends AiArenaException {
  constructor(data: t.TypeOf<typeof authenticationErrorCodec> = {}) {
    super({
      type: ErrorType.AUTHENTICATION_ERROR,
      message: "Not authenticated",
      statusCode: HttpStatusCode.HTTP_401_UNAUTHORIZED,
      ...data,
    });
  }
}

export class AuthorizationError extends AiArenaException {
  constructor(data: t.TypeOf<typeof authorizationErrorCodec> = {}) {
    super({
      type: ErrorType.AUTHORIZATION_ERROR,
      message: "Not authorized",
      statusCode: HttpStatusCode.HTTP_403_FORBIDDEN,
      ...data,
    });
  }
}
