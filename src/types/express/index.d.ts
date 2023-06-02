import { Actor } from "../../authorization";
import { GraphqlDataLoaders } from "../../graphql-resolvers/graphql-context-resolver.provider";

declare global {
  namespace Express {
    export interface Request {
      actor: Actor;
      loaders: GraphqlDataLoaders;
    }
  }
}

export {};
