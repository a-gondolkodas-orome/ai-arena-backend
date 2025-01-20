import { BindingScope, injectable, service } from "@loopback/core";
import { repository } from "@loopback/repository";
import { Match } from "../models/match";
import path from "path";
import fsp from "fs/promises";
import { decodeJson } from "../../shared/codec";
import { BotService } from "./bot.service";
import EventEmitter from "events";
import { GameRepository } from "../repositories/game.repository";
import { MatchRepository } from "../repositories/match.repository";
import { BotRepository } from "../repositories/bot.repository";
import { matchExecutionResultCodec, matchExecutionWorkCodec, RedisKey } from "../../shared/common";
import { createClient } from "@redis/client";
import { AiArenaBackendApplication } from "../application";

@injectable({ scope: BindingScope.SINGLETON })
export class MatchService {
  static getGamePath(gameId: string) {
    return path.resolve("container", "games", gameId);
  }

  static getMatchPath(matchId: string) {
    return path.resolve("container", "matches", matchId);
  }

  constructor(
    @service() protected botService: BotService,
    @repository("GameRepository") protected gameRepository: GameRepository,
    @repository("BotRepository") protected botRepository: BotRepository,
    @repository("MatchRepository") protected matchRepository: MatchRepository,
  ) {}

  sse = new EventEmitter();

  protected redis?: ReturnType<typeof createClient>;
  protected subscriberRedis?: ReturnType<typeof createClient>;
  protected static readonly CALLBACK_CHANNEL = "MATCH";

  async runMatch(match: Match) {
    if (!this.redis) {
      this.redis = createClient({
        url: AiArenaBackendApplication.config.redisUrl,
      });
      await this.redis.connect();
    }
    if (!this.subscriberRedis) {
      this.subscriberRedis = createClient({
        url: AiArenaBackendApplication.config.redisUrl,
      });
      await this.subscriberRedis.connect();
      await this.subscriberRedis.subscribe(MatchService.CALLBACK_CHANNEL, (message) => {
        const { userId, matchId } = decodeJson(matchExecutionResultCodec, message);
        this.sse.emit(userId, { matchUpdate: matchId });
      });
    }
    await this.redis.lPush(
      RedisKey.WORK_QUEUE__MATCH,
      JSON.stringify(
        matchExecutionWorkCodec.encode({
          matchId: match.id,
          callbackChannel: MatchService.CALLBACK_CHANNEL,
        }),
      ),
    );
  }

  async deleteMatchBuild(matchId: string) {
    await fsp.rm(MatchService.getMatchPath(matchId), { recursive: true, force: true });
  }
}
