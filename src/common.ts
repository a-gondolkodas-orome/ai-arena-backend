import * as t from "io-ts";

export const EVENT_TYPE__BOT = "bot";
export const botUpdateEventCodec = t.type({ botUpdate: t.string });
export type BotUpdateEvent = t.TypeOf<typeof botUpdateEventCodec>;

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

export const botConfigCodec = t.type({ id: t.string, name: t.string, runCommand: t.string });
export const matchConfigCodec = t.type({
  map: t.string,
  bots: t.array(botConfigCodec),
});

export const scoresCodec = t.record(t.string, t.number);

export type GqlValue = { __typename: string };
