import { ApplicationConfig, AiArenaBackendApplication } from "./application";
import { program } from "commander";
import { appConfigCodec } from "../shared/common";
import { decode } from "../shared/codec";

export * from "./application";

export async function main(options: ApplicationConfig) {
  const app = new AiArenaBackendApplication(options);
  await app.boot();
  await app.start();

  const url = app.restServer.url;
  console.log(`Server is running at ${url}`);

  return app;
}

if (require.main === module) {
  program
    .name("ai-arena-backend")
    .description("Backend server for AI Arena")
    .requiredOption("--redis-url <url>", "URL of the Redis server")
    .requiredOption("--mongodb-url <url>", "URL of the MongoDB server")
    .parse();
  const options = decode(appConfigCodec, program.opts(), "appConfig");

  const config = {
    redisUrl: options.redisUrl,
    mongodbUrl: options.mongodbUrl,
    rest: {
      port: +(process.env.PORT ?? 3000),
      host: process.env.HOST,
      // The `gracePeriodForClose` provides a graceful close for http/https
      // servers with keep-alive clients. The default value is `Infinity`
      // (don't force-close). If you want to immediately destroy all sockets
      // upon stop, set its value to `0`.
      // See https://www.npmjs.com/package/stoppable
      gracePeriodForClose: 5000, // 5 seconds
      openApiSpec: {
        // useful when used with OpenAPI-to-GraphQL to locate your application
        setServersFromRequest: true,
      },
    },
    graphql: {
      apollo: {
        subscriptions: "/subscriptions",
      },
      asMiddlewareOnly: true,
    },
  };
  main(config).catch((err) => {
    console.error("Cannot start the application.", err);
    process.exit(1);
  });
}
