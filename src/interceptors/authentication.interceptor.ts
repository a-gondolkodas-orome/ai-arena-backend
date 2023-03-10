import { inject, globalInterceptor, Interceptor } from "@loopback/core";
import { AiArenaBindings } from "../keys";
import { AuthenticationStrategy } from "@loopback/authentication";
import { repository } from "@loopback/repository";
import { ExpressMiddlewareInterceptorProvider } from "@loopback/rest";
import { ExpressRequestHandler } from "@loopback/express/src/types";
import { authenticateRequest } from "../authentication/authentication";
import { UserRepository } from "../repositories/user.repository";

@globalInterceptor("middleware", { tags: { name: "authentication" } })
export class AuthenticationInterceptor extends ExpressMiddlewareInterceptorProvider<Interceptor> {
  constructor(
    @inject(AiArenaBindings.AUTH_STRATEGY)
    protected authStrategy: AuthenticationStrategy,
    @repository(UserRepository) public userRepository: UserRepository,
  ) {
    super(() => {
      return this.authMiddleware;
    });
  }

  protected authMiddleware: ExpressRequestHandler = async (request, response, next) => {
    request.actor = await authenticateRequest(this.authStrategy, this.userRepository, request);
    next();
  };
}
