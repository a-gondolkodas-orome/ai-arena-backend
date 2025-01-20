import { AiArenaBackendApplication, ApplicationConfig } from "./application";

/**
 * Export the OpenAPI spec from the application
 */
async function exportOpenApiSpec(): Promise<void> {
  const config: ApplicationConfig = {
    rest: {
      port: +(process.env.PORT ?? 3000),
      host: process.env.HOST ?? "localhost",
    },
    redisUrl: "redis://localhost:6379",
    mongodbUrl: "mongodb://localhost:27017/ai-arena",
  };
  const outFile = process.argv[2] ?? "";
  const app = new AiArenaBackendApplication(config);
  await app.boot();
  await app.exportOpenApiSpec(outFile);
}

exportOpenApiSpec().catch((err) => {
  console.error("Fail to export OpenAPI spec from the application.", err);
  process.exit(1);
});
