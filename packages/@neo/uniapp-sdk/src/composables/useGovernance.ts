/**
 * useGovernance - Governance composable for uni-app
 * Refactored to expose separate state for each action (SOLID: Single Responsibility)
 */
import { waitForSDK } from "../bridge";
import { useAsyncAction } from "./useAsyncAction";
import type { VoteBNEOResponse, CandidatesResponse } from "../types";

export function useGovernance(appId: string) {
  const voteAction = useAsyncAction(
    async (proposalId: string, amount: string, support?: boolean): Promise<VoteBNEOResponse> => {
      // Validate parameters
      if (!proposalId || typeof proposalId !== "string") {
        throw new Error("Invalid proposalId: must be a non-empty string");
      }
      const numAmount = parseFloat(amount);
      if (Number.isNaN(numAmount) || numAmount <= 0) {
        throw new Error("Invalid amount: must be a positive number");
      }
      const sdk = await waitForSDK();
      return await sdk.governance.vote(appId, proposalId, amount, support);
    },
  );

  const candidatesAction = useAsyncAction(async (): Promise<CandidatesResponse> => {
    const sdk = await waitForSDK();
    return await sdk.governance.getCandidates();
  });

  return {
    // Vote action
    isVoting: voteAction.isLoading,
    voteError: voteAction.error,
    vote: voteAction.execute,
    // Candidates action
    isLoadingCandidates: candidatesAction.isLoading,
    candidatesError: candidatesAction.error,
    getCandidates: candidatesAction.execute,
  };
}
