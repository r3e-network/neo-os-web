/**
 * Production orchestration tests for Custom Anchor.
 *
 * These tests pin the durable write contract: storage is proven before the
 * first wallet call, txids are captured at broadcast time, unknown outcomes
 * remain pending, and a confirmed registration advances through fee -> anchor
 * -> AA accounts -> agent binding without replaying an earlier stage.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "../react";
import { BLOCKCHAIN_CONSTANTS } from "../constants";
import { defaultProfitCandidates } from "../utils/anchor-agents";
import {
  CUSTOM_ANCHOR_BINDINGS,
  CUSTOM_ANCHOR_PENDING_KEY,
} from "../../custom-anchor/src/anchor-production";

const ADDRESS = "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX";
const FEE = "100000000";

const harness = vi.hoisted(() => ({
  definition: null as null | { setup?: (ctx: Record<string, unknown>) => unknown },
  outcome: "unknown" as "unknown" | "halt" | "fault",
  eventMatch: true,
}));

vi.mock("@shared/react/defineMiniApp", async () => {
  const actual = await vi.importActual<typeof import("../react/defineMiniApp")>("../react/defineMiniApp");
  return {
    ...actual,
    defineMiniApp: vi.fn((definition: unknown) => {
      harness.definition = definition as { setup?: (ctx: Record<string, unknown>) => unknown };
      return { render: vi.fn(), unmount: vi.fn() };
    }),
  };
});

vi.mock("../../custom-anchor/src/anchor-production", async () => {
  const actual = await vi.importActual<typeof import("../../custom-anchor/src/anchor-production")>(
    "../../custom-anchor/src/anchor-production",
  );
  return {
    ...actual,
    readAnchorTransactionOutcome: vi.fn(async () => ({ state: harness.outcome, notifications: [] })),
    pendingAnchorEventsMatch: vi.fn(() => harness.eventMatch),
  };
});

interface HarnessScript {
  malformedMode?: boolean;
  malformedCredit?: boolean;
  existingGasCredit?: boolean;
  rejectWallet?: boolean;
}

function reverseHash(hash: string): string {
  return `0x${(hash.replace(/^0x/, "").match(/../g) ?? []).reverse().join("")}`;
}

function buildHarness(script: HarnessScript = {}) {
  const ops: string[] = [];
  const invokes: Array<{ operation: string; args: Array<{ type?: string; value?: unknown }>; options?: Record<string, unknown> }> = [];
  const registeredActions = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  let feeCredited = Boolean(script.existingGasCredit);
  let registered = false;
  let accountsRegistered = false;
  let agentsRegistered = false;
  let agentAccounts: string[] = [];
  let candidates: string[] = [];
  let txIndex = 1;

  const read = vi.fn(async (operation: string, args?: Array<{ value?: unknown }>) => {
    ops.push(`read:${operation}`);
    if (operation === "getAppMode") return script.malformedMode ? { nope: true } : registered ? 2 : 0;
    if (operation === "getCredit") {
      if (script.malformedCredit) return { type: "Integer", value: "bad" };
      const asset = String(args?.[1]?.value ?? "");
      return asset === "GAS" && feeCredited && !registered ? FEE : "0";
    }
    if (operation === "getAppAdmin") return ADDRESS;
    if (operation === "getBackupOwner") return accountsRegistered ? ADDRESS : `0x${"0".repeat(40)}`;
    if (operation === "getAgentCount") return agentsRegistered ? 21 : 0;
    if (operation === "getAgentAccount") {
      const index = Number(args?.[1]?.value ?? 0) - 1;
      return reverseHash(agentAccounts[index] ?? `0x${"0".repeat(40)}`);
    }
    if (operation === "getAgentCandidate") {
      const index = Number(args?.[1]?.value ?? 0) - 1;
      return `0x${candidates[index] ?? ""}`;
    }
    if (operation === "getTotalStaked") return "0";
    if (operation === "getRewardReserve") return "0";
    if (operation === "getRewardPerNeo") return "0";
    if (operation === "getUserStake") return "0";
    if (operation === "getPendingRewards") return "0";
    return "0";
  });

  const invoke = vi.fn(async (
    operation: string,
    args: Array<{ type?: string; value?: unknown }>,
    options?: Record<string, unknown>,
  ) => {
    ops.push(`invoke:${operation}`);
    invokes.push({ operation, args, options });
    if (script.rejectWallet) {
      throw Object.assign(new Error("User rejected the request"), { code: 4001 });
    }
    const txid = `0x${txIndex.toString(16).padStart(64, "0")}`;
    txIndex += 1;
    (options?.onTransactionSent as ((txid: string) => void) | undefined)?.(txid);
    if (operation === "transfer" && options?.scriptHash === BLOCKCHAIN_CONSTANTS.GAS_HASH) feeCredited = true;
    if (operation === "registerCustomAnchorApp") registered = true;
    if (operation === "registerAccounts") accountsRegistered = true;
    if (operation === "registerAgents") {
      agentsRegistered = true;
      agentAccounts = ((args[1]?.value ?? []) as Array<{ value?: unknown }>).map((entry) => String(entry.value ?? ""));
      candidates = ((args[2]?.value ?? []) as Array<{ value?: unknown }>).map((entry) => String(entry.value ?? ""));
    }
    return { txid, success: true };
  });

  const chain = {
    address: { get: () => ADDRESS, set: () => undefined, subscribe: () => () => undefined },
    ensureWallet: vi.fn(async () => ADDRESS),
    read,
    invoke,
    listEvents: vi.fn(async () => []),
    detectNetwork: vi.fn(async () => "testnet"),
  };
  const ctx: Record<string, unknown> = {
    services: { chain, notify: { error: vi.fn(), success: vi.fn() } },
    launchContext: { params: { anchorAppId: "custom-anchor:team:nonce" }, network: "testnet" },
    t: (key: string) => key,
    registerAction: (key: string, handler: (...args: unknown[]) => Promise<unknown>) => registeredActions.set(key, handler),
  };
  ctx.framework = createMiniAppFramework(ctx as never, { appId: "miniapp-custom-anchor" });
  return { ctx, ops, invokes, registeredActions };
}

async function setupApp(script: HarnessScript = {}) {
  const built = buildHarness(script);
  const setup = harness.definition?.setup;
  expect(setup).toBeTypeOf("function");
  const result = await setup?.(built.ctx) as {
    state: Record<string, { get: () => unknown }>;
    loadData: () => Promise<void>;
  };
  return { ...built, result };
}

const registration = () => ({
  anchorAppId: "custom-anchor:team:nonce",
  mode: 2,
  candidates: defaultProfitCandidates().join("\n"),
});

describe("custom-anchor production orchestration", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    harness.definition = null;
    harness.outcome = "unknown";
    harness.eventMatch = true;
    await import("../../custom-anchor/src/main");
  });

  afterEach(() => localStorage.clear());

  it("uses pinned contexts, durable tx capture, and exact outcome recovery surfaces", () => {
    const source = readFileSync(
      resolve(
        process.cwd().endsWith("/apps/shared") ? process.cwd() : resolve(process.cwd(), "apps/shared"),
        "../custom-anchor/src/main.tsx",
      ),
      "utf8",
    );
    expect(source).toContain("CUSTOM_ANCHOR_BINDINGS");
    expect(source).toContain("assertAnchorStorage(storage)");
    expect(source).toContain("onTransactionSent");
    expect(source).toContain("readAnchorTransactionOutcome");
    expect(source).toContain("pendingAnchorEventsMatch");
    expect(source).not.toContain("waitForState(");
    expect(source).not.toContain("ctx.services.");
  });

  // The property under test is that an unresolved read never masquerades as a
  // real 0 — not the glyph it renders as. The value stays empty and the status
  // carries the meaning; the PlayArea turns that into a skeleton or honest
  // zero-state copy (never an em-dash).
  it("does not turn a malformed chain read into a zero-value anchor", async () => {
    const { result } = await setupApp({ malformedMode: true });
    await result.loadData();
    expect(result.state.anchorMode.get()).toBe(-1);
    expect(result.state.totalStaked.get()).toBe("");
    expect(result.state.totalStaked.get()).not.toBe("0");
    expect(result.state.dataStatus.get()).toBe("unavailable");
  });

  it("surfaces malformed credit reads as unavailable instead of zero", async () => {
    const { result } = await setupApp({ malformedCredit: true });
    await result.loadData();
    expect(result.state.neoCredit.get()).toBe("");
    expect(result.state.gasCredit.get()).toBe("");
    expect(result.state.neoCredit.get()).not.toBe("0");
    expect(result.state.gasCredit.get()).not.toBe("0");
    expect(result.state.creditStatus.get()).toBe("unavailable");
  });

  it("persists an unknown fee transaction and never replays it on resume", async () => {
    const { invokes, registeredActions, result } = await setupApp();
    await registeredActions.get("register")?.(registration());

    expect(invokes.map((entry) => entry.operation)).toEqual(["transfer"]);
    const pending = result.state.pendingOperation.get() as {
      stage: string; phase: string; txid: string; network: string; contractHash: string; walletHash: string;
    };
    expect(pending).toMatchObject({
      stage: "register-fee",
      phase: "broadcast",
      txid: `0x${"1".padStart(64, "0")}`,
      network: "testnet",
      contractHash: CUSTOM_ANCHOR_BINDINGS.testnet.contractHash,
    });
    expect(pending.walletHash).toMatch(/^0x[0-9a-f]{40}$/);
    await registeredActions.get("resumePending")?.();
    expect(invokes.map((entry) => entry.operation)).toEqual(["transfer"]);
    expect(result.state.pendingState.get()).toBe("pending");
    expect(localStorage.length).toBeGreaterThan(0);
    expect([...Array(localStorage.length)].map((_, index) => localStorage.key(index))).toEqual(
      expect.arrayContaining([expect.stringContaining(CUSTOM_ANCHOR_PENDING_KEY)]),
    );
  });

  it("clears a definite wallet rejection because no transaction was broadcast", async () => {
    const { invokes, registeredActions, result } = await setupApp({ rejectWallet: true });
    await registeredActions.get("register")?.(registration());
    expect(invokes.map((entry) => entry.operation)).toEqual(["transfer"]);
    expect(result.state.pendingOperation.get()).toBeNull();
    expect(result.state.pendingState.get()).toBe("none");
    expect(result.state.workflowStatus.get()).toBe("workflowFailed");
  });

  it("advances confirmed registration fee -> anchor -> AA accounts -> 21-agent binding", async () => {
    harness.outcome = "halt";
    const { invokes, registeredActions, result } = await setupApp();
    await registeredActions.get("register")?.(registration());

    expect(invokes.map((entry) => entry.operation)).toEqual([
      "transfer",
      "registerCustomAnchorApp",
      "registerAccounts",
      "registerAgents",
    ]);
    expect(invokes[0]?.options?.scriptHash).toBe(BLOCKCHAIN_CONSTANTS.GAS_HASH);
    expect(invokes[1]?.options?.scriptHash).toBe(CUSTOM_ANCHOR_BINDINGS.testnet.contractHash);
    expect(invokes[2]?.options?.waitForEvent).toBe("AccountRegistered");
    expect(invokes[3]?.options?.waitForEvent).toBe("AnchorAgentRegistered");
    expect(result.state.pendingOperation.get()).toBeNull();
    expect(result.state.pendingState.get()).toBe("confirmed");
    expect(result.state.workflowStatus.get()).toBe("statusLoaded");
  });
});
