import Buffer from "buffer";
import { model, property } from "@loopback/repository";

@model()
export class ProgramSource {
  @property()
  file: Buffer;

  @property()
  fileName: string;
}
