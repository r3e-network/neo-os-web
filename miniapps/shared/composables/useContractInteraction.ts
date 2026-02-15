/**
 * Contract Interaction Composable
 *
 * Provides a unified API for reading from and writing to Neo N3 smart contracts.
 * Wraps invokeRead with automatic result parsing, invokeContract with the
 * payment flow, and event waiting — the three operations repeated across
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
 * // Write call through payment flow
 * const { txid, waitForEvent } = await invoke("1.0", "burn", "burnGas", [
 *   { type: "Hash160", value: address.value },
 *   { type: "Integer", value: toFixed8("1") },
 * ]);
 * await waitForTxEvent(txid, "GasBurned", waitForEvent);
 * ```
 */

import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useContractAddress } from "./useContractAddress";
import { usePaymentFlow } from "./usePaymentFlow";
import { parseInvokeResult, parseStackItem } from "../utils/neo";
import { extractTxid } from "../utils/transaction";

type InvokeArg = {
  type: string;
  value: string | number | boolean;
};

export interface ContractInteractionOptions {
  /** App ID used for payment flow and event listing */
  appId: string;
  /** Translation function for error messages */
  t: (key: string) => string;
  /** Optional pre-existing wallet instance to reuse */
  wallet?: WalletSDK;
}

export function useContractInteraction(options: ContractInteractionOptions) {
  const { appId, t, wallet: externalWallet } = options;

  const wallet = externalWallet ?? (useWallet() as WalletSDK);
  const { address, connect, invokeContract, invokeRead } = wallet;
  const { contractAddress, ensure: ensureContractAddress, ensureSafe } = useContractAddress(t);
  const { processPayment, isProcessing, error: paymentError, success: paymentSuccess } = usePaymentFlow(appId);

  /**
   * Ensure wallet is connected, connecting if needed.
   * Throws if the user declines.
   */
  const ensureWallet = async (): Promise<string> => {
    if (!address.value) {
      await connect();
    }
    if (!address.value) {
      throw new Error(t("connectWallet") || "Wallet not connected");
    }
    return address.value;
  };

  /**
   * Read-only contract call with automatic result parsing.
   * Returns the parsed first stack item (or array if multiple).
   */
  const read = async (operation: string, args?: InvokeArg[], scriptHash?: string): Promise<unknown> => {
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
  const readArray = async (operation: string, args?: InvokeArg[], scriptHash?: string): Promise<unknown[]> => {
    const result = await read(operation, args, scriptHash);
    return Array.isArray(result) ? result : [result];
  };

  /**
   * Full payment + invoke flow.
   *
   * 1. Ensures wallet connection
   * 2. Processes GAS payment
   * 3. Invokes the contract operation
   * 4. Returns txid and a bound waitForEvent helper
   */
  const invoke = async (
    paymentAmount: string,
    paymentMemo: string,
    operation: string,
    args: InvokeArg[],
    scriptHash?: string
  ) => {
    await ensureWallet();
    const contract = scriptHash ?? (await ensureContractAddress());

    const {
      receiptId,
      invoke: invokeWithReceipt,
      waitForEvent,
      triggerSuccess,
    } = await processPayment(paymentAmount, paymentMemo);

    const tx = await invokeWithReceipt(contract, operation, args);
    const txid = typeof tx === "object" && tx !== null ? extractTxid(tx) : "";

    return { txid, receiptId, waitForEvent, triggerSuccess, tx };
  };

  /**
   * Direct contract invocation without payment flow.
   * For operations that don't require a GAS payment (e.g. settle, claim).
   */
  const invokeDirectly = async (operation: string, args: InvokeArg[], scriptHash?: string) => {
    await ensureWallet();
    const contract = scriptHash ?? (await ensureContractAddress());

    const tx = await invokeContract({
      scriptHash: contract,
      operation,
      args,
    });

    const txid = extractTxid(tx as unknown);
    return { txid, tx };
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

    // Payment flow state
    isProcessing,
    paymentError,
    paymentSuccess,

    // Re-exported parsing utilities for convenience
    parseInvokeResult,
    parseStackItem,
  };
}
