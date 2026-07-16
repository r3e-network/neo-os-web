/**
 * framework/chain-query — app.chain.query typed read lane (RFC P0-6).
 *
 * `chain.readRaw` adopters hand-roll a `parse*` function per read (99 local
 * parsers across 39 apps). `query()` keeps the readRaw ergonomics (positional
 * operation + args) and makes the DECODE chainable:
 *
 *   `parseCount(await app.chain.readRaw("totalGames"))`
 *   → `await app.chain.query("totalGames").asInt()`
 *
 * One read per result object: the underlying `chain.read` fires lazily on the
 * first accessor and is cached, so chaining multiple accessors on the same
 * result re-uses a single RPC round-trip.
 *
 * Coercion contract (fleet-parity — the decoders reuse `utils/parsers` and
 * the canonical Hash160 handling in `utils/neo`):
 * - `asInt` / `asBigInt` / `asString` / `asBool` / `asAddress` NEVER throw on
 *   a malformed VALUE — they return the `fallback` (or the documented zero
 *   value: `0` / `0n` / `""` / `false` / `""`).
 * - A failing READ (RPC error) returns the `fallback` when one was given,
 *   otherwise rethrows — matching the try/catch-to-default pattern the
 *   hand-rolled parse sites use.
 * - `raw()` / `asArray()` / `asMap()` / `as()` propagate read errors — they
 *   are the "own your error handling" lanes.
 */

import { parseBool } from "./utils/parsers";
import { parseHash160, scriptHashToAddress } from "./utils/neo";

/** Options accepted by the framework read lanes (readRaw/readArray/query). */
export interface FrameworkReadOptions {
  /** Read a different contract than the app's primary contract. */
  scriptHash?: string;
  /** Enable the host chain-service read cache for this call. */
  cache?: boolean;
  /** Cache TTL in milliseconds (host-defined default when omitted). */
  cacheTtlMs?: number;
}

/**
 * Chainable decode handle returned by `app.chain.query(...)` — see the
 * module doc for the coercion contract.
 *
 * @example
 * ```ts
 * const total = await app.chain.query("totalGames").asInt();
 * const owner = await app.chain.query("ownerOf", [app.chain.arg.integer(id)]).asAddress();
 * const pool = await app.chain.query("getPool", [], { cache: true }).asMap<{
 *   free: bigint;
 *   locked: bigint;
 * }>({
 *   free: (raw) => parseBigInt(raw),
 *   locked: (raw) => parseBigInt(raw),
 * });
 * ```
 */
export interface FrameworkQueryResult {
  /** The untyped escape hatch (≡ `readRaw` — read errors propagate). */
  raw(): Promise<unknown>;
  /** Safe-integer decode (`Number(parseBigInt(raw))`); default fallback `0`. */
  asInt(fallback?: number): Promise<number>;
  /** BigInt decode (`parseBigInt` semantics); default fallback `0n`. */
  asBigInt(fallback?: bigint): Promise<bigint>;
  /** String decode (`String(raw)`; null/undefined → fallback); default `""`. */
  asString(fallback?: string): Promise<string>;
  /** Boolean decode (`parseBool` truthy forms); default fallback `false`. */
  asBool(fallback?: boolean): Promise<boolean>;
  /** Hash160 stack item → NEO address string; default fallback `""`. */
  asAddress(fallback?: string): Promise<string>;
  /** Array reads: the raw value when it is an array, `[]` otherwise. */
  asArray(): Promise<unknown[]>;
  /**
   * Typed struct/map decode: field-name → coercer. Works on `Map` and plain
   * object reads; MISSING fields hit their coercer with `undefined` (so the
   * coercer's own default applies).
   */
  asMap<T>(shape: { [K in keyof T]: (raw: unknown) => T[K] }): Promise<T>;
  /** Custom parser — the free-form `(raw) => T` decode lane, chainable. */
  as<T>(parse: (raw: unknown) => T): Promise<T>;
}

const NEO_ADDRESS_RE = /^N[1-9A-HJ-NP-Za-km-z]{33}$/;

/**
 * Strict integer decode: null/undefined/"" coerce to `0n` (a missing storage
 * value reads as zero on-chain), anything unparseable THROWS so the caller's
 * `fallback` applies — unlike `parseBigInt`, which silently returns `0n`.
 */
function strictBigInt(raw: unknown): bigint {
  if (raw === null || raw === undefined) return 0n;
  const text = String(raw).trim();
  return text ? BigInt(text) : 0n;
}

function fieldOf(source: unknown, key: string): unknown {
  if (source instanceof Map) return source.get(key);
  if (source && typeof source === "object" && key in (source as Record<string, unknown>)) {
    return (source as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Build a {@link FrameworkQueryResult} over a lazy read. Exported for the
 * chain surface wiring and for tests; apps reach this via
 * `app.chain.query(operation, args?, options?)`.
 */
export function createQueryResult(read: () => Promise<unknown>): FrameworkQueryResult {
  let flight: Promise<unknown> | undefined;
  const load = (): Promise<unknown> => (flight ??= read());

  /** Value-safe lane: decode never throws; read errors → fallback when given. */
  const decode = async <T>(convert: (raw: unknown) => T, fallback: T | undefined, zero: T): Promise<T> => {
    let raw: unknown;
    try {
      raw = await load();
    } catch (error) {
      if (fallback !== undefined) return fallback;
      throw error;
    }
    try {
      return convert(raw);
    } catch {
      return fallback ?? zero;
    }
  };

  return {
    async raw(): Promise<unknown> {
      return load();
    },
    asInt(fallback?: number): Promise<number> {
      return decode(
        (raw) => {
          const value = Number(strictBigInt(raw));
          if (!Number.isFinite(value)) throw new Error("not a safe integer");
          return value;
        },
        fallback,
        0,
      );
    },
    asBigInt(fallback?: bigint): Promise<bigint> {
      return decode((raw) => strictBigInt(raw), fallback, 0n);
    },
    asString(fallback?: string): Promise<string> {
      return decode(
        (raw) => (raw === null || raw === undefined ? fallback ?? "" : String(raw)),
        fallback,
        "",
      );
    },
    asBool(fallback?: boolean): Promise<boolean> {
      return decode(
        (raw) => (raw === null || raw === undefined ? fallback ?? false : parseBool(raw)),
        fallback,
        false,
      );
    },
    asAddress(fallback?: string): Promise<string> {
      return decode(
        (raw) => {
          if (typeof raw === "string" && NEO_ADDRESS_RE.test(raw.trim())) return raw.trim();
          const hash = parseHash160(raw);
          const address = hash ? scriptHashToAddress(hash) : "";
          return address || (fallback ?? "");
        },
        fallback,
        "",
      );
    },
    async asArray(): Promise<unknown[]> {
      const raw = await load();
      return Array.isArray(raw) ? raw : [];
    },
    async asMap<T>(shape: { [K in keyof T]: (raw: unknown) => T[K] }): Promise<T> {
      const raw = await load();
      const out = {} as T;
      for (const key of Object.keys(shape) as Array<keyof T & string>) {
        out[key] = shape[key](fieldOf(raw, key));
      }
      return out;
    },
    async as<T>(parse: (raw: unknown) => T): Promise<T> {
      return parse(await load());
    },
  };
}
