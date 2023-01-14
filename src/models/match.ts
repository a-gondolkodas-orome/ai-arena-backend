import { field, ID, inputType, objectType } from "@loopback/graphql";
import { belongsTo, Entity, model, property } from "@loopback/repository";
import { createAuthErrorUnionType, GraphqlError } from "./auth";
import { User } from "./user";
import { Game } from "./game";
import { GqlValue } from "../utils";
import { Bot } from "./bot";
import { registerEnumType } from "type-graphql";

export enum MatchRunStage {
  REGISTERED = "REGISTERED",
  PREPARE_GAME_SERVER_DONE = "PREPARE_GAME_SERVER_DONE",
  PREPARE_GAME_SERVER_ERROR = "PREPARE_GAME_SERVER_ERROR",
  PREPARE_BOTS_DONE = "PREPARE_BOTS_DONE",
  PREPARE_BOTS_ERROR = "PREPARE_BOTS_ERROR",
  RUN_SUCCESS = "RUN_SUCCESS",
  RUN_ERROR = "RUN_ERROR",
}

registerEnumType(MatchRunStage, {
  name: "MatchRunStage",
});

@objectType()
@model()
export class MatchRunStatus {
  @field((type) => MatchRunStage)
  @property()
  stage: MatchRunStage;

  @field({ nullable: true })
  @property()
  log: string;
}

@objectType()
export class MatchResult {
  @field()
  log: string;
}

@objectType()
@model()
export class Match extends Entity {
  @field((type) => ID)
  @property({ id: true, type: "string", mongodb: { dataType: "ObjectId" } })
  id: string;

  @belongsTo(() => User, {}, { type: "string", mongodb: { dataType: "ObjectId" } })
  userId: string;
  @field()
  user: User;

  @belongsTo(() => Game, {}, { type: "string", mongodb: { dataType: "ObjectId" } })
  gameId: string;
  @field()
  game: Game;

  @property.array(String)
  botIds: string[];
  @field((type) => [Bot])
  bots: Bot[];

  @field()
  @property()
  runStatus: MatchRunStatus;

  @field((type) => MatchResult, { nullable: true })
  result: MatchResult | undefined;

  @property()
  log:
    | {
        file: Buffer;
        fileName: string;
      }
    | undefined;
}

@inputType()
export class MatchInput {
  @field()
  gameId: string;

  @field((type) => [String])
  botIds: string[];
}

@objectType()
export class StartMatchFieldErrors {
  @field((type) => [String!], { nullable: true })
  gameId?: string[];
  @field((type) => [String!], { nullable: true })
  botIds?: string[];
}

@objectType({ implements: GraphqlError })
export class StartMatchError extends GraphqlError {
  @field()
  fieldErrors: StartMatchFieldErrors;
}

export const StartMatchResponse = createAuthErrorUnionType(
  "StartMatchResponse",
  [Match, StartMatchError],
  (value: unknown) =>
    (value as GqlValue).__typename === "Match"
      ? Match
      : (value as GqlValue).__typename === "StartMatchError"
      ? StartMatchError
      : undefined,
);

@objectType()
export class Matches {
  @field((type) => [Match])
  matches: Match[];
}

export const MatchesResponse = createAuthErrorUnionType(
  "MatchesResponse",
  [Matches],
  (value: unknown) => ((value as GqlValue).__typename === "Matches" ? Matches : undefined),
);

export const MatchResponse = createAuthErrorUnionType("MatchResponse", [Match], (value: unknown) =>
  (value as GqlValue).__typename === "Match" ? Match : undefined,
);
