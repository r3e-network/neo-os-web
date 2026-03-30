import { OSServiceProxy } from "./OSServiceProxy";

export interface LeaderboardEntry {
  user: string;
  score: string;
}

export class LeaderboardProxy extends OSServiceProxy {
  protected readonly servicePrefix = "os-leaderboard";

  async submitScore(score: string): Promise<void> {
    await this.call("submit", { score });
  }

  async get(limit = 100): Promise<LeaderboardEntry[]> {
    return this.call("get", { limit });
  }

  async reset(): Promise<void> {
    await this.call("reset", {});
  }
}
