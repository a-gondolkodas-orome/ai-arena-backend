import { BindingScope, injectable, service } from "@loopback/core";
import { repository } from "@loopback/repository";
import path from "path";
import EventEmitter from "events";
import { Contest, ContestStatus } from "../models/contest";
import { MatchService } from "./match.service";
import { UserService } from "./user.service";
import { MatchRepository } from "../repositories/match.repository";
import { ContestRepository } from "../repositories/contest.repository";
import { AssertException } from "../errors";
import { decodeJson } from "../codec";
import { scoresCodec } from "../common";
import { MatchRunStage } from "../models/match";

@injectable({ scope: BindingScope.SINGLETON })
export class ContestService {
  static getGamePath(gameId: string) {
    return path.resolve("container", "games", gameId);
  }

  static getMatchPath(matchId: string) {
    return path.resolve("container", "matches", matchId);
  }

  constructor(
    @service() protected userService: UserService,
    @service() protected matchService: MatchService,
    @repository("MatchRepository") protected matchRepository: MatchRepository,
    @repository("ContestRepository") protected contestRepository: ContestRepository,
  ) {}

  sse = new EventEmitter();

  async runContest(contest: Contest) {
    if (new Set(contest.botIds).size < contest.botIds.length) {
      throw new AssertException({
        message: "ContestService.runContest: botIds are not unique",
        values: { contestId: contest.id, botIds: contest.botIds },
      });
    }
    const contestScores = new Map(contest.botIds.map((botId) => [botId, 0]));
    const increaseScore = (botId: string, increment: number) => {
      contestScores.set(botId, (contestScores.get(botId) ?? 0) + increment);
    };
    for (let botIdx1 = 0; botIdx1 < contest.botIds.length; ++botIdx1) {
      for (let botIdx2 = botIdx1 + 1; botIdx2 < contest.botIds.length; ++botIdx2) {
        const botId1 = contest.botIds[botIdx1];
        const botId2 = contest.botIds[botIdx2];
        let match = await this.matchRepository.validateAndCreate(
          await this.userService.getSystemUser(),
          {
            gameId: contest.gameId,
            botIds: [botId1, botId2],
          },
        );
        contest.matchIds.push(match.id);
        await this.contestRepository.update(contest);
        await this.matchService.runMatch(match);
        match = await this.matchRepository.findById(match.id);
        if (match.runStatus.stage !== MatchRunStage.RUN_SUCCESS) {
          contest.status = ContestStatus.RUN_ERROR;
          await this.contestRepository.update(contest);
          return;
        }
        if (!match.scoreJson) {
          throw new AssertException({
            message: "ContestService.runContest: missing scoreJson",
            values: { contestId: contest.id },
          });
        }
        const matchScores = decodeJson(scoresCodec, match.scoreJson);
        if (matchScores[botId1] === matchScores[botId2]) {
          increaseScore(botId1, 0.5);
          increaseScore(botId2, 0.5);
        } else if (matchScores[botId1] > matchScores[botId2]) {
          increaseScore(botId1, 1);
        } else {
          increaseScore(botId2, 1);
        }
      }
    }
    contest.status = ContestStatus.FINISHED;
    contest.scoreJson = JSON.stringify(Object.fromEntries(contestScores));
    await this.contestRepository.update(contest);
  }
}
