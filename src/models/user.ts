import { field, ID, objectType } from "@loopback/graphql";
import { Entity, model, property } from "@loopback/repository";
import { createAuthErrorUnionType } from "./auth";
import { registerEnumType } from "type-graphql";

export enum Role {
  ADMIN = "ADMIN",
}

registerEnumType(Role, {
  name: "Role",
});

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

  @field((type) => [Role])
  @property.array(String)
  roles: Role[];
}

@objectType()
export class Users {
  @field((type) => [User])
  users: User[];
}

export const UserResponse = createAuthErrorUnionType("UserResponse", [User], (value: unknown) => {
  return typeof value === "object" && value && "username" in value ? User : undefined;
});

export const UsersResponse = createAuthErrorUnionType(
  "UsersResponse",
  [Users],
  (value: unknown) => {
    return typeof value === "object" && value && "users" in value ? Users : undefined;
  },
);
