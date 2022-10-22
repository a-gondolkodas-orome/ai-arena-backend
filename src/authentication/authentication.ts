import { HttpErrors, RedirectRoute, Request } from "@loopback/rest";
import { Executor } from "../authorization";
import { AuthenticationStrategy } from "@loopback/authentication";
import { UserRepository } from "../repositories";

export async function authenticateRequest(
  authStrategy: AuthenticationStrategy,
  userRepository: UserRepository,
  request: Request,
): Promise<Executor> {
  let result;
  try {
    result = await authStrategy.authenticate(request);
  } catch (error) {
    if (error instanceof HttpErrors.Unauthorized) return null;
    throw error;
  }
  return !(result instanceof RedirectRoute) && result?.id
    ? userRepository._systemAccess.findOne({
        where: { id: result.id },
      })
    : null;
}
