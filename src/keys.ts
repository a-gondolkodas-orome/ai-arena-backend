import { BindingKey } from "@loopback/core";
import { AuthenticationStrategy } from "@loopback/authentication/src/types";

export namespace AiArenaBindings {
  export const AUTH_STRATEGY = BindingKey.create<AuthenticationStrategy>("auth.strategy");
}
