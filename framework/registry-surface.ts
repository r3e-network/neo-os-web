/**
 * app.registry — the PlatformRegistry directory surface (Platform Contract
 * Library v2 phase 2, docs/platform-contract-library-v2.md §3.1).
 *
 * The registry is the canonical on-chain estate ledger: appId → engine row,
 * appId → minted AppAccount, account → appId (the permission-anchoring
 * reverse index), and the per-app/global pause state engines and lane-B
 * shims consult. This surface exposes those `[Safe]` directory reads, typed
 * and auto-threaded with the host appId (§6 item 4 config-injection grammar,
 * the app.credits exemplar): apps never hand-roll `chain.read("getApp", …)`
 * against a hardcoded hash.
 *
 * READS ONLY in this phase — registration, account minting and descriptor
 * writes are pipeline/ops lanes (timelocked, witness-gated), never app
 * lanes, so the surface carries no invoke path at all.
 *
 * Config comes from `MiniAppFrameworkOptions.registry` (platform config
 * pattern, like `oracle.dataFeed` / `credits`): the app layer injects the
 * network's deployed PlatformRegistry hash. Absent/invalid ⇒ every read
 * throws a typed {@link FrameworkCapabilityError} (capability "registry") so
 * registry-aware UI degrades away cleanly on hosts without the directory —
 * branch on `registry.available`.
 *
 * `deriveAccountHash` is the ADVISORY client-side sibling of the registry's
 * `predictedAccountHash` read (§4.1 rule 4): a pure, config-free wrap of the
 * shared {@link deriveAppAccountHash} derivation. Per §4.1 rules 2–3 the
 * registry row records the ACTUAL post-deploy hash and stays the address of
 * record — never publish a predicted address before materialization, and
 * never fund one.
 */

import { FrameworkCapabilityError } from "./aa";
import { deriveAppAccountHash } from "./utils/aa-account";
import type { AppAccountHashInput } from "./utils/aa-account";
import { addressToScriptHash, parseHash160 } from "./utils/neo";
import { parseBigInt, parseBool } from "./utils/parsers";

// Re-exported so apps reach the derivation + its input type from the same
// module as the surface (the wrap lane — the logic itself stays in
// utils/aa-account, pinned by the shared CreateContractHash vectors).
export { deriveAppAccountHash };
export type { AppAccountHashInput };

// ─── config + result types ──────────────────────────────────────────────────

/**
 * Platform-injected registry config (`MiniAppFrameworkOptions.registry`).
 * Absent or invalid ⇒ every read throws a typed
 * {@link FrameworkCapabilityError} naming what is missing.
 */
export interface FrameworkRegistryConfig {
  /** Deployed PlatformRegistry contract hash for the network ("0x" + 40 hex). */
  registryHash: string;
}

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
  /** Minted AppAccount hash; null while unminted (lite tier). */
  accountHash: string | null;
  /** True once the app's AppAccount is deployed (full tier / post-mint). */
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

// ─── surface + deps ─────────────────────────────────────────────────────────

/** Chain lane the registry surface consumes (subset of the host service). */
export interface RegistrySurfaceChain {
  read(
    operation: string,
    args?: Array<{ type: string; value: unknown }>,
    options?: unknown,
  ): Promise<unknown>;
}

export interface RegistrySurfaceDeps {
  /** Host app id — the default appId every read threads (§6 item 4). */
  appId: string;
  chain: RegistrySurfaceChain;
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
  /** Minted AppAccount hash (display `0x`), or null while unminted/unknown. */
  appAccountOf(appId?: string): Promise<string | null>;
  /**
   * The permission-anchoring reverse index: the appId owning an AppAccount
   * (Neo address or Hash160 input), "" when the account is unknown.
   */
  appIdOfAccount(accountHash: string): Promise<string>;
  /** Engine id the app is attached to ("" when unattached/unknown). */
  engineOf(appId?: string): Promise<string>;
  /** Per-app pause read — true also while the global kill switch is engaged. */
  isPaused(appId?: string): Promise<boolean>;
  /** The global kill-switch state (the read the AppAccount escape hatch pins). */
  getGlobalPause(): Promise<FrameworkRegistryGlobalPause>;
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
    return config;
  };

  /** One registry read, auto-targeted at the configured contract (§6 item 4). */
  const read = (
    operation: string,
    args: Array<{ type: string; value: unknown }> = [],
  ): Promise<unknown> => {
    const cfg = requireConfig();
    return chain.read(operation, args, { scriptHash: cfg.registryHash.trim().toLowerCase() });
  };

  const resolveAppId = (appId?: string): string => {
    const resolved = String(appId ?? deps.appId ?? "").trim();
    if (!resolved) {
      throw new Error("appId is required (no host app id and none passed)");
    }
    return resolved;
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

  return {
    get available(): boolean {
      return isConfigValid;
    },
    getApp,
    appAccountOf,
    appIdOfAccount,
    engineOf,
    isPaused,
    getGlobalPause,
    // Config-free by design (same contract as the oracle dataFeed freshness
    // math): the derivation is offline math, meaningful without a directory.
    deriveAccountHash: (input) => deriveAppAccountHash(input),
  };
}
