/**
 * fetchAppStats council-governance caching tests (perf item D2).
 *
 * Regression covered: the council-governance live-stats branch used to fan out
 * one getProposalCount + up to 20 getProposalDetails RPC reads on EVERY 15s
 * poll (~21 round-trips). It must now fetch only getProposalCount each poll and
 * re-fetch the per-proposal details only when the proposal count changes,
 * dropping steady-state polling to a single round-trip while keeping the
 * rendered stats shape identical.
 */

import { fetchAppStats } from "../../components/playfield/MiniAppLiveStats";

const APP_ID = "miniapp-council-governance";
const RPC_URL = "https://rpc.example/neo";
const CONTRACT = "0xcouncilcontracthash000000000000000000abcd";
const NETWORK = "testnet" as const;

type RpcBody = {
  contractHash: string;
  method: string;
  params: Array<{ type: string; value: string }>;
  network: "mainnet" | "testnet";
};

/** Build a Map stack item matching what decodeMap expects. */
function proposalMap(status: string): unknown[] {
  return [
    {
      type: "Map",
      value: [
        {
          key: { type: "ByteString", value: btoa("statusString") },
          value: { type: "ByteString", value: btoa(status) },
        },
        {
          key: { type: "ByteString", value: btoa("quorumRequired") },
          value: { type: "Integer", value: "3" },
        },
      ],
    },
  ];
}

function rpcResponse(stack: unknown[]) {
  return {
    ok: true,
    json: async () => ({ result: { state: "HALT", stack } }),
  } as unknown as Response;
}

describe("fetchAppStats council-governance RPC fan-out caching", () => {
  let fetchMock: jest.Mock;
  let proposalCount: number;
  let detailsCalls: number;
  let countCalls: number;

  beforeEach(() => {
    proposalCount = 5;
    detailsCalls = 0;
    countCalls = 0;

    fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as RpcBody;
      if (body.method === "getProposalCount") {
        countCalls += 1;
        return rpcResponse([{ type: "Integer", value: String(proposalCount) }]);
      }
      if (body.method === "getProposalDetails") {
        detailsCalls += 1;
        // Make the highest id active so activeCount/latest are deterministic.
        const id = parseInt(body.params[0]?.value ?? "0", 10);
        return rpcResponse(
          proposalMap(id === proposalCount ? "Active" : "Finalized"),
        );
      }
      return rpcResponse([]);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("fetches every proposal on the first poll then only the count when unchanged", async () => {
    // First poll: 1 count read + `proposalCount` detail reads.
    const first = await fetchAppStats(APP_ID, RPC_URL, CONTRACT, NETWORK);
    expect(countCalls).toBe(1);
    expect(detailsCalls).toBe(proposalCount);
    const firstRoundTrips = countCalls + detailsCalls;
    expect(firstRoundTrips).toBe(proposalCount + 1); // ~21 in production (20 cap + 1)

    // Second poll, count unchanged: only the count is re-read, details reused.
    detailsCalls = 0;
    countCalls = 0;
    const second = await fetchAppStats(APP_ID, RPC_URL, CONTRACT, NETWORK);
    expect(countCalls).toBe(1);
    expect(detailsCalls).toBe(0);
    expect(countCalls + detailsCalls).toBe(1);

    // Rendered shape stays identical across the cached poll.
    expect(second).toEqual(first);
  });

  it("re-fetches per-proposal details when the proposal count changes", async () => {
    await fetchAppStats(APP_ID, RPC_URL, CONTRACT, NETWORK);

    // A new proposal is added → count changes → details re-fetched.
    proposalCount = 6;
    detailsCalls = 0;
    countCalls = 0;
    const updated = await fetchAppStats(APP_ID, RPC_URL, CONTRACT, NETWORK);
    expect(countCalls).toBe(1);
    expect(detailsCalls).toBe(6);

    const totalStat = updated.find((s) => s.label === "Total Proposals");
    expect(totalStat?.value).toBe("6");
  });

  it("does not share cache across contracts or networks", async () => {
    await fetchAppStats(APP_ID, RPC_URL, CONTRACT, NETWORK);

    // A different contract hash must trigger a fresh detail fan-out, not reuse
    // the first contract's cached proposals.
    detailsCalls = 0;
    countCalls = 0;
    const otherContract = "0xothercouncilhash00000000000000000000beef";
    await fetchAppStats(APP_ID, RPC_URL, otherContract, NETWORK);
    expect(countCalls).toBe(1);
    expect(detailsCalls).toBe(proposalCount);
  });

  it("renders the zero-proposal shape without per-proposal reads", async () => {
    proposalCount = 0;
    const stats = await fetchAppStats(APP_ID, RPC_URL, CONTRACT, NETWORK);
    expect(countCalls).toBe(1);
    expect(detailsCalls).toBe(0);
    expect(stats.find((s) => s.label === "Total Proposals")?.value).toBe("0");
  });
});
