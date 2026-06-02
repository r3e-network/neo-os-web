import { OSServiceProxy } from "./OSServiceProxy";

export interface CheckinData {
  currentStreak: number;
  highestStreak: number;
  totalCheckins: number;
  lastCheckinTime: number;
  unclaimedRewards: string;
  totalClaimed: string;
  totalGlobalCheckins?: number | string;
  totalGlobalUsers?: number | string;
  totalGlobalRewarded?: number | string;
  checkInFee?: number | string;
}

export class CheckinProxy extends OSServiceProxy {
  protected readonly servicePrefix = "os-checkin";

  async checkIn(): Promise<unknown> {
    return this.call("checkin", {});
  }

  async getStreak(): Promise<CheckinData> {
    return this.call("streak", {});
  }

  async claimRewards(): Promise<unknown> {
    return this.call("claim", {});
  }
}
