import { Executor } from "../../authorization";

declare global {
  namespace Express {
    export interface Request {
      executor: Executor;
    }
  }
}

export {};
