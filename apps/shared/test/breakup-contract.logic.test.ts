import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBreakup } from "../../breakup-contract/src/composables/useBreakup";
import type { ChainService } from "../services/ChainService";
import { createMiniAppFramework } from "../react";
import { createObservable } from "../react/context";

// The on-device title/terms store is localStorage-backed; clear it between
// tests so a pact id written in one test never leaks its title into another
// (the foreign-pact placeholder test depends on a clean store).
beforeEach(() => {
  try {
    globalThis.localStorage?.clear();
  } catch {
    /* memory storage stub may be absent — ignore */
  }
});

// A valid Neo N3 address (party2 / partner named in the pact). Its script hash
// is derived by addressToScriptHash; the test only needs it to pass the
// /^N[0-9a-zA-Z]{33}$/ shape check and to differ from the creator.
const PARTNER = "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq";
const CREATOR = "NgaiKFjurmNmiRzDRQGs44yzByXuSkdGPF";

// getPact returns party1/party2 as UInt160 Hash160s. chain.read surfaces those
// as raw chain-order (little-endian) ByteStrings — parseStackItem renders them
// as `0x<chain-order hex>`, the REVERSE of the display-order hash. mapPact must
// normalize these to display order and match them against the wallet via
// ownerMatchesAddress (the old N-address-vs-hex string compare was always
// false, which hid every Sign/Break/Cancel control). Feed the realistic
// chain-order form so the tests exercise the real normalization path.
const CREATOR_HASH_CHAIN = "0xe2b653227293e99c4f2906d53553abb4a672df86";
const PARTNER_HASH_CHAIN = "0x7eee1aabeb67ed1d791d44e4f5fcf3ae9171a871";

// The on-chain contract script hash the composable reads from contractAddress.
const CONTRACT = "0xe298ae87a7e31f25ad0fce23e83f0e93c02e2850";
// GAS native contract hash (used as the transfer scriptHash override).
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    contractCreated: "Contract created successfully!",
    contractSubmitted: `Contract "${params?.title ?? ""}" submitted. Refreshing contract state.`,
    contractSigned: "Contract signed",
    contractBroken: "Pact broken — your stake is forfeited to your partner.",
    contractSettled: "Pact honored — both stakes refunded.",
    partnerInvalid: "Invalid partner address",
    partnerRequired: "Partner address is required",
    partnerSelf: "You cannot name yourself as the partner.",
    stakeOrDurationInvalid:
      "Stake must be at least 1 GAS and duration at least 30 days",
    stakeRequired: "Stake amount is required",
    titleRequired: "Contract title is required",
    titleTooLong: "Title must be 100 characters or less",
    termsTooLong: "Terms must be 2000 characters or less",
    untitledContract: "Untitled pact",
    contractWalletUnavailable:
      "Connect your wallet to stake and confirm the pact on-chain.",
    loadFailed: "Failed to load contracts",
    depositPrepaidNoContract:
      "Your stake was deposited but the pact was not created.",
    depositPrepaidNoSign:
      "Your matching stake was deposited but the pact was not signed.",
    signNotPartner: "Only the named partner can sign this pact.",
    noCreditToRecover: "No recoverable stake credit.",
    creditRecovering: "Recovering your stranded stake credit…",
    creditRecovered: "Stake credit recovered to your wallet.",
  };
  return messages[key] ?? key;
}

// 5 GAS in base units (5 × 1e8). The contract takes/returns base units.
const STAKE_BASE = "500000000";

/**
 * A getPact Map (as chain.read surfaces it: a plain object). status codes:
 * 0 pending, 1 active, 2 broken, 3 settled, 4 cancelled. endTime is ms.
 */
function pact(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 1,
    party1: CREATOR_HASH_CHAIN,
    party2: PARTNER_HASH_CHAIN,
    stake: STAKE_BASE,
    endTime: Date.now() + 90 * 86_400_000,
    party1Staked: true,
    party2Staked: false,
    status: 0,
    breaker: "0x0000000000000000000000000000000000000000",
    ...over,
  };
}

interface ChainMock {
  read: ReturnType<typeof vi.fn>;
  readArray: ReturnType<typeof vi.fn>;
  invoke: ReturnType<typeof vi.fn>;
  ensureWallet: ReturnType<typeof vi.fn>;
  address: ReturnType<typeof createObservable<string | null>>;
  contractAddress: ReturnType<typeof createObservable<string | null>>;
}

/**
 * Build a ChainService stand-in. `pacts` is the id->Map store getPact reads;
 * `partyPacts` is the id list getPartyPacts returns; `events` maps an invoked
 * operation to the event payload chain.invoke resolves with (so PactCreated can
 * surface the new id via state[0]).
 */
function chainMock(opts: {
  pacts?: Record<string, Record<string, unknown>>;
  partyPacts?: string[];
  lastPactId?: string;
  events?: Record<string, unknown>;
  invokeImpl?: (op: string, args: unknown[]) => Promise<unknown> | unknown;
} = {}): { chain: ChainService; mock: ChainMock } {
  const pacts = opts.pacts ?? {};
  const partyPacts = opts.partyPacts ?? [];
  const events = opts.events ?? {};

  const read = vi.fn(async (op: string, args?: { value: string }[]) => {
    if (op === "getPact") return pacts[String(args?.[0]?.value)] ?? null;
    if (op === "lastPactId") return opts.lastPactId ?? "0";
    return null;
  });
  const readArray = vi.fn(async (op: string) => {
    if (op === "getPartyPacts") return partyPacts;
    return [];
  });
  const invoke = vi.fn(async (op: string, args: unknown[]) => {
    if (opts.invokeImpl) {
      const r = await opts.invokeImpl(op, args);
      if (r !== undefined) return r;
    }
    return { txid: "0xtx", event: events[op], success: true };
  });
  const ensureWallet = vi.fn(async () => CREATOR);
  const address = createObservable<string | null>(CREATOR);
  const contractAddress = createObservable<string | null>(CONTRACT);

  const mock: ChainMock = { read, readArray, invoke, ensureWallet, address, contractAddress };
  return { chain: mock as unknown as ChainService, mock };
}

function eventState(values: unknown[]) {
  return { state: values.map((value) => ({ value })) };
}

/**
 * Wrap a mock ChainService in the MiniApp framework the composable now consumes.
 * The framework's arg builders/passthroughs are behavior-preserving, so every
 * recorded chain call (op, args, options) matches the pre-migration expectations.
 */
function frameworkFor(chain: ChainService) {
  return createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-breakupcontract" },
  );
}

function validApp(chainOpts: Parameters<typeof chainMock>[0] = {}) {
  const { chain, mock } = chainMock(chainOpts);
  const eventBus = { emit: vi.fn() };
  const app = useBreakup({ app: frameworkFor(chain), eventBus, t });
  app.address.set(CREATOR);
  app.partnerAddress.set(PARTNER);
  app.stakeAmount.set("5");
  app.duration.set("90");
  app.contractTitle.set("Summer covenant");
  app.contractTerms.set("Shared plans and clean exit rules.");
  return { app, mock, eventBus };
}

describe("useBreakup", () => {
  it("creates a pact: deposits the stake then calls createPact, capturing the pactId from the PactCreated event and persisting title/terms on-device", async () => {
    const { app, mock } = validApp({
      // PactCreated(id, p1, p2, stake, endTime) — new id in state[0].
      events: { createPact: eventState(["7"]) },
      // After create, loadContracts lists the new pact.
      partyPacts: ["7"],
      pacts: { "7": pact({ id: 7 }) },
    });

    await app.createContract();

    // Step 1: DEPOSIT — a GAS transfer to the contract with the stake memo, in
    // BASE UNITS (5 GAS = 5e8), routed through the GAS native contract.
    expect(mock.invoke).toHaveBeenCalledWith(
      "transfer",
      [
        { type: "Hash160", value: expect.any(String) },
        { type: "Hash160", value: CONTRACT },
        { type: "Integer", value: STAKE_BASE },
        { type: "String", value: "miniapp-breakup:stake" },
      ],
      expect.objectContaining({ scriptHash: GAS_HASH }),
    );

    // Step 2: createPact(party1, party2, stakeBase, durationSeconds) — duration
    // is days × 86400 (90 × 86400), stake in base units, waiting on the event.
    const createCall = mock.invoke.mock.calls.find(([op]) => op === "createPact");
    expect(createCall).toBeTruthy();
    const [, createArgs, createOpts] = createCall as [string, { type: string; value: string }[], { waitForEvent?: string }];
    expect(createArgs[2]).toEqual({ type: "Integer", value: STAKE_BASE });
    expect(createArgs[3]).toEqual({ type: "Integer", value: String(90 * 86_400) });
    expect(createOpts.waitForEvent).toBe("PactCreated");

    // The on-device title/terms are keyed by the captured on-chain pact id (7),
    // NOT a synthesized id — so the listed pact rebuilds the real title.
    const listed = app.contracts.get();
    expect(listed).toHaveLength(1);
    expect(listed[0].pactId).toBe("7");
    expect(listed[0].title).toBe("Summer covenant");
    expect(listed[0].terms).toBe("Shared plans and clean exit rules.");
    expect(listed[0].status).toBe("pending");
    expect(app.lastSubmittedTitle.get()).toBe("Summer covenant");
  });

  it("falls back to lastPactId() when the PactCreated event slot is unavailable", async () => {
    const { app } = validApp({
      events: {}, // no PactCreated event payload
      lastPactId: "9",
      partyPacts: ["9"],
      pacts: { "9": pact({ id: 9 }) },
    });

    await app.createContract();

    const listed = app.contracts.get();
    expect(listed).toHaveLength(1);
    expect(listed[0].pactId).toBe("9");
    expect(listed[0].title).toBe("Summer covenant");
  });

  it("rejects an invalid partner, a sub-1-GAS stake, and a sub-30-day duration before any chain call", async () => {
    const { app, mock } = validApp();

    app.partnerAddress.set("not-a-neo-address");
    await expect(app.createContract()).rejects.toThrow("Invalid partner address");

    app.partnerAddress.set(PARTNER);
    app.stakeAmount.set("0.5");
    await expect(app.createContract()).rejects.toThrow(
      "Stake must be at least 1 GAS and duration at least 30 days",
    );

    app.stakeAmount.set("5");
    app.duration.set("10");
    await expect(app.createContract()).rejects.toThrow(
      "Stake must be at least 1 GAS and duration at least 30 days",
    );

    // None of the rejected attempts touched the chain.
    expect(mock.invoke).not.toHaveBeenCalled();
  });

  it("signs a pending pact: deposits a stake matching the pact's exact on-chain base units, then calls signPact", async () => {
    const { app, mock } = validApp({
      partyPacts: ["7"],
      pacts: { "7": pact({ id: 7 }) },
    });
    // The signer is the named partner (party2).
    app.address.set(PARTNER);

    await app.signContract({ pactId: "7", stake: 5, stakeRaw: STAKE_BASE });

    // The matching deposit uses the pact's exact stake (read from getPact),
    // not the human-rounded view value, so it always equals party1's lock.
    const depositCall = mock.invoke.mock.calls.find(
      ([op, args]) =>
        op === "transfer" &&
        (args as { value: string }[])[3]?.value === "miniapp-breakup:stake",
    );
    expect(depositCall).toBeTruthy();
    expect((depositCall as [string, { value: string }[]])[1][2]).toEqual({
      type: "Integer",
      value: STAKE_BASE,
    });

    // signPact(pactId, party2) waits on PactSigned.
    const signCall = mock.invoke.mock.calls.find(([op]) => op === "signPact");
    expect(signCall).toBeTruthy();
    const [, signArgs, signOpts] = signCall as [string, { value: string }[], { waitForEvent?: string }];
    expect(signArgs[0]).toEqual({ type: "Integer", value: "7" });
    expect(signOpts.waitForEvent).toBe("PactSigned");
  });

  it("breaks a pact via breakPact(pactId, breaker) where breaker is the connected wallet", async () => {
    const { app, mock } = validApp({
      partyPacts: ["7"],
      pacts: { "7": pact({ id: 7, status: 1, party2Staked: true }) },
    });

    await app.breakContract({ pactId: "7" });

    const breakCall = mock.invoke.mock.calls.find(([op]) => op === "breakPact");
    expect(breakCall).toBeTruthy();
    const [, breakArgs, breakOpts] = breakCall as [string, { type: string; value: string }[], { waitForEvent?: string }];
    expect(breakArgs[0]).toEqual({ type: "Integer", value: "7" });
    expect(breakArgs[1].type).toBe("Hash160"); // breaker = connected wallet
    expect(breakOpts.waitForEvent).toBe("PactBroken");
  });

  it("settles an honored, expired pact via permissionless settlePact(pactId)", async () => {
    const { app, mock } = validApp({
      partyPacts: ["7"],
      // ACTIVE pact already past its endTime -> settleable.
      pacts: { "7": pact({ id: 7, status: 1, party2Staked: true, endTime: Date.now() - 1000 }) },
    });

    // The expired-but-honored ACTIVE pact surfaces a settleable flag.
    await app.loadContracts();
    const listed = app.contracts.get();
    expect(listed[0].settleable).toBe(true);

    await app.settleContract({ pactId: "7" });

    const settleCall = mock.invoke.mock.calls.find(([op]) => op === "settlePact");
    expect(settleCall).toBeTruthy();
    const [, settleArgs, settleOpts] = settleCall as [string, { value: string }[], { waitForEvent?: string }];
    expect(settleArgs[0]).toEqual({ type: "Integer", value: "7" });
    // settlePact is permissionless — no witness arg beyond the id.
    expect(settleArgs).toHaveLength(1);
    expect(settleOpts.waitForEvent).toBe("PactSettled");
  });

  it("maps every getPact status to the right display lifecycle and the staked flags", async () => {
    const now = Date.now();
    const { app } = validApp({
      partyPacts: ["1", "2", "3", "4", "5"],
      pacts: {
        "1": pact({ id: 1, status: 0, party2Staked: false }),                 // pending
        "2": pact({ id: 2, status: 1, party2Staked: true }),                  // active
        "3": pact({ id: 3, status: 2, party2Staked: true }),                  // broken
        "4": pact({ id: 4, status: 3, party2Staked: true, endTime: now - 1 }), // settled -> ended
        "5": pact({ id: 5, status: 4, party2Staked: false }),                 // cancelled -> cancelled
      },
    });

    await app.loadContracts();
    const byId = Object.fromEntries(app.contracts.get().map((c) => [c.pactId, c]));

    expect(byId["1"].status).toBe("pending");
    expect(byId["1"].party1Signed).toBe(true);
    expect(byId["1"].party2Signed).toBe(false);

    expect(byId["2"].status).toBe("active");
    expect(byId["2"].party2Signed).toBe(true);

    expect(byId["3"].status).toBe("broken");
    expect(byId["4"].status).toBe("ended"); // settled (honored to expiry)
    expect(byId["5"].status).toBe("cancelled"); // cancelled (distinct from settled)

    // Counts derive from the mapped statuses.
    expect(app.activeCount.get()).toBe(1);
    expect(app.pendingCount.get()).toBe(1);
    expect(app.brokenCount.get()).toBe(1);
    expect(app.contractCount.get()).toBe(5);
  });

  it("converts the on-chain base-unit stake to whole GAS for display while keeping the raw base units", async () => {
    const { app } = validApp({
      partyPacts: ["7"],
      pacts: { "7": pact({ id: 7, stake: "250000000" }) }, // 2.5 GAS
    });

    await app.loadContracts();
    const c = app.contracts.get()[0];
    expect(c.stake).toBe(2.5);
    expect(c.stakeRaw).toBe("250000000");
  });

  it("falls back to a placeholder title for a foreign pact with no on-device metadata", async () => {
    // A pact the viewer is party2 on, created on another device — no local
    // title/terms entry exists, so the title is the localized placeholder.
    const { app } = validApp({
      partyPacts: ["7"],
      pacts: { "7": pact({ id: 7 }) },
    });
    // Use a fresh app instance whose local store was never written for id 7.
    await app.loadContracts();
    expect(app.contracts.get()[0].title).toBe("Untitled pact");
  });

  it("surfaces a prepaid-credit message when createPact fails after the deposit lands", async () => {
    const { app } = validApp({
      invokeImpl: (op) => {
        if (op === "createPact") throw new Error("ASSERT: pact not pending");
        return undefined; // transfer (deposit) succeeds
      },
    });

    await expect(app.createContract()).rejects.toThrow(
      "Your stake was deposited but the pact was not created.",
    );
    expect(app.actionNotice.get()).toContain("deposited but the pact was not created");
  });

  it("reports a load failure cleanly without throwing", async () => {
    const { chain, mock } = chainMock({ partyPacts: ["1"] });
    mock.readArray.mockImplementation(async () => {
      throw new Error("RPC unreachable");
    });
    const app = useBreakup({ app: frameworkFor(chain), eventBus: { emit: vi.fn() }, t });
    app.address.set(CREATOR);

    await expect(app.loadContracts()).resolves.toBeUndefined();
    expect(app.contracts.get()).toEqual([]);
    expect(app.serviceNotice.get()).toBe("Failed to load contracts");
  });

  it("shows no pacts (and no error) when no wallet is connected", async () => {
    const { chain } = chainMock();
    const app = useBreakup({ app: frameworkFor(chain), eventBus: { emit: vi.fn() }, t });
    app.address.set("");

    await app.loadContracts();
    expect(app.contracts.get()).toEqual([]);
    expect(app.serviceNotice.get()).toBe("");
  });

  it("normalizes the chain-order party hashes and matches the connected wallet (the isParty/Sign-button fix)", async () => {
    // Viewer is the CREATOR (party1). The contract returns the parties as
    // chain-order Hash160s; mapPact must normalize and match them so the creator
    // is recognized as a party and the partner is resolved to the OTHER side.
    const { app } = validApp({
      partyPacts: ["7"],
      pacts: { "7": pact({ id: 7 }) },
    });
    app.address.set(CREATOR);

    await app.loadContracts();
    const c = app.contracts.get()[0];
    expect(c.isCreator).toBe(true);
    expect(c.isPartner).toBe(false);
    // The counterparty (the OTHER party) is the PARTNER, rendered as a real
    // N-address — not the viewer's own truncated script hash (the old bug).
    expect(c.partner).toBe(PARTNER);

    // Switching the wallet to the PARTNER flips the party flags and the shown
    // counterparty becomes the CREATOR.
    app.address.set(PARTNER);
    await app.loadContracts();
    const c2 = app.contracts.get()[0];
    expect(c2.isCreator).toBe(false);
    expect(c2.isPartner).toBe(true);
    expect(c2.partner).toBe(CREATOR);
  });

  it("blocks a non-partner (e.g. the creator) from signing BEFORE any GAS moves", async () => {
    // The creator tapping Sign would deposit a second matching stake then revert
    // (signPact asserts p.Party2 == caller). Reject pre-transfer so the stake
    // never leaves the wrong wallet.
    const { app, mock } = validApp({
      partyPacts: ["7"],
      pacts: { "7": pact({ id: 7 }) },
    });
    app.address.set(CREATOR); // party1, NOT the named partner

    await expect(
      app.signContract({ pactId: "7", stake: 5, stakeRaw: STAKE_BASE }),
    ).rejects.toThrow("Only the named partner can sign this pact.");

    // No transfer (deposit) and no signPact were attempted.
    expect(mock.invoke).not.toHaveBeenCalled();
  });

  it("waits for the Credited event on both stake deposits before consuming the credit", async () => {
    const { app, mock } = validApp({
      events: { createPact: eventState(["7"]) },
      partyPacts: ["7"],
      pacts: { "7": pact({ id: 7 }) },
    });

    await app.createContract();

    const depositCall = mock.invoke.mock.calls.find(
      ([op, args]) =>
        op === "transfer" &&
        (args as { value: string }[])[3]?.value === "miniapp-breakup:stake",
    );
    expect(depositCall).toBeTruthy();
    const [, , depositOpts] = depositCall as [
      string,
      unknown,
      { waitForEvent?: string },
    ];
    // The deposit transfer waits on Credited so createPact never races ahead of
    // the credit landing and faults "insufficient stake credit".
    expect(depositOpts.waitForEvent).toBe("Credited");
  });

  it("reads reclaimable stake-credit (creditOf) and exposes it for recovery", async () => {
    const { app, mock } = validApp({ partyPacts: [], pacts: {} });
    // creditOf returns 3 GAS of stranded credit under the wallet.
    mock.read.mockImplementation(async (op: string) => {
      if (op === "creditOf") return "300000000";
      return null;
    });

    await app.loadCredit();
    expect(app.creditBalance.get()).toBe("3");
    expect(app.creditBalanceRaw.get()).toBe("300000000");
    expect(app.hasCredit.get()).toBe(true);
  });

  it("withdraws stranded credit via withdraw(account) waiting on CreditWithdrawn", async () => {
    const { app, mock } = validApp({ partyPacts: [], pacts: {} });
    mock.read.mockImplementation(async (op: string) => {
      if (op === "creditOf") return "300000000";
      return null;
    });
    await app.loadCredit();

    await app.withdrawCredit();

    const withdrawCall = mock.invoke.mock.calls.find(([op]) => op === "withdraw");
    expect(withdrawCall).toBeTruthy();
    const [, withdrawArgs, withdrawOpts] = withdrawCall as [
      string,
      { type: string; value: string }[],
      { waitForEvent?: string },
    ];
    expect(withdrawArgs[0].type).toBe("Hash160"); // account = connected wallet
    expect(withdrawOpts.waitForEvent).toBe("CreditWithdrawn");
  });

  it("refuses to withdraw when there is no recoverable credit", async () => {
    const { app, mock } = validApp({ partyPacts: [], pacts: {} });
    // creditOf returns 0 -> no recoverable credit.
    await app.loadCredit();
    expect(app.hasCredit.get()).toBe(false);

    await expect(app.withdrawCredit()).rejects.toThrow("No recoverable stake credit.");
    expect(mock.invoke).not.toHaveBeenCalledWith("withdraw", expect.anything(), expect.anything());
  });

  it("createContract resolves true on success so the form only resets on a real success", async () => {
    const { app } = validApp({
      events: { createPact: eventState(["7"]) },
      partyPacts: ["7"],
      pacts: { "7": pact({ id: 7 }) },
    });
    await expect(app.createContract()).resolves.toBe(true);
  });
});
