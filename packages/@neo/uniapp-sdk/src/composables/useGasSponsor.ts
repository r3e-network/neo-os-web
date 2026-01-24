/**
 * useGasSponsor - Gas Sponsor composable for uni-app
 * Refactored to use useAsyncAction and apiFetch (DRY principle)
 */
import { useAsyncAction } from "./useAsyncAction";
import { apiGet, apiPost } from "../api";

export interface GasSponsorStatus {
  eligible: boolean;
  gas_balance: string;
  daily_limit: string;
  used_today: string;
  remaining: string;
  resets_at: string;
}

export interface GasSponsorRequest {
  request_id: string;
  amount: string;
  status: string;
  tx_hash: string | null;
}

export function useGasSponsor() {
  const eligibilityAction = useAsyncAction(async (): Promise<GasSponsorStatus> => {
    return apiGet<GasSponsorStatus>("/gas-sponsor-check");
  });

  const sponsorshipAction = useAsyncAction(async (amount: string): Promise<GasSponsorRequest> => {
    const numAmount = parseFloat(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      throw new Error("Invalid amount: must be a positive number");
    }
    return apiPost<GasSponsorRequest>("/gas-sponsor-request", { amount });
  });

  return {
    // Eligibility check
    isCheckingEligibility: eligibilityAction.isLoading,
    eligibilityError: eligibilityAction.error,
    checkEligibility: eligibilityAction.execute,
    // Sponsorship request
    isRequestingSponsorship: sponsorshipAction.isLoading,
    sponsorshipError: sponsorshipAction.error,
    requestSponsorship: sponsorshipAction.execute,
  };
}
