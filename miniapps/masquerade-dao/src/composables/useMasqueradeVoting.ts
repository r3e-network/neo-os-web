import { ref, computed } from "vue";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";

export type VoteChoice = 1 | 2 | 3; // 1=for, 2=against, 3=abstain

export interface Vote {
  proposalId: string;
  maskId: string;
  choice: VoteChoice;
  timestamp: string;
}

export function useMasqueradeVoting(APP_ID: string) {
  const { t } = createUseI18n(messages)();
  const { address, invoke, isProcessing: isLoading } = useContractInteraction({ appId: APP_ID, t });

  const VOTE_FEE = 0.01;
  const proposalId = ref("");
  const { status, setStatus, clearStatus } = useStatusMessage();
  const myVotes = ref<Vote[]>([]);

  const canVote = computed(() => Boolean(proposalId.value));

  const submitVote = async (selectedMaskId: string | null, choice: VoteChoice): Promise<boolean> => {
    if (!canVote.value || !selectedMaskId) return false;
    clearStatus();

    try {
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }

      await invoke(String(VOTE_FEE), `vote:${proposalId.value}`, "submitVote", [
        { type: "Integer", value: proposalId.value },
        { type: "Integer", value: selectedMaskId },
        { type: "Integer", value: String(choice) },
      ]);

      // Record local vote
      myVotes.value.push({
        proposalId: proposalId.value,
        maskId: selectedMaskId,
        choice,
        timestamp: new Date().toISOString(),
      });

      setStatus(t("voteCast"), "success");
      return true;
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
      return false;
    }
  };

  const hasVotedOn = (proposalId: string): boolean => {
    return myVotes.value.some((v) => v.proposalId === proposalId);
  };

  const getVoteChoice = (proposalId: string): string | null => {
    const vote = myVotes.value.find((v) => v.proposalId === proposalId);
    if (!vote) return null;
    const choices: Record<number, string> = { 1: "for", 2: "against", 3: "abstain" };
    return choices[vote.choice];
  };

  return {
    proposalId,
    status,
    isLoading,
    canVote,
    myVotes,
    hasVotedOn,
    getVoteChoice,
    submitVote,
  };
}
