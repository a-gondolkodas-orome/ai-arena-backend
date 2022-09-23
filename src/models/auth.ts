import { field, inputType, objectType } from "@loopback/graphql";
import { User } from "./user";

@inputType({ description: "UserData" })
export class UserData {
  @field()
  username: string;

  @field()
  email: string;

  @field()
  password: string;
}

@objectType({ description: "RegistrationResponse" })
export class RegistrationResponse {
  @field()
  token: string;

  @field()
  user: User;
}

@inputType({ description: "Credentials" })
export class Credentials {
  @field()
  email: string;

  @field()
  password: string;
}

@objectType({ description: "LoginResponse" })
export class LoginResponse {
  @field()
  token: string;
}
