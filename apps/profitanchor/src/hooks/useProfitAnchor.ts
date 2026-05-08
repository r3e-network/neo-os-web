/**
 * useProfitAnchor -- React hook for ProfitAnchor operator logic.
 *
 * ProfitAnchor is intentionally manual: operators rebalance NEO between
 * AA candidate agents and sync votes explicitly. The operator chooses the route.
 */

import { createObservable } from "@shared/react/context";
import type { ChainService, EventBus } from "@shared/services";
import { BLOCKCHAIN_CONSTANTS, TOKEN_CONSTANTS } from "@shared/constants";

const APP_ID = "miniapp-profitanchor";
const GAS_DECIMALS = TOKEN_CONSTANTS.GAS_MULTIPLIER;

export interface ProfitAnchorStats {
  totalStaked: number;
  rewardReserve: number;
  agentCount: number;
  rps: string;
  selectedAgentId?: number;
}

export interface UseProfitAnchorOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

type StackLike = { value?: unknown; key?: unknown };

function valueOf(input: unknown): unknown {
  if (input && typeof input === "object" && "value" in input) {
    return valueOf((input as StackLike).value);
  }
  return input;
}

function asNumber(input: unknown): number {
  const value = valueOf(input);
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

function asMapValue(input: unknown, key: string): unknown {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  if (key in record) return record[key];
  if (Array.isArray(record.value)) {
    for (const entry of record.value as StackLike[]) {
      if (String(valueOf(entry.key)) === key) return valueOf(entry.value);
    }
  }
  if (Array.isArray(input)) {
    for (const entry of input as StackLike[]) {
      if (String(valueOf(entry.key)) === key) return valueOf(entry.value);
    }
  }
  if ("value" in record) return asMapValue(record.value, key);
  return undefined;
}

function normalizeWholeNeo(input: unknown): number {
  const amount = Number(input);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error("NEO is indivisible -- enter a positive whole number.");
  }
  return amount;
}

function normalizeAgentId(input: unknown): number {
  const id = Number(input);
  if (!Number.isInteger(id) || id < 1 || id > 21) {
    throw new Error("Agent id must be an integer from 1 to 21.");
  }
  return id;
}

function normalizePublicKey(input: unknown): string {
  const value = String(input ?? "")
    .trim()
    .replace(/^0x/i, "");
  if (!/^(02|03)[0-9a-f]{64}$/i.test(value)) {
    throw new Error("Candidate must be a 33-byte compressed public key.");
  }
  return value;
}

function normalizeHex(input: unknown, label: string): string {
  const value = String(input ?? "")
    .trim()
    .replace(/^0x/i, "");
  if (!/^[0-9a-f]*$/i.test(value) || value.length % 2 !== 0) {
    throw new Error(`${label} must be even-length hex.`);
  }
  return value;
}

function normalizeHash160OrAddress(input: unknown, label: string): string {
  const value = String(input ?? "").trim();
  if (
    /^0x[0-9a-f]{40}$/i.test(value) ||
    /^[0-9a-f]{40}$/i.test(value) ||
    /^N[A-HJ-NP-Za-km-z1-9]{33}$/.test(value)
  ) {
    return value;
  }
  throw new Error(`${label} must be a Neo address or Hash160.`);
}

export function useProfitAnchor({ chain, eventBus }: UseProfitAnchorOptions) {
  const isLoading = createObservable(false);
  const error = createObservable<string | null>(null);
  const myStake = createObservable(0);
  const pendingRewards = createObservable(0);
  const pendingWithdraw = createObservable(0);
  const stats = createObservable<ProfitAnchorStats | null>(null);

  const loadMyStake = async () => {
    const addr = chain.address.get();
    if (!addr) {
      myStake.set(0);
      return;
    }
    try {
      const result = await chain.read("getUserStake", [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: addr },
      ]);
      myStake.set(asNumber(result));
    } catch (e) {
      console.warn(
        "[useProfitAnchor] loadMyStake failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  const loadPendingRewards = async () => {
    const addr = chain.address.get();
    if (!addr) {
      pendingRewards.set(0);
      return;
    }
    try {
      const result = await chain.read("getPendingRewards", [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: addr },
      ]);
      pendingRewards.set(asNumber(result) / GAS_DECIMALS);
    } catch (e) {
      console.warn(
        "[useProfitAnchor] loadPendingRewards failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  const loadPendingWithdraw = async () => {
    const addr = chain.address.get();
    if (!addr) {
      pendingWithdraw.set(0);
      return;
    }
    try {
      const result = await chain.read("getCredit", [
        { type: "Hash160", value: addr },
        { type: "String", value: "NEO" },
      ]);
      pendingWithdraw.set(asNumber(result));
    } catch (e) {
      console.warn(
        "[useProfitAnchor] loadPendingWithdraw failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  const loadStats = async () => {
    try {
      const result = await chain.read("getAnchorStats", [
        { type: "String", value: APP_ID },
      ]);
      stats.set({
        totalStaked: asNumber(asMapValue(result, "totalStaked")),
        rewardReserve:
          asNumber(asMapValue(result, "rewardReserve")) / GAS_DECIMALS,
        agentCount: asNumber(asMapValue(result, "agentCount")),
        rps: String(asNumber(asMapValue(result, "rewardPerNeo"))),
        selectedAgentId: asNumber(asMapValue(result, "selectedAgentId")),
      });
    } catch (e) {
      console.warn(
        "[useProfitAnchor] loadStats failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  const loadAll = async () => {
    isLoading.set(true);
    error.set(null);
    try {
      await Promise.all([
        loadMyStake(),
        loadPendingRewards(),
        loadPendingWithdraw(),
        loadStats(),
      ]);
    } finally {
      isLoading.set(false);
    }
  };

  const stakeNeo = async (amountInput: unknown) => {
    const user = await chain.ensureWallet();
    const contract = chain.contractAddress.get();
    if (!contract)
      throw new Error("PlatformAnchor contract is not configured.");
    const amount = normalizeWholeNeo(amountInput);
    await chain.invoke(
      "transfer",
      [
        { type: "Hash160", value: user },
        { type: "Hash160", value: contract },
        { type: "Integer", value: amount },
        { type: "String", value: APP_ID },
      ],
      {
        scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
        waitForEvent: "AnchorStakeChanged",
        waitTimeoutMs: 30_000,
      },
    );
    eventBus.emit("anchor:staked", { appId: APP_ID, amount });
    await loadAll();
  };

  const withdrawNeo = async (amountInput: unknown) => {
    const user = await chain.ensureWallet();
    const amount = normalizeWholeNeo(amountInput);
    await chain.invoke(
      "withdraw",
      [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: user },
        { type: "Integer", value: amount },
      ],
      {
        waitForEvent: "AnchorStakeChanged",
        waitTimeoutMs: 30_000,
      },
    );
    eventBus.emit("anchor:withdrawn", { appId: APP_ID, amount });
    await loadAll();
  };

  const claimRewards = async () => {
    const user = await chain.ensureWallet();
    await chain.invoke(
      "claimRewards",
      [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: user },
      ],
      {
        waitForEvent: "AnchorRewardsClaimed",
        waitTimeoutMs: 30_000,
      },
    );
    eventBus.emit("anchor:rewards-claimed", { appId: APP_ID });
    await loadAll();
  };

  const transferAgentNeo = async (
    fromAgentIdInput: unknown,
    toAgentIdInput: unknown,
    amountInput: unknown,
  ) => {
    await chain.ensureWallet();
    const fromAgentId = normalizeAgentId(fromAgentIdInput);
    const toAgentId = normalizeAgentId(toAgentIdInput);
    const amount = normalizeWholeNeo(amountInput);
    if (fromAgentId === toAgentId)
      throw new Error("Choose two different agents.");
    await chain.invoke("transferAgentNeo", [
      { type: "String", value: APP_ID },
      { type: "Integer", value: fromAgentId },
      { type: "Integer", value: toAgentId },
      { type: "Integer", value: amount },
    ]);
    eventBus.emit("anchor:agent-transfer", {
      appId: APP_ID,
      fromAgentId,
      toAgentId,
      amount,
    });
    await loadAll();
  };

  const setAgentCandidate = async (
    agentIdInput: unknown,
    candidateInput: unknown,
  ) => {
    await chain.ensureWallet();
    const agentId = normalizeAgentId(agentIdInput);
    const candidate = normalizePublicKey(candidateInput);
    await chain.invoke("setAgentCandidate", [
      { type: "String", value: APP_ID },
      { type: "Integer", value: agentId },
      { type: "PublicKey", value: candidate },
    ]);
    eventBus.emit("anchor:candidate-updated", {
      appId: APP_ID,
      agentId,
      candidate,
    });
    await loadAll();
  };

  const voteAgent = async (agentIdInput: unknown) => {
    await chain.ensureWallet();
    const agentId = normalizeAgentId(agentIdInput);
    await chain.invoke("voteAgent", [
      { type: "String", value: APP_ID },
      { type: "Integer", value: agentId },
    ]);
    eventBus.emit("anchor:agent-voted", { appId: APP_ID, agentId });
    await loadAll();
  };

  const registerAgent = async (
    agentAccountInput: unknown,
    candidateInput: unknown,
    verificationScriptHashInput: unknown,
  ) => {
    await chain.ensureWallet();
    const agentAccount = normalizeHash160OrAddress(
      agentAccountInput,
      "Agent account",
    );
    const candidate = normalizePublicKey(candidateInput);
    const verificationScriptHash = normalizeHex(
      verificationScriptHashInput,
      "Verification script hash",
    );
    await chain.invoke("registerAgent", [
      { type: "String", value: APP_ID },
      { type: "Hash160", value: agentAccount },
      { type: "PublicKey", value: candidate },
      { type: "ByteArray", value: verificationScriptHash },
    ]);
    eventBus.emit("anchor:agent-registered", {
      appId: APP_ID,
      agentAccount,
      candidate,
    });
    await loadAll();
  };

  return {
    isLoading,
    error,
    myStake,
    pendingRewards,
    pendingWithdraw,
    stats,
    loadAll,
    stakeNeo,
    withdrawNeo,
    claimRewards,
    transferAgentNeo,
    setAgentCandidate,
    voteAgent,
    registerAgent,
  };
}
