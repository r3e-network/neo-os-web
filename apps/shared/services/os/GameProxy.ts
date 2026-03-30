import { OSServiceProxy } from "./OSServiceProxy";

export interface PoolConfig {
  poolType: number;  // 0=countdown, 1=pvp, 2=lottery
  maxPlayers: number;
  entryFee: string;
  duration: number;
}

export interface PoolState {
  poolId: string;
  appId: string;
  status: 'open' | 'active' | 'settled' | 'cancelled';
  playerCount: number;
  totalBets: string;
}

export class GameProxy extends OSServiceProxy {
  protected readonly servicePrefix = "os-game";

  async createPool(config: PoolConfig): Promise<string> {
    return this.call("create", { config });
  }

  async joinPool(poolId: string): Promise<void> {
    await this.call("join", { poolId });
  }

  async placeBet(poolId: string, amount: string): Promise<void> {
    await this.call("bet", { poolId, amount });
  }

  async getPoolState(poolId: string): Promise<PoolState> {
    return this.call("status", { poolId });
  }

  async settle(poolId: string, results: unknown): Promise<void> {
    await this.call("settle", { poolId, results });
  }
}
