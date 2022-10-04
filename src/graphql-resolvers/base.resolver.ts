import { AssertException } from "../errors";
import { Executor, isExecutor } from "../authorization";
import { GraphQLBindings, ResolverData } from "@loopback/graphql";
import { inject } from "@loopback/core";

export class BaseResolver {
  constructor(
    @inject(GraphQLBindings.RESOLVER_DATA) resolverData: ResolverData,
  ) {
    const context = resolverData.context;
    if (!this.isContextWithExecutor(context)) {
      throw new AssertException({
        message: "BaseResolver: unhandled context structure",
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
}
