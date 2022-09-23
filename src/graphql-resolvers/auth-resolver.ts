import { inject } from "@loopback/core";
import { arg, mutation, query, resolver } from "@loopback/graphql";
import { repository } from "@loopback/repository";
import { UserRepository } from "../repositories";
import {
  Credentials,
  LoginResponse,
  RegistrationResponse,
  UserData,
} from "../models/auth";
import { TokenServiceBindings } from "@loopback/authentication-jwt";
import { TokenService } from "@loopback/authentication";
import { AiArenaBindings } from "../keys";
import { UserService } from "../services";
import { SecurityBindings, UserProfile } from "@loopback/security";

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
    @arg("userData") userData: UserData,
  ): Promise<RegistrationResponse> {
    const user = await this.userRepository.create(undefined, userData);
    const userProfile = this.userService.convertToUserProfile(user);
    const token = await this.jwtService.generateToken(userProfile);
    return { user, token };
  }

  @query((returns) => LoginResponse)
  async login(
    @arg("credentials") credentials: Credentials,
  ): Promise<LoginResponse> {
    const user = await this.userService.verifyCredentials(credentials);
    const userProfile = this.userService.convertToUserProfile(user);
    const token = await this.jwtService.generateToken(userProfile);
    return { token };
  }
}
