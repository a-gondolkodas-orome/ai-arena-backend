import { BindingScope, injectable, service } from "@loopback/core";
import { repository } from "@loopback/repository";
import path from "path";
import EventEmitter from "events";
import { Contest, ContestStatus } from "../models/contest";
import { MatchService } from "./match.service";
import { UserService } from "./user.service";
import { MatchRepository } from "../repositories/match.repository";
import { ContestRepository } from "../repositories/contest.repository";

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
    for (let bot1 = 0; bot1 < contest.botIds.length; ++bot1) {
      for (let bot2 = bot1 + 1; bot2 < contest.botIds.length; ++bot2) {
        const match = await this.matchRepository.validateAndCreate(
          await this.userService.getSystemUser(),
          {
            gameId: contest.gameId,
            botIds: [contest.botIds[bot1], contest.botIds[bot2]],
          },
        );
        contest.matchIds.push(match.id);
        await this.contestRepository.update(contest);
        await this.matchService.runMatch(match);
      }
    }
    contest.status = ContestStatus.FINISHED;
    await this.contestRepository.update(contest);
  }
}
