import { HttpErrors, RedirectRoute, Request } from "@loopback/rest";
import { Actor } from "../services/authorization.service";
import { AuthenticationStrategy } from "@loopback/authentication";
import { UserRepository } from "../repositories";

export async function authenticateRequest(
  authStrategy: AuthenticationStrategy,
  userRepository: UserRepository,
  request: Request,
): Promise<Actor> {
  let result;
  try {
    result = await authStrategy.authenticate(request);
  } catch (error) {
    if (error instanceof HttpErrors.Unauthorized) return null;
    throw error;
  }
  return !(result instanceof RedirectRoute) && result?.id
    ? userRepository.findOne({
        where: { id: result.id },
      })
    : null;
}
