import { field, ID, inputType, objectType } from "@loopback/graphql";
import { belongsTo, Entity, model, property } from "@loopback/repository";
import { createAuthErrorUnionType, GraphqlError } from "./auth";
import { User } from "./user";
import { Game } from "./game";
import { GqlValue } from "../utils";
import { Bot } from "./bot";

// @objectType()
// @model()
// export class MatchResult {
//   @field()
//   scores: string;
// }

@objectType()
@model()
export class Match extends Entity {
  @field((type) => ID)
  @property({ id: true, type: "string", mongodb: { dataType: "ObjectId" } })
  id: string;

  @belongsTo(
    () => User,
    {},
    { type: "string", mongodb: { dataType: "ObjectId" } },
  )
  userId: string;
  @field()
  user: User;

  @belongsTo(
    () => Game,
    {},
    { type: "string", mongodb: { dataType: "ObjectId" } },
  )
  gameId: string;
  @field()
  game: Game;

  @property.array(String)
  botIds: string[];
  @field((type) => [Bot])
  bots: Bot[];

  // @field({ nullable: true })
  // @property()
  // result: MatchResult;

  @property()
  log: {
    file: Buffer;
    fileName: string;
  };
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
  (value: unknown) =>
    (value as GqlValue).__typename === "Matches" ? Matches : undefined,
);
