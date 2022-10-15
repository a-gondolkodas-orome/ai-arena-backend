import { Executor } from "../../authorization";

declare module "express-serve-static-core" {
  export interface Request {
    executor: Executor;
  }
}

export {};
