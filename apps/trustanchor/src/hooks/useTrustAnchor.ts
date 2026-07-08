/**
 * useTrustAnchor -- React hook for TrustAnchor operator logic.
 *
 * TrustAnchor uses explicit admin-operated AA agent routing. Rebalancing
 * is a deliberate transfer between candidate agents, never an auto strategy.
 *
 * All on-chain reads/writes go through the MiniApp framework SDK (ctx.framework).
 */

import { createObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { BLOCKCHAIN_CONSTANTS, TOKEN_CONSTANTS } from "@shared/constants";
import { getMiniAppContractHash } from "@shared/constants/rpc";
import { addressToScriptHash, parseHash160 } from "@shared/utils/neo";

const APP_ID = "miniapp-trustanchor";
const GAS_DECIMALS = TOKEN_CONSTANTS.GAS_MULTIPLIER;

export interface TrustAnchorStats {
  totalStaked: number;
  rewardReserve: number;
  agentCount: number;
  rps: string;
  selectedAgentId?: number;
}

/** On-chain agent record from getAgent(appId, id). */
export interface AnchorAgent {
  agentId: number;
  account: string;
  candidate: string;
  active: boolean;
}

/** Resolved admin authority for the app, from admin() + getAppAdmin(appId). */
export interface AnchorAdminInfo {
  platformAdmin: string;
  appAdmin: string;
}

export interface UseTrustAnchorOptions {
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

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

function normalizeWholeNeo(input: unknown, t: Translate): number {
  const amount = Number(input);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error(t("invalidAmount"));
  }
  return amount;
}

function normalizeAgentId(input: unknown, t: Translate): number {
  const id = Number(input);
  if (!Number.isInteger(id) || id < 1 || id > 21) {
    throw new Error(t("invalidAgentId"));
  }
  return id;
}

function normalizePublicKey(input: unknown, t: Translate): string {
  const value = String(input ?? "")
    .trim()
    .replace(/^0x/i, "");
  if (!/^(02|03)[0-9a-f]{64}$/i.test(value)) {
    throw new Error(t("invalidCandidateKey"));
  }
  return value;
}

function normalizeHex(input: unknown, t: Translate): string {
  const value = String(input ?? "")
    .trim()
    .replace(/^0x/i, "");
  if (!/^[0-9a-f]*$/i.test(value) || value.length % 2 !== 0) {
    throw new Error(t("invalidVerificationHash"));
  }
  return value;
}

function normalizeHash160OrAddress(input: unknown, t: Translate): string {
  const value = String(input ?? "").trim();
  if (
    /^0x[0-9a-f]{40}$/i.test(value) ||
    /^[0-9a-f]{40}$/i.test(value) ||
    /^N[A-HJ-NP-Za-km-z1-9]{33}$/.test(value)
  ) {
    return value;
  }
  throw new Error(t("invalidAgentAccount"));
}

export function useTrustAnchor({ app, t }: UseTrustAnchorOptions) {
  const isLoading = createObservable(false);
  const error = createObservable<string | null>(null);
  const myStake = createObservable(0);
  const pendingRewards = createObservable(0);
  const pendingWithdraw = createObservable(0);
  const stats = createObservable<TrustAnchorStats | null>(null);
  const agents = createObservable<AnchorAgent[]>([]);
  const adminInfo = createObservable<AnchorAdminInfo | null>(null);
  const anchorOptions = <T extends Record<string, unknown>>(options?: T) => {
    const scriptHash = getMiniAppContractHash(APP_ID);
    return { ...(options ?? {}), ...(scriptHash ? { scriptHash } : {}) };
  };

  const loadMyStake = async () => {
    const addr = app.chain.address.get();
    if (!addr) {
      myStake.set(0);
      return;
    }
    try {
      const result = await app.chain.readRaw("getUserStake", [
        app.chain.arg.string(APP_ID),
        app.chain.arg.hash160(addr),
      ], anchorOptions());
      myStake.set(asNumber(result));
    } catch (e) {
      console.warn(
        "[useTrustAnchor] loadMyStake failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  const loadPendingRewards = async () => {
    const addr = app.chain.address.get();
    if (!addr) {
      pendingRewards.set(0);
      return;
    }
    try {
      const result = await app.chain.readRaw("getPendingRewards", [
        app.chain.arg.string(APP_ID),
        app.chain.arg.hash160(addr),
      ], anchorOptions());
      pendingRewards.set(asNumber(result) / GAS_DECIMALS);
    } catch (e) {
      console.warn(
        "[useTrustAnchor] loadPendingRewards failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  const loadPendingWithdraw = async () => {
    const addr = app.chain.address.get();
    if (!addr) {
      pendingWithdraw.set(0);
      return;
    }
    try {
      const result = await app.chain.readRaw("getCredit", [
        app.chain.arg.hash160(addr),
        app.chain.arg.string("NEO"),
      ], anchorOptions());
      pendingWithdraw.set(asNumber(result));
    } catch (e) {
      console.warn(
        "[useTrustAnchor] loadPendingWithdraw failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  const loadStats = async () => {
    try {
      const result = await app.chain.readRaw("getAnchorStats", [
        app.chain.arg.string(APP_ID),
      ], anchorOptions());
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
        "[useTrustAnchor] loadStats failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  // Ground-truth admin authority: admin() is the platform operator, getAppAdmin
  // is the per-app operator. Either witness authorizes the admin console paths.
  const loadAdmin = async () => {
    try {
      const [platform, appAdminRaw] = await Promise.all([
        app.chain.readRaw("admin", [], anchorOptions()),
        app.chain.readRaw(
          "getAppAdmin",
          [app.chain.arg.string(APP_ID)],
          anchorOptions(),
        ),
      ]);
      adminInfo.set({
        platformAdmin: parseHash160(platform),
        appAdmin: parseHash160(appAdminRaw),
      });
    } catch (e) {
      console.warn(
        "[useTrustAnchor] loadAdmin failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  // On-chain agent directory: getAgent(appId, id) for 1..agentCount. Replaces
  // the static compile-time roster so candidate/account rotations show as truth.
  const loadAgents = async () => {
    try {
      const count = asNumber(
        await app.chain.readRaw(
          "getAgentCount",
          [app.chain.arg.string(APP_ID)],
          anchorOptions(),
        ),
      );
      if (!Number.isInteger(count) || count <= 0) {
        agents.set([]);
        return;
      }
      const reads = [];
      for (let id = 1; id <= count; id += 1) {
        reads.push(
          app.chain.readRaw(
            "getAgent",
            [
              app.chain.arg.string(APP_ID),
              app.chain.arg.integer(id),
            ],
            anchorOptions(),
          ),
        );
      }
      const results = await Promise.all(reads);
      agents.set(
        results.map((result, idx) => ({
          agentId: asNumber(asMapValue(result, "agentId")) || idx + 1,
          account: parseHash160(asMapValue(result, "account")),
          candidate: String(asMapValue(result, "candidate") ?? ""),
          active: Boolean(valueOf(asMapValue(result, "active"))),
        })),
      );
    } catch (e) {
      console.warn(
        "[useTrustAnchor] loadAgents failed:",
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
        loadAdmin(),
        loadAgents(),
      ]);
    } finally {
      isLoading.set(false);
    }
  };

  // Compare the connected wallet against on-chain admin authority. Returns
  // null while admin info is still loading (caller renders a neutral state).
  const isAdmin = (): boolean | null => {
    const info = adminInfo.get();
    if (!info) return null;
    const addr = app.chain.address.get();
    if (!addr) return false;
    const myHash = addressToScriptHash(addr).toLowerCase();
    if (!myHash) return false;
    return (
      myHash === info.platformAdmin.toLowerCase() ||
      myHash === info.appAdmin.toLowerCase()
    );
  };

  const stakeNeo = async (amountInput: unknown) => {
    const user = await app.chain.ensureWallet();
    const contract = getMiniAppContractHash(APP_ID) || app.chain.contractAddress.get();
    if (!contract) throw new Error(t("missingContract"));
    const amount = normalizeWholeNeo(amountInput, t);
    const result = await app.chain.invoke(
      "transfer",
      [
        app.chain.arg.hash160(user),
        app.chain.arg.hash160(contract),
        app.chain.arg.integer(amount),
        app.chain.arg.string(`stake:${APP_ID}`),
      ],
      {
        scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
        waitForEvent: "AnchorStakeChanged",
        waitTimeoutMs: 30_000,
      },
    );
    await loadAll();
    return result;
  };

  const withdrawNeo = async (amountInput: unknown) => {
    const user = await app.chain.ensureWallet();
    const amount = normalizeWholeNeo(amountInput, t);
    const result = await app.chain.invoke(
      "withdraw",
      [
        app.chain.arg.string(APP_ID),
        app.chain.arg.hash160(user),
        app.chain.arg.integer(amount),
      ],
      {
        ...anchorOptions(),
        waitForEvent: "AnchorStakeChanged",
        waitTimeoutMs: 30_000,
      },
    );
    await loadAll();
    return result;
  };

  const claimRewards = async () => {
    const user = await app.chain.ensureWallet();
    const result = await app.chain.invoke(
      "claimRewards",
      [
        app.chain.arg.string(APP_ID),
        app.chain.arg.hash160(user),
      ],
      {
        ...anchorOptions(),
        waitForEvent: "AnchorRewardsClaimed",
        waitTimeoutMs: 30_000,
      },
    );
    await loadAll();
    return result;
  };

  // Recover a bare NEO deposit that landed as credit (a NEO transfer without
  // the "stake:<appId>" memo). withdrawCredit(user,"NEO",amount) is witness-
  // gated to the user and transfers the NEO back from the contract balance.
  const recoverNeoCredit = async () => {
    const user = await app.chain.ensureWallet();
    const amount = pendingWithdraw.get();
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error(t("invalidAmount"));
    }
    const result = await app.chain.invoke(
      "withdrawCredit",
      [
        app.chain.arg.hash160(user),
        app.chain.arg.string("NEO"),
        app.chain.arg.integer(amount),
      ],
      anchorOptions(),
    );
    await loadAll();
    return result;
  };

  const transferAgentNeo = async (
    fromAgentIdInput: unknown,
    toAgentIdInput: unknown,
    amountInput: unknown,
  ) => {
    await app.chain.ensureWallet();
    const fromAgentId = normalizeAgentId(fromAgentIdInput, t);
    const toAgentId = normalizeAgentId(toAgentIdInput, t);
    const amount = normalizeWholeNeo(amountInput, t);
    if (fromAgentId === toAgentId) throw new Error(t("sameAgent"));
    await app.chain.invoke(
      "transferAgentNeo",
      [
        app.chain.arg.string(APP_ID),
        app.chain.arg.integer(fromAgentId),
        app.chain.arg.integer(toAgentId),
        app.chain.arg.integer(amount),
      ],
      anchorOptions(),
    );
    await loadAll();
  };

  const setAgentCandidate = async (
    agentIdInput: unknown,
    candidateInput: unknown,
  ) => {
    await app.chain.ensureWallet();
    const agentId = normalizeAgentId(agentIdInput, t);
    const candidate = normalizePublicKey(candidateInput, t);
    await app.chain.invoke(
      "setAgentCandidate",
      [
        app.chain.arg.string(APP_ID),
        app.chain.arg.integer(agentId),
        app.chain.arg.publicKey(candidate),
      ],
      anchorOptions(),
    );
    await loadAll();
  };

  const voteAgent = async (agentIdInput: unknown) => {
    await app.chain.ensureWallet();
    const agentId = normalizeAgentId(agentIdInput, t);
    await app.chain.invoke(
      "voteAgent",
      [
        app.chain.arg.string(APP_ID),
        app.chain.arg.integer(agentId),
      ],
      anchorOptions(),
    );
    await loadAll();
  };

  const registerAgent = async (
    agentAccountInput: unknown,
    candidateInput: unknown,
    verificationScriptHashInput: unknown,
  ) => {
    await app.chain.ensureWallet();
    const agentAccount = normalizeHash160OrAddress(agentAccountInput, t);
    const candidate = normalizePublicKey(candidateInput, t);
    const verificationScriptHash = normalizeHex(verificationScriptHashInput, t);
    await app.chain.invoke(
      "registerAgent",
      [
        app.chain.arg.string(APP_ID),
        app.chain.arg.hash160(agentAccount),
        app.chain.arg.publicKey(candidate),
        app.chain.arg.byteArray(verificationScriptHash),
      ],
      anchorOptions(),
    );
    await loadAll();
  };

  return {
    isLoading,
    error,
    myStake,
    pendingRewards,
    pendingWithdraw,
    stats,
    agents,
    adminInfo,
    isAdmin,
    loadAll,
    stakeNeo,
    withdrawNeo,
    claimRewards,
    recoverNeoCredit,
    transferAgentNeo,
    setAgentCandidate,
    voteAgent,
    registerAgent,
  };
}
