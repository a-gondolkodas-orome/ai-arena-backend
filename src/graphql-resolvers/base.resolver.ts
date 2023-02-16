import { AssertException, AuthenticationError } from "../errors";
import { ResolverData } from "@loopback/graphql";
import { Actor, isActor } from "../services/authorization.service";
import { User } from "../models/user";

export class BaseResolver<A extends Actor = User> {
  constructor(resolverData: ResolverData, authenticated = true) {
    const context = resolverData.context;
    if (!this.isContextWithActor(context, authenticated)) {
      throw new AssertException({
        message: "BaseResolver: unhandled context structure",
        values: { context },
      });
    }
    this.actor = context.actor;
  }

  protected readonly actor: A;

  protected isContextWithActor(value: unknown, authenticated: boolean): value is { actor: A } {
    const context = value as { actor: unknown };
    if (authenticated && !context.actor) {
      throw new AuthenticationError({});
    }
    return isActor(context.actor);
  }
}
