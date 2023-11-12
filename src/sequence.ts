import { MiddlewareSequence, RequestContext } from "@loopback/rest";

export class AiArenaSequence extends MiddlewareSequence {
  async handle(context: RequestContext) {
    if (context.request.url !== "/graphql") {
      console.log(`${new Date().toISOString()} ${context.request.method} ${context.request.url}`);
    }
    await super.handle(context);
  }
}
