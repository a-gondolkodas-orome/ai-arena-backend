import { inject, service } from "@loopback/core";
import { arg, GraphQLBindings, mutation, query, resolver, ResolverData } from "@loopback/graphql";
import { repository } from "@loopback/repository";
import { UserRepository } from "../repositories";
import {
  Credentials,
  LoginResponse,
  RegistrationResponse,
  RegistrationInput,
  handleAuthErrors,
} from "../models/auth";
import { TokenServiceBindings } from "@loopback/authentication-jwt";
import { TokenService } from "@loopback/authentication";
import { UserService } from "../services";
import { SecurityBindings, UserProfile } from "@loopback/security";
import { AuthenticationError, ValidationError, validationErrorCodec } from "../errors";
import * as t from "io-ts";
import { Actor, AuthorizationService } from "../services/authorization.service";
import { BaseResolver } from "./base.resolver";
import { User, UserResponse } from "../models/user";
import { notNull } from "../utils";

@resolver()
export class AuthResolver extends BaseResolver<Actor> {
  constructor(
    @inject(TokenServiceBindings.TOKEN_SERVICE) public jwtService: TokenService,
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
        return await User.create(
          this.actor,
          registrationData,
          this.authorizationService,
          this.userRepository,
          this.userService,
          this.jwtService,
        );
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
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
      return User.login(credentials, this.userService, this.jwtService);
    });
  }

  @query(() => UserResponse)
  async profile(): Promise<typeof UserResponse> {
    return handleAuthErrors(async () => {
      if (!this.actor) throw new AuthenticationError({});
      return Object.assign(
        notNull(
          await User.getUser(
            this.actor,
            this.actor.id,
            this.authorizationService,
            this.userRepository,
          ),
        ),
        { __typename: "User" },
      );
    });
  }
}
