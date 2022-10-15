import { inject } from "@loopback/core";
import {
  GraphQLBindings,
  query,
  resolver,
  ResolverData,
} from "@loopback/graphql";
import { repository } from "@loopback/repository";
import { User, UserResponse, UsersResponse } from "../models/user";
import { UserRepository } from "../repositories";
import { notNull } from "../utils";
import { AuthenticationError } from "../errors";
import { handleAuthErrors } from "../models/auth";
import { BaseResolver } from "./base.resolver";

@resolver((of) => User)
export class UserResolver extends BaseResolver {
  constructor(
    @repository("UserRepository") readonly userRepository: UserRepository,
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    super(resolverData);
  }

  @query((returns) => UsersResponse)
  async users(): Promise<typeof UsersResponse> {
    return handleAuthErrors(async () => {
      return { users: await this.userRepository.find(this.executor) };
    });
  }

  @query((returns) => UserResponse)
  async profile(): Promise<typeof UserResponse> {
    return handleAuthErrors(async () => {
      if (this.executor === null) throw new AuthenticationError({});
      return notNull(
        await this.userRepository.findOne(this.executor, {
          where: { id: this.executor.id },
        }),
      );
    });
  }
}
