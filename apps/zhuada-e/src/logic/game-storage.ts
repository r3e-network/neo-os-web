/**
 * Synchronous game storage with a sandbox-safe host bridge.
 *
 * The platform intentionally runs same-origin MiniApps in an opaque-origin
 * iframe (no `allow-same-origin`), where direct Web Storage throws. The host
 * bridge hydrates an in-memory mirror before the game boots; later writes are
 * mirrored back with validated postMessage requests. Standalone entry points
 * continue to use native localStorage directly.
 */

export type GameStorageStatus = "initializing" | "direct" | "bridged" | "blocked";

const REQUEST_TYPE = "neo-miniapp-storage:request";
const RESPONSE_TYPE = "neo-miniapp-storage:response";
const APP_ID = "miniapp-zhuada-e";
const REQUEST_TIMEOUT_MS = 2_000;
const TEST_KEY = "zhuada-e:storage-probe";

interface StorageResponse {
  type?: unknown;
  requestId?: unknown;
  ok?: unknown;
  values?: unknown;
}

let status: GameStorageStatus = "initializing";
let directStorage: Storage | null = null;
let initialization: Promise<GameStorageStatus> | null = null;
const memory = new Map<string, string>();

function nativeStorage(): Storage | null {
  try {
    const candidate = globalThis.localStorage;
    if (!candidate) return null;
    candidate.setItem(TEST_KEY, "1");
    candidate.removeItem(TEST_KEY);
    return candidate;
  } catch {
    return null;
  }
}

function send(op: "set" | "remove", key: string, value?: string): void {
  if (status !== "bridged" || typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage({
    type: REQUEST_TYPE,
    version: 1,
    requestId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    appId: APP_ID,
    op,
    key,
    ...(value === undefined ? {} : { value }),
  }, "*");
}

export const gameStorage = {
  getItem(key: string): string | null {
    if (directStorage) return directStorage.getItem(key);
    if (status === "initializing") {
      const available = nativeStorage();
      if (available) {
        directStorage = available;
        status = "direct";
        return available.getItem(key);
      }
    }
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    const normalized = String(value);
    if (directStorage) {
      directStorage.setItem(key, normalized);
      return;
    }
    if (status === "initializing") {
      const available = nativeStorage();
      if (available) {
        directStorage = available;
        status = "direct";
        available.setItem(key, normalized);
        return;
      }
    }
    memory.set(key, normalized);
    send("set", key, normalized);
  },
  removeItem(key: string): void {
    if (directStorage) {
      directStorage.removeItem(key);
      return;
    }
    memory.delete(key);
    send("remove", key);
  },
};

export function gameStorageStatus(): GameStorageStatus {
  return status;
}

export function initializeGameStorage(): Promise<GameStorageStatus> {
  if (initialization) return initialization;
  initialization = new Promise((resolve) => {
    const available = nativeStorage();
    if (available) {
      directStorage = available;
      status = "direct";
      resolve(status);
      return;
    }
    if (typeof window === "undefined" || window.parent === window) {
      status = "blocked";
      resolve(status);
      return;
    }

    const requestId = `hydrate-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    let settled = false;
    const finish = (next: GameStorageStatus): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      status = next;
      resolve(status);
    };
    const onMessage = (event: MessageEvent): void => {
      if (event.source !== window.parent) return;
      const data = event.data as StorageResponse | null;
      if (!data || data.type !== RESPONSE_TYPE || data.requestId !== requestId) return;
      if (data.ok !== true || !data.values || typeof data.values !== "object" || Array.isArray(data.values)) {
        finish("blocked");
        return;
      }
      for (const [key, value] of Object.entries(data.values as Record<string, unknown>)) {
        if (key.startsWith("zhuada-e:") && typeof value === "string") memory.set(key, value);
      }
      finish("bridged");
    };
    const timeout = window.setTimeout(() => finish("blocked"), REQUEST_TIMEOUT_MS);
    window.addEventListener("message", onMessage);
    window.parent.postMessage({
      type: REQUEST_TYPE,
      version: 1,
      requestId,
      appId: APP_ID,
      op: "getAll",
    }, "*");
  });
  return initialization;
}
