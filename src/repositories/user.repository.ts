import { inject } from "@loopback/core";
import { DefaultCrudRepository, Where } from "@loopback/repository";
import { MongoDataSource } from "../datasources";
import { User } from "../models/user";
import { Filter } from "@loopback/filter";
import { Options } from "@loopback/repository/src/common-types";
import { AccessLevel, Executor, authorize } from "../authorization";
import { genSalt, hash } from "bcryptjs";
import { RegistrationData } from "../models/auth";
import { ValidationError } from "../errors";

export class UserRepository {
  constructor(@inject("datasources.mongo") dataSource: MongoDataSource) {
    this.repo = new DefaultCrudRepository<User, typeof User.prototype.id, {}>(
      User,
      dataSource,
    );
  }
  protected repo: DefaultCrudRepository<User, typeof User.prototype.id, {}>;

  async count(executor: Executor, where?: Where<User>, options?: Options) {
    authorize(AccessLevel.ADMIN, executor);
    return this.repo.count(where, options);
  }

  async find(executor: Executor, filter?: Filter<User>, options?: Options) {
    authorize(AccessLevel.ADMIN, executor);
    return this.repo.find(filter, options);
  }

  async create(executor: Executor, user: RegistrationData, options?: Options) {
    authorize(AccessLevel.NONE, executor);
    await this.validateCreate(user);
    user.password = await hash(user.password, await genSalt());
    return this.repo.create(user, options);
  }

  async findOne(executor: Executor, filter?: Filter<User>, options?: Options) {
    const user = await this.repo.findOne(filter, options);
    authorize(AccessLevel.OWNER, executor, user?.id);
    return user;
  }

  // TODO use some validation library?
  protected async validateCreate(user: RegistrationData) {
    const usernameErrors = [];
    if (user.username.length === 0)
      usernameErrors.push("Username must not be empty");
    const usernameCollision = await this.repo.findOne({
      where: { username: user.username },
    });
    if (usernameCollision) usernameErrors.push("Username already in use");
    const emailErrors = [];
    if (user.email.length === 0) emailErrors.push("Email must not be empty");
    const emailCollision = await this.repo.findOne({
      where: { email: user.email },
    });
    if (emailCollision) emailErrors.push("Email already in use");
    const passwordErrors = [];
    if (user.password.length === 0)
      passwordErrors.push("Password must not be empty");
    if (usernameErrors.length || emailErrors.length || passwordErrors.length) {
      throw new ValidationError({
        fieldErrors: {
          ...(usernameErrors.length && { username: usernameErrors }),
          ...(emailErrors.length && { email: emailErrors }),
          ...(passwordErrors.length && { password: passwordErrors }),
        },
      });
    }
  }
}
