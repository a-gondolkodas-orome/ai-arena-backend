import { BootMixin } from "@loopback/boot";
import { ApplicationConfig } from "@loopback/core";
import { RestExplorerBindings, RestExplorerComponent } from "@loopback/rest-explorer";
import { RestApplication } from "@loopback/rest";
import path from "path";
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
import { BotService, JwtService, MatchService, UserService } from "./services";
import { UserRepository } from "./repositories";
import { AiArenaBindings } from "./keys";
import { GraphqlAuthenticationProvider } from "./authentication/graphql-authentication.provider";
import { JWTAuthenticationStrategy } from "@loopback/authentication-jwt/dist/services/jwt.auth.strategy";

export { ApplicationConfig };

export class AiArenaBackendApplication extends BootMixin(RepositoryMixin(RestApplication)) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    this.component(GraphQLComponent);
    this.component(AuthenticationComponent);
    this.component(JWTAuthenticationComponent);
    this.dataSource(MongoDataSource, UserServiceBindings.DATASOURCE_NAME);
    this.bind(AiArenaBindings.USER_SERVICE).toClass(UserService);
    this.bind(AiArenaBindings.BOT_SERVICE).toInjectable(BotService);
    this.bind(AiArenaBindings.MATCH_SERVICE).toInjectable(MatchService);
    this.bind(AiArenaBindings.JWT_SERVICE).toInjectable(JwtService);
    this.bind(AiArenaBindings.AUTH_STRATEGY).toClass(JWTAuthenticationStrategy);
    this.bind(UserServiceBindings.USER_REPOSITORY).toClass(UserRepository);
    this.bind(TokenServiceBindings.TOKEN_SERVICE).toInjectable(JwtService);
    const server = this.getSync(GraphQLBindings.GRAPHQL_SERVER);
    this.expressMiddleware("middleware.express.GraphQL", server.expressApp);
    this.bind(GraphQLBindings.GRAPHQL_CONTEXT_RESOLVER).toProvider(GraphqlAuthenticationProvider);

    this.sequence(AiArenaSequence);
    this.static("/", path.join(__dirname, "../public"));
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
