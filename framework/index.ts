import { createObservable, type Observable } from "./reactive";
import { addressToScriptHash } from "./utils/neo";
import {
  createLocalStorageRewardGameStorage,
  expireRewardGame,
  finalizeRewardGame,
  fixed8ToGasString,
  observeRewardGameSettlement,
  openRewardGameSession,
  readRewardGameSnapshot,
  recoverActiveRewardGame,
  recordRewardGameOp,
  refreshRewardGameBalances,
  replayRewardGameOps,
  rewardGameModeOf,
  startRewardGame,
  withdrawRewardCredit,
} from "./gamefi";
import type { RewardGameConfig, RewardGameSession, RewardGameStorage } from "./gamefi";
import type { TeeSessionOp, TeeStepResult } from "./logic/tee-session";
import { fromFixed8 } from "./utils/format";
import { parseBigInt } from "./utils/parsers";
import { eventStateValue } from "./utils/chain-events";
import { eventHashMatches, mapField, normalizedHash } from "./gamefi";
import {
  toScriptHash,
  buildLeaderboard,
  formatFixed8Gas,
  asNumber,
  createGameSessionObservables,
  applyGameSnapshot,
  parsePlayerStats,
} from "./game";
import type {
  LeaderEntry,
  SolveRow,
  GameSessionStatus,
  SolvedEventSlots,
  GameSessionObservables,
} from "./game";

export type FrameworkHost = "onegate" | "miniapp-platform" | "standalone";

export interface FrameworkContractArg {
  type: "String" | "Integer" | "Boolean" | "Hash160" | "Hash256" | "PublicKey" | "ByteArray" | "Array";
  value: string | number | boolean | FrameworkContractArg[];
}

export interface FrameworkTxResult {
  txid: string;
  event?: unknown;
  success?: boolean;
  verified?: boolean;
}

export interface FrameworkInvokeOptions {
  scriptHash?: string;
  signers?: unknown[];
  waitForEvent?: string;
  waitTimeoutMs?: number;
  onPaymentSent?: (txid: string) => void;
}

export interface MiniAppFrameworkChain {
  address: Observable<string | null>;
  contractAddress?: Observable<string | null>;
  ensureWallet(): Promise<string>;
  detectNetwork?(): Promise<string>;
  read(operation: string, args?: FrameworkContractArg[], options?: unknown): Promise<unknown>;
  readArray?(operation: string, args?: FrameworkContractArg[], options?: unknown): Promise<unknown[]>;
  invoke(
    operation: string,
    args: FrameworkContractArg[],
    options?: FrameworkInvokeOptions,
  ): Promise<FrameworkTxResult>;
  invokeWithPayment(
    amount: string,
    memo: string,
    operation: string,
    args: FrameworkContractArg[],
    options?: FrameworkInvokeOptions,
  ): Promise<FrameworkTxResult>;
  listEvents?(eventName: string, options?: { limit?: number; offset?: number }): Promise<unknown[]>;
}

export interface MiniAppFrameworkNotify {
  success?(messageKey: string, params?: Record<string, string | number>): void;
  error?(error: unknown, fallbackKey?: string): void;
  info?(messageKey: string, params?: Record<string, string | number>): void;
  warn?(messageKey: string, params?: Record<string, string | number>): void;
  guardResult?<T>(
    fn: () => Promise<T>,
    successKey?: string,
    errorKey?: string,
  ): Promise<{ ok: true; value: T } | { ok: false; error: unknown }>;
}

export interface MiniAppFrameworkOS {
  storage?: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<unknown>;
    delete(key: string): Promise<unknown>;
    list(prefix: string, limit?: number): Promise<Record<string, unknown>>;
  };
  badge?: {
    define(badgeId: string, name: string, criteria: string): Promise<void>;
    award(badgeId: string, user: string): Promise<void>;
    list(user?: string): Promise<unknown[]>;
    updateStat?(user: string, statKey: string, value: string): Promise<void>;
    getStat?(user: string, statKey: string): Promise<string>;
  };
  leaderboard?: {
    submitScore(score: string): Promise<void>;
    get(limit?: number): Promise<Array<{ user: string; score: string }>>;
  };
}

export interface FrameworkLaunchContext {
  appId?: string;
  source?: string | null;
  operation?: string | null;
  tab?: string | null;
  network?: string | null;
  params?: Record<string, string>;
  keys?: string[];
  hasParams?: boolean;
  signature?: string;
}

export interface MiniAppFrameworkContext {
  services: {
    chain: MiniAppFrameworkChain;
    notify?: MiniAppFrameworkNotify;
    os?: MiniAppFrameworkOS;
  };
  os?: MiniAppFrameworkOS;
  t: (key: string, params?: Record<string, string | number>) => string;
  state?: Record<string, Observable>;
  setStatus?: (message: string, type: "success" | "error" | "warning" | "info") => void;
  clearStatus?: () => void;
  launchContext?: Partial<FrameworkLaunchContext>;
  registerAction?: (key: string, handler: (...args: unknown[]) => Promise<unknown>) => void;
}

export interface MiniAppFrameworkOptions {
  appId?: string;
}

export interface FrameworkActionOptions {
  successKey?: string;
  errorKey?: string;
  rethrow?: boolean;
}

export interface FrameworkReadSpec<T = unknown> {
  operation: string;
  args?: FrameworkContractArg[];
  scriptHash?: string;
  cache?: boolean;
  cacheTtlMs?: number;
  parse?: (raw: unknown) => T;
}

export interface FrameworkWriteSpec {
  operation: string;
  args: FrameworkContractArg[];
  successKey?: string;
  errorKey?: string;
  reload?: () => Promise<void>;
}

export interface FrameworkPaySpec extends FrameworkWriteSpec {
  amountFixed8?: bigint | number | string;
  amountGas?: number | string;
  memo: string;
}

export type FrameworkAssetSymbol = "GAS" | "NEO";

export type FrameworkOperationStatus = "idle" | "running" | "succeeded" | "failed";

export interface FrameworkOperationState<TResult = unknown> {
  key: string;
  status: FrameworkOperationStatus;
  txid: string;
  error: string;
  value: TResult | null;
  startedAt: number;
  finishedAt: number;
  runId: number;
}

export interface FrameworkOperationRunOptions extends FrameworkActionOptions {
  successKey?: string;
  errorKey?: string;
}

export type FrameworkRewardGameConfig = Omit<RewardGameConfig, "appId"> & {
  appId?: string;
};

export interface FrameworkRewardGameOptions<Op extends TeeSessionOp = TeeSessionOp> {
  storage?: RewardGameStorage<Op>;
  storagePrefix?: string;
  fetcher?: typeof fetch;
}

export interface FrameworkRewardGameFinalizeOptions {
  pollAttempts?: number;
  pollDelayMs?: number;
  delay?: (ms: number) => Promise<void>;
  fetcher?: typeof fetch;
}

export interface FrameworkRewardGameSettlementOptions {
  pollAttempts?: number;
  pollDelayMs?: number;
  delay?: (ms: number) => Promise<void>;
}

export interface OracleEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  kind: string;
  digest: string;
  payload: TPayload & {
    kind: string;
    appId: string;
    digest: string;
  };
}

export interface HttpOracleRequest {
  url: string;
  method?: "GET" | "POST";
  path?: string;
  body?: unknown;
}

export interface VrfOracleRequest {
  consumer: string;
  salt: string;
  rounds?: number;
  proofMode?: "single" | "batch";
}

export interface ComputeOracleRequest {
  workflow: string;
  input: unknown;
  sealed?: boolean;
}

export interface SealOracleRequest {
  purpose: string;
  recipient?: string;
  payload: unknown;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  criteria: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function stableJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    // Oracle-envelope digests must be a real SHA-256 so an equivalent payload
    // hashes to the same value in the UI preview, the OneGate dApp call, and the
    // on-chain submission. A non-crypto fallback would silently diverge across
    // environments and break that cross-check, so require a secure context here
    // rather than return a digest that cannot be reproduced downstream.
    throw new Error(
      "Oracle envelope digest requires SHA-256 (crypto.subtle); run in a secure context",
    );
  }
  const hash = await subtle.digest("SHA-256", bytes);
  return `0x${[...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function localStorageAvailable(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function compactInvokeOptions(spec: FrameworkWriteSpec | FrameworkPaySpec): FrameworkInvokeOptions {
  const source = spec as FrameworkWriteSpec & FrameworkInvokeOptions;
  const options: FrameworkInvokeOptions = {};
  if (source.scriptHash) options.scriptHash = source.scriptHash;
  if (source.signers) options.signers = source.signers;
  if (source.waitForEvent) options.waitForEvent = source.waitForEvent;
  if (source.waitTimeoutMs) options.waitTimeoutMs = source.waitTimeoutMs;
  if (source.onPaymentSent) options.onPaymentSent = source.onPaymentSent;
  return options;
}

function fixed8Amount(spec: FrameworkPaySpec): string {
  if (spec.amountFixed8 !== undefined) return String(spec.amountFixed8);
  return gasFixed8Amount(spec.amountGas ?? "");
}

function accountToHash160(value: string): string {
  const raw = String(value ?? "").trim();
  if (/^(0x)?[0-9a-fA-F]{40}$/.test(raw)) {
    return raw.startsWith("0x") ? raw.toLowerCase() : `0x${raw.toLowerCase()}`;
  }
  const converted = addressToScriptHash(raw);
  if (/^0x[0-9a-fA-F]{40}$/.test(converted)) return converted.toLowerCase();
  throw new Error("Account must be a valid Neo N3 address or Hash160");
}

function gasFixed8Amount(value: bigint | number | string, allowZero = false): string {
  if (typeof value === "bigint") {
    if (value < 0n) throw new Error("GAS amount cannot be negative");
    if (!allowZero && value === 0n) throw new Error("GAS amount must be positive");
    return value.toString();
  }
  const raw = typeof value === "number"
    ? Number.isFinite(value)
      ? value.toFixed(8).replace(/\.?0+$/, "")
      : ""
    : String(value ?? "").trim();
  if (raw.startsWith("-")) throw new Error("GAS amount cannot be negative");
  if (!/^\d+(?:\.\d+)?$/.test(raw)) {
    throw new Error("GAS amount must be a positive decimal amount");
  }
  const [whole = "0", fraction = ""] = raw.split(".");
  if (fraction.length > 8) throw new Error("GAS amount cannot have more than 8 decimals");
  const fixed8 = BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, "0") || "0");
  if (!allowZero && fixed8 <= 0n) throw new Error("GAS amount must be positive");
  return fixed8.toString();
}

function neoWholeAmount(value: bigint | number | string, allowZero = false): string {
  if (typeof value === "bigint") {
    if (value < 0n) throw new Error("NEO amount cannot be negative");
    if (!allowZero && value === 0n) throw new Error("NEO amount must be positive");
    return value.toString();
  }
  const raw = String(value ?? "").trim();
  if (raw.startsWith("-")) throw new Error("NEO amount cannot be negative");
  if (!/^\d+$/.test(raw)) {
    throw new Error("NEO amount must be a whole number");
  }
  const units = BigInt(raw);
  if (units < 0n) throw new Error("NEO amount cannot be negative");
  if (!allowZero && units === 0n) throw new Error("NEO amount must be positive");
  return units.toString();
}

function txidOf(value: unknown): string {
  if (value && typeof value === "object" && "txid" in value) {
    return String((value as { txid?: unknown }).txid ?? "");
  }
  return "";
}

function errorMessage(error: unknown, fallback = "error"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

function eventValue(ev: unknown, index: number): unknown {
  const state = (ev as { state?: unknown })?.state ?? ev;
  if (!Array.isArray(state)) return undefined;
  const item = state[index];
  return (item as { value?: unknown })?.value ?? item;
}

export function createMiniAppFramework(
  ctx: MiniAppFrameworkContext,
  options: MiniAppFrameworkOptions = {},
) {
  const appId =
    options.appId ||
    ctx.launchContext?.appId ||
    "miniapp";
  const os = ctx.os ?? ctx.services.os ?? {};
  const chain = ctx.services.chain;
  // Stable contract-address observable so subscribers keep a single source even
  // when the host has no deployed contract accessor.
  const contractAddressAccessor: Observable<string | null> =
    chain.contractAddress ?? createObservable<string | null>(null);
  const notify = ctx.services.notify ?? {};
  const storagePrefix = `neo:${appId}:`;
  const inFlight = new Set<string>();
  const actionHandlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();

  const localKey = (key: string) => `${storagePrefix}${key}`;
  const local = {
    get<T>(key: string, fallback: T | null = null): T | null {
      return parseJson<T | null>(localStorageAvailable()?.getItem(localKey(key)) ?? null, fallback);
    },
    set(key: string, value: unknown): void {
      localStorageAvailable()?.setItem(localKey(key), JSON.stringify(value));
    },
    delete(key: string): void {
      localStorageAvailable()?.removeItem(localKey(key));
    },
    list(prefix: string): Record<string, unknown> {
      const store = localStorageAvailable();
      const out: Record<string, unknown> = {};
      if (!store) return out;
      const fullPrefix = localKey(prefix);
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index);
        if (!key?.startsWith(fullPrefix)) continue;
        out[key.slice(storagePrefix.length)] = parseJson(store.getItem(key), null);
      }
      return out;
    },
  };

  const remote = {
    async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
      if (!os.storage) return fallback;
      const value = await os.storage.get(key);
      return value === undefined || value === null ? fallback : value as T;
    },
    async set(key: string, value: unknown): Promise<void> {
      if (!os.storage) return;
      await os.storage.set(key, value);
    },
    async delete(key: string): Promise<void> {
      if (!os.storage) return;
      await os.storage.delete(key);
    },
    async list(prefix: string, limit = 100): Promise<Record<string, unknown>> {
      if (!os.storage) return {};
      return os.storage.list(prefix, limit);
    },
  };

  const hybrid = {
    async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
      try {
        const value = await remote.get<T>(key, null);
        if (value !== null) return value;
      } catch {
        /* OneGate/standalone embeds may not expose OS storage; local survives. */
      }
      return local.get<T>(key, fallback);
    },
    async set(key: string, value: unknown): Promise<void> {
      local.set(key, value);
      try {
        await remote.set(key, value);
      } catch {
        /* Keep the local copy; remote sync can be retried by the app later. */
      }
    },
    async delete(key: string): Promise<void> {
      local.delete(key);
      try {
        await remote.delete(key);
      } catch {
        /* local delete already completed */
      }
    },
    async list(prefix: string, limit = 100): Promise<Record<string, unknown>> {
      const localValues = local.list(prefix);
      try {
        return { ...localValues, ...(await remote.list(prefix, limit)) };
      } catch {
        return localValues;
      }
    },
  };

  const runWithNotify = async <T>(
    work: () => Promise<T>,
    successKey?: string,
    errorKey?: string,
  ): Promise<T> => {
    if (notify.guardResult) {
      const result = await notify.guardResult(work, successKey, errorKey);
      if (result.ok) return result.value;
      throw result.error;
    }
    try {
      const value = await work();
      if (successKey) notify.success?.(successKey);
      return value;
    } catch (error) {
      notify.error?.(error, errorKey);
      throw error;
    }
  };

  const createEnvelope = async <TPayload extends Record<string, unknown>>(
    kind: string,
    payload: TPayload,
  ): Promise<OracleEnvelope<TPayload>> => {
    const unsigned = { kind, appId, ...payload };
    const digest = await sha256Hex(stableJson(unsigned));
    return {
      kind,
      digest,
      payload: {
        ...unsigned,
        digest,
      } as OracleEnvelope<TPayload>["payload"],
    };
  };

  const arg = {
    string(value: unknown): FrameworkContractArg {
      return { type: "String", value: String(value ?? "") };
    },
    integer(value: bigint | number | string): FrameworkContractArg {
      return { type: "Integer", value: String(value) };
    },
    boolean(value: unknown): FrameworkContractArg {
      return { type: "Boolean", value: Boolean(value) };
    },
    hash160(value: string): FrameworkContractArg {
      return { type: "Hash160", value: accountToHash160(value) };
    },
    hash256(value: string): FrameworkContractArg {
      const raw = String(value ?? "").trim().toLowerCase();
      const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
      if (!/^0x[0-9a-f]{64}$/.test(normalized)) {
        throw new Error("Hash256 must be 32 bytes of hex");
      }
      return { type: "Hash256", value: normalized };
    },
    byteArray(value: string): FrameworkContractArg {
      return { type: "ByteArray", value };
    },
    array(value: FrameworkContractArg[]): FrameworkContractArg {
      return { type: "Array", value };
    },
  };

  const amount = {
    gasToFixed8(value: bigint | number | string, options?: { allowZero?: boolean }): bigint {
      return BigInt(gasFixed8Amount(value, options?.allowZero === true));
    },
    fixed8ToGas(value: bigint | number | string, maxDecimals = 8): string {
      return fixed8ToGasString(value, maxDecimals);
    },
    neoToUnits(value: bigint | number | string, options?: { allowZero?: boolean }): bigint {
      return BigInt(neoWholeAmount(value, options?.allowZero === true));
    },
    assetToUnits(
      asset: FrameworkAssetSymbol,
      value: bigint | number | string,
      options?: { allowZero?: boolean },
    ): bigint {
      return asset === "NEO"
        ? BigInt(neoWholeAmount(value, options?.allowZero === true))
        : BigInt(gasFixed8Amount(value, options?.allowZero === true));
    },
  };

  const operationState = <TResult>(key: string): FrameworkOperationState<TResult> => ({
    key,
    status: "idle",
    txid: "",
    error: "",
    value: null,
    startedAt: 0,
    finishedAt: 0,
    runId: 0,
  });

  const rewardChain = () => ({
    address: chain.address,
    contractAddress: chain.contractAddress ?? { get: () => "" },
    ensureWallet: () => chain.ensureWallet(),
    detectNetwork: async () => chain.detectNetwork?.() ?? String(ctx.launchContext?.network ?? "testnet"),
    read: (operation: string, args?: FrameworkContractArg[]) => chain.read(operation, args),
    invoke: (
      operation: string,
      args: FrameworkContractArg[],
      invokeOptions?: FrameworkInvokeOptions,
    ) => chain.invoke(operation, args, invokeOptions),
    invokeWithPayment: (
      paymentAmount: string,
      memo: string,
      operation: string,
      args: FrameworkContractArg[],
      invokeOptions?: FrameworkInvokeOptions,
    ) => chain.invokeWithPayment(paymentAmount, memo, operation, args, invokeOptions),
  });

  const framework = {
    amount,

    platform: {
      appId,
      launch: ctx.launchContext ?? {},
      get host(): FrameworkHost {
        const source = String(ctx.launchContext?.source ?? "").trim().toLowerCase();
        if (source === "onegate") return "onegate";
        if (typeof window !== "undefined" && window.parent !== window) return "miniapp-platform";
        return "standalone";
      },
      get isOneGate() {
        return this.host === "onegate";
      },
      get isMiniAppPlatform() {
        return this.host === "miniapp-platform";
      },
      param(key: string, fallback = ""): string {
        return ctx.launchContext?.params?.[key] ?? fallback;
      },
    },

    state: {
      atom<T>(key: string, initial: T): Observable<T> {
        const value = createObservable(initial);
        (ctx as { state?: Record<string, Observable> }).state ??= {};
        (ctx as { state?: Record<string, Observable> }).state![key] = value;
        return value;
      },
      persisted<T>(key: string, initial: T): Observable<T> {
        const storageKey = `state/${key}`;
        const value = createObservable(local.get<T>(storageKey, initial) as T);
        value.subscribe(() => local.set(storageKey, value.get()));
        (ctx as { state?: Record<string, Observable> }).state ??= {};
        (ctx as { state?: Record<string, Observable> }).state![key] = value;
        return value;
      },
      snapshot(values: Record<string, Observable>): Record<string, unknown> {
        return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.get()]));
      },
    },

    storage: {
      local,
      remote,
      hybrid,
    },

    db: {
      collection<T extends Record<string, unknown>>(name: string) {
        const prefix = `db/${name}/`;
        return {
          async get(id: string): Promise<T | null> {
            return hybrid.get<T>(`${prefix}${id}`, null);
          },
          async set(id: string, value: T): Promise<void> {
            await hybrid.set(`${prefix}${id}`, value);
          },
          async delete(id: string): Promise<void> {
            await hybrid.delete(`${prefix}${id}`);
          },
          async list(limit = 100): Promise<T[]> {
            const values = await hybrid.list(prefix, limit);
            return Object.values(values).filter(isRecord) as T[];
          },
        };
      },
    },

    actions: {
      register<TArgs extends unknown[], TResult>(
        key: string,
        handler: (...args: TArgs) => TResult | Promise<TResult>,
        actionOptions: FrameworkActionOptions = {},
      ): void {
        const wrapped = async (...args: unknown[]) =>
          framework.actions.run(key, ...(args as TArgs));
        actionHandlers.set(key, async (...args: unknown[]) => {
          if (notify.guardResult) {
            const result = await notify.guardResult(
              async () => handler(...(args as TArgs)),
              actionOptions.successKey,
              actionOptions.errorKey,
            );
            if (result.ok) return result.value;
            if (actionOptions.rethrow) throw result.error;
            return undefined;
          }
          try {
            const value = await handler(...(args as TArgs));
            if (actionOptions.successKey) notify.success?.(actionOptions.successKey);
            return value;
          } catch (error) {
            notify.error?.(error, actionOptions.errorKey);
            if (actionOptions.rethrow) throw error;
            return undefined;
          }
        });
        ctx.registerAction?.(key, wrapped);
      },
      async run<TResult = unknown>(key: string, ...args: unknown[]): Promise<TResult | undefined> {
        if (inFlight.has(key)) return undefined;
        const handler = actionHandlers.get(key);
        if (!handler) return undefined;
        inFlight.add(key);
        try {
          return await handler(...args) as TResult;
        } finally {
          inFlight.delete(key);
        }
      },
    },

    chain: {
      arg,
      /** Underlying wallet-address accessor (observable in the platform host). */
      get address() {
        return chain.address;
      },
      /** Deployed contract-address observable; a null-observable when unset. */
      get contractAddress() {
        return contractAddressAccessor;
      },
      async ensureWallet() {
        return chain.ensureWallet();
      },
      /** Current network label (e.g. "testnet"/"mainnet") if the host exposes it. */
      async detectNetwork(): Promise<string> {
        return (await chain.detectNetwork?.()) ?? String(ctx.launchContext?.network ?? "testnet");
      },
      async read<T = unknown>(spec: FrameworkReadSpec<T>): Promise<T> {
        const raw = await chain.read(spec.operation, spec.args, {
          scriptHash: spec.scriptHash,
          cache: spec.cache,
          cacheTtlMs: spec.cacheTtlMs,
        });
        return spec.parse ? spec.parse(raw) : raw as T;
      },
      /**
       * Raw contract read by operation + args, for app-specific parse/guard
       * flows that don't want the {@link FrameworkReadSpec} envelope.
       */
      async readRaw(operation: string, args?: FrameworkContractArg[], options?: unknown): Promise<unknown> {
        return chain.read(operation, args, options);
      },
      /** Raw ARRAY read — for contract methods returning a list stack item. */
      async readArray(operation: string, args?: FrameworkContractArg[], options?: unknown): Promise<unknown[]> {
        return (await chain.readArray?.(operation, args, options)) ?? [];
      },
      /**
       * Raw invoke with NO notify/reload wrapping — for composables that own
       * their own multi-step control flow and error reporting. Use
       * {@link write} instead for simple fire-and-notify writes.
       */
      invoke(
        operation: string,
        args: FrameworkContractArg[],
        options?: FrameworkInvokeOptions,
      ): Promise<FrameworkTxResult> {
        return chain.invoke(operation, args, options);
      },
      /** Raw pay-and-call with NO notify/reload wrapping (see {@link invoke}). */
      invokeWithPayment(
        amount: string,
        memo: string,
        operation: string,
        args: FrameworkContractArg[],
        options?: FrameworkInvokeOptions,
      ): Promise<FrameworkTxResult> {
        return chain.invokeWithPayment(amount, memo, operation, args, options);
      },
      async write(spec: FrameworkWriteSpec & FrameworkInvokeOptions): Promise<FrameworkTxResult> {
        return runWithNotify(async () => {
          const tx = await chain.invoke(spec.operation, spec.args, compactInvokeOptions(spec));
          if (tx.success !== false) await spec.reload?.();
          return tx;
        }, spec.successKey, spec.errorKey);
      },
      async events(eventName: string, options?: { limit?: number; offset?: number }): Promise<unknown[]> {
        return chain.listEvents?.(eventName, options) ?? [];
      },
      eventValue,
    },

    operations: {
      create<TResult = unknown>(key: string) {
        const state = createObservable<FrameworkOperationState<TResult>>(operationState<TResult>(key));
        let runId = 0;
        return {
          state,
          reset(): void {
            state.set(operationState<TResult>(key));
          },
          async run<TValue extends TResult = TResult>(
            work: () => Promise<TValue>,
            runOptions: FrameworkOperationRunOptions = {},
          ): Promise<TValue | undefined> {
            const nextRunId = runId + 1;
            runId = nextRunId;
            state.set({
              ...state.get(),
              status: "running",
              txid: "",
              error: "",
              startedAt: Date.now(),
              finishedAt: 0,
              runId: nextRunId,
            });
            try {
              const value = await work();
              if (runId !== nextRunId) return value;
              const txid = txidOf(value);
              state.set({
                ...state.get(),
                status: "succeeded",
                txid,
                error: "",
                value,
                finishedAt: Date.now(),
              });
              if (runOptions.successKey) notify.success?.(runOptions.successKey);
              return value;
            } catch (error) {
              if (runId !== nextRunId) {
                if (runOptions.rethrow) throw error;
                return undefined;
              }
              state.set({
                ...state.get(),
                status: "failed",
                error: errorMessage(error, runOptions.errorKey),
                finishedAt: Date.now(),
              });
              notify.error?.(error, runOptions.errorKey);
              if (runOptions.rethrow) throw error;
              return undefined;
            }
          },
        };
      },
    },

    funds: {
      async payAndCall(spec: FrameworkPaySpec & FrameworkInvokeOptions): Promise<FrameworkTxResult> {
        return runWithNotify(async () => {
          const tx = await chain.invokeWithPayment(
            fixed8Amount(spec),
            spec.memo,
            spec.operation,
            spec.args,
            compactInvokeOptions(spec),
          );
          if (tx.success !== false) await spec.reload?.();
          return tx;
        }, spec.successKey, spec.errorKey);
      },
      async creditOf(playerHash?: string, operation = "creditOf"): Promise<bigint> {
        const account = playerHash || chain.address.get() || await chain.ensureWallet();
        const hash = accountToHash160(account);
        const raw = await chain.read(operation, [{ type: "Hash160", value: hash }]);
        try {
          return BigInt(String(raw ?? "0"));
        } catch {
          return 0n;
        }
      },
      async withdrawCredit(operation = "withdraw", successKey?: string): Promise<FrameworkTxResult> {
        const user = accountToHash160(await chain.ensureWallet());
        return framework.chain.write({
          operation,
          args: [{ type: "Hash160", value: user }],
          waitForEvent: "CreditWithdrawn",
          successKey,
        });
      },
    },

    oracle: {
      async http(request: HttpOracleRequest) {
        const url = new URL(request.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          throw new Error("HTTP oracle request must use http(s) URL");
        }
        const method = request.method ?? "GET";
        return createEnvelope("oracle.http.request", {
          url: url.toString(),
          method,
          path: request.path ?? "$",
          ...(method === "POST" && request.body !== undefined ? { body: request.body } : {}),
        });
      },
      async vrf(request: VrfOracleRequest) {
        const rounds = Math.max(1, Math.min(64, Math.trunc(Number(request.rounds ?? 1) || 1)));
        return createEnvelope("oracle.vrf.request", {
          consumer: request.consumer,
          salt: request.salt,
          rounds,
          proofMode: request.proofMode ?? (rounds > 1 ? "batch" : "single"),
        });
      },
      async compute(request: ComputeOracleRequest) {
        const inputDigest = await sha256Hex(stableJson(request.input));
        return createEnvelope("oracle.compute.request", {
          workflow: request.workflow,
          sealed: request.sealed === true,
          inputDigest,
          ...(request.sealed ? {} : { input: request.input }),
        });
      },
      async seal(request: SealOracleRequest) {
        const payloadDigest = await sha256Hex(stableJson(request.payload));
        return createEnvelope("oracle.seal.envelope", {
          purpose: request.purpose,
          recipient: request.recipient ?? "",
          payloadDigest,
        });
      },
      async dispatch(
        envelope: OracleEnvelope,
        spec: Omit<FrameworkWriteSpec & FrameworkInvokeOptions, "args"> & { args?: FrameworkContractArg[] },
      ) {
        return framework.chain.write({
          ...spec,
          args: [
            ...(spec.args ?? []),
            { type: "String", value: JSON.stringify(envelope.payload) },
          ],
        });
      },
    },

    stats: {
      async increment(key: string, by = 1, scope: "global" | "user" = "global"): Promise<number> {
        const id = scope === "user" ? `${chain.address.get() || await chain.ensureWallet()}:${key}` : key;
        const stats = framework.db.collection<{ value: number }>("stats");
        const current = await stats.get(id);
        const next = Number(current?.value ?? 0) + by;
        await stats.set(id, { value: next });
        return next;
      },
      leaderboard: {
        async submit(score: number | string): Promise<void> {
          await os.leaderboard?.submitScore(String(score));
        },
        async top(limit = 100): Promise<Array<{ user: string; score: string }>> {
          return os.leaderboard?.get(limit) ?? [];
        },
      },
    },

    achievements: {
      async awardOnce(definition: AchievementDefinition, user?: string): Promise<{ awarded: boolean }> {
        const recipient = user || chain.address.get() || await chain.ensureWallet();
        const marker = `achievements/awarded/${recipient}/${definition.id}`;
        if (local.get<boolean>(marker, false)) return { awarded: false };
        await os.badge?.define(definition.id, definition.name, definition.criteria);
        await os.badge?.award(definition.id, recipient);
        local.set(marker, true);
        return { awarded: true };
      },
      async list(user?: string): Promise<unknown[]> {
        return os.badge?.list(user) ?? [];
      },
    },

    game: {
      reward<Op extends TeeSessionOp = TeeSessionOp>(
        rewardConfig: FrameworkRewardGameConfig,
        rewardOptions: FrameworkRewardGameOptions<Op> = {},
      ) {
        const config: RewardGameConfig = {
          ...rewardConfig,
          appId: rewardConfig.appId ?? appId,
        };
        const storage = rewardOptions.storage ?? createLocalStorageRewardGameStorage<Op>(
          rewardOptions.storagePrefix ?? `${storagePrefix}gamefi/${config.appId}/ops/`,
          localStorageAvailable(),
        );
        const chainAdapter = rewardChain();
        return {
          config,
          storage,
          mode(difficulty: number | string) {
            return rewardGameModeOf(config, difficulty);
          },
          balances(playerHash?: string) {
            return refreshRewardGameBalances(config, chainAdapter, playerHash);
          },
          start(difficulty: number) {
            return startRewardGame(config, chainAdapter, difficulty, storage);
          },
          openSession(gameId: string, difficulty: number) {
            return openRewardGameSession(config, chainAdapter, gameId, difficulty, rewardOptions.fetcher);
          },
          recordOp(session: RewardGameSession, op: Op) {
            return recordRewardGameOp(session, storage, op, rewardOptions.fetcher);
          },
          replayOps(
            session: RewardGameSession,
            ops: readonly Op[],
            onStep?: (step: TeeStepResult, op: Op, index: number) => void | Promise<void>,
          ) {
            return replayRewardGameOps(session, ops, onStep, rewardOptions.fetcher);
          },
          finalize(
            session: RewardGameSession,
            finalizeOptions?: FrameworkRewardGameFinalizeOptions,
          ) {
            return finalizeRewardGame(config, chainAdapter, session, storage, {
              ...finalizeOptions,
              fetcher: finalizeOptions?.fetcher ?? rewardOptions.fetcher,
            });
          },
          recoverActive() {
            return recoverActiveRewardGame(config, chainAdapter);
          },
          expire(gameId: string) {
            return expireRewardGame(config, chainAdapter, gameId, storage);
          },
          withdrawCredit(creditFixed8?: bigint | number | string) {
            return withdrawRewardCredit(config, chainAdapter, creditFixed8);
          },
          snapshot(gameId: string) {
            return readRewardGameSnapshot(config, chainAdapter, gameId);
          },
          observeSettlement(
            gameId: string,
            solvedEvent?: unknown | null,
            settlementOptions?: FrameworkRewardGameSettlementOptions,
          ) {
            return observeRewardGameSettlement(config, chainAdapter, gameId, solvedEvent, settlementOptions);
          },
        };
      },

      // ── player helpers ────────────────────────────────────────────────────
      /**
       * High-level helpers for the connected player.
       * Used by game main.tsx files instead of re-implementing the
       * addressToScriptHash + address.get() pattern inline.
       */
      player: {
        /**
         * Return the script-hash of the currently connected wallet.
         * Returns "" when no wallet is connected (safe to pass to balances/stats
         * calls which guard on empty hash).
         */
        scriptHash(): string {
          return toScriptHash(chain.address.get());
        },
        /**
         * Wait for wallet connection and return the script-hash.
         * Throws if the wallet prompt is cancelled.
         */
        async ensureScriptHash(): Promise<string> {
          const address = await chain.ensureWallet();
          return toScriptHash(address);
        },
      },

      // ── stats helpers ─────────────────────────────────────────────────────
      /**
       * High-level player stats helpers.
       * Replaces the `refreshStats()` pattern that every game re-implements.
       */
      stats: {
        /**
         * Fetch statsOf(playerHash) from the contract and return
         * `{ solves, totalWon }`.  Returns zeros on any error.
         */
        async load(playerHash?: string): Promise<{ solves: number; totalWon: number }> {
          const hash = playerHash ?? toScriptHash(chain.address.get());
          if (!hash) return { solves: 0, totalWon: 0 };
          try {
            const raw = await chain.read("statsOf", [{ type: "Hash160", value: hash }]);
            return parsePlayerStats(raw);
          } catch {
            return { solves: 0, totalWon: 0 };
          }
        },
      },

      // ── leaderboard helpers ───────────────────────────────────────────────
      /**
       * High-level leaderboard helpers built on the unified buildLeaderboard()
       * utility.  Replaces the `loadLeaderboard()` function that every game
       * re-implements with slight variations.
       */
      leaderboard: {
        /**
         * Fetch `limit` solved events from the chain, build a ranked leaderboard,
         * and extract the connected player's own history rows.
         *
         * @param eventName  On-chain event name (usually "Solved").
         * @param slots      Optional override of event-state slot indices.
         * @param limit      Number of events to scan (default 200).
         */
        async load<TRow extends SolveRow = SolveRow>(
          eventName = "Solved",
          slots?: SolvedEventSlots,
          limit = 200,
          extraRowFields?: (ev: unknown) => Partial<TRow>,
        ): Promise<{ ranked: LeaderEntry[]; mine: TRow[] }> {
          const playerHash = toScriptHash(chain.address.get());
          try {
            const events = await chain.listEvents?.(eventName, { limit }) ?? [];
            return buildLeaderboard<TRow>(events, playerHash, slots, extraRowFields);
          } catch {
            return { ranked: [], mine: [] };
          }
        },
      },

      // ── session observables factory ────────────────────────────────────────
      /**
       * Session observable factory — creates the standard set of observables
       * every reward game needs without boilerplate.
       */
      session: {
        /**
         * Create and return all standard game session observables.
         * Pass the result directly as the `state` return value in setup().
         *
         * @example
         * ```ts
         * const obs = app.game.session.observables(ctx.t);
         * // ... register actions using obs.gameStatus, obs.credit, etc.
         * return { state: obs };
         * ```
         */
        observables<THistory extends SolveRow = SolveRow>(
          t?: (key: string) => string,
        ): GameSessionObservables<THistory> {
          return createGameSessionObservables<THistory>({ t });
        },

        /**
         * Apply a getGame() on-chain snapshot to a set of session observables.
         * Centralises the "read game + set status/difficulty/commitment/dealtAt/
         * deadline/undos" pattern.
         */
        applySnapshot(
          obs: Parameters<typeof applyGameSnapshot>[0],
          game: unknown,
          statusOf: (raw: number) => GameSessionStatus,
        ): void {
          applyGameSnapshot(obs, game, statusOf);
        },
      },
    },
  };

  return framework;
}

export type MiniAppFramework = ReturnType<typeof createMiniAppFramework>;
