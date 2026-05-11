import { OSServiceProxy } from "./OSServiceProxy";

export class StorageProxy extends OSServiceProxy {
  protected readonly servicePrefix = "os-storage";

  async get(key: string): Promise<unknown> {
    return this.call("get", { key });
  }

  async set(key: string, value: unknown): Promise<unknown> {
    return this.call("set", { key, value });
  }

  async delete(key: string): Promise<unknown> {
    return this.call("delete", { key });
  }

  async list(prefix: string, limit = 100): Promise<Record<string, unknown>> {
    return this.call("list", { prefix, limit });
  }

  async grantReadAccess(
    readerAppId: string,
    keyPrefix: string,
  ): Promise<unknown> {
    return this.call("grant-access", { readerAppId, keyPrefix });
  }

  async readShared(ownerAppId: string, key: string): Promise<unknown> {
    return this.call("read-shared", { ownerAppId, key });
  }
}
