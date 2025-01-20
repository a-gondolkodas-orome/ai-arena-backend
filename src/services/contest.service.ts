import { BindingScope, injectable, service } from "@loopback/core";
import { repository } from "@loopback/repository";
import EventEmitter from "events";
import { Contest, ContestStatus } from "../models/contest";
import { MatchService } from "./match.service";
import { UserService } from "./user.service";
import { MatchRepository } from "../repositories/match.repository";
import { ContestRepository } from "../repositories/contest.repository";
import { AssertException } from "../../shared/errors";
import { decodeJson } from "../../shared/codec";
import { scoresCodec, sleep } from "../../shared/common";
import { MatchRunStage } from "../models/match";
import { performance } from "perf_hooks";
import { Time } from "../../shared/utils";

@injectable({ scope: BindingScope.SINGLETON })
export class ContestService {
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
    const startTime = performance.now();
    const matches = [];
    for (const mapName of contest.mapNames) {
      for (let botIdx1 = 0; botIdx1 < contest.botIds.length; ++botIdx1) {
        for (let botIdx2 = botIdx1 + 1; botIdx2 < contest.botIds.length; ++botIdx2) {
          const botId1 = contest.botIds[botIdx1];
          const botId2 = contest.botIds[botIdx2];
          const match = await this.matchRepository.validateAndCreate(
            await this.userService.getSystemUser(),
            {
              mapName,
              gameId: contest.gameId,
              botIds: [botId1, botId2],
            },
          );
          contest.matchIds.push(match.id);
          matches.push({ matchId: match.id, botId1, botId2 });
          await this.matchService.runMatch(match);
        }
      }
    }

    contest.progress = {
      totalMatchCount:
        (contest.mapNames.length * (contest.botIds.length * (contest.botIds.length - 1))) / 2,
      completedMatchCount: 0,
    };
    do {
      await sleep(3 * Time.second);
      contest.progress.completedMatchCount =
        await this.contestRepository.getCompletedMatchCount(contest);
      if (contest.progress.completedMatchCount) {
        const avgMatchTime = (performance.now() - startTime) / contest.progress.completedMatchCount;
        contest.progress.timeRemaining = Math.round(
          (contest.progress.totalMatchCount - contest.progress.completedMatchCount) * avgMatchTime,
        );
      }
      await this.contestRepository.update(contest);
    } while (contest.progress.completedMatchCount < matches.length);

    const contestScores = new Map(contest.botIds.map((botId) => [botId, 0]));
    const increaseScore = (botId: string, increment: number) => {
      contestScores.set(botId, (contestScores.get(botId) ?? 0) + increment);
    };
    for (const { matchId, botId1, botId2 } of matches) {
      const match = await this.matchRepository.findById(matchId);
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
    contest.status = ContestStatus.FINISHED;
    contest.scoreJson = JSON.stringify(Object.fromEntries(contestScores));
    await this.contestRepository.update(contest);
  }
}
