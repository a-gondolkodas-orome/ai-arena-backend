import { inject, Provider } from "@loopback/core";
import { AiArenaBindings } from "../keys";
import { AuthenticationStrategy } from "@loopback/authentication";
import { ContextFunction, ExpressContext } from "@loopback/graphql/src/types";
import { repository } from "@loopback/repository";
import { UserRepository } from "../repositories";
import { authenticateRequest } from "./authentication";

export class GraphqlAuthenticationProvider implements Provider<ContextFunction<ExpressContext>> {
  constructor(
    @inject(AiArenaBindings.AUTH_STRATEGY)
    protected authStrategy: AuthenticationStrategy,
    @repository(UserRepository) public userRepository: UserRepository,
  ) {}

  value(): ContextFunction<ExpressContext> {
    return async (context: ExpressContext) => {
      return {
        ...context,
        actor: await authenticateRequest(this.authStrategy, this.userRepository, context.req),
      };
    };
  }
}
