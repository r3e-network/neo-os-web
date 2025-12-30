/**
 * useGasSponsor - Gas Sponsor composable for uni-app
 */
import { ref } from "vue";

const API_BASE = import.meta.env.VITE_API_BASE || "https://api.neo-service-layer.io";

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
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  const checkEligibility = async (): Promise<GasSponsorStatus> => {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${API_BASE}/gas-sponsor-check`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Check failed");
      }
      return await res.json();
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  const requestSponsorship = async (amount: string): Promise<GasSponsorRequest> => {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${API_BASE}/gas-sponsor-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Request failed");
      }
      return await res.json();
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  return { isLoading, error, checkEligibility, requestSponsorship };
}
