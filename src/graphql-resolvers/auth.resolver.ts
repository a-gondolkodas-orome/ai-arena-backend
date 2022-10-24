import { inject } from "@loopback/core";
import { arg, mutation, query, resolver } from "@loopback/graphql";
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
import { AiArenaBindings } from "../keys";
import { UserService } from "../services";
import { SecurityBindings, UserProfile } from "@loopback/security";
import { ValidationError, validationErrorCodec } from "../errors";
import * as t from "io-ts";

@resolver()
export class AuthResolver {
  constructor(
    @inject(TokenServiceBindings.TOKEN_SERVICE) public jwtService: TokenService,
    @inject(AiArenaBindings.USER_SERVICE) public userService: UserService,
    @inject(SecurityBindings.USER, { optional: true }) public user: UserProfile,
    @repository(UserRepository) protected userRepository: UserRepository,
  ) {}

  @mutation((returns) => RegistrationResponse)
  async register(
    @arg("registrationData") registrationData: RegistrationInput,
  ): Promise<typeof RegistrationResponse> {
    return handleAuthErrors(async () => {
      try {
        const user = await this.userRepository.create(null, registrationData);
        const userProfile = this.userService.convertToUserProfile(user);
        const token = await this.jwtService.generateToken(userProfile);
        return { user, token };
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

  @query((returns) => LoginResponse)
  async login(@arg("credentials") credentials: Credentials): Promise<typeof LoginResponse> {
    return handleAuthErrors(async () => {
      const user = await this.userService.verifyCredentials(credentials);
      const userProfile = this.userService.convertToUserProfile(user);
      const token = await this.jwtService.generateToken(userProfile);
      return { token };
    });
  }
}
