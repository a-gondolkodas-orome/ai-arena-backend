import { field, ID, objectType } from "@loopback/graphql";
import { Entity, model, property } from "@loopback/repository";
import { createAuthErrorUnionType } from "./auth";

@objectType()
@model({ settings: { strict: false } })
export class User extends Entity {
  @field((type) => ID)
  @property({ id: true, type: "string", mongodb: { dataType: "ObjectId" } })
  id: string;

  @field()
  @property()
  username: string;

  @field()
  @property()
  email: string;

  @property()
  password: string;
}

@objectType()
export class Users {
  @field((type) => [User])
  users: User[];
}

export const UserResponse = createAuthErrorUnionType(
  "UserResponse",
  [User],
  (value: unknown) => {
    return typeof value === "object" && value && "username" in value
      ? User
      : undefined;
  },
);

export const UsersResponse = createAuthErrorUnionType(
  "UsersResponse",
  [Users],
  (value: unknown) => {
    return typeof value === "object" && value && "users" in value
      ? Users
      : undefined;
  },
);
