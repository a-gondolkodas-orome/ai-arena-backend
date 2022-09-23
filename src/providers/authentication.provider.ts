import { inject, Provider } from "@loopback/core";
import { AiArenaBindings } from "../keys";
import { AuthenticationStrategy } from "@loopback/authentication";
import { HttpErrors, RedirectRoute } from "@loopback/rest";
import { ContextFunction, ExpressContext } from "@loopback/graphql/src/types";
import { repository } from "@loopback/repository";
import { UserRepository } from "../repositories";
import { EXECUTOR_SYSTEM } from "../authorization";

export class AuthenticationProvider
  implements Provider<ContextFunction<ExpressContext>>
{
  constructor(
    @inject(AiArenaBindings.AUTH_STRATEGY)
    protected authStrategy: AuthenticationStrategy,
    @repository(UserRepository) public userRepository: UserRepository,
  ) {}

  value() {
    return async (context: ExpressContext) => {
      let result;
      try {
        result = await this.authStrategy.authenticate(context.req);
      } catch (error) {
        if (error instanceof HttpErrors.Unauthorized) return context;
        throw error;
      }
      const executor =
        !(result instanceof RedirectRoute) && result?.id
          ? (await this.userRepository.findOne(EXECUTOR_SYSTEM, {
              where: { id: result.id },
            })) ?? undefined
          : undefined;
      return { ...context, executor };
    };
  }
}
