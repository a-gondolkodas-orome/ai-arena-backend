import { Model, model, property } from "@loopback/repository";

@model()
export class File extends Model {
  @property()
  content: Buffer;

  @property()
  fileName: string;
}
