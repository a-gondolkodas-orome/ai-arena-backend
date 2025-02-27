import { get, Request, Response, RestBindings } from "@loopback/rest";
import { inject, service } from "@loopback/core";
import { HttpStatusCode } from "../../shared/errors";
import { EVENT_TYPE__BOT, EVENT_TYPE__MATCH } from "../../shared/common";
import { setInterval } from "timers";
import { Time } from "../../shared/utils";
import { BotService } from "../services/bot.service";
import { MatchService } from "../services/match.service";
import { Actor } from "../services/authorization.service";

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
    const actor = request.actor as Actor; // stupid eslint
    if (!actor) {
      response.sendStatus(HttpStatusCode.HTTP_401_UNAUTHORIZED);
      return;
    }
    const userId = actor.id;
    response.status(HttpStatusCode.HTTP_200_OK);
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.flushHeaders();
    console.log(`SSE opened ${userId}`);

    const keepAliveInterval = setInterval(() => {
      response.write(": keep alive\n\n");
    }, 25 * Time.second);

    const sendEvent = (event: string, data: unknown) => {
      const sseMessage = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      response.write(sseMessage);
      console.log(`SSE ${userId}:\n` + sseMessage);
    };
    const sendBotEvent = (data: unknown) => sendEvent(EVENT_TYPE__BOT, data);
    const sendMatchEvent = (data: unknown) => sendEvent(EVENT_TYPE__MATCH, data);

    response.on("close", () => {
      console.log(`SSE closed ${userId}`);
      this.botService.sse.off(userId, sendBotEvent);
      this.matchService.sse.off(userId, sendBotEvent);
      clearInterval(keepAliveInterval);
    });

    this.botService.sse.on(userId, sendBotEvent);
    this.matchService.sse.on(userId, sendMatchEvent);
    return response;
  }
}
