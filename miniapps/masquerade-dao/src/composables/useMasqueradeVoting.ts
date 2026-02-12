import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { requireNeoChain } from "@shared/utils/chain";
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
  const { address, chainType, invokeContract, getContractAddress } = useWallet() as WalletSDK;
  const { processPayment, isLoading } = usePaymentFlow(APP_ID);
  
  const VOTE_FEE = 0.01;
  const proposalId = ref("");
  const { status, setStatus, clearStatus } = useStatusMessage();
  const myVotes = ref<Vote[]>([]);

  const canVote = computed(() => Boolean(proposalId.value));

  const ensureContractAddress = async () => {
    if (!requireNeoChain(chainType, (key: string) => key)) {
      throw new Error("Wrong chain");
    }
    const contract = await getContractAddress();
    if (!contract) throw new Error("Contract unavailable");
    return contract;
  };

  const submitVote = async (
    selectedMaskId: string | null,
    choice: VoteChoice,
    t: Function
  ): Promise<boolean> => {
    if (!canVote.value || !selectedMaskId) return false;
    clearStatus();
    
    try {
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }
      
      const contract = await ensureContractAddress();
      const { receiptId, invoke } = await processPayment(
        String(VOTE_FEE), 
        `vote:${proposalId.value}`
      );
      
      if (!receiptId) throw new Error(t("receiptMissing"));
      
      await invoke(
        "submitVote",
        [
          { type: "Integer", value: proposalId.value },
          { type: "Integer", value: selectedMaskId },
          { type: "Integer", value: String(choice) },
          { type: "Integer", value: String(receiptId) },
        ],
        contract,
      );

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
    return myVotes.value.some(v => v.proposalId === proposalId);
  };

  const getVoteChoice = (proposalId: string): string | null => {
    const vote = myVotes.value.find(v => v.proposalId === proposalId);
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
