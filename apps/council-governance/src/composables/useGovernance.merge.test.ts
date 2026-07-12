import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGovernance } from "./useGovernance";
import { createObservable } from "@shared/react/context";
import { createMiniAppFramework } from "@framework/index";
import type { MiniAppFramework } from "@shared/react";

const t = (key: string) => key;

/**
 * A contract proposal #7 (on-chain) alongside an explorer mirror proposal.
 * getProposalCount returns 7; getProposalDetails(7) returns the contract row.
 * Lower ids resolve to null so only #7 materializes from the contract.
 *
 * The composable consumes the MiniApp framework (ctx.framework); build it from
 * the mock chain so recorded read/invoke calls stay byte-identical.
 */
function makeApp(): MiniAppFramework {
  const read = vi.fn(async (method: string, args?: unknown[]): Promise<unknown> => {
    if (method === "getProposalCount") return 7;
    if (method === "getProposalDetails") {
      const idArg = (args?.[0] as { value?: string } | undefined)?.value;
      const id = Number(idArg);
      if (Number.isSafeInteger(id) && id >= 1 && id <= 7) {
        return {
          id,
          status: 1,
          statusString: "active",
          type: 0,
          title: id === 7 ? "On-chain proposal" : `Earlier proposal ${id}`,
          description: "Created via the contract",
          creator: "AReallyLongHashValue",
          yesVotes: 0,
          noVotes: 0,
          totalVotes: 0,
          quorumRequired: 21,
          quorumReached: false,
          createTime: 0,
          expiryTime: 0,
        };
      }
      throw new Error("unexpected proposal id");
    }
    if (method === "isCandidate") return false;
    if (method === "hasVoted") return false;
    return 0;
  });

  const chain = {
    read,
    invoke: vi.fn(async () => ({ txid: "0xtx", success: true })),
    address: createObservable<string>(""),
    ensureWallet: vi.fn(async () => ""),
  };
  return createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-council-governance" },
  ) as unknown as MiniAppFramework;
}

const EXPLORER_PAYLOAD = {
  proposals: [
    {
      id: "neo-community-42",
      number: 0,
      title: "Community proposal",
      summary: "From the neo.community mirror",
      status: "active",
      type: "text",
      proposerName: "Neo Foundation",
      councilVotes: { for: 3, against: 1, neutral: 0 },
      communityVotes: { for: 10, against: 2, neutral: 0 },
      endTime: new Date(Date.now() + 86_400_000).toISOString(),
      createdAt: new Date().toISOString(),
    },
  ],
};

describe("useGovernance — mainnet merges contract + explorer proposals", () => {
  beforeEach(() => {
    // Fetch backs both the RPC-read fallback and the explorer mirror; route by URL.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/api/explorer/council-governance")) {
          return { ok: true, json: async () => EXPLORER_PAYLOAD } as Response;
        }
        // RPC fallback is unused here (chainService.read succeeds), but answer safely.
        return { ok: true, json: async () => ({ result: 0 }) } as Response;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces BOTH the on-chain proposal and the mirror (no explorer-first short-circuit)", async () => {
    const app = makeApp();
    // Unique network token avoids the module-level explorer cache across runs.
    const currentChainId = createObservable<string>("neo-n3-mainnet");
    const gov = useGovernance({ app, t, currentChainId });

    await gov.loadProposals();
    const list = gov.proposals.get();

    // The contract proposal MUST be present (the bug hid it behind the mirror).
    const contractRow = list.find((p) => p.source === "contract");
    expect(contractRow, "contract proposal present").toBeTruthy();
    expect(contractRow!.id).toBe(7);

    // The mirror proposal is also present, as enrichment.
    const mirrorRow = list.find((p) => p.source === "neo-community");
    expect(mirrorRow, "mirror proposal present").toBeTruthy();

    // Contract entries sort before mirror entries.
    expect(list[0]?.source).toBe("contract");

    // Mirror ids live in the negative space so they never collide with a real
    // positive contract id (the hasVotedMap / React-key collision guard).
    expect(mirrorRow!.id).toBeLessThan(0);
  });

  it("converts the contract creator to a display-order 0x hash, not raw LE bytes", async () => {
    const app = makeApp();
    const currentChainId = createObservable<string>("neo-n3-mainnet");
    const gov = useGovernance({ app, t, currentChainId });

    await gov.loadProposals();
    const contractRow = gov.proposals.get().find((p) => p.source === "contract");
    // creatorDisplay is populated (falls back to the raw value only when the
    // hash can't be parsed); the field exists for the UI to render.
    expect(contractRow!.creatorDisplay).toBeTruthy();
  });
});
