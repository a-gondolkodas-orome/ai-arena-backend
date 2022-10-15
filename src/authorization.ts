import { User } from "./models/user";
import { AuthenticationError, AuthorizationError } from "./errors";

export const EXECUTOR_SYSTEM = "EXECUTOR_SYSTEM";

export type Executor = User | null;

export function isExecutor(value: unknown): value is Executor {
  return value instanceof User || value === null;
}

export enum AccessLevel {
  NONE = "NONE",
  USER = "USER",
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  SYSTEM = "SYSTEM",
}

export function authorize(
  requiredAccessLevel: Exclude<AccessLevel, AccessLevel.OWNER>,
  authInfo: Executor,
): void;
export function authorize(
  requiredAccessLevel: typeof AccessLevel.OWNER,
  authInfo: Executor,
  resourceOwner: User["username"] | undefined,
): void;
export function authorize(
  requiredAccessLevel: AccessLevel,
  executor: Executor,
  resourceOwner?: User["id"],
): void {
  const executorAccessLevel = [
    true,
    executor instanceof User,
    executor instanceof User && executor.id === resourceOwner,
    executor instanceof User && executor.username === "admin", // TODO handle roles
    executor instanceof User && executor.username === EXECUTOR_SYSTEM, // and here as well
  ].lastIndexOf(true);
  if (requiredAccessLevel !== AccessLevel.NONE && !executor)
    throw new AuthenticationError({});
  if (
    executorAccessLevel <
    Object.values(AccessLevel).indexOf(requiredAccessLevel)
  )
    throw new AuthorizationError({});
}
