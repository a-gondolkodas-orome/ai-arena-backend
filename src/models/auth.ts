import { ClassType, field, inputType, InterfaceType, objectType } from "@loopback/graphql";
import { User } from "./user";
import { createUnionType } from "type-graphql";
import { AuthenticationError, AuthorizationError } from "../errors";
import { GqlValue } from "../utils";

function resolveAuthErrorType(value: unknown) {
  if ((value as GqlValue).__typename === "GraphqlAuthenticationError")
    return GraphqlAuthenticationError;
  if ((value as GqlValue).__typename === "GraphqlAuthorizationError")
    return GraphqlAuthorizationError;
  return undefined;
}

@InterfaceType({
  resolveType: resolveAuthErrorType,
})
export class GraphqlError {
  @field()
  message: string;
}

@objectType({ implements: GraphqlError })
export class GraphqlAuthenticationError extends GraphqlError {}

@objectType({ implements: GraphqlError })
export class GraphqlAuthorizationError extends GraphqlError {}

export async function handleAuthErrors<T>(getResponse: () => T | Promise<T>) {
  try {
    return await getResponse();
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        __typename:
          error instanceof AuthenticationError
            ? "GraphqlAuthenticationError"
            : "GraphqlAuthorizationError",
        message: error.data.message,
      };
    }
    throw error;
  }
}

export function createAuthErrorUnionType<C extends ClassType[]>(
  name: string,
  types: C,
  resolveType: ReturnType<typeof createUnionType<C>>["resolveType"],
) {
  return createUnionType({
    name: name,
    types: () => [...types, GraphqlAuthenticationError, GraphqlAuthorizationError] as const,
    resolveType: (value: unknown) => {
      return resolveType(value) ?? resolveAuthErrorType(value);
    },
  });
}

@inputType()
export class RegistrationInput {
  @field()
  username: string;

  @field()
  email: string;

  @field()
  password: string;
}

@objectType()
export class RegistrationSuccess {
  @field()
  token: string;

  @field((type) => User)
  user: User;
}

@objectType()
export class RegistrationFieldErrors {
  @field((type) => [String!], { nullable: true })
  username?: string[];

  @field((type) => [String!], { nullable: true })
  email?: string[];
}

@objectType({ implements: GraphqlError })
export class RegistrationError extends GraphqlError {
  @field({ nullable: true })
  fieldErrors?: RegistrationFieldErrors;

  @field((type) => [String!], { nullable: true })
  nonFieldErrors?: string[];
}

export const RegistrationResponse = createAuthErrorUnionType(
  "RegistrationResponse",
  [RegistrationSuccess, RegistrationError],
  (value: unknown) => {
    if (typeof value === "object" && value) {
      if ("token" in value && "user" in value) return RegistrationSuccess;
      if ("fieldErrors" in value || "nonFieldErrors" in value) return RegistrationError;
    }
    return undefined;
  },
);

@inputType()
export class Credentials {
  @field()
  email: string;

  @field()
  password: string;
}

@objectType()
export class LoginSuccess {
  @field()
  token: string;
}

export const LoginResponse = createAuthErrorUnionType(
  "LoginResponse",
  [LoginSuccess],
  (value: unknown) => {
    return typeof value === "object" && value && "token" in value ? LoginSuccess : undefined;
  },
);

export const AuthError = createUnionType({
  name: "AuthError",
  types: () => [GraphqlAuthenticationError, GraphqlAuthorizationError] as const,
  resolveType: resolveAuthErrorType,
});
