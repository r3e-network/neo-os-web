/**
 * framework/chain-surface — app.chain (RFC P0-1 §2 step 6, moved verbatim
 * from index.ts).
 *
 * The contract read/write surface: arg builders, raw + typed reads
 * (`readRaw` / `read(spec)` / `query` / `readArray`), the
 * guarded broadcast lanes (`invoke` / `invokeWithPayment` / `write` /
 * `invokeMultiple`), message signing, the post-broadcast `waitForState`
 * poll, and the event helpers. Write lanes compose the RFC P0-2 ordering
 * (guest guard → S11 gate → notify wrap → reload-on-success) via
 * `guardedWrite` + the injected `runWithNotify`.
 */

import { type Observable } from "./reactive";
import { createQueryResult } from "./chain-query";
import type { FrameworkQueryResult, FrameworkReadOptions } from "./chain-query";
import { guardedWrite, WRITE_PRIMARY } from "./internal/guards";
import type { FrameworkGuardDeps } from "./internal/guards";
import type { RunWithNotifyOptions } from "./notify-surface";
import { eventStateValue } from "./utils/chain-events";
import { MiniAppError } from "./utils/errors";
import { addressToScriptHash } from "./utils/neo";
import type {
  FrameworkArgBuilder,
  FrameworkChainSurface,
  FrameworkContractArg,
  FrameworkInvokeCall,
  FrameworkInvokeOptions,
  FrameworkMultiInvokeOptions,
  FrameworkMultiInvokeResult,
  FrameworkPaySpec,
  FrameworkReadSpec,
  FrameworkSignedMessage,
  FrameworkTxResult,
  FrameworkWaitForStateOptions,
  FrameworkWriteSpec,
  MiniAppFrameworkChain,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Compact the write/pay spec's invoke-option fields into a bare
 * {@link FrameworkInvokeOptions} record (shared with the funds lanes).
 */
export function compactInvokeOptions(
  spec: FrameworkWriteSpec | FrameworkPaySpec,
): FrameworkInvokeOptions {
  const source = spec as FrameworkWriteSpec & FrameworkInvokeOptions;
  const options: FrameworkInvokeOptions = {};
  if (source.scriptHash) options.scriptHash = source.scriptHash;
  if (source.signers) options.signers = source.signers;
  if (source.waitForEvent) options.waitForEvent = source.waitForEvent;
  if (source.waitTimeoutMs) options.waitTimeoutMs = source.waitTimeoutMs;
  if (source.onPaymentSent) options.onPaymentSent = source.onPaymentSent;
  if (source.onTransactionSent) {
    options.onTransactionSent = source.onTransactionSent;
  }
  return options;
}

/**
 * Normalize a Neo N3 address or (0x-)Hash160 into the canonical lowercase
 * `0x…` script-hash form (shared with the funds lanes).
 */
export function accountToHash160(value: string): string {
  const raw = String(value ?? "").trim();
  if (/^(0x)?[0-9a-fA-F]{40}$/.test(raw)) {
    return raw.startsWith("0x") ? raw.toLowerCase() : `0x${raw.toLowerCase()}`;
  }
  const converted = addressToScriptHash(raw);
  if (/^0x[0-9a-fA-F]{40}$/.test(converted)) return converted.toLowerCase();
  throw new Error("Account must be a valid Neo N3 address or Hash160");
}

/** The stateless `app.chain.arg` contract-argument builders. */
export const frameworkArg: FrameworkArgBuilder = {
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
  /**
   * Hash160 argument that passes the value through UNCONVERTED.
   *
   * Deployed-ABI quirk lane (memorial-shrine, neo-ns): some live contracts
   * were deployed with Hash160 parameters that actually expect the RAW
   * base58 address literal, and the wallet/RPC layer must receive it
   * verbatim. Routing those through {@link hash160} would convert the
   * address to a script hash and silently change on-chain behavior — for
   * these parameters this builder MUST be used and `arg.hash160` must NOT.
   */
  hash160Raw(value: string): FrameworkContractArg {
    return { type: "Hash160", value: String(value ?? "") };
  },
  /** 33-byte compressed secp256r1 public key (bare hex; 0x prefix stripped). */
  publicKey(value: string): FrameworkContractArg {
    const raw = String(value ?? "").trim().replace(/^0x/i, "");
    if (!/^(02|03)[0-9a-fA-F]{64}$/.test(raw)) {
      throw new Error("PublicKey must be a 33-byte compressed key in hex");
    }
    return { type: "PublicKey", value: raw };
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

export interface ChainSurfaceDeps {
  /** Raw host chain service. */
  chain: MiniAppFrameworkChain;
  /**
   * Stable contract-address observable (the composition root builds one
   * source shared with the funds deposit lane).
   */
  contractAddress: Observable<string | null>;
  /** Guest guard + S11 permission gate (RFC P0-2). */
  guards: FrameworkGuardDeps;
  /** S2 notify-policy wrapper (write / invokeMultiple lanes). */
  runWithNotify<T>(work: () => Promise<T>, runOptions?: RunWithNotifyOptions<T>): Promise<T>;
  /** Launch-context network fallback for {@link FrameworkChainSurface.detectNetwork}. */
  fallbackNetwork(): string;
}

/**
 * Build the `app.chain` surface (see module doc).
 *
 * @example
 * ```ts
 * const chainSurface = createChainSurface({
 *   chain, contractAddress, guards, runWithNotify,
 *   fallbackNetwork: () => "testnet",
 * });
 * const total = await chainSurface.query("totalGames").asInt();
 * ```
 */
export function createChainSurface(deps: ChainSurfaceDeps): FrameworkChainSurface {
  const { chain, contractAddress: contractAddressAccessor, guards, runWithNotify } = deps;
  const arg = frameworkArg;

  // Derived read-only readiness flag (S7): true once the deployed contract
  // address is known — the gate milestone-escrow derives from the raw service
  // today. `set` is a no-op (derived value), subscriptions ride the source.
  const contractReadyObservable: Observable<boolean> = {
    get: () => Boolean(contractAddressAccessor.get()),
    set: () => {},
    subscribe: (listener) => contractAddressAccessor.subscribe(listener),
  };

  return {
    arg,
    /** Underlying wallet-address accessor (observable in the platform host). */
    get address() {
      return chain.address;
    },
    /** Deployed contract-address observable; a null-observable when unset. */
    get contractAddress() {
      return contractAddressAccessor;
    },
    /**
     * True once the app's contract address is configured for the network —
     * NOT whether a wallet is connected (S7; the deployment-pending gate
     * milestone-escrow hand-derives today). Read-only derived observable.
     */
    get contractReady(): Observable<boolean> {
      return contractReadyObservable;
    },
    async ensureWallet() {
      return chain.ensureWallet();
    },
    /** Current network label (e.g. "testnet"/"mainnet") if the host exposes it. */
    async detectNetwork(): Promise<string> {
      return (await chain.detectNetwork?.()) ?? deps.fallbackNetwork();
    },
    /**
     * Typed read via a spec object.
     * @deprecated Use {@link query} — `chain.query(op, args).as(parse)` is
     * the chainable successor (the spec-object form found no adopters).
     */
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
     * Prefer {@link query} for typed decodes (`readRaw` ≡ `query(...).raw()`).
     */
    async readRaw(
      operation: string,
      args?: FrameworkContractArg[],
      options?: FrameworkReadOptions,
    ): Promise<unknown> {
      return chain.read(operation, args, options);
    },
    /** Raw ARRAY read — for contract methods returning a list stack item. */
    async readArray(
      operation: string,
      args?: FrameworkContractArg[],
      options?: FrameworkReadOptions,
    ): Promise<unknown[]> {
      return (await chain.readArray?.(operation, args, options)) ?? [];
    },
    /**
     * Chainable typed read (RFC P0-6): one RPC read, decoded via
     * `asInt`/`asBigInt`/`asString`/`asBool`/`asAddress`/`asArray`/`asMap`/
     * `as(parse)` — see {@link FrameworkQueryResult} for the coercion
     * contract. Read lane: NOT guest-guarded, NOT permission-gated.
     *
     * @example
     * ```ts
     * const total = await app.chain.query("totalGames").asInt();
     * const paused = await app.chain.query("isPaused").asBool(false);
     * ```
     */
    query(
      operation: string,
      args?: FrameworkContractArg[],
      options?: FrameworkReadOptions,
    ): FrameworkQueryResult {
      return createQueryResult(() => chain.read(operation, args, options));
    },
    /**
     * Raw invoke with NO notify/reload wrapping — for composables that own
     * their own multi-step control flow and error reporting. Use
     * {@link write} instead for simple fire-and-notify writes.
     *
     * S11 central gate: requires the "invoke:primary" manifest permission.
     * Hosts that deliver no manifest permission declaration at all
     * default-allow (see the app.permissions wiring in the composition
     * root), so existing standalone/test contexts are unaffected; `async`
     * so a denial rejects instead of throwing synchronously.
     */
    invoke: guardedWrite(
      guards,
      WRITE_PRIMARY,
      async (
        operation: string,
        args: FrameworkContractArg[],
        options?: FrameworkInvokeOptions,
      ): Promise<FrameworkTxResult> => chain.invoke(operation, args, options),
    ),
    /**
     * Raw pay-and-call with NO notify/reload wrapping (see {@link invoke}).
     * S11: a payment-carrying invoke of the primary contract — same
     * "invoke:primary" gate as {@link invoke}; denials reject.
     */
    invokeWithPayment: guardedWrite(
      guards,
      WRITE_PRIMARY,
      async (
        amount: string,
        memo: string,
        operation: string,
        args: FrameworkContractArg[],
        options?: FrameworkInvokeOptions,
      ): Promise<FrameworkTxResult> =>
        chain.invokeWithPayment(amount, memo, operation, args, options),
    ),
    // S11: write is the fire-and-notify wrapper over chain.invoke — the
    // same "invoke:primary" gate, composed BEFORE the notify wrapping so a
    // denial rejects exactly like the raw invoke lane (RFC P0-2 ordering:
    // guest guard → permission gate → notify wrap → reload-on-success).
    write: guardedWrite(
      guards,
      WRITE_PRIMARY,
      async (spec: FrameworkWriteSpec & FrameworkInvokeOptions): Promise<FrameworkTxResult> =>
        runWithNotify(async () => {
          const tx = await chain.invoke(spec.operation, spec.args, compactInvokeOptions(spec));
          if (tx.success !== false) await spec.reload?.();
          return tx;
        }, spec),
    ),
    /**
     * Raw event page.
     * @deprecated Alias of `app.events.list` — one concept, one home (S4).
     */
    async events(eventName: string, options?: { limit?: number; offset?: number }): Promise<unknown[]> {
      return chain.listEvents?.(eventName, options) ?? [];
    },
    /** Canonical positional event-state slot decode (utils/chain-events). */
    eventValue: eventStateValue,
    /**
     * Sign an arbitrary message with the connected wallet, normalizing the
     * wallet-specific result shapes (bare signature string vs
     * `{ signature | data, publicKey }` records) into one typed envelope
     * (S7 — neo-sign-anything, neodid-passport).
     */
    async signMessage(message: string): Promise<FrameworkSignedMessage> {
      if (!chain.signMessage) {
        throw new MiniAppError(
          "Wallet does not support message signing",
          "SIGN_UNSUPPORTED",
        );
      }
      const result = await chain.signMessage(message);
      if (typeof result === "string" && result) return { signature: result };
      if (isRecord(result)) {
        const signatureSource = result.signature ?? result.data;
        const signature =
          signatureSource === undefined || signatureSource === null || signatureSource === ""
            ? JSON.stringify(result)
            : String(signatureSource);
        const publicKey = result.publicKey ?? result.publicKeyHash ?? result.pubkey;
        const data = typeof result.data === "string" && result.data ? result.data : undefined;
        const account = result.account ?? result.address;
        return {
          signature,
          ...(publicKey ? { publicKey: String(publicKey) } : {}),
          ...(data ? { data } : {}),
          ...(account ? { account: String(account) } : {}),
        };
      }
      throw new MiniAppError("Wallet returned no signature", "SIGN_EMPTY_RESULT");
    },
    /**
     * Multi-script single-transaction invoke with custom signer scopes
     * (S7 — aa-market-hub's transfer-then-settle with scopes-16
     * allowedContracts). FAULT-state results throw with the VM exception
     * SANITIZED: short assert strings pass through, anything else becomes
     * a generic message so raw VM dumps never reach a toast.
     */
    // S11: multi-call transactions broadcast invokes like the single-call
    // lanes — uniform "invoke:primary" gate (composed via guardedWrite).
    invokeMultiple: guardedWrite(
      guards,
      WRITE_PRIMARY,
      async (
        calls: FrameworkInvokeCall[],
        multiOptions: FrameworkMultiInvokeOptions = {},
      ): Promise<FrameworkMultiInvokeResult> =>
        runWithNotify(async () => {
        if (!chain.invokeMultiple) {
          throw new MiniAppError(
            "Host chain service does not support invokeMultiple",
            "INVOKE_MULTIPLE_UNSUPPORTED",
          );
        }
        const result = await chain.invokeMultiple(
          calls,
          {
            ...(multiOptions.signers ? { signers: multiOptions.signers } : {}),
            ...(multiOptions.onTransactionSent
              ? { onTransactionSent: multiOptions.onTransactionSent }
              : {}),
          },
        );
        if (String(result?.state ?? "").toUpperCase().includes("FAULT")) {
          const exception = result?.exception;
          const sanitized =
            typeof exception === "string" && exception.length < 100
              ? exception
              : "Contract operation failed";
          throw new Error(sanitized);
        }
        return result;
      }, { notify: multiOptions.notify }),
    ),
    /**
     * Post-broadcast confirmation poll (S7): RPC nodes lag behind a fresh
     * tx, so re-read state until the predicate passes. Verbatim
     * aa-account-lab/aa-session-key-lab semantics: 4 attempts, delay BEFORE
     * each read (4s first, then 5s), per-attempt read errors swallowed.
     * Resolves with the first matching value, or `null` once the attempt
     * budget is exhausted.
     */
    async waitForState<T>(
      read: () => Promise<T>,
      until: (value: T) => boolean,
      waitOptions: FrameworkWaitForStateOptions = {},
    ): Promise<T | null> {
      const attempts = waitOptions.attempts ?? 4;
      const firstDelayMs = waitOptions.firstDelayMs ?? 4000;
      const delayMs = waitOptions.delayMs ?? 5000;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, attempt === 0 ? firstDelayMs : delayMs),
        );
        try {
          const value = await read();
          if (until(value)) return value;
        } catch {
          /* RPC hiccup or node lag — keep retrying within the budget. */
        }
      }
      return null;
    },
  };
}
