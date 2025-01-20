import { BindingKey } from "@loopback/core";
import { AuthenticationStrategy } from "@loopback/authentication/src/types";

export class AiArenaBindings {
  static readonly AUTH_STRATEGY = BindingKey.create<AuthenticationStrategy>("auth.strategy");
}
