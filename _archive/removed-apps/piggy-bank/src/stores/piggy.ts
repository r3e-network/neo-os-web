/**
 * Piggy Bank store - manages piggy bank state
 */
import { ref, computed } from "vue";

export interface TokenMeta {
  symbol: string;
  decimals?: number;
}

export interface PiggyBank {
  id: string;
  owner: string;
  name: string;
  purpose?: string;
  themeColor?: string;
  targetAmount: bigint | string | number;
  currentAmount?: bigint | string | number;
  targetToken: TokenMeta;
  unlockTime: number;
  lockDate?: number;
  createdAt?: number;
  completed?: boolean;
  withdrawn?: boolean;
}

export interface ChainOption {
  id: string;
  name: string;
  shortName: string;
}

const EVM_CHAINS: ChainOption[] = [
  { id: "neo-n3-mainnet", name: "Neo N3 Mainnet", shortName: "Neo N3" },
  { id: "neo-n3-testnet", name: "Neo N3 TestNet", shortName: "TestNet" },
];

const piggyBanks = ref<PiggyBank[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

const currentChainId = ref<string>(EVM_CHAINS[0].id);
const alchemyApiKey = ref("");
const walletConnectProjectId = ref("");
const userAddress = ref("");
const contractAddressMap = ref<Record<string, string>>({
  [EVM_CHAINS[0].id]: "",
  [EVM_CHAINS[1].id]: "",
});

export function usePiggyStore() {
  const totalSaved = computed(() =>
    piggyBanks.value.reduce((acc, bank) => acc + Number(bank.currentAmount ?? 0), 0)
  );

  const activeBanks = computed(() => piggyBanks.value.filter((bank) => !bank.withdrawn));

  const completedBanks = computed(() =>
    piggyBanks.value.filter((bank) => bank.completed && !bank.withdrawn)
  );

  const isConnected = computed(() => Boolean(userAddress.value));

  const addPiggyBank = (bank: PiggyBank) => {
    piggyBanks.value = [...piggyBanks.value, bank];
  };

  const updatePiggyBank = (id: string, updates: Partial<PiggyBank>) => {
    piggyBanks.value = piggyBanks.value.map((bank) =>
      bank.id === id ? { ...bank, ...updates } : bank
    );
  };

  const removePiggyBank = (id: string) => {
    piggyBanks.value = piggyBanks.value.filter((bank) => bank.id !== id);
  };

  const setPiggyBanks = (banks: PiggyBank[]) => {
    piggyBanks.value = banks;
  };

  const setLoading = (loading: boolean) => {
    isLoading.value = loading;
  };

  const setError = (err: string | null) => {
    error.value = err;
  };

  const setAlchemyApiKey = (apiKey: string) => {
    alchemyApiKey.value = apiKey;
  };

  const setWalletConnectProjectId = (projectId: string) => {
    walletConnectProjectId.value = projectId;
  };

  const getContractAddress = (chainId: string) => {
    return contractAddressMap.value[chainId] ?? "";
  };

  const setContractAddress = (chainId: string, address: string) => {
    contractAddressMap.value = {
      ...contractAddressMap.value,
      [chainId]: address,
    };
  };

  const switchChain = async (chainId: string) => {
    currentChainId.value = chainId;
  };

  const connectWallet = async () => {
    if (!userAddress.value) {
      userAddress.value = "Nfakelocalwallet000000000000000000";
    }
  };

  const reset = () => {
    piggyBanks.value = [];
    isLoading.value = false;
    error.value = null;
    userAddress.value = "";
  };

  return {
    piggyBanks,
    isLoading,
    error,
    totalSaved,
    activeBanks,
    completedBanks,
    currentChainId,
    alchemyApiKey,
    walletConnectProjectId,
    userAddress,
    isConnected,
    EVM_CHAINS,
    addPiggyBank,
    updatePiggyBank,
    removePiggyBank,
    setPiggyBanks,
    setLoading,
    setError,
    setAlchemyApiKey,
    setWalletConnectProjectId,
    getContractAddress,
    setContractAddress,
    switchChain,
    connectWallet,
    reset,
  };
}
