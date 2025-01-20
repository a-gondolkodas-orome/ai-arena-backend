import { inject, service } from "@loopback/core";
import { arg, GraphQLBindings, mutation, query, resolver, ResolverData } from "@loopback/graphql";
import { repository } from "@loopback/repository";
import {
  Credentials,
  LoginResponse,
  RegistrationResponse,
  RegistrationInput,
  handleAuthErrors,
} from "../models/auth";
import { SecurityBindings, UserProfile } from "@loopback/security";
import { AuthenticationError, ValidationError, validationErrorCodec } from "../../shared/errors";
import * as t from "io-ts";
import { Actor, AuthorizationService } from "../services/authorization.service";
import { BaseResolver } from "./base.resolver";
import { User, UserResponse } from "../models/user";
import { notNull } from "../../shared/utils";
import { JwtService } from "../services/jwt.service";
import { UserService } from "../services/user.service";
import { UserRepository } from "../repositories/user.repository";

@resolver()
export class AuthResolver extends BaseResolver<Actor> {
  constructor(
    @service() public jwtService: JwtService,
    @service() public userService: UserService,
    @service() protected authorizationService: AuthorizationService,
    @inject(SecurityBindings.USER, { optional: true }) public user: UserProfile,
    @repository(UserRepository) protected userRepository: UserRepository,
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    super(resolverData, false);
  }

  @mutation(() => RegistrationResponse)
  async register(
    @arg("registrationData") registrationData: RegistrationInput,
  ): Promise<typeof RegistrationResponse> {
    return handleAuthErrors(async () => {
      try {
        const { user, token } = await User.create(
          this.context,
          registrationData,
          this.authorizationService,
          this.userRepository,
          this.userService,
          this.jwtService,
        );
        return { __typename: "RegistrationSuccess", userId: user.id, token };
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
            __typename: "RegistrationError",
            type: error.data.type,
            message: error.data.message,
            ...(error.data as t.TypeOf<typeof validationErrorCodec>),
          };
        }
        throw error;
      }
    });
  }

  @query(() => LoginResponse)
  async login(@arg("credentials") credentials: Credentials): Promise<typeof LoginResponse> {
    return handleAuthErrors(async () => {
      return Object.assign(await User.login(credentials, this.userService, this.jwtService), {
        __typename: "LoginSuccess",
      });
    });
  }

  @query(() => UserResponse)
  async profile(): Promise<typeof UserResponse> {
    return handleAuthErrors(async () => {
      if (!this.context.actor) throw new AuthenticationError({});
      return Object.assign(
        notNull(await User.getUser(this.context, this.context.actor.id, this.authorizationService)),
        { __typename: "User" },
      );
    });
  }
}
