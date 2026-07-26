export const EMBEDDED_STORAGE_REQUEST = "neo-miniapp-storage:request";
export const EMBEDDED_STORAGE_RESPONSE = "neo-miniapp-storage:response";
export const EMBEDDED_STORAGE_PROTOCOL_VERSION = 1;

export type EmbeddedStorageOperation = "get" | "getAll" | "set" | "remove";

export class EmbeddedStorageBridgeError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(
      code === "timed-out"
        ? "embedded storage bridge timed out"
        : `embedded storage bridge request failed: ${code}`,
    );
    this.name = "EmbeddedStorageBridgeError";
    this.code = code;
  }
}

interface EmbeddedStorageResponse {
  type?: unknown;
  version?: unknown;
  requestId?: unknown;
  ok?: unknown;
  value?: unknown;
  values?: unknown;
  error?: unknown;
}

export interface EmbeddedStorageClient {
  get(key: string): Promise<string | null>;
  getAll(): Promise<Record<string, string>>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface EmbeddedStorageClientOptions {
  appId: string;
  keyPrefix: string;
  timeoutMs?: number;
}

export function canUseNativeStorage(probeKey: string): boolean {
  try {
    const storage = window.localStorage;
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

function assertKey(key: string, keyPrefix: string): void {
  if (!key.startsWith(keyPrefix)) {
    throw new EmbeddedStorageBridgeError("invalid-key");
  }
}

function makeRequestId(operation: EmbeddedStorageOperation): string {
  return `${operation}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function responseError(response: EmbeddedStorageResponse): EmbeddedStorageBridgeError {
  return new EmbeddedStorageBridgeError(
    typeof response.error === "string" ? response.error : "request-failed",
  );
}

function ensureValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EmbeddedStorageBridgeError("invalid-response");
  }
  const values: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") values[key] = entry;
  }
  return values;
}

export function createEmbeddedStorageClient(
  options: EmbeddedStorageClientOptions,
): EmbeddedStorageClient {
  const timeoutMs = options.timeoutMs ?? 4_000;

  function request(
    operation: EmbeddedStorageOperation,
    key?: string,
    value?: string,
  ): Promise<EmbeddedStorageResponse> {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new EmbeddedStorageBridgeError("browser-unavailable"));
        return;
      }

      const parent = window.parent;
      const requestId = makeRequestId(operation);
      const cleanup = (): void => {
        window.clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
      };
      const onMessage = (event: MessageEvent): void => {
        if (event.source !== parent) return;
        const response = event.data as EmbeddedStorageResponse | null;
        if (
          !response
          || response.type !== EMBEDDED_STORAGE_RESPONSE
          || response.version !== EMBEDDED_STORAGE_PROTOCOL_VERSION
          || response.requestId !== requestId
        ) return;
        cleanup();
        resolve(response);
      };
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new EmbeddedStorageBridgeError("timed-out"));
      }, timeoutMs);

      window.addEventListener("message", onMessage);
      try {
        parent.postMessage({
          type: EMBEDDED_STORAGE_REQUEST,
          version: EMBEDDED_STORAGE_PROTOCOL_VERSION,
          requestId,
          appId: options.appId,
          op: operation,
          ...(key === undefined ? {} : { key }),
          ...(value === undefined ? {} : { value }),
        }, "*");
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  async function checkedRequest(
    operation: EmbeddedStorageOperation,
    key?: string,
    value?: string,
  ): Promise<EmbeddedStorageResponse> {
    const response = await request(operation, key, value);
    if (response.ok !== true) throw responseError(response);
    return response;
  }

  return {
    async get(key: string): Promise<string | null> {
      assertKey(key, options.keyPrefix);
      const response = await checkedRequest("get", key);
      return typeof response.value === "string" ? response.value : null;
    },
    async getAll(): Promise<Record<string, string>> {
      const response = await checkedRequest("getAll");
      return ensureValues(response.values);
    },
    async set(key: string, value: string): Promise<void> {
      assertKey(key, options.keyPrefix);
      await checkedRequest("set", key, value);
    },
    async remove(key: string): Promise<void> {
      assertKey(key, options.keyPrefix);
      await checkedRequest("remove", key);
    },
  };
}
