import { get, Request, Response, RestBindings } from "@loopback/rest";
import { inject } from "@loopback/core";
import { AiArenaBindings } from "../keys";
import { BotService, MatchService } from "../services";
import { HttpStatusCode } from "../errors";
import { EVENT_TYPE__BOT, EVENT_TYPE__MATCH } from "../common";
import { setInterval } from "timers";
import { Time } from "../utils";

export class SseController {
  constructor(
    @inject(AiArenaBindings.BOT_SERVICE) protected botService: BotService,
    @inject(AiArenaBindings.MATCH_SERVICE) protected matchService: MatchService,
  ) {}

  @get("/sse")
  sse(
    @inject(RestBindings.Http.REQUEST) request: Request,
    @inject(RestBindings.Http.RESPONSE) response: Response,
  ) {
    if (!request.executor) {
      response.sendStatus(HttpStatusCode.HTTP_401_UNAUTHORIZED);
      return;
    }
    const userId = request.executor.id;
    response.status(HttpStatusCode.HTTP_200_OK);
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    // response.setHeader("Access-Control-Allow-Origin", "*"); TODO when is this necessary?
    response.flushHeaders();

    const keepAliveInterval = setInterval(() => {
      response.write(": keep alive\n\n");
    }, 60 * Time.second);

    const sendEvent = (event: string, data: unknown) => {
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const sendBotEvent = (data: unknown) => sendEvent(EVENT_TYPE__BOT, data);
    const sendMatchEvent = (data: unknown) => sendEvent(EVENT_TYPE__MATCH, data);

    response.on("close", () => {
      this.botService.sse.off(userId, sendBotEvent);
      this.matchService.sse.off(userId, sendBotEvent);
      clearInterval(keepAliveInterval);
    });

    this.botService.sse.on(userId, sendBotEvent);
    this.matchService.sse.on(userId, sendMatchEvent);
    return response;
  }
}
