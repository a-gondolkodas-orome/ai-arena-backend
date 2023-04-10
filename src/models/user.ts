import { field, ID, objectType } from "@loopback/graphql";
import { Entity, model, property } from "@loopback/repository";
import { createAuthErrorUnionType, Credentials, RegistrationInput } from "./auth";
import { registerEnumType } from "type-graphql";
import { GqlValue } from "../utils";
import {
  Action,
  Actor,
  AuthorizationService,
  ResourceCollection,
  Role,
} from "../services/authorization.service";
import { TokenService } from "@loopback/authentication";
import { UserRepository } from "../repositories/user.repository";
import { UserService } from "../services/user.service";

registerEnumType(Role, {
  name: "Role",
});

@objectType()
@model({ settings: { strict: false } })
export class User extends Entity {
  static async create(
    actor: Actor,
    registrationData: RegistrationInput,
    authorizationService: AuthorizationService,
    userRepository: UserRepository,
    userService: UserService,
    jwtService: TokenService,
  ) {
    await authorizationService.authorize(actor, Action.CREATE, registrationData);
    const user = await userRepository.validateAndCreate(registrationData);
    const userProfile = userService.convertToUserProfile(user);
    const token = await jwtService.generateToken(userProfile);
    return { user, token };
  }

  static async getUsers(
    actor: User,
    authorizationService: AuthorizationService,
    userRepository: UserRepository,
  ) {
    await authorizationService.authorize(actor, Action.READ, ResourceCollection.USERS);
    return userRepository.find();
  }

  static async getUser(
    actor: Actor,
    id: string,
    authorizationService: AuthorizationService,
    userRepository: UserRepository,
  ) {
    return userRepository.findOne({ where: { id } });
  }

  static async login(credentials: Credentials, userService: UserService, jwtService: TokenService) {
    const user = await userService.verifyCredentials(credentials);
    const userProfile = userService.convertToUserProfile(user);
    const token = await jwtService.generateToken(userProfile);
    return { token };
  }

  @field(() => ID)
  @property({ id: true, type: "string", mongodb: { dataType: "ObjectId" } })
  id: string;

  async getIdAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "id");
    return this.id;
  }

  @field()
  @property()
  username: string;

  async getUsernameAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "username");
    return this.username;
  }

  @field()
  @property()
  email: string;

  async getEmailAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "email");
    return this.email;
  }

  @property()
  password: string;

  @field(() => [Role])
  @property.array(String)
  roles: Role[];

  async getRolesAuthorized(actor: Actor, authorizationService: AuthorizationService) {
    await authorizationService.authorize(actor, Action.READ, this, "roles");
    return this.roles;
  }
}

export interface UserRelations {}

export type UserWithRelations = User & UserRelations;

@objectType()
export class Users {
  @field(() => [User])
  users: User[];
}

export const UserResponse = createAuthErrorUnionType("UserResponse", [User], (value: unknown) =>
  (value as GqlValue).__typename === "User" ? User : undefined,
);

export const UsersResponse = createAuthErrorUnionType("UsersResponse", [Users], (value: unknown) =>
  (value as GqlValue).__typename === "Users" ? Users : undefined,
);
