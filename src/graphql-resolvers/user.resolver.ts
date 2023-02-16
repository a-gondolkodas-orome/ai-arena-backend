import { inject, service } from "@loopback/core";
import {
  fieldResolver,
  GraphQLBindings,
  query,
  resolver,
  ResolverData,
  root,
} from "@loopback/graphql";
import { repository } from "@loopback/repository";
import { User, UsersResponse } from "../models/user";
import { UserRepository } from "../repositories";
import { handleAuthErrors } from "../models/auth";
import { BaseResolver } from "./base.resolver";
import { AuthorizationService } from "../services/authorization.service";

@resolver(() => User)
export class UserResolver extends BaseResolver {
  constructor(
    @service() protected authorizationService: AuthorizationService,
    @repository("UserRepository") readonly userRepository: UserRepository,
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    super(resolverData);
  }

  @query(() => UsersResponse)
  async getUsers(): Promise<typeof UsersResponse> {
    return handleAuthErrors(async () => ({
      __typename: "Users",
      users: await User.getUsers(this.actor, this.authorizationService, this.userRepository),
    }));
  }

  @fieldResolver()
  async id(@root() user: User) {
    return user.getIdAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver()
  async username(@root() user: User) {
    return user.getUsernameAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver()
  async email(@root() user: User) {
    return user.getEmailAuthorized(this.actor, this.authorizationService);
  }

  @fieldResolver()
  async roles(@root() user: User) {
    return user.getRolesAuthorized(this.actor, this.authorizationService);
  }
}
