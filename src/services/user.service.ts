import { UserService as AuthUserService } from "@loopback/authentication";
import { repository } from "@loopback/repository";
import { securityId, UserProfile } from "@loopback/security";
import { compare } from "bcryptjs";
import { UserRepository } from "../repositories";
import { User } from "../models/user";
import { AssertException, AuthenticationError } from "../errors";

export type Credentials = {
  email: string;
  password: string;
};

export class UserService implements AuthUserService<User, Credentials> {
  constructor(@repository(UserRepository) public userRepository: UserRepository) {}

  async verifyCredentials(credentials: Credentials): Promise<User> {
    if (credentials.email.length === 0) {
      throw new AuthenticationError({ message: "Invalid email or password." });
    }
    const users = await this.userRepository._systemAccess.find({
      where: { email: credentials.email },
    });
    if (users.length > 1) {
      throw new AssertException({
        message: "UserService: email collision - contact admins",
        values: { email: credentials.email },
      });
    }
    if (!users.length) {
      throw new AuthenticationError({ message: "Invalid email or password." });
    }
    if (!(await compare(credentials.password, users[0].password))) {
      throw new AuthenticationError({ message: "Invalid email or password." });
    }
    return users[0];
  }

  convertToUserProfile(user: User): UserProfile {
    return {
      [securityId]: user.id.toString(),
      name: user.username,
      id: user.id,
      email: user.email,
    };
  }

  protected systemUser?: User;

  async getSystemUser() {
    if (!this.systemUser) {
      this.systemUser = await this.userRepository._getSystemUser();
    }
    return this.systemUser;
  }
}
