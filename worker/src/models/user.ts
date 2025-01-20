import * as t from "io-ts";
import { Role } from "../../../shared/common";
import { decode, enumCodec, stringFromObjectId } from "../../../shared/codec";

export class User {
  static readonly classCodec = t.type({
    _id: stringFromObjectId,
    username: t.string,
    email: t.string,
    password: t.string,
    roles: t.array(enumCodec(Role, "Role")),
  });

  constructor(initial: unknown) {
    Object.assign(this, decode(User.classCodec, initial, "User"));
  }

  _id: string;
  username: string;
  email: string;
  password: string;
  roles: Role[];
}
