import express from "express";
import { MatchExecutor } from "./match-executor";
import { program } from "commander";
import { appConfigCodec } from "../../shared/common";
import { decode } from "../../shared/codec";
import { BotChecker } from "./bot-checker";

program
  .name("ai-arena-worker")
  .description("Scalable job executor for distributing work, primarily match execution.")
  .requiredOption("--redis-url <url>", "URL of the Redis server")
  .requiredOption("--mongodb-url <url>", "URL of the MongoDB server")
  .parse();

async function run() {
  const options = decode(appConfigCodec, program.opts(), "appConfig");
  const botChecker = await BotChecker.create(options.redisUrl, options.mongodbUrl);
  const matchExecutor = await MatchExecutor.create(options.redisUrl, options.mongodbUrl);
  await Promise.all([botChecker.run(), matchExecutor.run()]);
}

run().catch((error) => {
  console.error("AI Arena Worker: fatal error");
  if (error instanceof Error) {
    console.error(error.message);
    console.error(error.stack);
  }
  process.exit(1);
});

if (process.env.NODE_ENV === "production") {
  const healthCheckAndMetricsApp = express();
  const PORT = process.env.PORT ?? 3000;

  healthCheckAndMetricsApp.get("/healthz", (req, res) => {
    res.status(200).send("OK");
  });

  healthCheckAndMetricsApp.get("/readyz", (req, res) => {
    res.status(200).send("Ready");
  });

  healthCheckAndMetricsApp.listen(PORT, () => {
    console.log(`Health checks and metrics server is running on port ${PORT}`);
  });
}
