import { OSServiceProxy } from "./OSServiceProxy";

export interface StreamParams {
  beneficiary: string;
  totalAmount: string;
  rateAmount: string;
  intervalSeconds: number;
  title?: string;
  notes?: string;
}

export class VestingProxy extends OSServiceProxy {
  protected readonly servicePrefix = "os-vesting";

  async createStream(params: StreamParams): Promise<string> {
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
