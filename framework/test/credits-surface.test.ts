/**
 * app.credits regression contract (Credits v2 — DB-first spends).
 *
 * Locks the invariants of the one uniform credit surface apps consume:
 * - rate math is the contract's exact fixed rate (1 GAS = 50 credits,
 *   1 credit = 2_000_000 base units, floor division, dust rejected);
 * - guest mode blocks buy AND spend before any chain/network call
 *   (credits are a GAS-backed feature);
 * - the S11 "payments" manifest permission gates BUY only — spends are
 *   off-chain and must keep working under a declared manifest without it;
 * - generated idempotency keys are unique per call, ledger-charset-safe,
 *   and caller overrides are honored (that is what makes retries safe);
 * - spends are single-flight per action (double-click ⇒ one ledger debit);
 * - the ledger's 402 surfaces as the typed FrameworkInsufficientCreditsError;
 * - when the ledger is unreachable, balance() serves the LAST SETTLED
 *   on-chain checkpoint flagged { source: "chain", stale: true };
 * - absent/invalid config throws typed FrameworkCapabilityError, never
 *   silently no-ops.
 */
import { describe, expect, it, vi } from "vitest";
import {
  createMiniAppFramework,
  creditsForGas,
  gasForCredits,
  FrameworkCreditsError,
  FrameworkInsufficientCreditsError,
  FrameworkPermissionError,
  CREDITS_BUY_MEMO,
  GAS_TOKEN_HASH,
} from "../index";
import type { MiniAppFrameworkContext, MiniAppFrameworkOptions } from "../index";
import { FrameworkCapabilityError } from "../aa";
import { createObservable } from "../reactive";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const LEDGER_URL = "https://edge.example/functions/v1/credits-ledger";
const CONTRACT_HASH = `0x${"ab".repeat(20)}`;
const GUEST_ERROR = /guest-mode: on-chain\/oracle operations are disabled/;
const IDEMPOTENCY_KEY_RE = /^[-_a-zA-Z0-9:.]{8,128}$/;

type FetchCall = { url: string; init?: RequestInit };

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function ledgerBalanceBody(overrides: Record<string, unknown> = {}) {
  return {
    wallet: ADDRESS,
    network: "testnet",
    balance: 100,
    total_purchased: 150,
    total_spent: 50,
    total_exited: 0,
    updated_at: "2026-07-12T00:00:00Z",
    events: [],
    ...overrides,
  };
}

function spendResponseBody(overrides: Record<string, unknown> = {}) {
  return {
    wallet: ADDRESS,
    network: "testnet",
    app_id: "credits-test",
    action: "hint",
    spent: 5,
    balance: 95,
    event_id: 42,
    deduped: false,
    ...overrides,
  };
}

function makeApp(
  options: Omit<MiniAppFrameworkOptions, "appId"> = {},
  ctxOverrides: Partial<MiniAppFrameworkContext> = {},
) {
  const calls: FetchCall[] = [];
  const responses: Array<Response | Error> = [];
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses.length > 1 ? responses.shift() : responses[0];
    if (!next) throw new Error("no mock ledger response queued");
    if (next instanceof Error) throw next;
    return next;
  });
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>("0xabc"),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async () => "0"),
    invoke: vi.fn(async () => ({ txid: "0xbuytx", success: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: "0xpay", success: true })),
    waitForEvent: vi.fn(async () => ({ eventName: "CreditsPurchased" })),
  };
  const ctx = {
    services: { chain },
    t: (key: string) => key,
    launchContext: { appId: "credits-test" },
    ...ctxOverrides,
  } as unknown as MiniAppFrameworkContext;
  const app = createMiniAppFramework(ctx, {
    appId: "credits-test",
    credits: {
      ledgerUrl: LEDGER_URL,
      contractHash: CONTRACT_HASH,
      fetcher: fetcher as unknown as typeof fetch,
      buyPollAttempts: 2,
      buyPollDelayMs: 1,
      readRetryAttempts: 1,
      delay: async () => {},
    },
    ...options,
  });
  return { app, chain, fetcher, calls, responses };
}

function spendBodyOf(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call.init?.body ?? "{}")) as Record<string, unknown>;
}

describe("credits rate math", () => {
  it("applies the fixed 1 GAS = 50 credits rate with contract floor semantics", () => {
    expect(creditsForGas("1")).toBe(50n);
    expect(creditsForGas(0.02)).toBe(1n);
    expect(creditsForGas("2.5")).toBe(125n);
    // Below one credit floors to zero — the contract rejects this as dust.
    expect(creditsForGas("0.019")).toBe(0n);
    // bigint inputs are GAS BASE UNITS (the app.amount.gasToFixed8 convention).
    expect(creditsForGas(2_000_000n)).toBe(1n);
    expect(creditsForGas(100_000_000n)).toBe(50n);
  });

  it("round-trips credits back to decimal GAS", () => {
    expect(gasForCredits(50)).toBe("1");
    expect(gasForCredits(1n)).toBe("0.02");
    expect(gasForCredits(125)).toBe("2.5");
    expect(gasForCredits("3")).toBe("0.06");
  });

  it("rejects invalid amounts loudly", () => {
    expect(() => creditsForGas("-1")).toThrow();
    expect(() => creditsForGas("abc")).toThrow();
    expect(() => creditsForGas(0)).toThrow();
    expect(() => gasForCredits(0)).toThrow();
    expect(() => gasForCredits(-5)).toThrow();
  });

  it("exposes the rate constants on app.credits.rate", () => {
    const { app } = makeApp();
    expect(app.credits.rate.creditsPerGas).toBe(50);
    expect(app.credits.rate.gasPerCredit).toBe("2000000");
    expect(app.credits.rate.creditsForGas("1")).toBe(50n);
    expect(app.credits.rate.gasForCredits(50)).toBe("1");
  });
});

describe("credits config validation", () => {
  it("throws a typed capability error when no credits config is injected", async () => {
    const chain = {
      address: createObservable<string | null>(ADDRESS),
      ensureWallet: vi.fn(async () => ADDRESS),
      read: vi.fn(async () => "0"),
      invoke: vi.fn(async () => ({ txid: "0x1", success: true })),
      invokeWithPayment: vi.fn(async () => ({ txid: "0x2", success: true })),
    };
    const ctx = {
      services: { chain },
      t: (key: string) => key,
      launchContext: { appId: "credits-test" },
    } as unknown as MiniAppFrameworkContext;
    const app = createMiniAppFramework(ctx, { appId: "credits-test" });

    expect(app.credits.available).toBe(false);
    await expect(app.credits.balance()).rejects.toThrow(FrameworkCapabilityError);
    await expect(app.credits.balance()).rejects.toThrow(/credits/i);
    await expect(app.credits.spend(1, "hint")).rejects.toThrow(FrameworkCapabilityError);
    await expect(app.credits.buy("1")).rejects.toThrow(FrameworkCapabilityError);
    await expect(app.credits.history()).rejects.toThrow(FrameworkCapabilityError);
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("rejects an invalid contract hash with a clear message", async () => {
    const { app } = makeApp({
      credits: {
        ledgerUrl: LEDGER_URL,
        contractHash: "not-a-hash",
      },
    });
    expect(app.credits.available).toBe(false);
    await expect(app.credits.balance()).rejects.toThrow(/contractHash/);
  });

  it("rejects a missing ledger URL with a clear message", async () => {
    const { app } = makeApp({
      credits: { ledgerUrl: "", contractHash: CONTRACT_HASH },
    });
    expect(app.credits.available).toBe(false);
    await expect(app.credits.spend(1, "hint")).rejects.toThrow(/ledgerUrl/);
  });
});

describe("credits guest guard", () => {
  it("blocks buy and spend in guest mode before any chain/network call", async () => {
    const { app, chain, fetcher } = makeApp();
    app.mode.set("guest");

    await expect(app.credits.buy("1")).rejects.toThrow(GUEST_ERROR);
    await expect(app.credits.spend(5, "hint")).rejects.toThrow(GUEST_ERROR);

    expect(chain.invoke).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("allows buy and spend again in gamefi mode", async () => {
    const { app, responses } = makeApp();
    app.mode.set("guest");
    await expect(app.credits.spend(5, "hint")).rejects.toThrow(GUEST_ERROR);

    app.mode.set("gamefi");
    responses.push(jsonResponse(201, spendResponseBody()));
    await expect(app.credits.spend(5, "hint")).resolves.toMatchObject({ spent: 5, balance: 95 });
  });
});

describe("credits spend", () => {
  it("POSTs the ledger contract shape with auto app_id and bound wallet", async () => {
    const { app, calls, responses } = makeApp();
    responses.push(jsonResponse(201, spendResponseBody()));

    const result = await app.credits.spend(5, "hint");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(LEDGER_URL);
    expect(calls[0].init?.method).toBe("POST");
    const body = spendBodyOf(calls[0]);
    expect(body.network).toBe("testnet");
    expect(body.app_id).toBe("credits-test");
    expect(body.action).toBe("hint");
    expect(body.amount).toBe(5);
    expect(body.wallet).toBe(ADDRESS);
    expect(String(body.idempotency_key)).toMatch(IDEMPOTENCY_KEY_RE);
    expect(result).toMatchObject({
      spent: 5,
      balance: 95,
      eventId: 42,
      deduped: false,
      appId: "credits-test",
      action: "hint",
    });
    expect(result.idempotencyKey).toBe(body.idempotency_key);
  });

  it("generates a unique, charset-safe idempotency key per call", async () => {
    const { app, calls, responses } = makeApp();
    responses.push(jsonResponse(201, spendResponseBody()), jsonResponse(201, spendResponseBody()));

    await app.credits.spend(1, "hint");
    await app.credits.spend(1, "hint");

    const keyA = String(spendBodyOf(calls[0]).idempotency_key);
    const keyB = String(spendBodyOf(calls[1]).idempotency_key);
    expect(keyA).toMatch(IDEMPOTENCY_KEY_RE);
    expect(keyB).toMatch(IDEMPOTENCY_KEY_RE);
    expect(keyA).not.toBe(keyB);
    // Keys embed app + action so ledger rows stay greppable per lane.
    expect(keyA).toContain("credits-test");
    expect(keyA).toContain("hint");
  });

  it("honors a caller-managed idempotency key and validates its shape", async () => {
    const { app, calls, responses, fetcher } = makeApp();
    responses.push(jsonResponse(200, spendResponseBody({ deduped: true })));

    const result = await app.credits.spend(1, "hint", { idempotencyKey: "retry:hint:0001" });
    expect(spendBodyOf(calls[0]).idempotency_key).toBe("retry:hint:0001");
    expect(result.deduped).toBe(true);

    fetcher.mockClear();
    await expect(
      app.credits.spend(1, "hint", { idempotencyKey: "no spaces allowed" }),
    ).rejects.toThrow(/idempotencyKey/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("is single-flight per action: a concurrent duplicate joins the in-flight debit", async () => {
    const { app, fetcher, calls } = makeApp();
    const pending: Array<(value: Response) => void> = [];
    fetcher.mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Promise<Response>((resolve) => {
        pending.push(resolve);
      });
    });

    const first = app.credits.spend(5, "hint");
    const duplicate = app.credits.spend(5, "hint");
    // The transport is reached asynchronously — wait for exactly ONE debit.
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    pending[0](jsonResponse(201, spendResponseBody()));

    const [a, b] = await Promise.all([first, duplicate]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);

    // A different action is a different flight and runs concurrently.
    const other = app.credits.spend(2, "retry");
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    pending[1](jsonResponse(201, spendResponseBody({ action: "retry", spent: 2, balance: 93 })));
    await other;

    // Once settled, the same action spends again (the flight is released).
    fetcher.mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return jsonResponse(201, spendResponseBody());
    });
    await app.credits.spend(5, "hint");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("rejects invalid amounts and actions before any network call", async () => {
    const { app, fetcher } = makeApp();
    await expect(app.credits.spend(0, "hint")).rejects.toThrow(FrameworkCreditsError);
    await expect(app.credits.spend(1.5, "hint")).rejects.toThrow(/positive integer/);
    await expect(app.credits.spend(-3, "hint")).rejects.toThrow(FrameworkCreditsError);
    await expect(app.credits.spend(1, "")).rejects.toThrow(/action/);
    await expect(app.credits.spend(1, "bad action!")).rejects.toThrow(/action/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("surfaces the ledger 402 as the typed InsufficientCredits error", async () => {
    const { app, responses } = makeApp();
    responses.push(
      jsonResponse(402, { error: { code: "INSUFFICIENT_CREDITS", message: "insufficient credits" } }),
    );

    const failure = await app.credits.spend(500, "hint").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(FrameworkInsufficientCreditsError);
    const typed = failure as FrameworkInsufficientCreditsError;
    expect(typed.code).toBe("INSUFFICIENT_CREDITS");
    expect(typed.required).toBe(500);
    expect(typed.httpStatus).toBe(402);
  });

  it("maps other ledger error envelopes to FrameworkCreditsError with the code", async () => {
    const { app, responses } = makeApp();
    responses.push(
      jsonResponse(403, { error: { code: "ADDRESS_MISMATCH", message: "wallet must match" } }),
    );
    const failure = await app.credits.spend(1, "hint").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(FrameworkCreditsError);
    expect((failure as FrameworkCreditsError).code).toBe("ADDRESS_MISMATCH");
  });

  it("folds the post-spend balance into app.credits.current", async () => {
    const { app, responses } = makeApp();
    responses.push(jsonResponse(200, ledgerBalanceBody()));
    await app.credits.balance();
    expect(app.credits.current.get()?.balance).toBe(100);

    responses.length = 0;
    responses.push(jsonResponse(201, spendResponseBody({ balance: 95 })));
    await app.credits.spend(5, "hint");
    expect(app.credits.current.get()?.balance).toBe(95);
    expect(app.credits.current.get()?.stale).toBe(false);
  });
});

describe("credits balance + stale chain fallback", () => {
  it("reads the ledger balance and marks it live", async () => {
    const { app, calls, responses } = makeApp();
    responses.push(jsonResponse(200, ledgerBalanceBody()));

    const balance = await app.credits.balance();
    expect(calls[0].url).toContain("network=testnet");
    expect(calls[0].url).toContain("limit=1");
    expect(balance).toMatchObject({
      wallet: ADDRESS,
      balance: 100,
      totalPurchased: 150,
      totalSpent: 50,
      source: "ledger",
      stale: false,
    });
    expect(app.credits.current.get()).toEqual(balance);
  });

  it("falls back to settledBalanceOf flagged stale when the ledger is unreachable", async () => {
    const { app, chain, responses } = makeApp();
    responses.push(new Error("ledger down"));
    chain.read.mockResolvedValue("120");

    const balance = await app.credits.balance();
    expect(chain.read).toHaveBeenCalledWith(
      "settledBalanceOf",
      [expect.objectContaining({ type: "Hash160" })],
      { scriptHash: CONTRACT_HASH },
    );
    expect(balance).toMatchObject({
      wallet: ADDRESS,
      balance: 120,
      source: "chain",
      stale: true,
      updatedAt: null,
    });
    expect(app.credits.current.get()?.stale).toBe(true);
  });

  it("rethrows the ledger error when the chain fallback also fails", async () => {
    const { app, chain, responses } = makeApp();
    responses.push(new Error("ledger down"));
    chain.read.mockRejectedValue(new Error("rpc down"));
    await expect(app.credits.balance()).rejects.toThrow(/ledger down/);
  });

  it("canAfford uses the cached balance and refreshes when cold", async () => {
    const { app, fetcher, responses } = makeApp();
    responses.push(jsonResponse(200, ledgerBalanceBody({ balance: 40 })));

    await expect(app.credits.canAfford(30)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    // Cached `current` answers the next check without another GET.
    await expect(app.credits.canAfford(50)).resolves.toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(app.credits.canAfford(0)).resolves.toBe(false);
    await expect(app.credits.canAfford(2.5)).resolves.toBe(false);
  });

  it("history returns decoded ledger events newest-first shape", async () => {
    const { app, calls, responses } = makeApp();
    responses.push(
      jsonResponse(
        200,
        ledgerBalanceBody({
          events: [
            {
              id: 7,
              event_type: "spend",
              amount: -5,
              balance_after: 95,
              app_id: "credits-test",
              action: "hint",
              idempotency_key: "k".repeat(12),
              tx_hash: null,
              gas_amount: null,
              created_at: "2026-07-12T00:00:01Z",
            },
            {
              id: 6,
              event_type: "purchase",
              amount: 100,
              balance_after: 100,
              app_id: null,
              action: null,
              idempotency_key: null,
              tx_hash: "0xbuytx",
              gas_amount: "200000000",
              created_at: "2026-07-12T00:00:00Z",
            },
          ],
        }),
      ),
    );

    const events = await app.credits.history(5);
    expect(calls[0].url).toContain("limit=5");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ id: 7, eventType: "spend", amount: -5, action: "hint" });
    expect(events[1]).toMatchObject({
      id: 6,
      eventType: "purchase",
      txHash: "0xbuytx",
      gasAmount: "200000000",
    });
  });
});

describe("credits buy", () => {
  it("transfers GAS to the credits contract with the buy memo and polls the ledger", async () => {
    const { app, chain, responses } = makeApp();
    responses.push(
      jsonResponse(
        200,
        ledgerBalanceBody({
          balance: 150,
          events: [
            {
              id: 9,
              event_type: "purchase",
              amount: 50,
              balance_after: 150,
              app_id: null,
              action: null,
              idempotency_key: null,
              tx_hash: "0xbuytx",
              gas_amount: "100000000",
              created_at: "2026-07-12T00:00:02Z",
            },
          ],
        }),
      ),
    );

    const result = await app.credits.buy("1");

    expect(chain.invoke).toHaveBeenCalledTimes(1);
    const [operation, args, options] = chain.invoke.mock.calls[0] as unknown as [
      string,
      Array<{ type: string; value: unknown }>,
      { scriptHash?: string },
    ];
    expect(operation).toBe("transfer");
    expect(options.scriptHash).toBe(GAS_TOKEN_HASH);
    expect(args[0]).toMatchObject({ type: "Hash160" });
    expect(args[1]).toEqual({ type: "Hash160", value: CONTRACT_HASH });
    expect(args[2]).toEqual({ type: "Integer", value: "100000000" });
    expect(args[3]).toEqual({ type: "String", value: CREDITS_BUY_MEMO });

    expect(chain.waitForEvent).toHaveBeenCalledWith("0xbuytx", "CreditsPurchased", 30_000);
    expect(result).toMatchObject({
      txid: "0xbuytx",
      gasFixed8: "100000000",
      credits: 50,
      credited: true,
    });
    expect(result.balance?.balance).toBe(150);
  });

  it("rejects dust below one credit before touching the chain", async () => {
    const { app, chain } = makeApp();
    await expect(app.credits.buy("0.019")).rejects.toThrow(/1-credit minimum/);
    await expect(app.credits.buy("0.019")).rejects.toThrow(FrameworkCreditsError);
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("resolves credited:false (not a failure) when the indexer lags past the poll budget", async () => {
    const { app, responses } = makeApp();
    // Ledger answers, but the purchase event never shows inside the budget.
    responses.push(jsonResponse(200, ledgerBalanceBody({ events: [] })));

    const result = await app.credits.buy("1");
    expect(result.credited).toBe(false);
    expect(result.txid).toBe("0xbuytx");
    expect(result.balance?.source).toBe("ledger");
  });

  it("gates buy — and only buy — on the S11 payments manifest permission", async () => {
    const { app, chain, responses } = makeApp(
      {},
      {
        launchContext: { appId: "credits-test", permissions: { payments: false } },
      } as Partial<MiniAppFrameworkContext>,
    );

    await expect(app.credits.buy("1")).rejects.toThrow(FrameworkPermissionError);
    expect(chain.invoke).not.toHaveBeenCalled();

    // Spend is off-chain: it must keep working WITHOUT the payments grant.
    responses.push(jsonResponse(201, spendResponseBody()));
    await expect(app.credits.spend(5, "hint")).resolves.toMatchObject({ spent: 5 });
  });

  it("allows buy when the manifest grants payments", async () => {
    const { app, chain, responses } = makeApp(
      {},
      {
        launchContext: { appId: "credits-test", permissions: { payments: true } },
      } as Partial<MiniAppFrameworkContext>,
    );
    responses.push(jsonResponse(200, ledgerBalanceBody()));
    const result = await app.credits.buy("1");
    expect(chain.invoke).toHaveBeenCalledTimes(1);
    expect(result.credits).toBe(50);
  });
});
