import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Verifies the GAS sponsor endpoint enforces its daily/global/per-user caps via
 * a SHARED PERSISTENT store rather than per-instance in-memory counters.
 *
 * The store below stands in for the Supabase atomic RPCs
 * (sponsor_global_budget_bump, rate_limit_bump). Critically it is defined at
 * module scope so it survives jest.resetModules() — i.e. two simulated
 * serverless module loads of the handler both talk to the SAME store and
 * therefore SHARE the cap, which the old in-memory counters could not do.
 */

// Shared persistent store (simulates the Supabase-backed quota tables).
type GlobalRow = { used: number; count: number };
const store = {
  globalBudget: new Map<string, GlobalRow>(),
  rateLimits: new Map<string, number>(),
  reset() {
    this.globalBudget.clear();
    this.rateLimits.clear();
  },
};

// Toggle to simulate the shared store being unavailable (fail-closed test).
let storeUnavailable = false;
// Optional override for the global daily budget cap (GAS). null = use whatever
// the handler passes (MAX_GAS_PER_DAY). Tests set this to constrain the budget.
let globalDailyCapOverride: number | null = null;

function rpcGlobalBudgetBump(args: {
  p_scope: string;
  p_amount: number;
  p_daily_limit: number | null;
}) {
  const row = store.globalBudget.get(args.p_scope) ?? { used: 0, count: 0 };
  const limit =
    args.p_daily_limit != null && globalDailyCapOverride != null
      ? globalDailyCapOverride
      : args.p_daily_limit;
  if (limit != null && args.p_amount > 0) {
    if (row.used + args.p_amount > limit) {
      return {
        data: null,
        error: new Error(
          `budget_exceeded: daily limit is ${limit}, current usage is ${row.used}, requested ${args.p_amount}`,
        ),
      };
    }
  }
  row.used += args.p_amount;
  row.count += 1;
  store.globalBudget.set(args.p_scope, row);
  return { data: [{ used_amount: row.used, request_count: row.count }], error: null };
}

function rpcRateLimitBump(args: { p_identifier: string }) {
  const next = (store.rateLimits.get(args.p_identifier) ?? 0) + 1;
  store.rateLimits.set(args.p_identifier, next);
  return { data: [{ request_count: next, window_start: new Date().toISOString() }], error: null };
}

const supabaseClient = {
  rpc: jest.fn((fn: string, args: Record<string, unknown>) => {
    if (storeUnavailable) {
      return Promise.resolve({ data: null, error: new Error("connection refused") });
    }
    if (fn === "sponsor_global_budget_bump") {
      return Promise.resolve(rpcGlobalBudgetBump(args as never));
    }
    if (fn === "rate_limit_bump") {
      return Promise.resolve(rpcRateLimitBump(args as never));
    }
    return Promise.resolve({ data: null, error: new Error(`unexpected rpc ${fn}`) });
  }),
};

jest.mock("@/lib/server-supabase", () => ({
  getServerSupabaseClient: jest.fn(() => supabaseClient),
}));

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const signMock = jest.fn();
const serializeMock = jest.fn(() => "deadbeef");
const deserializeMock = jest.fn();

function neoSdkMock() {
  return {
    tx: {
      Transaction: { deserialize: deserializeMock },
      Witness: function Witness(init: Record<string, unknown>) {
        return { ...init, toJSON: () => init };
      },
      WitnessScope: { None: "None" },
    },
    wallet: {
      Account: jest.fn(() => ({
        scriptHash: "sponsor-script-hash",
        publicKey: "03abc",
        contract: { script: Buffer.from("2103abcac", "hex").toString("base64") },
      })),
      getAddressFromScriptHash: jest.fn((hash: string) => hash),
    },
  };
}

jest.mock("@r3e/neo-js-sdk/browser", () => neoSdkMock());

// A signed-witness transaction whose computed fee is small (well under the
// per-tx cap) so each request reserves a tiny slice of the global budget.
function setupTransactionMock() {
  const primary = {
    signers: [{ account: currentWallet }],
    witnesses: [
      { invocationScript: "0c40" + "00".repeat(64), verificationScript: "abc" },
    ],
    serialize: serializeMock,
    sign: signMock,
    networkFee: 0n,
  };
  const sizing = {
    signers: [],
    witnesses: [],
    serialize: jest.fn(() => "00".repeat(120)),
  };
  deserializeMock.mockReset();
  deserializeMock.mockImplementationOnce(() => primary).mockImplementationOnce(() => sizing);
}

type Handler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

function loadHandler(): Handler {
  jest.resetModules();
  jest.doMock("@/lib/server-supabase", () => ({
    getServerSupabaseClient: jest.fn(() => supabaseClient),
  }));
  jest.doMock("@/lib/logger", () => ({
    logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
  }));
  jest.doMock("@r3e/neo-js-sdk/browser", () => neoSdkMock());
  jest.doMock("@/lib/require-wallet-auth", () => ({
    requireWalletAuth: jest.fn(async () => currentWallet),
  }));
  return require("@/pages/api/rpc/sponsor").default as Handler;
}

// Mutable identity returned by the mocked wallet auth for the next request.
let currentWallet = "user-script-hash";

async function callSponsor(handler: Handler, wallet: string): Promise<number> {
  currentWallet = wallet;
  setupTransactionMock();
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method: "POST",
    body: { txBase64: "ignored", userAddress: wallet },
  });
  await handler(req, res);
  return res._getStatusCode();
}

describe("/api/rpc/sponsor shared quota enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.reset();
    storeUnavailable = false;
    globalDailyCapOverride = null;
    process.env.SPONSORED_WIF = "test-wif";
    process.env.NEXT_PUBLIC_NETWORK_MAGIC = "894710606"; // testnet
    delete process.env.SPONSOR_ALLOW_MAINNET;
  });

  it("denies excess global-daily requests across distinct wallets with 429", async () => {
    const handler = loadHandler();

    // Probe one request to learn the per-request fee reservation.
    expect(await callSponsor(handler, "wallet-0")).toBe(200);
    const perRequestFee = store.globalBudget.get("rpc-sponsor:global")!.used;
    expect(perRequestFee).toBeGreaterThan(0);

    // Reset and constrain the shared budget to admit exactly 3 requests total.
    store.reset();
    globalDailyCapOverride = perRequestFee * 3;

    // Each request comes from a DISTINCT authenticated wallet, so only the
    // shared global budget — not any per-user limit — can produce the 429s.
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push(await callSponsor(handler, `wallet-${i}`));
    }

    expect(statuses.filter((s) => s === 200).length).toBe(3);
    expect(statuses.filter((s) => s === 429).length).toBe(2);
  });

  it("shares the cap across two simulated module loads (cold starts)", async () => {
    // Probe one request to learn the per-request fee reservation.
    const probe = loadHandler();
    expect(await callSponsor(probe, "probe")).toBe(200);
    const perRequestFee = store.globalBudget.get("rpc-sponsor:global")!.used;
    store.reset();

    // Constrain the shared budget to admit exactly 2 requests total.
    globalDailyCapOverride = perRequestFee * 2;

    // First module load consumes one slot.
    const handlerA = loadHandler();
    expect(await callSponsor(handlerA, "wallet-a")).toBe(200);

    // Second, independently loaded module instance consumes the second slot.
    const handlerB = loadHandler();
    expect(await callSponsor(handlerB, "wallet-b")).toBe(200);

    // The next request on either instance must be rejected — the cap is shared
    // across both loads (in-memory per-instance counters could not do this).
    expect(await callSponsor(handlerB, "wallet-c")).toBe(429);
    expect(await callSponsor(handlerA, "wallet-d")).toBe(429);
  });

  it("enforces the per-user window limit across module loads", async () => {
    const handler = loadHandler();
    // Same wallet repeatedly: per-user window cap is 5, 6th must be 429.
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(await callSponsor(handler, "repeat-wallet"));
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
  });

  it("fails closed (503) when the shared store is unavailable", async () => {
    storeUnavailable = true;
    const handler = loadHandler();
    const status = await callSponsor(handler, "wallet-x");
    expect(status).toBe(503);
  });

  it("rejects mainnet requests unless explicitly allowed", async () => {
    process.env.NEXT_PUBLIC_NETWORK_MAGIC = "860833102"; // mainnet
    const handler = loadHandler();
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { txBase64: "ignored", userAddress: "wallet-m" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(403);
    const body = JSON.parse(res._getData());
    expect(body.error.message).toContain("mainnet");
  });

  it("allows mainnet when SPONSOR_ALLOW_MAINNET=true", async () => {
    process.env.NEXT_PUBLIC_NETWORK_MAGIC = "860833102"; // mainnet
    process.env.SPONSOR_ALLOW_MAINNET = "true";
    const handler = loadHandler();
    const status = await callSponsor(handler, "wallet-allowed");
    expect(status).toBe(200);
  });
});
