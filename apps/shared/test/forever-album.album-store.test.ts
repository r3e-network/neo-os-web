/**
 * Forever Album storage lanes (audit fix C-4 follow-up).
 *
 * Audit fix C-4 (commit a8101a750) removed the allow-same-origin sandbox
 * grant, so the embedded album iframe can no longer touch Web Storage
 * directly. These tests pin the successor storage capability: the bridged
 * AlbumStore speaks the host storage-bridge protocol with acknowledged
 * writes (photos must never be silently dropped), quota failures surface as
 * the product's "storage full" state, and the direct lane stays
 * byte-identical to the legacy "forever-album:" namespace.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createBridgedAlbumStore,
  createDirectAlbumStore,
  resolveAlbumStore,
} from "../../forever-album/src/utils/album-store";
import { useForeverAlbum } from "../../forever-album/src/composables/useForeverAlbum";
import { createMiniAppFramework } from "../react";
import { createObservable } from "../react/context";

const REQUEST_TYPE = "neo-miniapp-storage:request";
const RESPONSE_TYPE = "neo-miniapp-storage:response";
const WALLET = "NgaiKFjurmNmiRzDRQGs44yzByXuSkdGPF";
const DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

interface WireRequest {
  type?: unknown;
  version?: unknown;
  requestId?: unknown;
  appId?: unknown;
  op?: unknown;
  key?: unknown;
  value?: unknown;
}

type HostOverride = (request: WireRequest) => Record<string, unknown> | null;

/**
 * In-memory stand-in for the host side of the storage bridge
 * (useEmbeddedStorageBridge): same wire protocol, backed by a Map. In jsdom
 * window.parent === window, so the store's parent.postMessage lands here and
 * replies are dispatched with the window itself as the source.
 */
function installHostSimulator(
  backing: Map<string, string>,
  override: HostOverride = () => null,
) {
  const seen: WireRequest[] = [];
  const onMessage = (event: MessageEvent): void => {
    const request = event.data as WireRequest | null;
    if (!request || request.type !== REQUEST_TYPE) return;
    seen.push(request);
    const reply = (payload: Record<string, unknown>): void => {
      window.dispatchEvent(new MessageEvent("message", {
        data: {
          type: RESPONSE_TYPE,
          version: 1,
          requestId: request.requestId,
          ...payload,
        },
        source: window as unknown as MessageEventSource,
      }));
    };
    const overridden = override(request);
    if (overridden) {
      reply(overridden);
      return;
    }
    const key = String(request.key);
    if (request.op === "get") {
      reply({ ok: true, value: backing.get(key) ?? null });
      return;
    }
    if (request.op === "set") {
      backing.set(key, String(request.value));
      reply({ ok: true });
      return;
    }
    if (request.op === "remove") {
      backing.delete(key);
      reply({ ok: true });
      return;
    }
    reply({ ok: false, error: "invalid-operation" });
  };
  window.addEventListener("message", onMessage);
  return {
    seen,
    uninstall: () => window.removeEventListener("message", onMessage),
  };
}

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    storageUnavailable: "Local storage unavailable.",
    storageFull: "Local storage full.",
    storageWriteNotConfirmed: "Local write was not confirmed.",
    albumDataDamaged: "Album data is damaged.",
    albumPartiallyRecovered: "Recovered album with {count} damaged item(s).",
    uploadSuccess: "Saved to this device!",
    uploadFailed: "Save failed.",
    connectPromptTitle: "Connect wallet to view your album",
  };
  let value = messages[key] ?? key;
  if (params) {
    for (const [name, replacement] of Object.entries(params)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
  }
  return value;
}

function makeBridgedAlbum(walletAddress: string | null = WALLET) {
  const address = createObservable<string | null>(walletAddress);
  const ensureWallet = vi.fn(async () => walletAddress ?? "");
  const app = createMiniAppFramework(
    { services: { chain: { address, ensureWallet } }, t } as never,
    { appId: "miniapp-forever-album", storagePrefix: "forever-album:" },
  );
  const album = useForeverAlbum({ app, t, store: createBridgedAlbumStore() });
  return { album, app };
}

let uninstallers: Array<() => void> = [];

beforeEach(() => {
  try {
    globalThis.localStorage?.clear();
  } catch {
    /* storage stub may be absent — ignore */
  }
});

afterEach(() => {
  for (const uninstall of uninstallers) uninstall();
  uninstallers = [];
  vi.useRealTimers();
});

describe("createBridgedAlbumStore — host bridge protocol", () => {
  it("speaks the storage-bridge wire format with the album's own namespace", async () => {
    const backing = new Map<string, string>();
    const sim = installHostSimulator(backing);
    uninstallers.push(sim.uninstall);
    const store = createBridgedAlbumStore();

    await store.set("photos:addr", { version: 2, photos: [] });
    expect(backing.get("forever-album:photos:addr")).toBe(
      JSON.stringify({ version: 2, photos: [] }),
    );
    expect(await store.get("photos:addr")).toEqual({ version: 2, photos: [] });

    const [first] = sim.seen;
    expect(first).toMatchObject({
      type: REQUEST_TYPE,
      version: 1,
      appId: "miniapp-forever-album",
      op: "set",
      key: "forever-album:photos:addr",
    });
    expect(String(first.requestId)).toMatch(/^[a-z0-9-]{8,96}$/i);

    await store.delete("photos:addr");
    expect(backing.has("forever-album:photos:addr")).toBe(false);
  });

  it("lists an exact key with framework semantics: absent -> {}, corrupt -> null value", async () => {
    const backing = new Map<string, string>();
    backing.set("forever-album:photos:bad", "{not-json");
    const sim = installHostSimulator(backing);
    uninstallers.push(sim.uninstall);
    const store = createBridgedAlbumStore();

    expect(await store.list("photos:missing")).toEqual({});
    // Present-but-corrupt must surface as a null value under the key (the
    // composable turns that into the damaged-album state), never as absent.
    expect(await store.list("photos:bad")).toEqual({ "photos:bad": null });
  });

  it("maps a host quota rejection to QuotaExceededError so the album shows storage-full", async () => {
    const sim = installHostSimulator(new Map(), (request) =>
      request.op === "set" ? { ok: false, error: "quota-exceeded" } : null);
    uninstallers.push(sim.uninstall);
    const store = createBridgedAlbumStore();

    await expect(store.set("photos:addr", { version: 2, photos: [] }))
      .rejects.toMatchObject({ name: "QuotaExceededError" });
  });

  it("rejects (never silently succeeds) on a host failure reply", async () => {
    const sim = installHostSimulator(new Map(), () => ({ ok: false, error: "storage-unavailable" }));
    uninstallers.push(sim.uninstall);
    const store = createBridgedAlbumStore();

    await expect(store.set("photos:addr", {})).rejects.toThrow("bridge request failed");
    await expect(store.get("photos:addr")).rejects.toThrow("bridge request failed");
    await expect(store.delete("photos:addr")).rejects.toThrow("bridge request failed");
  });

  it("fails closed with a timeout when no host bridge answers", async () => {
    vi.useFakeTimers();
    const store = createBridgedAlbumStore();
    const outcome = expect(store.get("photos:addr")).rejects.toThrow("timed out");
    vi.advanceTimersByTime(4_001);
    await outcome;
  });

  it("ignores responses for other request ids", async () => {
    const sim = installHostSimulator(new Map(), (request) => {
      // Reply once with a foreign requestId, then with the real one.
      window.dispatchEvent(new MessageEvent("message", {
        data: {
          type: RESPONSE_TYPE,
          version: 1,
          requestId: "someone-elses-request",
          ok: true,
          value: JSON.stringify("wrong"),
        },
        source: window as unknown as MessageEventSource,
      }));
      return request.op === "get" ? { ok: true, value: JSON.stringify("right") } : null;
    });
    uninstallers.push(sim.uninstall);
    const store = createBridgedAlbumStore();

    expect(await store.get("photos:addr")).toBe("right");
  });
});

describe("resolveAlbumStore — lane selection", () => {
  it("uses the direct framework lane when native storage works (standalone, pop-out, tests)", async () => {
    const local = {
      get: vi.fn(() => "value" as never),
      set: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(() => ({ k: 1 })),
    };
    // jsdom: window.parent === window and localStorage is writable.
    const store = resolveAlbumStore(local);
    expect(await store.get("k")).toBe("value");
    await store.set("k", 1);
    await store.delete("k");
    expect(await store.list("k")).toEqual({ k: 1 });
    expect(local.get).toHaveBeenCalledWith("k", null);
    expect(local.set).toHaveBeenCalledWith("k", 1);
    expect(local.delete).toHaveBeenCalledWith("k");
    expect(local.list).toHaveBeenCalledWith("k");
  });

  it("direct lane surfaces synchronous storage throws as rejections", async () => {
    const boom = new Error("QuotaExceededError: full");
    const local = {
      get: vi.fn(() => null),
      set: vi.fn(() => {
        throw boom;
      }),
      delete: vi.fn(),
      list: vi.fn(() => ({})),
    };
    await expect(createDirectAlbumStore(local).set("k", 1)).rejects.toBe(boom);
  });
});

describe("useForeverAlbum on the bridged store (embedded sandbox parity)", () => {
  it("saves and reloads a wallet album entirely over the bridge, byte-identical keys", async () => {
    const backing = new Map<string, string>();
    const sim = installHostSimulator(backing);
    uninstallers.push(sim.uninstall);

    const first = makeBridgedAlbum();
    first.album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);
    await first.album.uploadPhotos();

    // The host stores the exact legacy first-party key — the same key the
    // pop-out window and pre-C-4 embeds use — so nothing is orphaned.
    expect(backing.get(`forever-album:photos:${WALLET}`)).toBeTruthy();

    const second = makeBridgedAlbum();
    await second.album.loadPhotos();
    expect(second.album.photos.get()).toHaveLength(1);
    expect(second.album.photos.get()[0].data).toBe(DATA_URL);
  });

  it("surfaces a host quota failure as the storage-full product state, not a fake save", async () => {
    const backing = new Map<string, string>();
    const sim = installHostSimulator(backing, (request) =>
      request.op === "set" && String(request.key).includes("photos:")
        ? { ok: false, error: "quota-exceeded" }
        : null);
    uninstallers.push(sim.uninstall);

    const { album } = makeBridgedAlbum();
    album.selectedImages.set([
      { id: "s1", dataUrl: DATA_URL, size: 10, payloadBytes: DATA_URL.length },
    ]);

    await expect(album.uploadPhotos()).rejects.toThrow("Local storage full.");
    expect(album.storageIssue.get()).toBe("quota");
    expect(backing.has(`forever-album:photos:${WALLET}`)).toBe(false);
  });

  it("does not turn an unanswered bridge into a fake empty album", async () => {
    vi.useFakeTimers();
    const { album } = makeBridgedAlbum();
    const outcome = expect(album.loadPhotos()).rejects.toThrow("Local storage unavailable.");
    await vi.advanceTimersByTimeAsync(30_000);
    await outcome;
    expect(album.storageIssue.get()).toBe("unavailable");
  });
});
