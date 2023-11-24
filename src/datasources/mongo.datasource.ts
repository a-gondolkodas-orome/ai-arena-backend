import { inject, lifeCycleObserver, LifeCycleObserver } from "@loopback/core";
import { juggler } from "@loopback/repository";

export const MONGODB_DATABASE = "ai-arena";

const config = {
  name: "mongo",
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  connector: require("loopback-connector-mongodb"), // see https://github.com/loopbackio/loopback-datasource-juggler/issues/1866
  url:
    process.env.NODE_ENV === "production"
      ? process.env.MONGODB_URL
      : `mongodb://127.0.0.1:27017/${MONGODB_DATABASE}`,
  useNewUrlParser: true,
};

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver("datasource")
export class MongoDataSource extends juggler.DataSource implements LifeCycleObserver {
  static dataSourceName = "mongo";
  static readonly defaultConfig = config;

  constructor(
    @inject("datasources.config.mongo", { optional: true })
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}
