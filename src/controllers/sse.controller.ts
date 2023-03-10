import { get, Request, Response, RestBindings } from "@loopback/rest";
import { inject, service } from "@loopback/core";
import { HttpStatusCode } from "../errors";
import { EVENT_TYPE__BOT, EVENT_TYPE__MATCH } from "../common";
import { setInterval } from "timers";
import { Time } from "../utils";
import { BotService } from "../services/bot.service";
import { MatchService } from "../services/match.service";

export class SseController {
  constructor(
    @service() protected botService: BotService,
    @service() protected matchService: MatchService,
  ) {}

  @get("/sse")
  sse(
    @inject(RestBindings.Http.REQUEST) request: Request,
    @inject(RestBindings.Http.RESPONSE) response: Response,
  ) {
    if (!request.actor) {
      response.sendStatus(HttpStatusCode.HTTP_401_UNAUTHORIZED);
      return;
    }
    const userId = request.actor.id;
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
