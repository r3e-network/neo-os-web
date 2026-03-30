import { OSServiceProxy } from "./OSServiceProxy";

export class GameProxy extends OSServiceProxy {
  protected readonly servicePrefix = "os-game";

  async createPool(config: Record<string, unknown>): Promise<string> {
    return this.call("create", { config });
  }

  async joinPool(poolId: string): Promise<void> {
    await this.call("join", { poolId });
  }

  async placeBet(poolId: string, amount: string): Promise<void> {
    await this.call("bet", { poolId, amount });
  }

  async getPoolState(poolId: string): Promise<unknown> {
    return this.call("status", { poolId });
  }

  async settle(poolId: string, results: unknown): Promise<void> {
    await this.call("settle", { poolId, results });
  }
}
