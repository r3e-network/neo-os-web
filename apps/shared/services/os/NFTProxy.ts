import { OSServiceProxy } from "./OSServiceProxy";

export class NFTProxy extends OSServiceProxy {
  protected readonly servicePrefix = "os-nft";

  async mint(metadata: Record<string, unknown>): Promise<string> {
    return this.call("mint", { metadata });
  }

  async transfer(tokenId: string, to: string): Promise<void> {
    await this.call("transfer", { tokenId, to });
  }

  async burn(tokenId: string): Promise<void> {
    await this.call("burn", { tokenId });
  }

  async list(owner?: string, limit = 50): Promise<unknown[]> {
    return this.call("list", { owner, limit });
  }

  async validate(tokenId: string): Promise<void> {
    await this.call("validate", { tokenId });
  }
}
