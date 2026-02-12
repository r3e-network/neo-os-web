/**
 * Hybrid Compute Composable
 *
 * Provides utilities for two-phase hybrid on-chain/off-chain computation.
 * Flow: InitiateXxx (on-chain) -> compute (off-chain) -> SettleXxx (on-chain)
 */

import { ref } from "vue";
import { formatErrorMessage } from "@shared/utils/errorHandling";

export type ComputeVerifiedRequest = {
  app_id: string;
  contract_hash: string;
  script_name: string;
  seed: string;
  input?: Record<string, unknown>;
  chain_id?: string;
};

export type ComputeVerifiedResponse = {
  success: boolean;
  result: Record<string, unknown>;
  verification: {
    script_name: string;
    script_hash: string;
    script_version?: number;
    verified: boolean;
  };
};

const EDGE_BASE_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_EDGE_BASE_URL || "https://edge.miniapps.neo.org";

/**
 * Execute verified off-chain computation.
 */
export async function executeVerifiedCompute(
  params: ComputeVerifiedRequest,
  authToken: string
): Promise<ComputeVerifiedResponse> {
  const response = await fetch(`${EDGE_BASE_URL}/compute-verified`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || `Compute failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Composable for hybrid compute operations.
 */
export function useHybridCompute() {
  const isComputing = ref(false);
  const computeError = ref<string | null>(null);

  /**
   * Execute a two-phase hybrid operation.
   *
   * @param initiate - Function to call contract's InitiateXxx method
   * @param computeParams - Parameters for off-chain computation
   * @param settle - Function to call contract's SettleXxx method with computed result
   * @param authToken - Auth token for Edge API
   */
  async function executeHybrid<TInitResult, TComputeResult, TSettleResult>(
    initiate: () => Promise<TInitResult>,
    getComputeParams: (initResult: TInitResult) => ComputeVerifiedRequest,
    settle: (initResult: TInitResult, computeResult: TComputeResult) => Promise<TSettleResult>,
    authToken: string
  ): Promise<{ initResult: TInitResult; computeResult: TComputeResult; settleResult: TSettleResult }> {
    isComputing.value = true;
    computeError.value = null;

    try {
      // Phase 1: Initiate on-chain (generates seed)
      const initResult = await initiate();

      // Phase 2: Off-chain computation with verification
      const computeParams = getComputeParams(initResult);
      const computeResponse = await executeVerifiedCompute(computeParams, authToken);

      if (!computeResponse.success || !computeResponse.verification.verified) {
        throw new Error("Computation verification failed");
      }

      // Attach verification info to result for settle phase
      const computeResult = {
        ...computeResponse.result,
        _verification: computeResponse.verification,
      } as TComputeResult;

      // Phase 3: Settle on-chain (verify and finalize)
      const settleResult = await settle(initResult, computeResult);

      return { initResult, computeResult, settleResult };
    } catch (e: unknown) {
      const message = formatErrorMessage(e, "Unknown error");
      computeError.value = message;
      throw e;
    } finally {
      isComputing.value = false;
    }
  }

  return {
    isComputing,
    computeError,
    executeHybrid,
    executeVerifiedCompute,
  };
}
