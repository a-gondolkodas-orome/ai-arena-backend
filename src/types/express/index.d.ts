import { Actor } from "../../authorization";

declare global {
  namespace Express {
    export interface Request {
      actor: Actor;
    }
  }
}

export {};
