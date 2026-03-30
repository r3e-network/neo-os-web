import { EdgeClient } from "./EdgeClient";

/**
 * Base class for all OS service proxies.
 * Each proxy maps method calls to edge function endpoints.
 */
export abstract class OSServiceProxy {
  protected readonly appId: string;
  protected readonly edge: EdgeClient;
  protected abstract readonly servicePrefix: string;

  constructor(appId: string, edge: EdgeClient) {
    this.appId = appId;
    this.edge = edge;
  }

  protected call<T = unknown>(
    method: string,
    params: Record<string, unknown> | object = {},
  ): Promise<T> {
    return this.edge.call<T>(
      `${this.servicePrefix}-${method}`,
      params as Record<string, unknown>,
    );
  }
}
