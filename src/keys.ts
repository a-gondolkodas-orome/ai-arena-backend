import {BindingKey} from '@loopback/core';
import {UserService} from './services';
import {AuthenticationStrategy} from '@loopback/authentication/src/types';

export namespace AiArenaBindings {
  export const USER_SERVICE = BindingKey.create<UserService>('user.service');

  export const AUTH_STRATEGY = BindingKey.create<AuthenticationStrategy>('auth.strategy');
}
