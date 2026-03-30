import { OSServiceProxy } from "./OSServiceProxy";

export class VestingProxy extends OSServiceProxy {
  protected readonly servicePrefix = "os-vesting";

  async createStream(params: Record<string, unknown>): Promise<string> {
    return this.call("create", params);
  }

  async claim(streamId: string): Promise<void> {
    await this.call("claim", { streamId });
  }

  async cancel(streamId: string): Promise<void> {
    await this.call("cancel", { streamId });
  }

  async getStream(streamId: string): Promise<unknown> {
    return this.call("get", { streamId });
  }

  async listStreams(role: "creator" | "beneficiary"): Promise<unknown[]> {
    return this.call("list", { role });
  }
}
