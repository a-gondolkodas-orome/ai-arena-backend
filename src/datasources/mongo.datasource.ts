import { inject, lifeCycleObserver, LifeCycleObserver } from "@loopback/core";
import { juggler } from "@loopback/repository";
import { MONGODB_DATABASE } from "../../shared/common";
import { AiArenaBackendApplication } from "../application";

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver("datasource")
export class MongoDataSource extends juggler.DataSource implements LifeCycleObserver {
  static dataSourceName = "mongo";

  constructor(
    @inject("datasources.config.mongo", { optional: true })
    dsConfig: object = {
      name: "mongo",
      connector: "mongodb",
      url: AiArenaBackendApplication.config.mongodbUrl,
      useNewUrlParser: true,
      database: MONGODB_DATABASE,
      authSource: "admin",
    },
  ) {
    super(dsConfig);
  }
}
