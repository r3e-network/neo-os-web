import { OSServiceProxy } from "./OSServiceProxy";

export class BadgeProxy extends OSServiceProxy {
  protected readonly servicePrefix = "os-badge";

  async define(
    badgeId: string,
    name: string,
    criteria: string,
  ): Promise<void> {
    await this.call("define", { badgeId, name, criteria });
  }

  async award(badgeId: string, user: string): Promise<void> {
    await this.call("award", { badgeId, user });
  }

  async revoke(badgeId: string, user: string): Promise<void> {
    await this.call("revoke", { badgeId, user });
  }

  async list(user?: string): Promise<unknown[]> {
    return this.call("list", { user });
  }

  async getStat(user: string, statKey: string): Promise<string> {
    return this.call("get-stat", { user, statKey });
  }

  async updateStat(
    user: string,
    statKey: string,
    value: string,
  ): Promise<void> {
    await this.call("update-stat", { user, statKey, value });
  }
}
