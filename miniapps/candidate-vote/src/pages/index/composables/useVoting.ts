import { ref, computed } from "vue";
import type { WalletSDK } from "@neo/types";
import type { GovernanceCandidate } from "../utils";
import { parseInvokeResult } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";

export function useVoting(
  wallet: WalletSDK,
  t: (key: string) => string,
  normalizePublicKey: (value: unknown) => string,
  loadCandidates: (force?: boolean) => Promise<void>,
) {
  const { address, connect, invokeContract, invokeRead, chainType } = wallet;

  const isLoading = ref(false);
  const { status, setStatus: showStatus, clearStatus } = useStatusMessage();
  const userVotedPublicKey = ref<string | null>(null);

  const normalizedUserVotedPublicKey = computed(() => {
    const normalized = normalizePublicKey(userVotedPublicKey.value);
    return normalized || null;
  });

  const loadUserVote = async () => {
    if (!requireNeoChain(chainType, t)) return;
    if (!address.value) {
      userVotedPublicKey.value = null;
      return;
    }
    try {
      const result = await invokeRead({
        scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
        operation: "GetAccountState",
        args: [{ type: "Hash160", value: address.value }],
      });
      const parsed = parseInvokeResult(result);
      let voteValue: unknown = null;
      if (Array.isArray(parsed)) {
        voteValue = parsed[2];
      } else if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        voteValue = record.voteTo ?? record.VoteTo ?? record.vote_to;
      }
      const normalized = normalizePublicKey(voteValue);
      userVotedPublicKey.value = normalized || null;
    } catch {
      userVotedPublicKey.value = null;
    }
  };

  const handleVote = async (selectedCandidate: GovernanceCandidate | null) => {
    if (isLoading.value || !selectedCandidate) return;
    if (!requireNeoChain(chainType, t)) return;

    if (!address.value) {
      await connect();
    }
    if (!address.value) {
      showStatus(t("connectWallet"), "error");
      return;
    }

    isLoading.value = true;
    try {
      await invokeContract({
        scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
        operation: "Vote",
        args: [
          { type: "Hash160", value: address.value },
          { type: "PublicKey", value: selectedCandidate.publicKey },
        ],
      });

      showStatus(t("voteSuccess"), "success");
      await Promise.all([loadCandidates(true), loadUserVote()]);
    } catch (e: unknown) {
      showStatus(formatErrorMessage(e, t("voteFailed")), "error");
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    status,
    showStatus,
    clearStatus,
    userVotedPublicKey,
    normalizedUserVotedPublicKey,
    loadUserVote,
    handleVote,
  };
}
