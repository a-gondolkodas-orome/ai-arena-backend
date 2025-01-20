import { injectable, BindingScope, inject } from "@loopback/core";
import { JWTService, TokenServiceBindings } from "@loopback/authentication-jwt";
import { promisify } from "util";
import { Secret, sign, SignOptions, VerifyOptions, verify, Jwt } from "jsonwebtoken";
import * as t from "io-ts";
import { AuthorizationError } from "../../shared/errors";
import { decode } from "../../shared/codec";

const signAsync = promisify<string | Buffer | object, Secret, SignOptions | undefined, string>(
  sign,
);
const verifyAsync = promisify<string, Secret, VerifyOptions | undefined, Jwt>(verify);

@injectable({ scope: BindingScope.SINGLETON })
export class JwtService extends JWTService {
  constructor(
    @inject(TokenServiceBindings.TOKEN_SECRET)
    jwtSecret: string,
    @inject(TokenServiceBindings.TOKEN_EXPIRES_IN)
    userTokenExpiresIn: string,
  ) {
    super(jwtSecret, userTokenExpiresIn);
    this.secret = jwtSecret;
  }

  protected secret: string;

  async generateUniversalToken<T extends object>(codec: t.Type<T>, data: T, options?: SignOptions) {
    return signAsync(codec.encode(data), this.secret, options);
  }

  async verifyUniversalToken<T extends object>(
    codec: t.Type<T>,
    token: string,
    options?: VerifyOptions,
  ) {
    try {
      return decode(codec, await verifyAsync(token, this.secret, options));
    } catch (error: unknown) {
      throw new AuthorizationError({
        message: `verifyUniversalToken: failed to decode token - ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      });
    }
  }
}
