import { OSServiceProxy } from "./OSServiceProxy";

export class ScriptProxy extends OSServiceProxy {
  protected readonly servicePrefix = "os-script";

  async register(hookPoint: string, scriptHash: string): Promise<void> {
    await this.call("register", { hookPoint, scriptHash });
  }

  async unregister(hookPoint: string): Promise<void> {
    await this.call("unregister", { hookPoint });
  }

  async listHooks(): Promise<string[]> {
    return this.call("list", {});
  }

  async getExecutionCount(hookPoint: string): Promise<number> {
    return this.call("count", { hookPoint });
  }
}
