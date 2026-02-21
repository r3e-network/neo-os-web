/**
 * useGovernance - Governance composable for uni-app
 */
import { ref } from "vue";
import { waitForSDK } from "../bridge";
import type { VoteBNEOResponse, CandidatesResponse } from "../types";

export function useGovernance(appId: string) {
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  const vote = async (proposalId: string, amount: string, support?: boolean): Promise<VoteBNEOResponse> => {
    isLoading.value = true;
    error.value = null;
    try {
      const sdk = await waitForSDK();
      return await sdk.governance.vote(appId, proposalId, amount, support);
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  const getCandidates = async (): Promise<CandidatesResponse> => {
    isLoading.value = true;
    error.value = null;
    try {
      const sdk = await waitForSDK();
      return await sdk.governance.getCandidates();
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  return { isLoading, error, vote, getCandidates };
}
