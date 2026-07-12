import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "@framework/index";
import { createObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { useGovernance } from "./useGovernance";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ADDRESS_HASH = "0xa5de523ae9d99be784a536e9412b7a3cbe049e1a";
const TXID = `0x${"ab".repeat(32)}`;

function proposal() {
  return {
    id: 1,
    status: 1,
    statusString: "active",
    type: 0,
    title: "Production motion",
    description: "Verify the governance write path",
    creator: ADDRESS_HASH,
    yesVotes: 0,
    noVotes: 0,
    totalVotes: 0,
    quorumRequired: 6,
    quorumReached: false,
    createTime: Date.now() - 1_000,
    expiryTime: Date.now() + 86_400_000,
  };
}

function makeHarness(options: { verified?: boolean; failDetailsAfterFirst?: boolean; wrongVoteReadback?: boolean } = {}) {
  let voted = false;
  let detailReads = 0;
  const read = vi.fn(async (method: string) => {
    if (method === "getProposalCount") return 1;
    if (method === "getProposalDetails") {
      detailReads += 1;
      if (options.failDetailsAfterFirst && detailReads > 1) throw new Error("detail unavailable");
      return proposal();
    }
    if (method === "isCandidate") return true;
    if (method === "hasVoted") return voted;
    if (method === "getVote") return voted ? (options.wrongVoteReadback ? 0 : 1) : -1;
    if (method === "isPaused") return false;
    if (method === "getGovernanceConstants") {
      return {
        committeeSize: 21,
        quorumPercent: 30,
        thresholdPercent: 50,
        minDurationSeconds: 86_400,
        maxDurationSeconds: 2_592_000,
      };
    }
    if (method === "getPlatformStats") return {};
    return null;
  });
  const invoke = vi.fn(async (
    operation: string,
    _args: unknown[],
    writeOptions?: { onTransactionSent?: (txid: string) => void },
  ) => {
    writeOptions?.onTransactionSent?.(TXID);
    if (operation === "vote" && options.verified !== false) voted = true;
    return {
      txid: TXID,
      success: true,
      verified: options.verified !== false,
      event: options.verified === false
        ? undefined
        : {
            state: [
              { value: "1" },
              { value: ADDRESS_HASH },
              { value: true },
            ],
          },
    };
  });
  const chain = {
    read,
    invoke,
    address: createObservable<string>(ADDRESS),
    ensureWallet: vi.fn(async () => ADDRESS),
    detectNetwork: vi.fn(async () => "mainnet"),
    listEvents: vi.fn(async () => []),
  };
  const app = createMiniAppFramework(
    { services: { chain }, t: (key: string) => key } as never,
    { appId: "miniapp-council-governance" },
  ) as unknown as MiniAppFramework;
  return { app, invoke, read };
}

describe("useGovernance production truth", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ proposals: [] }),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires VoteCast plus authoritative hasVoted readback before resolving success", async () => {
    const { app, invoke } = makeHarness();
    const gov = useGovernance({
      app,
      t: (key) => key,
      currentChainId: createObservable("neo-n3-mainnet"),
    });
    gov.setAddress(ADDRESS);
    await gov.loadProposals();
    await gov.refreshCandidateStatus();
    await gov.refreshHasVoted();

    await expect(gov.castVote(1, "for")).resolves.toBeUndefined();

    expect(invoke).toHaveBeenCalledWith(
      "vote",
      expect.any(Array),
      expect.objectContaining({
        scriptHash: "0xc7e50e67589df63302cbea1a6b00beb649ee74d8",
        waitForEvent: "VoteCast",
        onTransactionSent: expect.any(Function),
      }),
    );
    expect(gov.pendingWrite.get()).toBeNull();
    expect(gov.hasVotedMap.get()[1]).toBe(true);
    expect(gov.hasVotedKnownMap.get()[1]).toBe(true);
  });

  it("keeps a broadcast pending and blocks success when its exact event is unavailable", async () => {
    const { app } = makeHarness({ verified: false });
    const gov = useGovernance({
      app,
      t: (key) => key,
      currentChainId: createObservable("neo-n3-mainnet"),
    });
    gov.setAddress(ADDRESS);
    await gov.loadProposals();
    await gov.refreshCandidateStatus();
    await gov.refreshHasVoted();

    await expect(gov.castVote(1, "for")).rejects.toThrow("governanceWritePending");
    expect(gov.pendingWrite.get()).toMatchObject({
      operation: "vote",
      txid: TXID,
      proposalId: 1,
      support: true,
    });
  });

  it("keeps recovery when hasVoted is true but getVote does not match the submitted choice", async () => {
    const { app } = makeHarness({ wrongVoteReadback: true });
    const gov = useGovernance({
      app,
      t: (key) => key,
      currentChainId: createObservable("neo-n3-mainnet"),
    });
    gov.setAddress(ADDRESS);
    await gov.loadProposals();
    await gov.refreshCandidateStatus();
    await gov.refreshHasVoted();

    await expect(gov.castVote(1, "for")).rejects.toThrow("voteReadbackFailed");
    expect(gov.pendingWrite.get()).toMatchObject({ operation: "vote", support: true });
  });

  it("preserves the last verified contract proposal when a later detail page is incomplete", async () => {
    const { app } = makeHarness({ failDetailsAfterFirst: true });
    const gov = useGovernance({
      app,
      t: (key) => key,
      currentChainId: createObservable("neo-n3-mainnet"),
    });

    await gov.loadProposals();
    expect(gov.proposals.get().some((item) => item.id === 1)).toBe(true);
    await gov.loadProposals();

    expect(gov.proposals.get().some((item) => item.id === 1)).toBe(true);
    expect(gov.loadError.get()).toBe("proposalSourcesPartial");
  });
});
