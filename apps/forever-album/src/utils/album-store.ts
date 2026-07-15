/**
 * Album storage adapter with a sandbox-safe host bridge.
 *
 * Audit fix C-4 (commit a8101a750) restored the opaque-origin sandbox on
 * every embedded miniapp iframe, so direct Web Storage throws inside the
 * host playarea and `app.storage.local` silently degrades to a no-op there.
 * The album's photos are precious, so this module keeps the product's
 * device-local persistence working in every runtime mode:
 *
 * - Standalone / pop-out window (native localStorage works): the framework
 *   `app.storage.local` path is used unchanged, so storage keys stay
 *   byte-identical to the pre-framework "forever-album:" namespace.
 * - Embedded opaque-origin iframe: every read/write/delete round-trips over
 *   the appId-gated host<->miniapp storage bridge (postMessage), the same
 *   pattern the host already serves for the goose game and the automation
 *   copilot credential. The host stores the exact same "forever-album:"
 *   keys, so the embedded view, the pop-out view, and pre-C-4 albums all
 *   share one album per wallet — nothing is orphaned.
 *
 * Unlike the fire-and-forget goose save mirror, every bridged write here is
 * acknowledged by the host before it is reported as saved: a lost or
 * quota-rejected write must surface to the user, never silently drop photos.
 */

// Wire constants of the host storage bridge. Exported so
// apps/shared/test/embedded-bridge-protocol-parity.test.ts pins them against
// the host-side declarations (use-embedded-storage-bridge.ts) — drift on
// either side is a test failure.
export const STORAGE_REQUEST = "neo-miniapp-storage:request";
export const STORAGE_RESPONSE = "neo-miniapp-storage:response";
export const STORAGE_PROTOCOL_VERSION = 1;
export const ALBUM_APP_ID = "miniapp-forever-album";
// Matches the defineMiniApp storagePrefix — bridged keys must stay
// byte-identical to the direct-mode framework keys.
export const ALBUM_KEY_PREFIX = "forever-album:";
const REQUEST_TIMEOUT_MS = 4_000;

/**
 * Async mirror of the framework `app.storage.local` surface the album
 * composable uses. Direct mode wraps the framework storage; bridged mode
 * round-trips each operation to the host.
 */
export interface AlbumStore {
  get<T>(key: string, fallback?: T | null): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<Record<string, unknown>>;
}

/** Structural view of the framework `app.storage.local` object. */
export interface AlbumLocalStorageLike {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  list(prefix: string): Record<string, unknown>;
}

interface BridgeResponse {
  type?: unknown;
  requestId?: unknown;
  ok?: unknown;
  value?: unknown;
  error?: unknown;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function bridgeRequest(
  op: "get" | "set" | "remove",
  key: string,
  value?: string,
): Promise<BridgeResponse> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("album storage bridge unavailable outside a browser window"));
      return;
    }
    // resolveAlbumStore only selects this lane inside an embedded frame;
    // window.parent is the host window there.
    const parent = window.parent;
    const requestId = `${op}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const cleanup = (): void => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
    };
    const onMessage = (event: MessageEvent): void => {
      if (event.source !== parent) return;
      const data = event.data as BridgeResponse | null;
      if (!data || data.type !== STORAGE_RESPONSE || data.requestId !== requestId) return;
      cleanup();
      resolve(data);
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("album storage bridge timed out"));
    }, REQUEST_TIMEOUT_MS);
    window.addEventListener("message", onMessage);
    // The opaque origin cannot name the host origin in targetOrigin, so "*"
    // is used — safe because the request carries no secret and the response
    // listener validates the exact parent window reference.
    parent.postMessage({
      type: STORAGE_REQUEST,
      version: STORAGE_PROTOCOL_VERSION,
      requestId,
      appId: ALBUM_APP_ID,
      op,
      key,
      ...(value === undefined ? {} : { value }),
    }, "*");
  });
}

function bridgeError(response: BridgeResponse): Error {
  if (response.error === "quota-exceeded") {
    // The composable's isQuotaError() keys off this DOMException name, so a
    // host-side quota failure surfaces as the "storage full" product state.
    const error = new Error("album storage quota exceeded on the host device");
    error.name = "QuotaExceededError";
    return error;
  }
  return new Error("album storage bridge request failed");
}

/** Every album operation round-trips to the host's localStorage. */
export function createBridgedAlbumStore(): AlbumStore {
  const wireKey = (key: string): string => `${ALBUM_KEY_PREFIX}${key}`;
  const readRaw = async (key: string): Promise<string | null> => {
    const response = await bridgeRequest("get", wireKey(key));
    if (response.ok !== true) throw bridgeError(response);
    return typeof response.value === "string" ? response.value : null;
  };
  return {
    async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
      return parseJson<T | null>(await readRaw(key), fallback);
    },
    async set(key: string, value: unknown): Promise<void> {
      const response = await bridgeRequest("set", wireKey(key), JSON.stringify(value));
      if (response.ok !== true) throw bridgeError(response);
    },
    async delete(key: string): Promise<void> {
      const response = await bridgeRequest("remove", wireKey(key));
      if (response.ok !== true) throw bridgeError(response);
    },
    async list(prefix: string): Promise<Record<string, unknown>> {
      // The album composable only ever lists an exact key (the album envelope
      // or the availability probe; wallet-address keys are fixed-length, so no
      // album key is a proper prefix of another). The bridged lane therefore
      // resolves that single key instead of enumerating the host store, and —
      // matching the framework list semantics — a present-but-corrupt value
      // maps to `null` (the composable surfaces that as a damaged album).
      const raw = await readRaw(prefix);
      return raw === null ? {} : { [prefix]: parseJson<unknown>(raw, null) };
    },
  };
}

/** Wrap the synchronous framework storage surface into the async store shape. */
export function createDirectAlbumStore(local: AlbumLocalStorageLike): AlbumStore {
  return {
    async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
      return local.get<T>(key, fallback);
    },
    async set(key: string, value: unknown): Promise<void> {
      local.set(key, value);
    },
    async delete(key: string): Promise<void> {
      local.delete(key);
    },
    async list(prefix: string): Promise<Record<string, unknown>> {
      return local.list(prefix);
    },
  };
}

function nativeLocalStorageWritable(): boolean {
  // In a sandboxed iframe without allow-same-origin even the property getter
  // throws, so probe with a real write instead of a presence check.
  try {
    const probeKey = `${ALBUM_KEY_PREFIX}__bridge-probe__`;
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pick the storage lane for the current runtime: the framework's direct
 * localStorage path whenever it works (standalone, pop-out, tests), the host
 * bridge only when running embedded with Web Storage blocked by the sandbox.
 */
export function resolveAlbumStore(local: AlbumLocalStorageLike): AlbumStore {
  if (
    typeof window !== "undefined"
    && window.parent !== window
    && !nativeLocalStorageWritable()
  ) {
    return createBridgedAlbumStore();
  }
  return createDirectAlbumStore(local);
}
