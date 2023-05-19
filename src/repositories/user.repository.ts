import { inject } from "@loopback/core";
import { MongoDataSource } from "../datasources";
import { User } from "../models/user";
import { Options } from "@loopback/repository/src/common-types";
import { genSalt, hash } from "bcryptjs";
import { RegistrationInput } from "../models/auth";
import { ValidationError } from "../errors";
import { notNull } from "../utils";
import { EXECUTOR_SYSTEM, Role } from "../services/authorization.service";
import { UserRelations } from "@loopback/authentication-jwt";
import { MongodbRepository } from "./mongodb.repository";

export class UserRepository extends MongodbRepository<
  User,
  typeof User.prototype.id,
  UserRelations
> {
  constructor(@inject("datasources.mongo") dataSource: MongoDataSource) {
    super(User, dataSource);
  }

  async validateAndCreate(user: RegistrationInput, roles: Role[], options?: Options) {
    // TODO use some validation library?
    const usernameErrors = [];
    if (user.username.length === 0) usernameErrors.push("Username must not be empty");
    const usernameCollision = await this.findOne({
      where: { username: user.username },
    });
    if (usernameCollision) usernameErrors.push("Username already in use");
    const emailErrors = [];
    if (user.email.length === 0) emailErrors.push("Email must not be empty");
    const emailCollision = await this.findOne({
      where: { email: user.email },
    });
    if (emailCollision) emailErrors.push("Email already in use");
    const passwordErrors = [];
    if (user.password.length === 0) passwordErrors.push("Password must not be empty");
    if (usernameErrors.length || emailErrors.length || passwordErrors.length) {
      throw new ValidationError({
        fieldErrors: {
          ...(usernameErrors.length && { username: usernameErrors }),
          ...(emailErrors.length && { email: emailErrors }),
          ...(passwordErrors.length && { password: passwordErrors }),
        },
      });
    }

    user.password = await hash(user.password, await genSalt());
    return this.create({ ...user, roles }, options);
  }

  /** Don't use this. If you need the system user, get it from UserService. */
  async _getSystemUser() {
    return notNull(await this.findOne({ where: { username: EXECUTOR_SYSTEM } }));
  }
}
