/**
 * app.registry — the PlatformRegistry directory surface (Platform Contract
 * Library v2 phase 2, docs/platform-contract-library-v2.md §3.1).
 *
 * The registry is the canonical on-chain estate ledger: appId → engine row,
 * appId → shared UnifiedSmartWallet identity, optional appId → deployed
 * AppAccount treasury shim, both reverse indexes, and the per-app/global
 * pause state engines and lane-B shims consult. This surface exposes every
 * non-control-plane read and tenant-owned write, typed and auto-threaded with
 * the host appId (§6 item 4 config-injection grammar, the app.credits
 * exemplar): apps never hand-roll registry calls against a hardcoded hash.
 * Platform-admin governance, artifact, engine-registration, fee-withdrawal,
 * and contract-upgrade methods remain intentionally absent.
 *
 * Config comes from `MiniAppFrameworkOptions.registry` (platform config
 * pattern, like `oracle.dataFeed` / `credits`): the app layer injects the
 * network's deployed PlatformRegistry hash. Absent/invalid ⇒ every chain call
 * throws a typed {@link FrameworkCapabilityError} (capability "registry") so
 * registry-aware UI degrades away cleanly on hosts without the directory —
 * branch on `registry.available`.
 *
 * `deriveAccountHash` is the ADVISORY client-side sibling of the optional shim registry's
 * `predictedAccountHash` read (§4.1 rule 4): a pure, config-free wrap of the
 * shared {@link deriveAppAccountHash} derivation. Per §4.1 rules 2–3 the
 * registry row records the ACTUAL post-deploy hash and stays the address of
 * record — never publish a predicted address before materialization, and
 * never fund one.
 */

import { FrameworkCapabilityError } from "./aa";
import { accountToHash160 } from "./chain-surface";
import { WRITE_PLATFORM_REGISTRY, guardedWrite } from "./internal/guards";
import type { FrameworkGuardDeps } from "./internal/guards";
import type { Observable } from "./reactive";
import { deriveAppAccountHash, deriveVirtualAAAccount } from "./utils/aa-account";
import type { AppAccountHashInput, VirtualAAAccount } from "./utils/aa-account";
import { addressToScriptHash, parseHash160 } from "./utils/neo";
import { parseBigInt, parseBool } from "./utils/parsers";

// Re-exported so apps reach the derivation + its input type from the same
// module as the surface (the wrap lane — the logic itself stays in
// utils/aa-account, pinned by the shared CreateContractHash vectors).
export { deriveAppAccountHash, deriveVirtualAAAccount };
export type { AppAccountHashInput, VirtualAAAccount };

// ─── config + result types ──────────────────────────────────────────────────

/**
 * Platform-injected registry config (`MiniAppFrameworkOptions.registry`).
 * Absent or invalid ⇒ every chain method throws a typed
 * {@link FrameworkCapabilityError} naming what is missing.
 */
export interface FrameworkRegistryConfig {
  /** Deployed PlatformRegistry contract hash for the network ("0x" + 40 hex). */
  registryHash: string;
  /** Native GAS hash override; defaults to the Neo N3 GAS contract. */
  gasHash?: string;
}

export interface FrameworkRegistryTx {
  txid: string;
  success?: boolean;
  event?: unknown;
}

export interface FrameworkRegistryInvokeOptions {
  waitForEvent?: string;
  waitTimeoutMs?: number;
  onTransactionSent?: (txid: string) => void;
}

export interface FrameworkRegistryContractArg {
  type: "String" | "Integer" | "Boolean" | "Hash160" | "Hash256" | "PublicKey" | "ByteArray" | "Array" | "Map" | "Any";
  value: unknown;
}

export type FrameworkRegistryDescriptorValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | FrameworkRegistryContractArg;

export type FrameworkRegistryDescriptor = Record<string, FrameworkRegistryDescriptorValue>;

/**
 * One directory row — the typed decode of the contract's
 * `getApp(appId)` → `[engineId, engineHash, appAdmin, accountHash,
 * materialized, active]`. Hashes are display-order `0x` hex; `null` marks an
 * unset hash slot (unattached engine, unminted lite-tier account).
 */
export interface FrameworkRegistryApp {
  /** Engine the app is attached to ("" when unattached). */
  engineId: string;
  /** Engine contract hash; null when the app is unattached. */
  engineHash: string | null;
  /** App admin ("" only when the host returned an undecodable row). */
  appAdmin: string;
  /** Optional deployed AppAccount treasury-shim hash; null while unminted. */
  accountHash: string | null;
  /** True once the optional AppAccount treasury shim is deployed. */
  materialized: boolean;
  /** True when the app is not paused (per-app or via the global kill switch). */
  active: boolean;
}

/** The global kill-switch read — the contract's `getGlobalPause()` → `[paused, pausedAt]`. */
export interface FrameworkRegistryGlobalPause {
  /** True while the platform-wide pause is engaged. */
  paused: boolean;
  /** Wall-clock ms when the pause was recorded; 0 when not paused. */
  pausedAt: number;
}

export interface FrameworkRegistryAbstractAccount extends VirtualAAAccount {
  materialized: true;
}

// ─── surface + deps ─────────────────────────────────────────────────────────

/** Chain lane the registry surface consumes (subset of the host service). */
export interface RegistrySurfaceChain {
  address: Observable<string | null>;
  ensureWallet(): Promise<string>;
  read(
    operation: string,
    args?: FrameworkRegistryContractArg[],
    options?: unknown,
  ): Promise<unknown>;
  invoke(
    operation: string,
    args: FrameworkRegistryContractArg[],
    options?: FrameworkRegistryInvokeOptions & { scriptHash?: string },
  ): Promise<FrameworkRegistryTx>;
}

export interface RegistrySurfaceDeps {
  /** Host app id — the default appId every read threads (§6 item 4). */
  appId: string;
  chain: RegistrySurfaceChain;
  guards: FrameworkGuardDeps;
  config?: FrameworkRegistryConfig;
}

export interface FrameworkRegistrySurface {
  /** True when the host injected a valid registry config. */
  readonly available: boolean;
  /**
   * Directory row for `appId` (default: this app). Resolves `null` when the
   * appId is not registered — the contract's `getApp` asserts on unknown
   * ids, which hosts surface as a null read (or, on hosts that throw on
   * FAULT reads, as a rejection).
   */
  getApp(appId?: string): Promise<FrameworkRegistryApp | null>;
  /** Optional deployed AppAccount treasury-shim hash, or null while unminted/unknown. */
  appAccountOf(appId?: string): Promise<string | null>;
  /**
   * The permission-anchoring reverse index: the appId owning an AppAccount
   * (Neo address or Hash160 input), "" when the account is unknown.
   */
  appIdOfAccount(accountHash: string): Promise<string>;
  /** Shared UnifiedSmartWallet account, or null until the registry materializes it. */
  getAbstractAccount(appId?: string): Promise<FrameworkRegistryAbstractAccount | null>;
  /** Reverse lookup scoped by AA core, because account ids are core-local identities. */
  appIdOfAbstractAccount(coreHash: string, accountId: string): Promise<string>;
  /** Engine id the app is attached to ("" when unattached/unknown). */
  engineOf(appId?: string): Promise<string>;
  /** Per-app pause read — true also while the global kill switch is engaged. */
  isPaused(appId?: string): Promise<boolean>;
  /** The global kill-switch state (the read the AppAccount escape hatch pins). */
  getGlobalPause(): Promise<FrameworkRegistryGlobalPause>;
  /** Current registry admin, exposed for transparent control-plane ownership. */
  admin(): Promise<string | null>;
  /** App admin for `appId` (default: this app). */
  appAdminOf(appId?: string): Promise<string | null>;
  abstractAccountCore(): Promise<string | null>;
  pendingAbstractAccountCore(): Promise<string | null>;
  abstractAccountCoreAvailableAt(): Promise<bigint>;
  predictedAccountHash(deployerSender: string, appId?: string): Promise<string | null>;
  creditOf(payer?: string, appId?: string): Promise<bigint>;
  totalCreditLiability(): Promise<bigint>;
  accruedFees(): Promise<bigint>;
  getDescriptor(key: string, appId?: string): Promise<unknown>;
  artifactVersion(): Promise<bigint>;
  artifactChecksum(): Promise<bigint>;
  shimUpgradeConsentOf(appId?: string): Promise<boolean>;
  getEngine(engineId: string): Promise<unknown>;
  engineIdOfHash(engineHash: string): Promise<string>;
  transitHopInProgress(): Promise<boolean>;
  payoutAddressOf(appId?: string): Promise<string | null>;
  spendThresholdOf(appId?: string): Promise<bigint>;
  spentInWindow(appId?: string): Promise<bigint>;
  prepayGasCredit(
    amount: string | number | bigint,
    payer?: string,
    appId?: string,
    options?: FrameworkRegistryInvokeOptions,
  ): Promise<FrameworkRegistryTx>;
  registerApp(
    engineId: string,
    descriptor?: FrameworkRegistryDescriptor,
    appAdmin?: string,
    options?: FrameworkRegistryInvokeOptions,
  ): Promise<FrameworkRegistryTx>;
  attachEngine(engineId: string, appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  materializeAbstractAccount(appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  mintAccount(appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  setShimUpgradeConsent(consented: boolean, appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  withdrawCredit(amount: string | number | bigint, appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  setDescriptor(key: string, value: FrameworkRegistryDescriptorValue, appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  executeSpendThresholdRaise(appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  cancelSpendThresholdRaise(appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  proposeAppAdmin(newAdmin: string, appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  executeAppAdminChange(appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  cancelAppAdminChange(appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  setAppPaused(paused: boolean, appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  proposePayoutAddress(value: string, appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  executePayoutAddress(appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  cancelPayoutAddress(appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  spendToPayout(asset: "NEO" | "GAS" | string, amount: string | number | bigint, appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  proposeSpend(asset: "NEO" | "GAS" | string, amount: string | number | bigint, appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  executeSpend(appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  cancelSpend(appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  fundEnginePool(amount: string | number | bigint, appId?: string, options?: FrameworkRegistryInvokeOptions): Promise<FrameworkRegistryTx>;
  /**
   * ADVISORY AppAccount hash prediction — pure, config-free wrap of
   * {@link deriveAppAccountHash}. The registry row is the address of record;
   * never publish or fund a predicted address before materialization.
   */
  deriveAccountHash(input: AppAccountHashInput): string;
}

// ─── internals ──────────────────────────────────────────────────────────────

const HASH160_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO_HASH160 = "0x0000000000000000000000000000000000000000";
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

/**
 * Display-order `0x` hash from a chain-read UInt160, null for the zero hash
 * (the contract's "unset" marker). parseHash160 owns the byte-order
 * normalization (chain ByteStrings carry UInt160 reversed).
 */
function decodeHashOrNull(value: unknown): string | null {
  const display = parseHash160(value);
  return !display || display === ZERO_HASH160 ? null : display;
}

/** Stored-string decode (engineId/appId arrive as printable ByteStrings). */
function decodeText(value: unknown): string {
  return String(value ?? "").trim();
}

/** Positional getApp row decode; null for a FAULTed (unregistered) read. */
function decodeAppRow(raw: unknown): FrameworkRegistryApp | null {
  if (!Array.isArray(raw) || raw.length < 6) return null;
  const [engineId, engineHash, appAdmin, accountHash, materialized, active] = raw;
  return {
    engineId: decodeText(engineId),
    engineHash: decodeHashOrNull(engineHash),
    appAdmin: parseHash160(appAdmin),
    accountHash: decodeHashOrNull(accountHash),
    materialized: parseBool(materialized),
    active: parseBool(active),
  };
}

/** Neo address or Hash160 → display-order `0x` Hash160 argument value. */
function toHash160Arg(value: string): string {
  const raw = String(value ?? "").trim();
  const hex = raw.replace(/^0x/i, "");
  if (/^[0-9a-fA-F]{40}$/.test(hex)) return `0x${hex.toLowerCase()}`;
  const converted = addressToScriptHash(raw);
  if (HASH160_RE.test(converted)) return converted.toLowerCase();
  throw new Error("Account must be a valid Neo N3 address or Hash160");
}

function positiveInteger(value: string | number | bigint, label: string): string {
  const normalized = parseBigInt(value);
  if (normalized <= 0n) throw new Error(`${label} must be a positive integer`);
  return normalized.toString();
}

function requiredText(value: string, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function descriptorArg(value: FrameworkRegistryDescriptorValue): FrameworkRegistryContractArg {
  if (value === null) return { type: "Any", value: null };
  if (typeof value === "boolean") return { type: "Boolean", value };
  if (typeof value === "number" || typeof value === "bigint") {
    return { type: "Integer", value: parseBigInt(value).toString() };
  }
  if (typeof value === "string") return { type: "String", value };
  if (value && typeof value === "object" && typeof value.type === "string") return value;
  throw new Error("Descriptor values must be scalar values or typed contract arguments");
}

function descriptorMap(descriptor: FrameworkRegistryDescriptor = {}): FrameworkRegistryContractArg {
  return {
    type: "Map",
    value: Object.entries(descriptor).map(([key, value]) => ({
      key: { type: "String", value: requiredText(key, "descriptor key") },
      value: descriptorArg(value),
    })),
  };
}

// ─── factory ────────────────────────────────────────────────────────────────

export function createRegistrySurface(deps: RegistrySurfaceDeps): FrameworkRegistrySurface {
  const { chain } = deps;
  const config = deps.config;

  const isConfigValid = Boolean(
    config && HASH160_RE.test(String(config.registryHash ?? "").trim()),
  );

  const requireConfig = (): FrameworkRegistryConfig => {
    if (!config) {
      throw new FrameworkCapabilityError(
        "registry",
        "Platform registry is not configured on this host — set MiniAppFrameworkOptions.registry " +
          "(the network's deployed PlatformRegistry registryHash)",
      );
    }
    if (!HASH160_RE.test(String(config.registryHash ?? "").trim())) {
      throw new FrameworkCapabilityError(
        "registry",
        "Registry config is missing a valid registryHash (0x + 40 hex chars of the deployed PlatformRegistry contract)",
      );
    }
    if (config.gasHash && !HASH160_RE.test(String(config.gasHash).trim())) {
      throw new FrameworkCapabilityError(
        "registry",
        "Registry config has an invalid gasHash",
      );
    }
    return config;
  };

  const registryHash = (): string => requireConfig().registryHash.trim().toLowerCase();
  const gasHash = (): string => (requireConfig().gasHash ?? GAS_HASH).trim().toLowerCase();

  /** One registry read, auto-targeted at the configured contract (§6 item 4). */
  const read = (
    operation: string,
    args: FrameworkRegistryContractArg[] = [],
  ): Promise<unknown> => {
    return chain.read(operation, args, { scriptHash: registryHash() });
  };

  const invoke = guardedWrite(
    deps.guards,
    WRITE_PLATFORM_REGISTRY,
    async (
      operation: string,
      buildArgs: () => FrameworkRegistryContractArg[] | Promise<FrameworkRegistryContractArg[]>,
      options?: FrameworkRegistryInvokeOptions,
    ) => chain.invoke(operation, await buildArgs(), { ...(options ?? {}), scriptHash: registryHash() }),
  );
  const invokeGasTransfer = guardedWrite(
    deps.guards,
    WRITE_PLATFORM_REGISTRY,
    async (
      buildArgs: () => FrameworkRegistryContractArg[] | Promise<FrameworkRegistryContractArg[]>,
      options?: FrameworkRegistryInvokeOptions,
    ) => chain.invoke("transfer", await buildArgs(), { ...(options ?? {}), scriptHash: gasHash() }),
  );

  const resolveAppId = (appId?: string): string => {
    const resolved = String(appId ?? deps.appId ?? "").trim();
    if (!resolved) {
      throw new Error("appId is required (no host app id and none passed)");
    }
    return resolved;
  };

  const account = async (value?: string): Promise<string> => {
    const resolved = String(value ?? chain.address.get() ?? "").trim() || await chain.ensureWallet();
    return accountToHash160(resolved);
  };

  const appArg = (appId?: string): FrameworkRegistryContractArg => ({
    type: "String",
    value: resolveAppId(appId),
  });
  const hashArg = (value: string): FrameworkRegistryContractArg => ({
    type: "Hash160",
    value: toHash160Arg(value),
  });
  const integerArg = (value: string | number | bigint, label: string): FrameworkRegistryContractArg => ({
    type: "Integer",
    value: positiveInteger(value, label),
  });
  const assetHash = (asset: "NEO" | "GAS" | string): string => {
    const normalized = String(asset ?? "").trim().toUpperCase();
    if (normalized === "NEO") return NEO_HASH;
    if (normalized === "GAS") return gasHash();
    return toHash160Arg(asset);
  };

  const getApp = async (appId?: string): Promise<FrameworkRegistryApp | null> => {
    const raw = await read("getApp", [{ type: "String", value: resolveAppId(appId) }]);
    return decodeAppRow(raw);
  };

  const appAccountOf = async (appId?: string): Promise<string | null> => {
    const raw = await read("appAccountOf", [{ type: "String", value: resolveAppId(appId) }]);
    return decodeHashOrNull(raw);
  };

  const appIdOfAccount = async (accountHash: string): Promise<string> => {
    const raw = await read("appIdOfAccount", [
      { type: "Hash160", value: toHash160Arg(accountHash) },
    ]);
    return decodeText(raw);
  };

  const getAbstractAccount = async (
    appId?: string,
  ): Promise<FrameworkRegistryAbstractAccount | null> => {
    const raw = await read("getAppAbstractAccount", [
      { type: "String", value: resolveAppId(appId) },
    ]);
    if (!Array.isArray(raw) || raw.length < 3 || !parseBool(raw[2])) return null;
    const coreHash = decodeHashOrNull(raw[0]);
    const accountId = decodeHashOrNull(raw[1]);
    if (!coreHash || !accountId) return null;
    return { ...deriveVirtualAAAccount(coreHash, accountId), materialized: true };
  };

  const appIdOfAbstractAccount = async (
    coreHash: string,
    accountId: string,
  ): Promise<string> => {
    const raw = await read("appIdOfAbstractAccount", [
      { type: "Hash160", value: toHash160Arg(coreHash) },
      { type: "Hash160", value: toHash160Arg(accountId) },
    ]);
    return decodeText(raw);
  };

  const engineOf = async (appId?: string): Promise<string> => {
    const raw = await read("engineOf", [{ type: "String", value: resolveAppId(appId) }]);
    return decodeText(raw);
  };

  const isPaused = async (appId?: string): Promise<boolean> => {
    const raw = await read("isPaused", [{ type: "String", value: resolveAppId(appId) }]);
    return parseBool(raw);
  };

  const getGlobalPause = async (): Promise<FrameworkRegistryGlobalPause> => {
    const raw = await read("getGlobalPause");
    if (!Array.isArray(raw) || raw.length < 2) return { paused: false, pausedAt: 0 };
    return { paused: parseBool(raw[0]), pausedAt: Number(parseBigInt(raw[1])) };
  };

  const readHash = async (
    operation: string,
    args: FrameworkRegistryContractArg[] = [],
  ): Promise<string | null> => decodeHashOrNull(await read(operation, args));

  const readInteger = async (
    operation: string,
    args: FrameworkRegistryContractArg[] = [],
  ): Promise<bigint> => parseBigInt(await read(operation, args));

  const admin = () => readHash("admin");
  const appAdminOf = (appId?: string) => readHash("appAdminOf", [appArg(appId)]);
  const abstractAccountCore = () => readHash("abstractAccountCore");
  const pendingAbstractAccountCore = () => readHash("pendingAbstractAccountCore");
  const abstractAccountCoreAvailableAt = () => readInteger("abstractAccountCoreAvailableAt");
  const predictedAccountHash = (deployerSender: string, appId?: string) =>
    readHash("predictedAccountHash", [hashArg(deployerSender), appArg(appId)]);
  const creditOf = async (payer?: string, appId?: string) =>
    readInteger("creditOf", [appArg(appId), hashArg(await account(payer))]);
  const totalCreditLiability = () => readInteger("totalCreditLiability");
  const accruedFees = () => readInteger("accruedFees");
  const getDescriptor = (key: string, appId?: string) =>
    read("getDescriptor", [appArg(appId), { type: "String", value: requiredText(key, "descriptor key") }]);
  const artifactVersion = () => readInteger("artifactVersion");
  const artifactChecksum = () => readInteger("artifactChecksum");
  const shimUpgradeConsentOf = async (appId?: string) =>
    parseBool(await read("shimUpgradeConsentOf", [appArg(appId)]));
  const getEngine = (engineId: string) =>
    read("getEngine", [{ type: "String", value: requiredText(engineId, "engineId") }]);
  const engineIdOfHash = async (engineHash: string) =>
    decodeText(await read("engineIdOfHash", [hashArg(engineHash)]));
  const transitHopInProgress = async () => parseBool(await read("transitHopInProgress"));
  const payoutAddressOf = (appId?: string) => readHash("payoutAddressOf", [appArg(appId)]);
  const spendThresholdOf = (appId?: string) => readInteger("spendThresholdOf", [appArg(appId)]);
  const spentInWindow = (appId?: string) => readInteger("spentInWindow", [appArg(appId)]);

  const prepayGasCredit = async (
    amount: string | number | bigint,
    payer?: string,
    appId?: string,
    options?: FrameworkRegistryInvokeOptions,
  ) => invokeGasTransfer(async () => [
    hashArg(await account(payer)),
    { type: "Hash160", value: registryHash() },
    integerArg(amount, "amount"),
    { type: "String", value: `${resolveAppId(appId)}:credit` },
  ], options);

  const registerApp = async (
    engineId: string,
    descriptor: FrameworkRegistryDescriptor = {},
    appAdmin?: string,
    options?: FrameworkRegistryInvokeOptions,
  ) => invoke("registerApp", async () => [
    appArg(),
    { type: "String", value: String(engineId ?? "").trim() },
    hashArg(await account(appAdmin)),
    descriptorMap(descriptor),
  ], options);

  const tenantInvoke = (
    operation: string,
    buildTrailingArgs: () => FrameworkRegistryContractArg[] | Promise<FrameworkRegistryContractArg[]> = () => [],
    appId?: string,
    options?: FrameworkRegistryInvokeOptions,
  ) => invoke(operation, async () => [appArg(appId), ...await buildTrailingArgs()], options);

  const attachEngine = async (engineId: string, appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("attachEngine", () => [{ type: "String", value: requiredText(engineId, "engineId") }], appId, options);
  const materializeAbstractAccount = async (appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("materializeAbstractAccount", undefined, appId, options);
  const mintAccount = async (appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("mintAccount", undefined, appId, options);
  const setShimUpgradeConsent = async (consented: boolean, appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("setShimUpgradeConsent", () => [{ type: "Boolean", value: Boolean(consented) }], appId, options);
  const withdrawCredit = async (amount: string | number | bigint, appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("withdrawCredit", () => [integerArg(amount, "amount")], appId, options);
  const setDescriptor = async (
    key: string,
    value: FrameworkRegistryDescriptorValue,
    appId?: string,
    options?: FrameworkRegistryInvokeOptions,
  ) => tenantInvoke("setDescriptor", () => [
    { type: "String", value: requiredText(key, "descriptor key") },
    descriptorArg(value),
  ], appId, options);
  const executeSpendThresholdRaise = async (appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("executeSpendThresholdRaise", undefined, appId, options);
  const cancelSpendThresholdRaise = async (appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("cancelSpendThresholdRaise", undefined, appId, options);
  const proposeAppAdmin = async (newAdmin: string, appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("proposeAppAdmin", async () => [hashArg(await account(newAdmin))], appId, options);
  const executeAppAdminChange = async (appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("executeAppAdminChange", undefined, appId, options);
  const cancelAppAdminChange = async (appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("cancelAppAdminChange", undefined, appId, options);
  const setAppPaused = async (paused: boolean, appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("setAppPaused", () => [{ type: "Boolean", value: Boolean(paused) }], appId, options);
  const proposePayoutAddress = async (value: string, appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("proposePayoutAddress", async () => [hashArg(await account(value))], appId, options);
  const executePayoutAddress = async (appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("executePayoutAddress", undefined, appId, options);
  const cancelPayoutAddress = async (appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("cancelPayoutAddress", undefined, appId, options);
  const spendToPayout = async (
    asset: "NEO" | "GAS" | string,
    amount: string | number | bigint,
    appId?: string,
    options?: FrameworkRegistryInvokeOptions,
  ) => tenantInvoke("spendToPayout", () => [hashArg(assetHash(asset)), integerArg(amount, "amount")], appId, options);
  const proposeSpend = async (
    asset: "NEO" | "GAS" | string,
    amount: string | number | bigint,
    appId?: string,
    options?: FrameworkRegistryInvokeOptions,
  ) => tenantInvoke("proposeSpend", () => [hashArg(assetHash(asset)), integerArg(amount, "amount")], appId, options);
  const executeSpend = async (appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("executeSpend", undefined, appId, options);
  const cancelSpend = async (appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("cancelSpend", undefined, appId, options);
  const fundEnginePool = async (amount: string | number | bigint, appId?: string, options?: FrameworkRegistryInvokeOptions) =>
    tenantInvoke("fundEnginePool", () => [integerArg(amount, "amount")], appId, options);

  return {
    get available(): boolean {
      return isConfigValid;
    },
    getApp,
    appAccountOf,
    appIdOfAccount,
    getAbstractAccount,
    appIdOfAbstractAccount,
    engineOf,
    isPaused,
    getGlobalPause,
    admin,
    appAdminOf,
    abstractAccountCore,
    pendingAbstractAccountCore,
    abstractAccountCoreAvailableAt,
    predictedAccountHash,
    creditOf,
    totalCreditLiability,
    accruedFees,
    getDescriptor,
    artifactVersion,
    artifactChecksum,
    shimUpgradeConsentOf,
    getEngine,
    engineIdOfHash,
    transitHopInProgress,
    payoutAddressOf,
    spendThresholdOf,
    spentInWindow,
    prepayGasCredit,
    registerApp,
    attachEngine,
    materializeAbstractAccount,
    mintAccount,
    setShimUpgradeConsent,
    withdrawCredit,
    setDescriptor,
    executeSpendThresholdRaise,
    cancelSpendThresholdRaise,
    proposeAppAdmin,
    executeAppAdminChange,
    cancelAppAdminChange,
    setAppPaused,
    proposePayoutAddress,
    executePayoutAddress,
    cancelPayoutAddress,
    spendToPayout,
    proposeSpend,
    executeSpend,
    cancelSpend,
    fundEnginePool,
    // Config-free by design (same contract as the oracle dataFeed freshness
    // math): the derivation is offline math, meaningful without a directory.
    deriveAccountHash: (input) => deriveAppAccountHash(input),
  };
}
