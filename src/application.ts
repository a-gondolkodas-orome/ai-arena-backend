import { BootMixin } from "@loopback/boot";
import { ApplicationConfig as LoopbackAppConfig, CoreTags } from "@loopback/core";
import { RestExplorerBindings, RestExplorerComponent } from "@loopback/rest-explorer";
import { Request, RestApplication } from "@loopback/rest";
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
import { GraphqlContextResolverProvider } from "./graphql-resolvers/graphql-context-resolver.provider";
import { JWTAuthenticationStrategy } from "@loopback/authentication-jwt/dist/services/jwt.auth.strategy";
import { UserRepository } from "./repositories/user.repository";
import { JwtService } from "./services/jwt.service";
import { MetricsComponent } from "@loopback/metrics";
import path from "path";
import { appConfigCodec } from "../shared/common";
import * as t from "io-ts";

type ApplicationConfig = LoopbackAppConfig & t.TypeOf<typeof appConfigCodec>;

export { ApplicationConfig };

export class AiArenaBackendApplication extends BootMixin(RepositoryMixin(RestApplication)) {
  static config: ApplicationConfig;

  constructor(options: ApplicationConfig) {
    super(options);
    AiArenaBackendApplication.config = options;

    this.component(GraphQLComponent);
    this.component(AuthenticationComponent);
    this.component(JWTAuthenticationComponent);
    this.component(MetricsComponent);
    this.dataSource(MongoDataSource, UserServiceBindings.DATASOURCE_NAME);
    this.bind(AiArenaBindings.AUTH_STRATEGY).toClass(JWTAuthenticationStrategy);
    this.bind(UserServiceBindings.USER_REPOSITORY).toClass(UserRepository);
    this.bind(TokenServiceBindings.TOKEN_SERVICE).toAlias(
      `${CoreTags.SERVICE}s.${JwtService.name}`,
    );
    const server = this.getSync(GraphQLBindings.GRAPHQL_SERVER);
    server.middleware<{
      req: Request<unknown, unknown, { operationName?: string; variables?: object }>;
    }>((resolverData, next) => {
      if (resolverData.root === undefined) {
        const request = resolverData.context.req;
        console.log(
          `${new Date().toISOString()} ${request.method} ${request.originalUrl} ${
            request.body.operationName
          } vars: ${JSON.stringify(request.body.variables)}`,
        );
      }
      return next();
    });
    this.expressMiddleware("middleware.express.GraphQL", server.expressApp);
    this.bind(GraphQLBindings.GRAPHQL_CONTEXT_RESOLVER).toProvider(GraphqlContextResolverProvider);

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
