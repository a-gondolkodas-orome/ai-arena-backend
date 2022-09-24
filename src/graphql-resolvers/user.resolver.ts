import { inject } from "@loopback/core";
import {
  GraphQLBindings,
  query,
  resolver,
  ResolverData,
} from "@loopback/graphql";
import { repository } from "@loopback/repository";
import { User } from "../models/user";
import { UserRepository } from "../repositories";
import { Executor, EXECUTOR_SYSTEM, isExecutor } from "../authorization";
import { notNull } from "../utils";
import { AssertException, AuthenticationError } from "../errors";

@resolver((of) => User)
export class UserResolver {
  constructor(
    @repository("UserRepository") readonly userRepository: UserRepository,
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    const context = resolverData.context;
    if (!this.isContextWithExecutor(context)) {
      throw new AssertException({
        message: "UserResolver: unhandled context structure",
        values: { context },
      });
    }
    this.executor = context.executor;
  }

  protected readonly executor: Executor;

  protected isContextWithExecutor(
    value: unknown,
  ): value is { executor: Executor } {
    const context = value as { executor: unknown };
    return isExecutor(context.executor);
  }

  @query((returns) => [User])
  async users(): Promise<User[]> {
    return this.userRepository.find(this.executor);
  }

  @query((returns) => User)
  async profile(): Promise<User> {
    if (this.executor === undefined) throw new AuthenticationError({});
    if (this.executor === EXECUTOR_SYSTEM)
      throw new AssertException({
        message: "UserResolver: unexpected executor",
        values: { executor: this.executor },
      });
    return notNull(
      await this.userRepository.findOne(this.executor, {
        where: { id: this.executor.id },
      }),
    );
  }
}
