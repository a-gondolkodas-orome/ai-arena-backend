import { Model, model, property } from "@loopback/repository";
import { field, objectType } from "@loopback/graphql";

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
