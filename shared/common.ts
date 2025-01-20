import * as t from "io-ts";
import path from "path";

export const appConfigCodec = t.type({ redisUrl: t.string, mongodbUrl: t.string });

export const MONGODB_DATABASE = "ai-arena";

export const EXECUTOR_SYSTEM = "EXECUTOR_SYSTEM";

export const AI_ARENA_CONFIG_FILE_NAME = "ai-arena.config.json";

export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
}

export const EVENT_TYPE__BOT = "bot";
export const botUpdateEventCodec = t.type({ botUpdate: t.string });
export type BotUpdateEvent = t.TypeOf<typeof botUpdateEventCodec>;

export function getBotPath(botId: string) {
  return path.resolve("container", "bots", botId);
}

export const EVENT_TYPE__MATCH = "match";
export const matchUpdateEventCodec = t.type({ matchUpdate: t.string });
export type MatchUpdateEvent = t.TypeOf<typeof matchUpdateEventCodec>;

export enum ErrorType {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  ASSERT_EXCEPTION = "ASSERT_EXCEPTION",
  USER_EXCEPTION = "USER_EXCEPTION",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
}

export function isErrorWithMessage(error: unknown): error is { message: string } {
  return !!error && typeof (error as { message: string }).message === "string";
}

export const botConfigCodec = t.type({ id: t.string, name: t.string, runCommand: t.string });
export const matchConfigCodec = t.type({
  map: t.string,
  bots: t.array(botConfigCodec),
});

export const scoresCodec = t.record(t.string, t.number);

export type GqlValue = { __typename: string };

export class RedisKey {
  static readonly WORK_QUEUE__MATCH = "WORK_QUEUE:MATCH";
  static readonly WORK_QUEUE__BOT_CHECK = "WORK_QUEUE:BOT_CHECK";
}

export const matchExecutionWorkCodec = t.type({ matchId: t.string, callbackChannel: t.string });
export const matchExecutionResultCodec = t.type({ userId: t.string, matchId: t.string });
export const botCheckWorkCodec = t.type({ botId: t.string, callbackChannel: t.string });
export const botCheckResultCodec = t.type({ userId: t.string, botId: t.string });

export const aiArenaConfigCodec = t.type({
  build: t.string,
  programPath: t.string,
  run: t.string,
});

export function sleep(time: number) {
  return new Promise<void>((resolve) => (time <= 0 ? resolve() : setTimeout(() => resolve(), time)));
}
