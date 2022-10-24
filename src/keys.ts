import { BindingKey } from "@loopback/core";
import { BotService, JwtService, MatchService, UserService } from "./services";
import { AuthenticationStrategy } from "@loopback/authentication/src/types";

export namespace AiArenaBindings {
  export const USER_SERVICE = BindingKey.create<UserService>("user.service");
  export const BOT_SERVICE = BindingKey.create<BotService>("bot.service");
  export const MATCH_SERVICE = BindingKey.create<MatchService>("match.service");
  export const JWT_SERVICE = BindingKey.create<JwtService>("jwt.service");

  export const AUTH_STRATEGY = BindingKey.create<AuthenticationStrategy>("auth.strategy");
}
