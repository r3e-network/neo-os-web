/**
 * framework/funds — app.funds payment-carrying invoke lanes (S3) + the
 * deposit-then-act failure envelope (RFC P0-1 §2 step 7, moved verbatim
 * from index.ts).
 *
 * Every mutating lane is a payment-carrying invoke of the primary contract —
 * uniform guest guard + S11 "invoke:primary" gate composed via `guardedWrite`
 * (RFC P0-2), toasts per the S2 notify policy via the injected
 * `runWithNotify`.
 */

import { gasFixed8Amount } from "./amounts-surface";
import { accountToHash160, compactInvokeOptions, frameworkArg } from "./chain-surface";
import { guardedWrite, WRITE_PRIMARY } from "./internal/guards";
import type { FrameworkGuardDeps } from "./internal/guards";
import type { RunWithNotifyOptions } from "./notify-surface";
import { MiniAppError } from "./utils/errors";
import type { Observable } from "./reactive";
import type {
  FrameworkDepositSettlement,
  FrameworkFundsSurface,
  FrameworkInvokeOptions,
  FrameworkPaySpec,
  FrameworkPrepayDepositLane,
  FrameworkPrepaySpec,
  FrameworkReceiptPaySpec,
  FrameworkTxResult,
  FrameworkWriteSpec,
  MiniAppFrameworkChain,
} from "./types";

/**
 * Deposit-then-act failure envelope (S3): the prepaid GAS deposit transfer
 * was BROADCAST on-chain but the consuming call failed — the funds are NOT
 * lost, they sit as withdrawable credit on the contract. Apps branch on this
 * class (gasbox / dev-tipping / self-loan / gov-merc / time-capsule) to show
 * localized recovery copy, so the class identity must stay stable: it is
 * exported here (re-exported by framework/index and apps/shared) so
 * `instanceof` resolves to a single class everywhere.
 */
export class FrameworkPrepaidActionError extends MiniAppError {
  /** Txid of the BROADCAST deposit transfer (recovery affordances link it). */
  readonly txid: string;
  /** The consuming operation that failed after the deposit went out. */
  readonly operation: string;
  /** The underlying error thrown by the consuming call. */
  readonly actionError: unknown;
  /** How far the deposit was proven when the consuming call failed. */
  readonly settlement: FrameworkDepositSettlement;
  /**
   * Discriminant: `settlement === "confirmed"` — the deposit is PROVEN in a
   * block. On "timeout"/"unreachable" the deposit is merely unproven by the
   * indexer, not absent; the stranded-credit recovery copy applies either
   * way, which is why apps branch on `instanceof`, not on this flag.
   */
  readonly depositConfirmed: boolean;

  constructor(
    operation: string,
    txid: string,
    actionError: unknown,
    settlement: FrameworkDepositSettlement = "confirmed",
  ) {
    const reason =
      actionError instanceof Error ? actionError.message : String(actionError);
    const depositState =
      settlement === "confirmed" ? "confirmed" : `broadcast (settlement ${settlement})`;
    super(
      `Deposit ${depositState} but "${operation}" failed — the prepaid credit remains on the contract and is withdrawable (deposit tx ${txid}): ${reason}`,
      "PREPAID_ACTION_FAILED",
      undefined,
      { operation, txid, settlement },
    );
    this.name = "FrameworkPrepaidActionError";
    this.txid = txid;
    this.operation = operation;
    this.actionError = actionError;
    this.settlement = settlement;
    this.depositConfirmed = settlement === "confirmed";
  }
}

/**
 * Recognize the host chain-service's deposit-confirmed failure shape
 * (apps/shared DepositConfirmedActionFailedError) structurally — the
 * framework cannot import it (package boundary), and hosts may ship their
 * own equivalent.
 */
function isDepositConfirmedFailure(error: unknown): error is Error & {
  operation?: unknown;
  depositTxid: string;
  actionError: unknown;
  settlement?: unknown;
} {
  return (
    error instanceof Error &&
    typeof (error as { depositTxid?: unknown }).depositTxid === "string" &&
    "actionError" in error
  );
}

/**
 * Read the host error's settlement field, defaulting to "confirmed" for host
 * shapes that predate the field (their wrap used to be confirmed-only).
 */
function settlementOf(error: { settlement?: unknown }): FrameworkDepositSettlement {
  return error.settlement === "timeout" || error.settlement === "unreachable"
    ? error.settlement
    : "confirmed";
}

/** Translate host deposit-confirmed failures into the stable framework class. */
function toPrepaidActionError(error: unknown): unknown {
  if (error instanceof FrameworkPrepaidActionError) return error;
  if (isDepositConfirmedFailure(error)) {
    return new FrameworkPrepaidActionError(
      String(error.operation ?? ""),
      error.depositTxid,
      error.actionError,
      settlementOf(error),
    );
  }
  return error;
}

/**
 * Map a contract revert onto an app i18n key (gov-merc's `windowRevertKey`
 * pattern, generalized — S3). Patterns are tried in map insertion order;
 * string patterns match as case-insensitive substrings, RegExps with their
 * own flags. A {@link FrameworkPrepaidActionError} message embeds the
 * consuming call's revert reason, so it matches here too. Returns the first
 * matching key, or `null` so callers keep their own fallback handling.
 */
export function revertKeyOf<K extends string>(
  error: unknown,
  map: Record<K, RegExp | string | ReadonlyArray<RegExp | string>>,
): K | null {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) return null;
  const haystack = message.toLowerCase();
  for (const key of Object.keys(map) as K[]) {
    const patterns = map[key];
    const list: ReadonlyArray<RegExp | string> = Array.isArray(patterns)
      ? patterns
      : [patterns as RegExp | string];
    for (const pattern of list) {
      const matched =
        typeof pattern === "string"
          ? haystack.includes(pattern.toLowerCase())
          : pattern.test(message);
      if (matched) return key;
    }
  }
  return null;
}

function fixed8Amount(spec: FrameworkPaySpec): string {
  if (spec.amountFixed8 !== undefined) return String(spec.amountFixed8);
  return gasFixed8Amount(spec.amountGas ?? "");
}

/**
 * Fixed settle delay applied by the custom deposit lane when no
 * deposit-confirmation source exists or the indexer is unreachable — the
 * same 4s fallback the host prepay lane (and the app flows this lane
 * retires) use before the consuming call.
 */
const DEPOSIT_SETTLE_FALLBACK_MS = 4_000;

export interface FundsSurfaceDeps {
  /** Raw host chain service. */
  chain: MiniAppFrameworkChain;
  /**
   * Stable contract-address observable (the deposit lane's recipient) —
   * the same source the chain surface exposes as `chain.contractAddress`.
   */
  contractAddress: Observable<string | null>;
  /** Guest guard + S11 permission gate (RFC P0-2). */
  guards: FrameworkGuardDeps;
  /** S2 notify-policy wrapper. */
  runWithNotify<T>(work: () => Promise<T>, runOptions?: RunWithNotifyOptions<T>): Promise<T>;
  /** The `app.chain.write` lane (withdrawCredit delegates to it). */
  write(spec: FrameworkWriteSpec & FrameworkInvokeOptions): Promise<FrameworkTxResult>;
}

/**
 * Build the `app.funds` surface (see module doc).
 *
 * @example
 * ```ts
 * const funds = createFundsSurface({ chain, contractAddress, guards, runWithNotify, write });
 * await funds.payAndCall({ operation: "tip", args, amountGas: "0.5", memo: "tip" });
 * ```
 */
export function createFundsSurface(deps: FundsSurfaceDeps): FrameworkFundsSurface {
  const { chain, contractAddress: contractAddressAccessor, guards, runWithNotify } = deps;
  const arg = frameworkArg;

  /**
   * Asset-parameterized deposit-then-act lane (S3 — milestone-escrow's
   * NEO|GAS escrows): the prepaid deposit is a NEP-17 transfer on the ASSET
   * token contract rather than the host's GAS-only prepay lane, so the
   * framework owns the transfer → confirmation wait → consuming call here.
   *
   * Once the deposit transfer has been accepted (txid), ANY consuming-call
   * failure is wrapped in {@link FrameworkPrepaidActionError}: the credit
   * sits on the contract under (asset, sender) and is recoverable by
   * retrying or withdrawing, so apps surface their localized stranded-credit
   * copy instead of a generic payment error — including on "timeout"
   * settlements, mirroring the app flows this lane retires (the deposit is
   * broadcast either way; only its indexing is unproven).
   */
  const prepayViaDepositLane = async (
    spec: FrameworkPrepaySpec & FrameworkInvokeOptions,
    lane: FrameworkPrepayDepositLane,
  ): Promise<FrameworkTxResult> => {
    const from = chain.address.get() || (await chain.ensureWallet());
    const to = contractAddressAccessor.get();
    if (!to) {
      throw new MiniAppError("Contract address is not configured", "CONTRACT_MISSING");
    }
    // Step 1: DEPOSIT — the transfer targets the TOKEN contract
    // (lane.scriptHash); the recipient is the app contract, whose
    // OnNEP17Payment credits the sender's prepaid balance for the memo.
    const transfer = await chain.invoke(
      "transfer",
      [
        arg.hash160(from),
        arg.hash160(to),
        arg.integer(fixed8Amount(spec)),
        arg.string(spec.memo),
      ],
      { scriptHash: lane.scriptHash },
    );
    // Step 2: wait for the deposit to land in a block before the consuming
    // call — intra-block ordering is fee/hash-based, so an unconfirmed
    // deposit lets the consuming call execute first and fault on missing
    // credit. Without a confirmation source, or when the indexer is
    // unreachable, fall back to the fixed settle delay.
    const settlement = lane.confirm ? await lane.confirm(transfer.txid) : "unreachable";
    if (settlement === "unreachable") {
      await new Promise((resolve) => setTimeout(resolve, DEPOSIT_SETTLE_FALLBACK_MS));
    }
    // Step 3: the consuming call. Failures after the deposit are the
    // stranded-credit branch (see the doc comment above) — the wrap carries
    // the OBSERVED settlement so "timeout"/"unreachable" deposits are not
    // reported as proven ("confirmed") in the recovery copy.
    try {
      const tx = await chain.invoke(spec.operation, spec.args, compactInvokeOptions(spec));
      if (tx.success !== false) await spec.reload?.();
      return tx;
    } catch (error) {
      throw new FrameworkPrepaidActionError(spec.operation, transfer.txid, error, settlement);
    }
  };

  return {
    /**
     * Pay-and-call in one step. When the host settles the payment as a
     * separate confirmed deposit and the consuming call then fails, the
     * error surfaces as {@link FrameworkPrepaidActionError} — the credit is
     * withdrawable, not lost.
     */
    // S11: every mutating funds lane is a payment-carrying invoke of the
    // primary contract — uniform "invoke:primary" gate (see app.permissions).
    payAndCall: guardedWrite(
      guards,
      WRITE_PRIMARY,
      async (spec: FrameworkPaySpec & FrameworkInvokeOptions): Promise<FrameworkTxResult> =>
        runWithNotify(async () => {
        let tx: FrameworkTxResult;
        try {
          tx = await chain.invokeWithPayment(
            fixed8Amount(spec),
            spec.memo,
            spec.operation,
            spec.args,
            compactInvokeOptions(spec),
          );
        } catch (error) {
          throw toPrepaidActionError(error);
        }
        if (tx.success !== false) await spec.reload?.();
        return tx;
      }, spec),
    ),
    /**
     * Deposit-then-act (S3): transfer GAS to the contract with a memo, wait
     * for the credit to confirm in a block, then run the consuming
     * operation — the lane gasbox reaches via chain.prepayAndInvoke and
     * custom-anchor via waitForDepositConfirmation. When the deposit landed
     * but the consuming call reverted, the error is a
     * {@link FrameworkPrepaidActionError} so apps can show localized
     * recovery copy (the credit is withdrawable). Hosts without a prepay
     * lane — and specs passing `waitForCredit: false` — fall back to the
     * atomic invokeWithPayment bundle. Specs carrying a custom `deposit`
     * lane (asset-token transfers — see {@link FrameworkPrepayDepositLane})
     * run the framework-owned two-step sequence instead.
     */
    // S11: uniform "invoke:primary" gate for mutating funds lanes.
    prepayAndCall: guardedWrite(
      guards,
      WRITE_PRIMARY,
      async (spec: FrameworkPrepaySpec & FrameworkInvokeOptions): Promise<FrameworkTxResult> =>
        runWithNotify(async () => {
        if (spec.deposit) return prepayViaDepositLane(spec, spec.deposit);
        const amountFixed8 = fixed8Amount(spec);
        const invokeOptions = compactInvokeOptions(spec);
        let tx: FrameworkTxResult;
        try {
          tx = chain.prepayAndInvoke && spec.waitForCredit !== false
            ? await chain.prepayAndInvoke(
                amountFixed8,
                spec.memo,
                spec.operation,
                spec.args,
                invokeOptions,
              )
            : await chain.invokeWithPayment(
                amountFixed8,
                spec.memo,
                spec.operation,
                spec.args,
                invokeOptions,
              );
        } catch (error) {
          throw toPrepaidActionError(error);
        }
        if (tx.success !== false) await spec.reload?.();
        return tx;
      }, spec),
    ),
    /**
     * Receipt-id deposit lane (S3, mainnet): the GAS was pre-transferred
     * with the deposit memo in a separate settled transaction; the
     * consuming call carries the resulting receipt id as its trailing
     * Integer argument (flashloan deposit, memorial-shrine tribute).
     */
    // S11: uniform "invoke:primary" gate for mutating funds lanes.
    receiptPay: guardedWrite(
      guards,
      WRITE_PRIMARY,
      async (spec: FrameworkReceiptPaySpec & FrameworkInvokeOptions): Promise<FrameworkTxResult> =>
        runWithNotify(async () => {
          const receiptId = String(spec.receiptId ?? "").trim();
          if (!/^[1-9]\d*$/.test(receiptId)) {
            throw new MiniAppError(
              "Receipt id must be a positive integer",
              "RECEIPT_ID_INVALID",
            );
          }
          const tx = await chain.invoke(
            spec.operation,
            [...spec.args, arg.integer(receiptId)],
            compactInvokeOptions(spec),
          );
          if (tx.success !== false) await spec.reload?.();
          return tx;
        }, spec),
    ),
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
    // S11: gate explicitly (chain.write inside re-checks) so a denial
    // rejects BEFORE ensureWallet() can pop a wallet prompt.
    withdrawCredit: guardedWrite(
      guards,
      WRITE_PRIMARY,
      async (operation = "withdraw", successKey?: string): Promise<FrameworkTxResult> => {
        const user = accountToHash160(await chain.ensureWallet());
        return deps.write({
          operation,
          args: [{ type: "Hash160", value: user }],
          waitForEvent: "CreditWithdrawn",
          successKey,
        });
      },
    ),
  };
}
