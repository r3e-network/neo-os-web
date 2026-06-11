import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetWalletForTests,
  invalidateManifestCache,
  useWallet,
} from "../utils/wallet-sdk";
import { getMiniAppContractHash } from "../constants/rpc";

/**
 * getContractAddress resolution order (matches the events lane):
 *   1. manifest contracts entry (neo-n3-<network> / <network>)
 *   2. generated MINIAPP_CONTRACTS registry keyed by the manifest's app id
 *   3. URL ?app_id registry fallback
 *   4. MiniAppError("Contract address not configured")
 */
describe("wallet-sdk getContractAddress resolution", () => {
  // A real registry-backed app id whose manifest historically shipped without
  // a contracts entry — the case the registry fallback exists for.
  const APP_ID = "miniapp-gas-lucky-pool";
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
    window.history.replaceState({}, "", "/miniapps/gas-lucky-pool/index.html");
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
      `/miniapps/gas-lucky-pool/index.html?app_id=${APP_ID}`,
    );

    const wallet = useWallet();
    await expect(wallet.getContractAddress()).resolves.toBe(REGISTRY_HASH);
  });

  it("throws the configured error when nothing resolves", async () => {
    stubManifestFetch({ id: "miniapp-not-registered", contracts: {} });

    const wallet = useWallet();
    await expect(wallet.getContractAddress()).rejects.toThrow(
      "Contract address not configured",
    );
  });
});
