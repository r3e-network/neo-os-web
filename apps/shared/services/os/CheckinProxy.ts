import { OSServiceProxy } from "./OSServiceProxy";

export interface CheckinData {
  currentStreak: number;
  highestStreak: number;
  totalCheckins: number;
  lastCheckinTime: number;
  unclaimedRewards: string;
  totalClaimed: string;
}

export class CheckinProxy extends OSServiceProxy {
  protected readonly servicePrefix = "os-checkin";

  async checkIn(): Promise<void> {
    await this.call("checkin", {});
  }

  async getStreak(): Promise<CheckinData> {
    return this.call("streak", {});
  }

  async claimRewards(): Promise<void> {
    await this.call("claim", {});
  }
}
