import { describe, expect, it, vi } from "vitest";

import { useMilestoneEscrow } from "./useMilestoneEscrow";
import { createObservable } from "@shared/react/context";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService } from "@shared/services/ChainService";

const t = (key: string) => key;

/**
 * Mock ChainService exposing a settable contractAddress + address observable so
 * the contractReady derivation can be exercised independently of the wallet.
 */
function makeChain(contractAddress: string | null) {
  return {
    contractAddress: createObservable<string | null>(contractAddress),
    address: createObservable<string>(""),
    read: vi.fn(async () => null),
    readArray: vi.fn(async () => []),
    invoke: vi.fn(async () => ({ txid: "0xtx", success: true })),
    ensureWallet: vi.fn(async () => ""),
  } as unknown as ChainService;
}

/**
 * Build the composable from a mock chain, wrapping it in the MiniApp framework
 * (ctx.framework) the composable now takes; the raw chain is still passed for
 * the array reads the framework has no helper for. contractReady derives from
 * the chain's contractAddress either way, so the assertions are unchanged.
 */
function makeEscrow(chain: ChainService) {
  const app = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-milestone-escrow" },
  );
  return useMilestoneEscrow({ app, chain, t });
}

describe("milestone-escrow — contractReady reflects contract config, not the wallet", () => {
  it("is TRUE when the contract is configured even with no wallet connected", () => {
    const chain = makeChain("0x442162de5c8d3a9e8f0d5b1f8b6c3e2a1d4f6e7a");
    const escrow = makeEscrow(chain);
    // No address set — but the contract IS configured, so the disconnected user
    // gets the Connect-wallet branch, not the "deployment pending" notice.
    expect(escrow.contractReady.get()).toBe(true);
  });

  it("is FALSE when no contract is configured for the network", () => {
    const chain = makeChain(null);
    const escrow = makeEscrow(chain);
    expect(escrow.contractReady.get()).toBe(false);
  });

  it("does not flip to false merely because the wallet is disconnected", () => {
    const chain = makeChain("0x442162de5c8d3a9e8f0d5b1f8b6c3e2a1d4f6e7a");
    const escrow = makeEscrow(chain);
    // Connect then disconnect a wallet; contractReady stays true throughout.
    escrow.setAddress?.("NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs");
    expect(escrow.contractReady.get()).toBe(true);
    escrow.setAddress?.("");
    expect(escrow.contractReady.get()).toBe(true);
  });
});
