import { field, ID, inputType, objectType } from "@loopback/graphql";
import { belongsTo, Entity, model, property } from "@loopback/repository";
import { createAuthErrorUnionType, GraphqlError } from "./auth";
import { User } from "./user";
import { Game } from "./game";
import { GqlValue } from "../utils";
import { ProgramSource } from "./base";

@objectType()
@model()
export class Bot extends Entity {
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

  @field()
  @property()
  name: string;

  @property()
  source: ProgramSource;

  @property()
  versionNumber: number;
}

@inputType()
export class BotInput {
  @field()
  name: string;

  @field()
  gameId: string;
}

@objectType()
export class BotWithUploadLink {
  @field()
  bot: Bot;

  @field()
  uploadLink: string;
}

@objectType()
export class AddBotFieldErrors {
  @field((type) => [String!], { nullable: true })
  name?: string[];
  @field((type) => [String!], { nullable: true })
  gameId?: string[];
}

@objectType({ implements: GraphqlError })
export class AddBotError extends GraphqlError {
  @field()
  fieldErrors: AddBotFieldErrors;
}

export const AddBotResponse = createAuthErrorUnionType(
  "AddBotResponse",
  [BotWithUploadLink, AddBotError],
  (value: unknown) =>
    (value as GqlValue).__typename === "BotWithUploadLink"
      ? BotWithUploadLink
      : (value as GqlValue).__typename === "AddBotError"
      ? AddBotError
      : undefined,
);

@objectType()
export class Bots {
  @field((type) => [Bot])
  bots: Bot[];
}

export const BotsResponse = createAuthErrorUnionType(
  "BotsResponse",
  [Bots],
  (value: unknown) =>
    (value as GqlValue).__typename === "Bots" ? Bots : undefined,
);
