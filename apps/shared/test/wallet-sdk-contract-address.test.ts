import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetWalletForTests,
  invalidateManifestCache,
  useWallet,
} from "../utils/wallet-sdk";
import { getMiniAppContractHash } from "../constants/rpc";

/**
 * getContractAddress resolution order (matches the events lane):
 *   0. ContractBinding mode "shared" (Platform Contract Library v2): the
 *      network's PLATFORM_SHARED_CONTRACTS row keyed by the binding's
 *      moduleId — an explicit shared binding beats every legacy lane, and an
 *      unknown/undeployed moduleId is a hard "not configured" error (never a
 *      silent per-app fallback; the shared engine's appId-first ABI is
 *      incompatible with the per-app clone ABI)
 *   1. typed custom contract hash
 *   2. manifest contracts entry (neo-n3-<network> / <network>)
 *   3. generated MINIAPP_CONTRACTS registry keyed by the manifest's app id
 *   4. caller-supplied app id registry fallback
 *   5. URL ?app_id registry fallback
 *   6. MiniAppError("Contract address not configured")
 */
describe("wallet-sdk getContractAddress resolution", () => {
  // A real registry-backed app id used purely as the registry-fallback
  // exemplar (the manifest fetch below is stubbed, so any id with a mainnet
  // registry entry preserves the guard). This was miniapp-gas-lucky-pool
  // until commit 0dd7c4af1 intentionally emptied its manifest contracts for
  // the guest-mode pivot, which removed it from the generated registry.
  const APP_ID = "miniapp-redenvelope";
  const REGISTRY_HASH = getMiniAppContractHash(APP_ID, "mainnet");

  function stubManifestFetch(manifest: unknown, ok = true) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok,
        text: async () => JSON.stringify(manifest),
      })),
    );
  }

  beforeEach(() => {
    __resetWalletForTests();
    invalidateManifestCache();
    // A static miniapp runtime path (slug form) so the manifest is loaded.
    window.history.replaceState({}, "", "/miniapps/red-envelope/index.html");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    invalidateManifestCache();
    window.history.replaceState({}, "", "/");
  });

  it("resolves via the registry keyed by manifest.id when the manifest has no contracts entry", async () => {
    expect(REGISTRY_HASH).toMatch(/^0x[0-9a-f]{40}$/);
    stubManifestFetch({ id: APP_ID, contracts: {} });

    const wallet = useWallet();
    await expect(wallet.getContractAddress()).resolves.toBe(REGISTRY_HASH);
  });

  it("prefers the manifest-configured contract over the registry", async () => {
    const configured = "0x1111111111111111111111111111111111111111";
    stubManifestFetch({
      id: APP_ID,
      contracts: { "neo-n3-mainnet": configured },
    });

    const wallet = useWallet();
    await expect(wallet.getContractAddress()).resolves.toBe(configured);
  });

  it("falls back to the URL ?app_id registry lookup when no manifest resolves", async () => {
    stubManifestFetch({}, false); // manifest fetch fails -> null manifest
    window.history.replaceState(
      {},
      "",
      `/miniapps/red-envelope/index.html?app_id=${APP_ID}`,
    );

    const wallet = useWallet();
    await expect(wallet.getContractAddress()).resolves.toBe(REGISTRY_HASH);
  });

  it("falls back to the caller app id when no manifest or URL id resolves", async () => {
    stubManifestFetch({}, false);

    const wallet = useWallet();
    await expect(wallet.getContractAddress(APP_ID)).resolves.toBe(REGISTRY_HASH);
  });

  it("throws the configured error when nothing resolves", async () => {
    stubManifestFetch({ id: "miniapp-not-registered", contracts: {} });

    const wallet = useWallet();
    await expect(wallet.getContractAddress()).rejects.toThrow(
      "Contract address not configured",
    );
  });
});

describe('wallet-sdk getContractAddress — ContractBinding mode "shared"', () => {
  // The platform engine's testnet deployment (Platform Contract Library v2,
  // deploy/config/platform-registry-testnet-2026-07-17.json).
  const PLATFORM_GAME_TESTNET = "0xc75b181b4561462903bb27d8d9e0b32b637bec12";
  const APP_ID = "miniapp-redenvelope";

  function stubManifestFetch(manifest: unknown, ok = true) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok,
        text: async () => JSON.stringify(manifest),
      })),
    );
  }

  beforeEach(() => {
    __resetWalletForTests();
    invalidateManifestCache();
    window.history.replaceState({}, "", "/miniapps/red-envelope/index.html?network=testnet");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    invalidateManifestCache();
    window.history.replaceState({}, "", "/");
  });

  it("resolves the shared engine hash from the injected network config", async () => {
    stubManifestFetch({
      id: APP_ID,
      contract: { mode: "shared", moduleId: "platform-game" },
    });

    const wallet = useWallet();
    await expect(wallet.getContractAddress()).resolves.toBe(PLATFORM_GAME_TESTNET);
  });

  it("prefers the explicit shared binding over a legacy contracts entry", async () => {
    stubManifestFetch({
      id: APP_ID,
      contract: { mode: "shared", moduleId: "platform-game" },
      contracts: { "neo-n3-testnet": "0x1111111111111111111111111111111111111111" },
    });

    const wallet = useWallet();
    await expect(wallet.getContractAddress()).resolves.toBe(PLATFORM_GAME_TESTNET);
  });

  it("throws for a shared module not deployed on the current network (no per-app fallback)", async () => {
    // No ?network= param → mainnet, where platform-game is not deployed yet.
    window.history.replaceState({}, "", "/miniapps/red-envelope/index.html");
    stubManifestFetch({
      id: APP_ID,
      contract: { mode: "shared", moduleId: "platform-game" },
    });

    const wallet = useWallet();
    await expect(wallet.getContractAddress()).rejects.toThrow(
      'Shared platform contract "platform-game" not configured for mainnet',
    );
  });

  it("throws for an unknown shared moduleId", async () => {
    stubManifestFetch({
      id: APP_ID,
      contract: { mode: "shared", moduleId: "platform-unknown" },
    });

    const wallet = useWallet();
    await expect(wallet.getContractAddress()).rejects.toThrow(
      'Shared platform contract "platform-unknown" not configured for testnet',
    );
  });

  it("keeps the legacy lanes byte-identical for non-shared binding modes", async () => {
    const configured = "0x1111111111111111111111111111111111111111";
    stubManifestFetch({
      id: APP_ID,
      contract: { mode: "custom", hash: configured },
      contracts: { "neo-n3-testnet": configured },
    });

    const wallet = useWallet();
    await expect(wallet.getContractAddress()).resolves.toBe(configured);
  });

  it("resolves a typed primary hash without treating platform bindings as primary", async () => {
    const primary = "0x2222222222222222222222222222222222222222";
    stubManifestFetch({
      id: APP_ID,
      contract: { mode: "custom", hash: primary },
      platformBindings: { game: PLATFORM_GAME_TESTNET },
      contracts: { "neo-n3-testnet": "0x3333333333333333333333333333333333333333" },
    });

    const wallet = useWallet();
    await expect(wallet.getContractAddress()).resolves.toBe(primary);
  });
});
