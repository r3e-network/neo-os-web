/**
 * Contract Interaction Composable
 *
 * Provides a unified API for reading from and writing to Neo N3 smart contracts.
 * Wraps invokeRead with automatic result parsing, invokeContract with the
 * direct-prepaid GAS flow, and event waiting — the three operations repeated across
 * virtually every miniapp composable.
 *
 * @example
 * ```ts
 * const { read, invoke, waitForTxEvent } = useContractInteraction({
 *   appId: "miniapp-burn-league",
 *   t,
 * });
 *
 * // Read-only call with automatic parsing
 * const totalBurned = parseGas(await read("TotalBurned"));
 *
 * // Write call through direct-prepaid GAS
 * const { txid, waitForEvent } = await invoke("1.0", "burn", "burnGas", [
 *   { type: "Hash160", value: address.value },
 *   { type: "Integer", value: toFixed8("1") },
 * ]);
 * await waitForTxEvent(txid, "GasBurned", waitForEvent);
 * ```
 */

import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK, WalletSigner } from "@shared/utils/wallet-sdk";
import { useEvents, usePayments } from "@shared/utils/wallet-sdk";
import { useContractAddress } from "./useContractAddress";
import { parseInvokeResult, parseStackItem } from "../utils/neo";
import { extractTxid, pollForTxEvent } from "../utils/transaction";
import { waitForTransactionStatus } from "../utils/n3index";
import type { Network, TransactionWaitStatus } from "../utils/n3index";
import {
  BLOCKCHAIN_CONSTANTS,
  TIME_CONSTANTS,
  getNetwork,
  resolveNeoNetwork,
} from "../constants";
import { createObservable, refToObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";

type InvokeArg = {
  type: string;
  value: string | number | boolean;
};

// ---------------------------------------------------------------------------
// Deposit confirmation
// ---------------------------------------------------------------------------

/**
 * Outcome of a deposit-confirmation wait:
 *  - "confirmed"   — the deposit tx is indexed in a block; the prepaid credit exists
 *  - "timeout"     — the indexer is reachable but the tx never appeared in time
 *  - "unreachable" — the indexer could not be queried (or no txid was available);
 *                    callers should fall back to a fixed settle delay
 */
export type DepositConfirmation = TransactionWaitStatus;

export interface DepositConfirmationOptions {
  /** Indexer network to poll. Defaults to the host's ?network= selection. */
  network?: Network;
  /**
   * Contract whose decoded events prove the deposit landed. Defaults to the
   * GAS token contract — a prepaid deposit is a NEP-17 transfer, so its
   * Transfer event is indexed there once the tx is in a block.
   */
  contractHash?: string;
  /** Overall polling deadline. Default: ~2 Neo N3 blocks (~15s each). */
  timeoutMs?: number;
  /** Delay between indexer polls. Default: 3s. */
  pollIntervalMs?: number;
}

/**
 * Poll the N3Index until a broadcast deposit transfer is confirmed in a block.
 *
 * Deposit-then-act contracts fault with "insufficient prepaid gas" when the
 * consuming call lands before the deposit, so the prepaid flows wait for this
 * confirmation instead of sleeping a fixed interval. Exported so per-app
 * composables that broadcast their own deposit transfers can adopt the same
 * settle-before-consume pattern.
 */
export async function waitForDepositConfirmation(
  txid: string,
  options: DepositConfirmationOptions = {},
): Promise<DepositConfirmation> {
  if (!txid) return "unreachable";
  const { status } = await waitForTransactionStatus(
    options.network ?? getNetwork(),
    txid,
    options.contractHash ?? BLOCKCHAIN_CONSTANTS.GAS_HASH,
    options.timeoutMs,
    options.pollIntervalMs,
  );
  return status;
}

/**
 * Thrown when the prepaid deposit transfer was BROADCAST on-chain but the
 * follow-up contract call failed: the funds are not lost — they sit as
 * withdrawable credit on the contract. Callers should surface a recovery hint
 * (credit is withdrawable / retry the action) instead of a generic payment
 * failure.
 *
 * `settlement` records how far the deposit was proven when the consuming call
 * failed: "confirmed" means the indexer saw it in a block; "timeout" and
 * "unreachable" mean the transfer was broadcast (funds left the wallet) but
 * its indexing could not be proven — the credit is still on the contract once
 * the transfer lands, so recovery copy applies either way.
 */
export class DepositConfirmedActionFailedError extends Error {
  readonly operation: string;
  readonly depositTxid: string;
  readonly actionError: unknown;
  /** Settlement state of the deposit when the consuming call failed. */
  readonly settlement: DepositConfirmation;

  constructor(
    operation: string,
    depositTxid: string,
    actionError: unknown,
    settlement: DepositConfirmation = "confirmed",
  ) {
    const reason =
      actionError instanceof Error ? actionError.message : String(actionError);
    const depositState =
      settlement === "confirmed" ? "confirmed" : `broadcast (settlement ${settlement})`;
    super(
      `Deposit ${depositState} but "${operation}" failed — the prepaid credit remains on the contract and is withdrawable (deposit tx ${depositTxid}): ${reason}`,
    );
    this.name = "DepositConfirmedActionFailedError";
    this.operation = operation;
    this.depositTxid = depositTxid;
    this.actionError = actionError;
    this.settlement = settlement;
  }
}

export interface ContractInteractionOptions {
  /** App ID used for payment flow and event listing */
  appId: string;
  /** Translation function for error messages */
  t: (key: string) => string;
  /** Optional pre-existing wallet instance to reuse */
  wallet?: WalletSDK;
  /**
   * Override the deposit-confirmation wait used by the prepaid flows.
   * Defaults to {@link waitForDepositConfirmation} polling the N3Index on the
   * wallet's network. Injectable for tests and apps that need custom pacing.
   */
  confirmDeposit?: (txid: string) => Promise<DepositConfirmation>;
}

export function useContractInteraction(options: ContractInteractionOptions) {
  const { appId, t, wallet: externalWallet } = options;

  const wallet = externalWallet ?? (useWallet() as WalletSDK);
  const { connect, invokeContract, invokeRead } = wallet;
  const address = refToObservable(wallet.address);
  const {
    contractAddress,
    ensure: ensureContractAddress,
    ensureSafe,
  } = useContractAddress(t, appId);
  const { payGAS } = usePayments(appId);
  const { list: listEvents } = useEvents();

  const isProcessing: Observable<boolean> = createObservable(false);
  const paymentError: Observable<Error | null> = createObservable<Error | null>(
    null,
  );
  const paymentSuccess: Observable<boolean> = createObservable(false);
  let successTimer: ReturnType<typeof setTimeout> | null = null;
  let waitTimers: ReturnType<typeof setTimeout>[] = [];

  /** Disposable sleep — timers are tracked so dispose() can clear them. */
  const delay = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      waitTimers.push(timer);
    });

  /** Indexer network matching the connected wallet's chain. */
  const walletNetwork = (): Network =>
    resolveNeoNetwork(wallet.chainType?.value ?? "");

  const confirmDeposit =
    options.confirmDeposit ??
    ((txid: string) =>
      waitForDepositConfirmation(txid, { network: walletNetwork() }));

  /**
   * Ensure wallet is connected, connecting if needed.
   * Throws if the user declines.
   */
  const ensureWallet = async (): Promise<string> => {
    if (!address.get()) {
      await connect();
    }
    if (!address.get()) {
      throw new Error(t("connectWallet") || "Wallet not connected");
    }
    return address.get()!;
  };

  /**
   * Read-only contract call with automatic result parsing.
   * Returns the parsed first stack item (or array if multiple).
   */
  const read = async (
    operation: string,
    args?: InvokeArg[],
    scriptHash?: string,
  ): Promise<unknown> => {
    const contract = scriptHash ?? (await ensureContractAddress());
    const result = await invokeRead({
      scriptHash: contract,
      operation,
      ...(args && { args }),
    });
    return parseInvokeResult(result);
  };

  /**
   * Read-only call that returns an array of parsed stack items.
   * Useful when the contract returns a Struct/Array with multiple fields.
   */
  const readArray = async (
    operation: string,
    args?: InvokeArg[],
    scriptHash?: string,
  ): Promise<unknown[]> => {
    const result = await read(operation, args, scriptHash);
    return Array.isArray(result) ? result : [result];
  };

  /**
   * Full direct-prepaid payment + invoke flow.
   *
   * 1. Ensures wallet connection
   * 2. Prepays GAS directly to the MiniApp contract
   * 3. Waits briefly for the prepaid credit to settle
   * 4. Invokes the contract operation
   * 5. Returns txid and a bound waitForEvent helper
   */
  const invoke = async (
    paymentAmount: string,
    paymentMemo: string,
    operation: string,
    args: InvokeArg[],
    scriptHash?: string,
  ): Promise<{
    txid: string;
    receiptId: string;
    waitForEvent: (
      targetTxid: string,
      eventName: string,
      timeoutMs?: number,
    ) => Promise<unknown>;
    triggerSuccess: () => void;
    tx: unknown;
  }> => {
    await ensureWallet();
    const contract = scriptHash ?? (await ensureContractAddress());

    try {
      isProcessing.set(true);
      paymentError.set(null);

      const payment = await payGAS(paymentAmount, paymentMemo, contract, appId);
      const receiptId = payment.receipt_id || "";
      // Wait for the prepaid credit to land in a block before consuming it.
      // The legacy fixed sleep remains only when the indexer is unreachable.
      const settlement = await confirmDeposit(payment.txid);
      if (settlement === "unreachable") {
        await delay(TIME_CONSTANTS.SECOND_MS * 4);
      }

      let tx: unknown;
      try {
        tx = (await invokeContract({
          scriptHash: contract,
          operation,
          args,
        })) as unknown;
      } catch (error: unknown) {
        if (settlement === "confirmed") {
          throw new DepositConfirmedActionFailedError(
            operation,
            payment.txid,
            error,
          );
        }
        throw error;
      }

      const txid = extractTxid(tx);

      const waitForEvent = async (
        targetTxid: string,
        eventName: string,
        timeoutMs = 10_000,
      ) => {
        return pollForTxEvent({
          listEvents: async () => {
            const result = await listEvents({
              app_id: appId,
              event_name: eventName,
              limit: 20,
            });
            return result.events || [];
          },
          txid: targetTxid,
          timeoutMs,
          errorMessage: `Event "${eventName}" not found for transaction ${targetTxid}`,
        });
      };

      const triggerSuccess = () => {
        if (successTimer !== null) {
          clearTimeout(successTimer);
        }
        paymentSuccess.set(true);
        successTimer = setTimeout(() => {
          paymentSuccess.set(false);
          successTimer = null;
        }, 3500);
      };

      return { txid, receiptId, waitForEvent, triggerSuccess, tx };
    } catch (error: unknown) {
      const sanitized =
        error instanceof Error ? error.message : "Payment operation failed";
      paymentError.set(error instanceof Error ? error : new Error(sanitized));
      // Keep the funds-recoverable signal distinct — apps branch on this class
      // to tell "credit withdrawable" apart from a generic payment failure.
      if (error instanceof DepositConfirmedActionFailedError) throw error;
      throw new Error(sanitized);
    } finally {
      isProcessing.set(false);
    }
  };

  /**
   * Direct contract invocation without payment flow.
   * For operations that don't require a GAS payment (e.g. settle, claim).
   */
  const invokeDirectly = async (
    operation: string,
    args: InvokeArg[],
    scriptHash?: string,
    signers?: WalletSigner[],
  ) => {
    await ensureWallet();
    const contract = scriptHash ?? (await ensureContractAddress());

    const tx = await invokeContract({
      scriptHash: contract,
      operation,
      args,
      ...(signers && signers.length ? { signers } : {}),
    });

    const txid = extractTxid(tx as unknown);
    return { txid, tx };
  };

  /**
   * Preferred direct-prepaid GAS flow for modern miniapps.
   *
   * 1. Ensures wallet connection
   * 2. Transfers GAS directly to the target MiniApp contract with an app-specific memo
   * 3. Waits for the transfer to confirm in a block (indexer poll, ~2 blocks max)
   * 4. Calls the target contract method
   *
   * Once the deposit transfer is broadcast (step 2), any step-4 failure
   * surfaces as {@link DepositConfirmedActionFailedError} — the credit is
   * withdrawable, not lost. Its `settlement` field records whether the
   * deposit was proven in a block ("confirmed") or merely broadcast
   * ("timeout"/"unreachable" — indexer lag or outage).
   *
   * @param waitMs Fallback settle delay used ONLY when the indexer is
   *   unreachable and the deposit could not be confirmed. Pass 0 to skip the
   *   fallback entirely.
   * @param onPaymentSent Optional callback invoked immediately AFTER the GAS
   *   transfer is broadcast (step 2) and BEFORE the settle wait + target call.
   *   Receives the transfer txid, or "" if none could be extracted. This is the
   *   exact moment funds have left the wallet, letting callers distinguish a
   *   pre-transfer failure (nothing moved) from a post-broadcast failure (funds
   *   in flight / recoverable). Purely additive — omit it for legacy behavior.
   */
  const invokeWithDirectPrepaidGas = async (
    paymentAmountBaseUnits: string,
    paymentMemo: string,
    operation: string,
    args: InvokeArg[],
    scriptHash?: string,
    waitMs = 4000,
    signers?: WalletSigner[],
    onPaymentSent?: (txid: string) => void,
  ) => {
    await ensureWallet();
    if (!address.get())
      throw new Error("Wallet address not set after connection");
    const contract = scriptHash ?? (await ensureContractAddress());

    const transferTx = (await invokeContract({
      scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
      operation: "transfer",
      args: [
        { type: "Hash160", value: address.get() as string },
        { type: "Hash160", value: contract },
        { type: "Integer", value: paymentAmountBaseUnits },
        { type: "String", value: paymentMemo },
      ],
    })) as unknown;

    const transferTxid = extractTxid(transferTx);
    if (onPaymentSent) {
      onPaymentSent(transferTxid);
    }

    // Confirm the deposit landed in a block before firing the consuming call —
    // intra-block ordering is fee/hash-based, so an unconfirmed deposit lets
    // the action execute first and fault with "insufficient prepaid gas".
    const settlement = await confirmDeposit(transferTxid);
    if (settlement === "unreachable" && waitMs > 0) {
      await delay(waitMs);
    }

    try {
      return await invokeDirectly(operation, args, contract, signers);
    } catch (error: unknown) {
      // The deposit transfer was BROADCAST (funds left the wallet) whatever
      // the settlement outcome — on "timeout"/"unreachable" the deposit is
      // merely unproven by the indexer, not absent. Wrap unconditionally so
      // callers surface stranded-credit recovery copy instead of a generic
      // payment failure; the settlement field keeps the states distinct.
      throw new DepositConfirmedActionFailedError(
        operation,
        transferTxid,
        error,
        settlement,
      );
    }
  };

  /** Cleanup function — caller is responsible for invoking on teardown. */
  const dispose = () => {
    if (successTimer !== null) {
      clearTimeout(successTimer);
      successTimer = null;
    }
    waitTimers.forEach(clearTimeout);
    waitTimers = [];
  };

  return {
    // Wallet state
    address,
    ensureWallet,

    // Contract address
    contractAddress,
    ensureContractAddress,
    ensureSafe,

    // Read operations
    read,
    readArray,

    // Write operations
    invoke,
    invokeDirectly,
    invokeWithDirectPrepaidGas,

    // Payment flow state
    isProcessing,
    paymentError,
    paymentSuccess,

    // Lifecycle
    dispose,

    // Re-exported parsing utilities for convenience
    parseInvokeResult,
    parseStackItem,
  };
}
