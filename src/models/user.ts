import { field, ID, objectType } from "@loopback/graphql";
import { Entity, model, property } from "@loopback/repository";

@objectType({ description: "User" })
@model({ settings: { strict: false } })
export class User extends Entity {
  @field((type) => ID)
  @property({ id: true })
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
