/**
 * Piggy Bank store - manages piggy bank state
 */
import { ref, computed } from "vue";

export interface PiggyBank {
    id: string;
    owner: string;
    name: string;
    targetAmount: bigint;
    currentAmount: bigint;
    lockDate: number;
    createdAt: number;
    completed: boolean;
    withdrawn: boolean;
}

const piggyBanks = ref<PiggyBank[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

export function usePiggyStore() {
    const totalSaved = computed(() =>
        piggyBanks.value.reduce((acc, bank) => acc + Number(bank.currentAmount), 0)
    );

    const activeBanks = computed(() =>
        piggyBanks.value.filter(bank => !bank.withdrawn)
    );

    const completedBanks = computed(() =>
        piggyBanks.value.filter(bank => bank.completed && !bank.withdrawn)
    );

    const addPiggyBank = (bank: PiggyBank) => {
        piggyBanks.value = [...piggyBanks.value, bank];
    };

    const updatePiggyBank = (id: string, updates: Partial<PiggyBank>) => {
        piggyBanks.value = piggyBanks.value.map(bank =>
            bank.id === id ? { ...bank, ...updates } : bank
        );
    };

    const removePiggyBank = (id: string) => {
        piggyBanks.value = piggyBanks.value.filter(bank => bank.id !== id);
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

    const reset = () => {
        piggyBanks.value = [];
        isLoading.value = false;
        error.value = null;
    };

    return {
        piggyBanks,
        isLoading,
        error,
        totalSaved,
        activeBanks,
        completedBanks,
        addPiggyBank,
        updatePiggyBank,
        removePiggyBank,
        setPiggyBanks,
        setLoading,
        setError,
        reset,
    };
}
