import type { OperationEntry } from "../../components/types";
import type { ResolvedMiniAppRuntime } from "../miniapp-runtime";
import type { NeoNetwork } from "../neo-network";
import { getWalletAdapter } from "../wallet/store";

export const WALLET_ADAPTER_UNAVAILABLE_ERROR =
  "Wallet adapter unavailable. Reconnect wallet and try again.";

const DEFAULT_MULTI_INVOKE_UNAVAILABLE_ERROR =
  "This wallet cannot submit the required batch transaction. Open in OneGate or NeoLine.";

export type InvokeRecipeInvocation = {
  scriptHash: string;
  operation: string;
  args: Array<{ type: string; value: unknown }>;
};

export type InvokeRecipeContext = {
  appId: string;
  operation: OperationEntry;
  values: Record<string, string>;
  walletAddress: string;
  targetHash: string;
  targetNetwork: NeoNetwork;
};

export type InvokeRecipePlan =
  | {
      /** Deposit transfers credited before the contract call (deposit-then-act). */
      deposits?: InvokeRecipeInvocation[];
      /** The contract call; omit for prepaid transfer-only flows. */
      invocation?: InvokeRecipeInvocation;
      successMessage: (txid: string) => string;
    }
  | {
      /** Short-circuit: the requested state already holds, no transaction needed. */
      completedMessage: string;
    };

export type InvokeRecipe = {
  /** Error shown when neither the platform runtime nor a direct contract hash resolves. */
  notConfiguredError: string;
  /** Error shown when the plan needs NEP-21 batching but the wallet lacks invokeMultiple. */
  multiInvokeUnavailableError?: string;
  /** Validates operation values and builds the transaction plan. */
  buildPlan: (
    context: InvokeRecipeContext,
  ) => InvokeRecipePlan | Promise<InvokeRecipePlan>;
};

export type ExecuteInvokeRecipeParams = {
  appId: string;
  operation: OperationEntry;
  values: Record<string, string>;
  walletAddress: string;
  targetNetwork: NeoNetwork;
  resolvedRuntime: ResolvedMiniAppRuntime | null;
  directContractHash: string | null;
};

/**
 * The single execution path for per-app invoke recipes: resolves the target
 * contract hash, validates and builds the plan, checks wallet adapter
 * capabilities, then submits either a single invoke or a NEP-21 batch
 * (deposit-then-act). Returns the success feedback message.
 */
export async function executeInvokeRecipe(
  recipe: InvokeRecipe,
  params: ExecuteInvokeRecipeParams,
): Promise<string> {
  const targetHash =
    params.resolvedRuntime?.mode === "platform"
      ? params.resolvedRuntime.contractHash
      : params.directContractHash;
  if (!targetHash) {
    throw new Error(recipe.notConfiguredError);
  }

  const plan = await recipe.buildPlan({
    appId: params.appId,
    operation: params.operation,
    values: params.values,
    walletAddress: params.walletAddress,
    targetHash,
    targetNetwork: params.targetNetwork,
  });
  if ("completedMessage" in plan) {
    return plan.completedMessage;
  }

  const invocations: InvokeRecipeInvocation[] = [
    ...(plan.deposits ?? []),
    ...(plan.invocation ? [plan.invocation] : []),
  ];
  if (invocations.length === 0) {
    throw new Error("Operation did not produce a transaction to submit.");
  }

  const adapter = getWalletAdapter();
  if (!adapter) {
    throw new Error(WALLET_ADAPTER_UNAVAILABLE_ERROR);
  }

  const signers = [{ account: params.walletAddress, scopes: 1 }];
  if (invocations.length === 1) {
    const result = await adapter.invoke({ ...invocations[0], signers });
    return plan.successMessage(result.txid);
  }

  if (typeof adapter.invokeMultiple !== "function") {
    throw new Error(
      recipe.multiInvokeUnavailableError ??
        DEFAULT_MULTI_INVOKE_UNAVAILABLE_ERROR,
    );
  }
  const result = await adapter.invokeMultiple(invocations, signers);
  return plan.successMessage(result.txid);
}
