import { BootMixin } from "@loopback/boot";
import { ApplicationConfig, CoreTags } from "@loopback/core";
import { RestExplorerBindings, RestExplorerComponent } from "@loopback/rest-explorer";
import { RestApplication } from "@loopback/rest";
import { AiArenaSequence } from "./sequence";
import { GraphQLBindings, GraphQLComponent } from "@loopback/graphql";
import { RepositoryMixin } from "@loopback/repository";
import { AuthenticationComponent } from "@loopback/authentication";
import {
  JWTAuthenticationComponent,
  UserServiceBindings,
  TokenServiceBindings,
} from "@loopback/authentication-jwt";
import { MongoDataSource } from "./datasources";
import { AiArenaBindings } from "./keys";
import { GraphqlAuthenticationProvider } from "./authentication/graphql-authentication.provider";
import { JWTAuthenticationStrategy } from "@loopback/authentication-jwt/dist/services/jwt.auth.strategy";
import { UserRepository } from "./repositories/user.repository";
import { JwtService } from "./services/jwt.service";

export { ApplicationConfig };

export class AiArenaBackendApplication extends BootMixin(RepositoryMixin(RestApplication)) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    this.component(GraphQLComponent);
    this.component(AuthenticationComponent);
    this.component(JWTAuthenticationComponent);
    this.dataSource(MongoDataSource, UserServiceBindings.DATASOURCE_NAME);
    this.bind(AiArenaBindings.AUTH_STRATEGY).toClass(JWTAuthenticationStrategy);
    this.bind(UserServiceBindings.USER_REPOSITORY).toClass(UserRepository);
    this.bind(TokenServiceBindings.TOKEN_SERVICE).toAlias(
      `${CoreTags.SERVICE}s.${JwtService.name}`,
    );
    const server = this.getSync(GraphQLBindings.GRAPHQL_SERVER);
    this.expressMiddleware("middleware.express.GraphQL", server.expressApp);
    this.bind(GraphQLBindings.GRAPHQL_CONTEXT_RESOLVER).toProvider(GraphqlAuthenticationProvider);

    this.sequence(AiArenaSequence);
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: "/explorer",
    });
    this.component(RestExplorerComponent);
    this.projectRoot = __dirname;
    this.bootOptions = {
      controllers: {
        dirs: ["controllers"],
        extensions: [".controller.js"],
        nested: true,
      },
      graphqlResolvers: {
        dirs: ["graphql-resolvers"],
        extensions: [".js"],
        nested: true,
      },
    };
  }
}
