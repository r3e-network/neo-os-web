import { OSServiceProxy } from "./OSServiceProxy";

export class EscrowProxy extends OSServiceProxy {
  protected readonly servicePrefix = "os-escrow";

  async create(params: Record<string, unknown>): Promise<string> {
    return this.call("create", params);
  }

  async fund(escrowId: string): Promise<void> {
    await this.call("fund", { escrowId });
  }

  async completeMilestone(escrowId: string, index: number): Promise<void> {
    await this.call("complete", { escrowId, milestoneIndex: index });
  }

  async refund(escrowId: string): Promise<void> {
    await this.call("refund", { escrowId });
  }

  async get(escrowId: string): Promise<unknown> {
    return this.call("get", { escrowId });
  }
}
