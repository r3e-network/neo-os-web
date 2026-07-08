/**
 * Custom Anchor setup orchestration (framework-extraction plan §3 Wave 4).
 *
 * The 4-step provisioning sequence is BUSINESS logic and stays app-side; these
 * tests pin the migrated mechanics underneath it:
 *  - every step's write runs on the framework invoke surface (which never
 *    toasts — the flow owns its own workflowStatus copy),
 *  - the un-evented steps are gated by app.chain.waitForState confirmation
 *    polls (fee-credit read after the GAS deposit, AA-core account read after
 *    registerAccounts) instead of the retired shared waitForDepositConfirmation
 *    N3Index poll,
 *  - the wallet network is sourced from app.chain.detectNetwork (the stale
 *    "no framework surface" raw-chain site at main.tsx:424 is gone),
 *  - THE deposit-then-act behavior contract: when the fee deposit lands but a
 *    follow-up step fails, the user still sees the app's localized failure
 *    copy (lastError + workflowFailed) and the stranded-credit recovery lane
 *    (credit readout + recoverCredit/withdrawCredit) keeps working.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "../react";
import { BLOCKCHAIN_CONSTANTS } from "../constants";
import { EXTERNAL_INTEGRATIONS, getMiniAppContractHash } from "../constants/rpc";
import { defaultProfitCandidates } from "../utils/anchor-agents";

const ADDRESS = "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX";
const FEE = "100000000";
/** Chain-order (reversed) hex of a non-zero Hash160 — "account exists". */
const OWNER_HASH_CHAIN_ORDER = "ab".repeat(20);
const ZERO_HASH_CHAIN_ORDER = "0".repeat(40);

const harness = vi.hoisted(() => ({
  definition: null as null | { setup?: (ctx: Record<string, unknown>) => unknown },
}));

vi.mock("@shared/react/defineMiniApp", async () => {
  const actual = await vi.importActual<typeof import("../react/defineMiniApp")>(
    "../react/defineMiniApp",
  );
  return {
    ...actual,
    defineMiniApp: vi.fn((definition: unknown) => {
      harness.definition = definition as {
        setup?: (ctx: Record<string, unknown>) => unknown;
      };
      return { render: vi.fn(), unmount: vi.fn() };
    }),
  };
});

type Ops = string[];

interface ChainScript {
  /** getCredit(GAS) reads AFTER the fee deposit broadcast, oldest first. */
  postDepositGasCredits?: string[];
  /** getCredit(GAS) value before any deposit (and NEO credit always). */
  initialGasCredit?: string;
  /** getBackupOwner responses, oldest first (chain-order hex). */
  backupOwners?: string[];
  /** Reject this operation's invoke with the given error. */
  failInvoke?: { operation: string; error: Error };
}

function buildHarness(script: ChainScript = {}) {
  const ops: Ops = [];
  const invokes: Array<{ operation: string; args: unknown[]; options?: Record<string, unknown> }> = [];
  let depositDone = false;
  let registered = false;
  let withdrawn = false;
  let gasCreditPollIndex = 0;
  let backupOwnerIndex = 0;

  const read = vi.fn(async (operation: string, args?: Array<{ value?: unknown }>) => {
    ops.push(`read:${operation}`);
    switch (operation) {
      case "getAppMode":
        return registered ? 1 : 0;
      case "getCredit": {
        const asset = String(args?.[1]?.value ?? "");
        if (asset === "NEO") return "0";
        if (withdrawn) return "0";
        if (!depositDone) return script.initialGasCredit ?? "0";
        const sequence = script.postDepositGasCredits ?? [FEE];
        const value = sequence[Math.min(gasCreditPollIndex, sequence.length - 1)];
        gasCreditPollIndex += 1;
        return value;
      }
      case "getBackupOwner": {
        const sequence = script.backupOwners ?? [OWNER_HASH_CHAIN_ORDER];
        const value = sequence[Math.min(backupOwnerIndex, sequence.length - 1)];
        backupOwnerIndex += 1;
        return value;
      }
      default:
        return "0";
    }
  });

  const invoke = vi.fn(async (operation: string, args: unknown[], options?: Record<string, unknown>) => {
    ops.push(`invoke:${operation}`);
    invokes.push({ operation, args, options });
    if (script.failInvoke && script.failInvoke.operation === operation) {
      throw script.failInvoke.error;
    }
    if (operation === "transfer") depositDone = true;
    if (operation === "registerCustomAnchorApp") registered = true;
    if (operation === "withdrawCredit") withdrawn = true;
    return { txid: `0x${operation}`, success: true };
  });

  const address = {
    get: () => ADDRESS,
    set: () => undefined,
    subscribe: () => () => undefined,
  };
  const detectNetwork = vi.fn(async () => "testnet");
  const chain = {
    address,
    ensureWallet: vi.fn(async () => ADDRESS),
    read,
    invoke,
    listEvents: vi.fn(async () => []),
    detectNetwork,
  };
  const notify = { error: vi.fn(), success: vi.fn() };
  const registeredActions = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  const ctx: Record<string, unknown> = {
    services: { chain, notify },
    launchContext: { params: {}, network: "testnet" },
    t: (key: string) => key,
    registerAction: (key: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      registeredActions.set(key, handler);
    },
  };
  ctx.framework = createMiniAppFramework(ctx as never, { appId: "miniapp-custom-anchor" });
  return { ctx, ops, invokes, chain, notify, detectNetwork, registeredActions };
}

async function setupApp(script: ChainScript = {}) {
  const built = buildHarness(script);
  const setup = harness.definition?.setup;
  expect(setup).toBeTypeOf("function");
  const result = (await setup?.(built.ctx)) as {
    state: Record<string, { get: () => unknown }>;
    loadData: () => Promise<void>;
  };
  return { ...built, result };
}

const registerPayload = () => ({
  anchorAppId: "custom-anchor:team:nonce",
  mode: 2,
  candidates: defaultProfitCandidates().join("\n"),
});

describe("custom-anchor setup: 4-step provisioning on framework surfaces", () => {
  beforeEach(async () => {
    vi.resetModules();
    harness.definition = null;
    await import("../../custom-anchor/src/main");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the raw service layer out of the app (framework surfaces only)", () => {
    const source = readFileSync(
      resolve(process.cwd(), "..", "custom-anchor", "src", "main.tsx"),
      "utf8",
    );
    expect(source).not.toContain("ctx.services.");
    expect(source).not.toContain("waitForDepositConfirmation");
    expect(source).toContain("ctx.framework.chain.detectNetwork()");
    expect(source).toContain("ctx.framework.chain.waitForState(");
  });

  it("provisions deposit -> register -> accounts -> agents, gating each un-evented step on a waitForState poll", async () => {
    const { ops, invokes, detectNetwork, registeredActions, result } = await setupApp({
      // Deposit lag: first credit poll still short, second covers the fee.
      postDepositGasCredits: ["0", FEE],
      // AA-core lag: first read shows no account, second shows the owner.
      backupOwners: [ZERO_HASH_CHAIN_ORDER, OWNER_HASH_CHAIN_ORDER],
    });
    const register = registeredActions.get("register");
    expect(register).toBeTypeOf("function");

    const pending = register?.(registerPayload());
    await vi.advanceTimersByTimeAsync(0);
    // Precheck read, then the fee deposit — but the register call must NOT
    // fire before the credited fee is confirmed on the contract.
    expect(ops).toEqual(["read:getAppMode", "invoke:transfer"]);
    expect(invokes[0]?.options?.scriptHash).toBe(BLOCKCHAIN_CONSTANTS.GAS_HASH);

    await vi.advanceTimersByTimeAsync(4000); // first credit poll -> "0"
    expect(ops).toEqual(["read:getAppMode", "invoke:transfer", "read:getCredit"]);

    await vi.advanceTimersByTimeAsync(5000); // second poll -> fee confirmed
    expect(ops.slice(3)).toEqual([
      "read:getCredit",
      "invoke:registerCustomAnchorApp",
      "invoke:registerAccounts",
    ]);

    await vi.advanceTimersByTimeAsync(4000); // first AA-core poll -> zero
    expect(ops).toContain("read:getBackupOwner");
    expect(ops).not.toContain("invoke:registerAgents");

    await vi.advanceTimersByTimeAsync(5000); // second poll -> account exists
    await pending;

    expect(ops.slice(0, 9)).toEqual([
      "read:getAppMode",
      "invoke:transfer",
      "read:getCredit",
      "read:getCredit",
      "invoke:registerCustomAnchorApp",
      "invoke:registerAccounts",
      "read:getBackupOwner",
      "read:getBackupOwner",
      "invoke:registerAgents",
    ]);

    // Wallet network came from the framework surface and routed the AA-core
    // calls to the testnet deployment.
    expect(detectNetwork).toHaveBeenCalledTimes(1);
    const accountsCall = invokes.find((call) => call.operation === "registerAccounts");
    expect(accountsCall?.options?.scriptHash).toBe(
      EXTERNAL_INTEGRATIONS.testnet.contracts.aaCore,
    );
    const agentsCall = invokes.find((call) => call.operation === "registerAgents");
    expect(agentsCall?.options?.waitForEvent).toBe("AnchorAgentRegistered");
    expect(agentsCall?.options?.scriptHash).toBe(
      getMiniAppContractHash("miniapp-custom-anchor"),
    );

    expect(result.state.lastTxid?.get()).toBe("0xregisterAgents");
    expect(result.state.workflowStatus?.get()).toBe("statusLoaded");
    expect(result.state.lastError?.get()).toBe("");
    expect(result.state.submitting?.get()).toBe(false);
  });

  it("skips the fee deposit when the wallet already holds the registration credit", async () => {
    const { ops, registeredActions, result } = await setupApp({
      initialGasCredit: FEE,
    });
    // Load credits first so gasCreditRaw reflects the existing fee credit.
    await result.loadData();
    ops.length = 0;

    const pending = registeredActions.get("register")?.(registerPayload());
    await vi.advanceTimersByTimeAsync(0);
    expect(ops).toEqual(["read:getAppMode", "invoke:registerCustomAnchorApp", "invoke:registerAccounts"]);

    await vi.advanceTimersByTimeAsync(4000); // AA-core poll -> account exists
    await pending;

    expect(ops).not.toContain("invoke:transfer");
    expect(result.state.lastTxid?.get()).toBe("0xregisterAgents");
  });

  it("keeps the stranded-credit recovery contract when the deposit lands but the register step fails", async () => {
    const failure = new Error("Insufficient prepaid credit");
    const { ops, invokes, notify, registeredActions, result } = await setupApp({
      postDepositGasCredits: [FEE],
      failInvoke: { operation: "registerCustomAnchorApp", error: failure },
    });

    const pending = registeredActions.get("register")?.(registerPayload());
    await vi.advanceTimersByTimeAsync(0);
    expect(ops).toContain("invoke:transfer"); // the deposit DID land
    await vi.advanceTimersByTimeAsync(4000); // credit poll confirms the fee
    const outcome = await pending;

    // The action wrapper reports the mapped error (framework notify) and the
    // app surfaces its own localized failure copy — byte-identical branch.
    expect(outcome).toBeUndefined();
    expect(notify.error).toHaveBeenCalledWith(failure, undefined);
    expect(result.state.lastError?.get()).toBe("Insufficient prepaid credit");
    expect(result.state.workflowStatus?.get()).toBe("workflowFailed");
    expect(result.state.submitting?.get()).toBe(false);

    // The stranded fee stays visible and recoverable: credits reload from the
    // contract and the withdrawCredit lane still fires with the full amount.
    await result.loadData();
    expect(result.state.gasCredit?.get()).toBe("1");

    await registeredActions.get("recoverCredit")?.("GAS");
    const withdraw = invokes.find((call) => call.operation === "withdrawCredit");
    expect(withdraw).toBeTruthy();
    expect(withdraw?.args?.[2]).toEqual({ type: "Integer", value: FEE });
    expect(result.state.workflowStatus?.get()).toBe("recoverSubmitted");
    expect(result.state.gasCredit?.get()).toBe("0");
  });
});
