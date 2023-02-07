import { field, ID, inputType, objectType } from "@loopback/graphql";
import { belongsTo, Entity, model, property } from "@loopback/repository";
import { createAuthErrorUnionType, GraphqlError } from "./auth";
import { Game } from "./game";
import { User } from "./user";
import { Bot } from "./bot";
import { Match } from "./match";
import { registerEnumType } from "type-graphql";
import { GqlValue } from "../utils";

export enum ContestStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  RUNNING = "RUNNING",
  FINISHED = "FINISHED",
}

registerEnumType(ContestStatus, {
  name: "ContestStatus",
});

@objectType()
@model()
export class Contest extends Entity {
  @field((type) => ID)
  @property({ id: true, type: "string", mongodb: { dataType: "ObjectId" } })
  id: string;

  @belongsTo(() => Game, {}, { type: "string", mongodb: { dataType: "ObjectId" } })
  gameId: string;
  @field()
  game: Game;

  @belongsTo(() => User, {}, { type: "string", mongodb: { dataType: "ObjectId" } })
  ownerId: string;
  @field()
  owner: User;

  @field()
  @property()
  name: string;

  @field()
  @property()
  date: Date;

  @property.array(String)
  botIds: string[];
  @field((type) => [Bot])
  bots: Bot[];

  @property.array(String)
  matchIds: string[];
  @field((type) => [Match])
  matches: Match[];

  @field()
  @property()
  status: ContestStatus;
}

@inputType()
export class ContestInput {
  @field()
  gameId: string;

  @field()
  name: string;

  @field()
  date: Date;
}

export const ContestResponse = createAuthErrorUnionType(
  "ContestResponse",
  [Contest],
  (value: unknown) => ((value as GqlValue).__typename === "Contest" ? Contest : undefined),
);

@objectType()
export class Contests {
  @field((type) => [Contest])
  contests: Contest[];
}

@objectType()
export class CreateContestFieldErrors {
  @field((type) => [String!], { nullable: true })
  gameId?: string[];
  @field((type) => [String!], { nullable: true })
  name?: string[];
  @field((type) => [String!], { nullable: true })
  date?: string[];
}

@objectType({ implements: GraphqlError })
export class CreateContestError extends GraphqlError {
  @field()
  fieldErrors: CreateContestFieldErrors;
}

export const ContestsResponse = createAuthErrorUnionType(
  "ContestsResponse",
  [Contests],
  (value: unknown) => ((value as GqlValue).__typename === "Contests" ? Contests : undefined),
);

export const CreateContestResponse = createAuthErrorUnionType(
  "CreateContestResponse",
  [Contest, CreateContestError],
  (value: unknown) =>
    (value as GqlValue).__typename === "Contest"
      ? Contest
      : (value as GqlValue).__typename === "CreateContestError"
      ? CreateContestError
      : undefined,
);
