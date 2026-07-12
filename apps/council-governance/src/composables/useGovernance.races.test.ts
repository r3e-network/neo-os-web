import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "@framework/index";
import { createObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { useGovernance } from "./useGovernance";

const MAIN_ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const SECOND_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const MAIN_CONTRACT = "0xc7e50e67589df63302cbea1a6b00beb649ee74d8";
const TEST_CONTRACT = "0x4c61e5575ae9e151027f6724d07fac127d4cc25f";

function framework(read: (...args: never[]) => Promise<unknown>): MiniAppFramework {
  const chain = {
    read,
    invoke: vi.fn(async () => ({ success: false })),
    address: createObservable<string>(MAIN_ADDRESS),
    ensureWallet: vi.fn(async () => MAIN_ADDRESS),
    listEvents: vi.fn(async () => []),
  };
  return createMiniAppFramework(
    { services: { chain }, t: (key: string) => key } as never,
    { appId: "miniapp-council-governance" },
  ) as unknown as MiniAppFramework;
}

function proposal(id: number, title: string) {
  return {
    id,
    status: 1,
    statusString: "active",
    type: 0,
    title,
    description: "Race-safe proposal",
    creator: "0xa5de523ae9d99be784a536e9412b7a3cbe049e1a",
    yesVotes: 0,
    noVotes: 0,
    totalVotes: 0,
    quorumRequired: 6,
    quorumReached: false,
    createTime: Date.now() - 1_000,
    expiryTime: Date.now() + 120_000,
  };
}

describe("useGovernance request scoping", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ proposals: [] }),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores an eligibility response from the wallet that was replaced mid-read", async () => {
    const resolvers: Array<(value: boolean) => void> = [];
    const read = vi.fn(async (method: string) => {
      if (method === "isCandidate") {
        return new Promise<boolean>((resolve) => resolvers.push(resolve));
      }
      return null;
    });
    const gov = useGovernance({
      app: framework(read as never),
      t: (key) => key,
      currentChainId: createObservable("neo-n3-mainnet"),
    });

    gov.setAddress(MAIN_ADDRESS);
    const first = gov.refreshCandidateStatus();
    await vi.waitFor(() => expect(resolvers).toHaveLength(1));
    gov.setAddress(SECOND_ADDRESS);
    const second = gov.refreshCandidateStatus();
    await vi.waitFor(() => expect(resolvers).toHaveLength(2));

    resolvers[1]!(true);
    await second;
    resolvers[0]!(false);
    await first;

    expect(gov.address.get()).toBe(SECOND_ADDRESS);
    expect(gov.candidateLoaded.get()).toBe(true);
    expect(gov.isCandidate.get()).toBe(true);
  });

  it("does not let a late mainnet proposal page overwrite a testnet switch", async () => {
    let resolveMainCount: ((value: number) => void) | undefined;
    let resolveTestCount: ((value: number) => void) | undefined;
    const read = vi.fn(async (method: string, _args?: unknown[], options?: { scriptHash?: string }) => {
      if (method === "getProposalCount") {
        if (options?.scriptHash === MAIN_CONTRACT) {
          return new Promise<number>((resolve) => { resolveMainCount = resolve; });
        }
        if (options?.scriptHash === TEST_CONTRACT) {
          return new Promise<number>((resolve) => { resolveTestCount = resolve; });
        }
      }
      if (method === "getProposalDetails") return proposal(1, "Late mainnet row");
      return null;
    });
    const gov = useGovernance({
      app: framework(read as never),
      t: (key) => key,
      currentChainId: createObservable("neo-n3-mainnet"),
    });

    const mainLoad = gov.loadProposals();
    await vi.waitFor(() => expect(resolveMainCount).toBeTypeOf("function"));
    gov.setNetwork("neo-n3-testnet");
    const testLoad = gov.loadProposals();
    await vi.waitFor(() => expect(resolveTestCount).toBeTypeOf("function"));

    resolveTestCount!(0);
    await testLoad;
    resolveMainCount!(1);
    await mainLoad;

    expect(gov.currentNetwork.get()).toBe("testnet");
    expect(gov.proposals.get()).toEqual([]);
  });

  it("accepts only well-formed compressed candidate keys with integer vote weight", async () => {
    const validKey = `0x02${"11".repeat(32)}`;
    const read = vi.fn(async (method: string) => {
      if (method === "getCandidates") {
        return [
          [validKey, "42"],
          ["0x04bad", 500],
          [`0x03${"22".repeat(32)}`, 1.5],
        ];
      }
      if (method === "getCommittee") return [validKey];
      return null;
    });
    const gov = useGovernance({
      app: framework(read as never),
      t: (key) => key,
      currentChainId: createObservable("neo-n3-mainnet"),
    });

    await gov.loadCouncilRoster();

    expect(gov.councilRosterError.get()).toBe("");
    expect(gov.councilCandidates.get()).toEqual([
      { publicKey: validKey, votes: 42, rank: 1, isCommittee: true },
    ]);
  });

  it("rejects a voting window outside the deployed contract bounds before invoking", async () => {
    const invoke = vi.fn(async () => ({ success: false }));
    const read = vi.fn(async (method: string) => {
      if (method === "isCandidate") return true;
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
    const chain = {
      read,
      invoke,
      address: createObservable<string>(MAIN_ADDRESS),
      ensureWallet: vi.fn(async () => MAIN_ADDRESS),
    };
    const app = createMiniAppFramework(
      { services: { chain }, t: (key: string) => key } as never,
      { appId: "miniapp-council-governance" },
    ) as unknown as MiniAppFramework;
    const gov = useGovernance({
      app,
      t: (key) => key,
      currentChainId: createObservable("neo-n3-mainnet"),
    });
    gov.setAddress(MAIN_ADDRESS);
    await gov.refreshCandidateStatus();

    await expect(gov.createProposal({
      type: 0,
      title: "Too long",
      description: "This duration does not fit the deployed contract.",
      duration: 3 * 24 * 60 * 60 * 1_000,
    })).rejects.toThrow("invalidProposalDuration");
    expect(invoke).not.toHaveBeenCalled();
  });
});
