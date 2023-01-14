import * as t from "io-ts";

export const EVENT_TYPE__BOT = "bot";
export const botUpdateEventCodec = t.type({ botUpdate: t.string });
export type BotUpdateEvent = t.TypeOf<typeof botUpdateEventCodec>;

export const EVENT_TYPE__MATCH = "match";
export const matchUpdateEventCodec = t.type({ matchUpdate: t.string });
export type MatchUpdateEvent = t.TypeOf<typeof matchUpdateEventCodec>;
