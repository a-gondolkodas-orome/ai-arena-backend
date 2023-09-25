import { Model, model, property } from "@loopback/repository";
import { field, objectType } from "@loopback/graphql";
import { createAuthErrorUnionType, GraphqlError } from "./auth";
import { GqlValue } from "../common";

@objectType()
@model()
export class File extends Model {
  @property()
  content: Buffer;

  @field(() => String)
  get contentBase64() {
    return this.content.toString("base64");
  }

  @field()
  @property()
  fileName: string;
}

@objectType({ implements: GraphqlError })
export class GraphqlValidationError extends GraphqlError {}

export const ValidatedNoContentResponse = createAuthErrorUnionType(
  "ValidatedNoContentResponse",
  [GraphqlValidationError],
  (value: unknown) =>
    (value as GqlValue).__typename === "GraphqlValidationError"
      ? "GraphqlValidationError"
      : undefined,
);
