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

import {
  canUseNativeStorage,
  createEmbeddedStorageClient,
  EmbeddedStorageBridgeError,
  EMBEDDED_STORAGE_PROTOCOL_VERSION,
  EMBEDDED_STORAGE_REQUEST,
  EMBEDDED_STORAGE_RESPONSE,
} from "../../../shared/utils/embedded-storage-client";

// Re-export the protocol constants for the album/host parity tests and any
// first-party adapter that needs to document the wire contract.
export const STORAGE_REQUEST = EMBEDDED_STORAGE_REQUEST;
export const STORAGE_RESPONSE = EMBEDDED_STORAGE_RESPONSE;
export const STORAGE_PROTOCOL_VERSION = EMBEDDED_STORAGE_PROTOCOL_VERSION;
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

function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function bridgeError(error: unknown): Error {
  if (error instanceof EmbeddedStorageBridgeError && error.code === "quota-exceeded") {
    // The composable's isQuotaError() keys off this DOMException name, so a
    // host-side quota failure surfaces as the "storage full" product state.
    const error = new Error("album storage quota exceeded on the host device");
    error.name = "QuotaExceededError";
    return error;
  }
  return error instanceof Error ? error : new Error("album storage bridge request failed");
}

/** Every album operation round-trips to the host's localStorage. */
export function createBridgedAlbumStore(): AlbumStore {
  const wireKey = (key: string): string => `${ALBUM_KEY_PREFIX}${key}`;
  const bridge = createEmbeddedStorageClient({
    appId: ALBUM_APP_ID,
    keyPrefix: ALBUM_KEY_PREFIX,
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
  const readRaw = async (key: string): Promise<string | null> => {
    try {
      return await bridge.get(wireKey(key));
    } catch (error) {
      throw bridgeError(error);
    }
  };
  return {
    async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
      return parseJson<T | null>(await readRaw(key), fallback);
    },
    async set(key: string, value: unknown): Promise<void> {
      try {
        await bridge.set(wireKey(key), JSON.stringify(value));
      } catch (error) {
        throw bridgeError(error);
      }
    },
    async delete(key: string): Promise<void> {
      try {
        await bridge.remove(wireKey(key));
      } catch (error) {
        throw bridgeError(error);
      }
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

/**
 * Pick the storage lane for the current runtime: the framework's direct
 * localStorage path whenever it works (standalone, pop-out, tests), the host
 * bridge only when running embedded with Web Storage blocked by the sandbox.
 */
export function resolveAlbumStore(local: AlbumLocalStorageLike): AlbumStore {
  if (
    typeof window !== "undefined"
    && window.parent !== window
    && !canUseNativeStorage(`${ALBUM_KEY_PREFIX}__bridge-probe__`)
  ) {
    return createBridgedAlbumStore();
  }
  return createDirectAlbumStore(local);
}
