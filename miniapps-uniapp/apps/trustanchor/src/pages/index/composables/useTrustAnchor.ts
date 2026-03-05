import { ref, computed } from "vue";
import type { WalletSDK } from "@neo/types";
import { useWallet } from "@neo/uniapp-sdk";
import { handleAsync, formatErrorMessage } from "@shared/utils/errorHandling";

export interface AgentInfo {
  address: string;
  displayName: string;
  metadataUri: string;
  reputationScore: number;
  totalDelegators: number;
  totalVotingPower: number;
  isActive: boolean;
}

export interface DelegationInfo {
  delegator: string;
  delegatee: string;
  votingPower: number;
  delegationTime: number;
}

export interface TrustAnchorStats {
  totalDelegations: number;
  totalAgents: number;
  activeAgentCount: number;
}

const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

export function useTrustAnchor(_t: (key: string) => string) {
  const { address, chainType, invokeRead, invokeContract } = useWallet() as WalletSDK;

  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const myDelegation = ref<DelegationInfo | null>(null);
  const agents = ref<AgentInfo[]>([]);
  const stats = ref<TrustAnchorStats | null>(null);
  const myVotingPower = ref(0);

  const setError = (message: string) => {
    error.value = message;
  };

  const clearError = () => {
    error.value = null;
  };

  const myVotePower = computed(() => myDelegation.value?.votingPower ?? myVotingPower.value ?? 0);
  const hasDelegation = computed(() => myDelegation.value?.delegatee != null && myDelegation.value?.delegatee !== "");
  const currentDelegatee = computed(() => myDelegation.value?.delegatee ?? null);

  const loadMyDelegation = async () => {
    if (!address.value) {
      myDelegation.value = null;
      return;
    }

    const result = await handleAsync(
      async () => {
        const res = await invokeRead({
          scriptHash: CONTRACT_ADDRESS,
          operation: "GetDelegationInfo",
          args: [{ type: "Hash160", value: address.value }],
        });
        return res;
      },
      { context: "Loading delegation info", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) }
    );

    if (result.success && result.data) {
      const data = result.data as Record<string, unknown>;
      if (data.Delegatee && data.Delegatee !== "0x0000000000000000000000000000000000000000") {
        myDelegation.value = {
          delegator: address.value,
          delegatee: String(data.Delegatee ?? data.delegatee ?? ""),
          votingPower: Number(data.VotingPower ?? data.votingPower ?? 0) / 1e8,
          delegationTime: Number(data.DelegationTime ?? data.delegationTime ?? 0),
        };
      } else {
        myDelegation.value = null;
      }
    }
  };

  const loadMyVotingPower = async () => {
    if (!address.value) {
      myVotingPower.value = 0;
      return;
    }

    const result = await handleAsync(
      async () => {
        const res = await invokeRead({
          scriptHash: CONTRACT_ADDRESS,
          operation: "CalculateVotingPower",
          args: [{ type: "Hash160", value: address.value }],
        });
        return res;
      },
      { context: "Calculating voting power", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) }
    );

    if (result.success && result.data) {
      myVotingPower.value = Number(result.data) / 1e8;
    }
  };

  const loadAgents = async () => {
    const result = await handleAsync(
      async () => {
        const res = await invokeRead({
          scriptHash: CONTRACT_ADDRESS,
          operation: "GetActiveAgentCount",
          args: [],
        });
        return res;
      },
      { context: "Loading agents", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) }
    );

    if (result.success && result.data) {
      const count = Number(result.data);
      const agentList: AgentInfo[] = [];
      for (let i = 0; i < Math.min(count, 21); i++) {
        const agentAddr = await getAgentByIndex(i);
        if (agentAddr && agentAddr !== "0x0000000000000000000000000000000000000000") {
          const info = await getAgentInfo(agentAddr);
          if (info) {
            agentList.push(info);
          }
        }
      }
      agents.value = agentList;
    }
  };

  const getAgentByIndex = async (index: number): Promise<string | null> => {
    const result = await handleAsync(
      async () => {
        const res = await invokeRead({
          scriptHash: CONTRACT_ADDRESS,
          operation: "GetAgentByIndex",
          args: [{ type: "Integer", value: index }],
        });
        return res;
      },
      { context: "Getting agent by index", onError: () => null }
    );
    return result.success && result.data ? result.data : null;
  };

  const getAgentInfo = async (agentAddress: string): Promise<AgentInfo | null> => {
    const result = await handleAsync(
      async () => {
        const res = await invokeRead({
          scriptHash: CONTRACT_ADDRESS,
          operation: "GetAgentInfo",
          args: [{ type: "Hash160", value: agentAddress }],
        });
        return res;
      },
      { context: "Getting agent info", onError: () => null }
    );

    if (result.success && result.data) {
      const data = result.data as Record<string, unknown>;
      return {
        address: agentAddress,
        displayName: String(data.DisplayName ?? data.displayName ?? "Unknown"),
        metadataUri: String(data.MetadataUri ?? data.metadataUri ?? ""),
        reputationScore: Number(data.ReputationScore ?? data.reputationScore ?? 0),
        totalDelegators: Number(data.TotalDelegators ?? data.totalDelegators ?? 0),
        totalVotingPower: Number(data.TotalVotingPower ?? data.totalVotingPower ?? 0) / 1e8,
        isActive: Boolean(data.IsActive ?? data.isActive ?? true),
      };
    }
    return null;
  };

  const loadStats = async () => {
    const result = await handleAsync(
      async () => {
        const [totalDelegations, totalAgents, activeAgents] = await Promise.all([
          invokeRead({ scriptHash: CONTRACT_ADDRESS, operation: "GetTotalDelegations", args: [] }),
          invokeRead({ scriptHash: CONTRACT_ADDRESS, operation: "GetTotalAgents", args: [] }),
          invokeRead({ scriptHash: CONTRACT_ADDRESS, operation: "GetActiveAgentCount", args: [] }),
        ]);
        const asRecord = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
        return {
          totalDelegations: Number(asRecord(totalDelegations).data ?? 0),
          totalAgents: Number(asRecord(totalAgents).data ?? 0),
          activeAgentCount: Number(asRecord(activeAgents).data ?? 0),
        };
      },
      { context: "Loading stats", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) }
    );

    if (result.success && result.data) {
      stats.value = result.data;
    }
  };

  const loadAll = async () => {
    isLoading.value = true;
    clearError();

    try {
      await Promise.all([loadMyDelegation(), loadMyVotingPower(), loadAgents(), loadStats()]);
    } finally {
      isLoading.value = false;
    }
  };

  const registerAgent = async (displayName: string, metadataUri: string) => {
    const result = await handleAsync(
      async () => {
        const res = await invokeContract({
          scriptHash: CONTRACT_ADDRESS,
          operation: "RegisterAgent",
          args: [
            { type: "String", value: displayName },
            { type: "String", value: metadataUri },
          ],
        });
        return res;
      },
      { context: "Registering as agent", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) }
    );

    if (result.success) {
      await loadAgents();
    }
    return result;
  };

  const unregisterAgent = async () => {
    const result = await handleAsync(
      async () => {
        const res = await invokeContract({
          scriptHash: CONTRACT_ADDRESS,
          operation: "UnregisterAgent",
          args: [],
        });
        return res;
      },
      { context: "Unregistering as agent", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) }
    );

    if (result.success) {
      await loadAgents();
    }
    return result;
  };

  const delegateTo = async (delegateeAddress: string) => {
    const result = await handleAsync(
      async () => {
        const res = await invokeContract({
          scriptHash: CONTRACT_ADDRESS,
          operation: "DelegateTo",
          args: [{ type: "Hash160", value: delegateeAddress }],
        });
        return res;
      },
      { context: "Delegating votes", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) }
    );

    if (result.success) {
      await loadMyDelegation();
      await loadAgents();
    }
    return result;
  };

  const revokeDelegation = async () => {
    const result = await handleAsync(
      async () => {
        const res = await invokeContract({
          scriptHash: CONTRACT_ADDRESS,
          operation: "RevokeDelegation",
          args: [],
        });
        return res;
      },
      { context: "Revoking delegation", onError: (e: Error) => setError(formatErrorMessage(e, e.message)) }
    );

    if (result.success) {
      await loadMyDelegation();
      await loadAgents();
    }
    return result;
  };

  return {
    address,
    chainType,
    isLoading,
    error,
    myDelegation,
    agents,
    stats,
    myVotingPower,
    myVotePower,
    hasDelegation,
    currentDelegatee,
    setError,
    clearError,
    loadMyDelegation,
    loadMyVotingPower,
    loadAgents,
    loadStats,
    loadAll,
    registerAgent,
    unregisterAgent,
    delegateTo,
    revokeDelegation,
  };
}
