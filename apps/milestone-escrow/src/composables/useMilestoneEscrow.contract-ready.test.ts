import { describe, expect, it, vi } from "vitest";

import { useMilestoneEscrow } from "./useMilestoneEscrow";
import { createObservable } from "@shared/react/context";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService } from "@shared/services/ChainService";

const t = (key: string) => key;
const SHARED_ESCROW_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CREATOR = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

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
 * Build the composable from a mock chain wrapped in the MiniApp framework
 * (ctx.framework) — the composable's only service surface. contractReady is
 * the framework's app.chain.contractReady observable, which derives from the
 * injected chain's contractAddress, so the assertions are unchanged.
 */
function makeEscrow(chain: ChainService) {
  const app = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-milestone-escrow" },
  );
  return useMilestoneEscrow({ app, t });
}

function makeSharedEscrow() {
  const chain = makeChain(null);
  chain.read = vi.fn(async (operation: string) => {
    if (operation === "getPlatformStats") {
      return { totalEscrows: "1", maxMilestones: "12", approvalGraceMs: "2592000000" };
    }
    if (operation === "getEscrowDetails") {
      return {
        creator: CREATOR,
        beneficiary: CREATOR,
        asset: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
        totalAmount: "10000000",
        releasedAmount: "0",
        milestoneCount: "1",
        createdTime: "1000",
        status: "active",
        title: "Shared escrow",
        notes: "",
        milestoneAmounts: ["10000000"],
        milestoneApproved: [false],
        milestoneClaimed: [false],
      };
    }
    return [];
  }) as ChainService["read"];
  const app = createMiniAppFramework(
    { services: { chain }, t } as never,
    {
      appId: "miniapp-milestone-escrow",
      platformEscrow: { escrowHash: SHARED_ESCROW_HASH },
    },
  );
  const escrow = useMilestoneEscrow({ app, t });
  escrow.setAddress?.(CREATOR);
  return { escrow, chain };
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

describe("milestone-escrow — shared platform escrow compatibility", () => {
  it("uses the shared appId-first ABI when the host injects the engine", async () => {
    const { escrow, chain } = makeSharedEscrow();

    await escrow.approveMilestone({ id: "7" } as never, 0);

    expect(chain.invoke).toHaveBeenCalledWith(
      "approveMilestone",
      expect.arrayContaining([
        expect.objectContaining({ type: "String", value: "miniapp-milestone-escrow" }),
        expect.objectContaining({ type: "Integer", value: "7" }),
        expect.objectContaining({ type: "Integer", value: "1" }),
      ]),
      expect.objectContaining({ scriptHash: SHARED_ESCROW_HASH }),
    );
    const invocation = vi.mocked(chain.invoke).mock.calls.at(-1);
    expect(invocation?.[1]?.[0]).toMatchObject({
      type: "String",
      value: "miniapp-milestone-escrow",
    });
  });
});
