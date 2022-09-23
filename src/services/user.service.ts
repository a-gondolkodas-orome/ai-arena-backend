import {UserService as AuthUserService} from '@loopback/authentication';
import {repository} from '@loopback/repository';
import {securityId, UserProfile} from '@loopback/security';
import {compare} from 'bcryptjs';
import {UserRepository} from '../repositories';
import {User} from '../models/user';
import {EXECUTOR_SYSTEM} from '../authorization';
import {AssertException, AuthenticationError} from '../errors';

export type Credentials = {
  email: string;
  password: string;
};

export class UserService implements AuthUserService<User, Credentials> {
  constructor(@repository(UserRepository) public userRepository: UserRepository) {}

  async verifyCredentials(credentials: Credentials): Promise<User> {
    const users = await this.userRepository.find(EXECUTOR_SYSTEM, {
      where: {email: credentials.email},
    });
    if (users.length > 1) {
      throw new AssertException({
        message: 'UserService: email collision - contact admins',
        values: {email: credentials.email},
      });
    }
    if (!users.length) {
      throw new AuthenticationError({message: 'Invalid email or password.'});
    }
    if (!(await compare(credentials.password, users[0].password))) {
      throw new AuthenticationError({message: 'Invalid email or password.'});
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
}
