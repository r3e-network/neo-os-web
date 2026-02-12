import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseInvokeResult } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { requireNeoChain } from "@shared/utils/chain";
import type { PredictionMarket, MarketFilters } from "@/types";

export type { PredictionMarket, MarketFilters };

export function usePredictionMarkets() {
  const { address, invokeRead, getContractAddress, chainType } = useWallet() as WalletSDK;

  const markets = ref<PredictionMarket[]>([]);
  const loadingMarkets = ref(false);
  const activeTraders = ref(0);
  const error = ref<string | null>(null);
  const filters = ref<MarketFilters>({
    category: "all",
    sortBy: "volume",
  });

  const categories = computed(() => [
    { id: "all", label: "All" },
    { id: "crypto", label: "Crypto" },
    { id: "sports", label: "Sports" },
    { id: "politics", label: "Politics" },
    { id: "economics", label: "Economics" },
    { id: "entertainment", label: "Entertainment" },
    { id: "other", label: "Other" },
  ]);

  const totalVolume = computed(() => markets.value.reduce((sum, m) => sum + m.totalVolume, 0));

  const getCategoryCount = (catId: string) => {
    if (catId === "all") return markets.value.length;
    return markets.value.filter((m) => m.category === catId).length;
  };

  const filteredMarkets = computed(() => {
    let result = markets.value;

    if (filters.value.category !== "all") {
      result = result.filter((m) => m.category === filters.value.category);
    }

    result = [...result].sort((a, b) => {
      switch (filters.value.sortBy) {
        case "volume":
          return b.totalVolume - a.totalVolume;
        case "newest":
          return b.id - a.id;
        case "ending":
          return a.endTime - b.endTime;
        default:
          return 0;
      }
    });

    return result;
  });

  const ensureContractAddress = async () => {
    if (!requireNeoChain(chainType, (key: string) => key)) {
      throw new Error("Wrong chain");
    }
    const contract = await getContractAddress();
    if (!contract) throw new Error("Contract unavailable");
    return contract;
  };

  const loadMarkets = async (t: Function) => {
    loadingMarkets.value = true;
    error.value = null;

    try {
      const contract = await ensureContractAddress();
      const res = await invokeRead({
        scriptHash: contract,
        operation: "getMarkets",
        args: [{ type: "Integer", value: "50" }],
      });

      const parsed = parseInvokeResult(res);
      if (Array.isArray(parsed)) {
        markets.value = parsed.map((m: Record<string, unknown>) => ({
          id: Number(m.id),
          question: String(m.question || ""),
          description: String(m.description || ""),
          category: String(m.category || "other"),
          endTime: Number(m.endTime || Date.now()),
          resolutionTime: m.resolutionTime ? Number(m.resolutionTime) : undefined,
          oracle: String(m.oracle || ""),
          creator: String(m.creator || ""),
          status: String(m.status || "open") as PredictionMarket["status"],
          yesPrice: Number(m.yesPrice || 0.5),
          noPrice: Number(m.noPrice || 0.5),
          totalVolume: Number(m.totalVolume || 0),
          resolution: m.resolution !== undefined ? Boolean(m.resolution) : undefined,
        }));
      }

      // Load active traders count
      const tradersRes = await invokeRead({
        scriptHash: contract,
        operation: "getActiveTraderCount",
        args: [],
      });
      activeTraders.value = Number(parseInvokeResult(tradersRes) || 0);
    } catch (e: unknown) {
      error.value = formatErrorMessage(e, "Failed to load markets");
      // Fallback to mock data
      markets.value = [
        {
          id: 1,
          question: t("market1Question"),
          description: "",
          category: "crypto",
          endTime: Date.now() + 86400000,
          oracle: "",
          creator: "",
          status: "open",
          yesPrice: 0.65,
          noPrice: 0.35,
          totalVolume: 1500,
        },
        {
          id: 2,
          question: t("market2Question"),
          description: "",
          category: "sports",
          endTime: Date.now() + 172800000,
          oracle: "",
          creator: "",
          status: "open",
          yesPrice: 0.42,
          noPrice: 0.58,
          totalVolume: 2800,
        },
        {
          id: 3,
          question: t("market3Question"),
          description: "",
          category: "politics",
          endTime: Date.now() + 259200000,
          oracle: "",
          creator: "",
          status: "open",
          yesPrice: 0.78,
          noPrice: 0.22,
          totalVolume: 4200,
        },
      ];
      activeTraders.value = 156;
    } finally {
      loadingMarkets.value = false;
    }
  };

  const setCategory = (cat: string) => {
    filters.value.category = cat;
  };

  const toggleSort = () => {
    const options: Array<"volume" | "newest" | "ending"> = ["volume", "newest", "ending"];
    const currentIndex = options.indexOf(filters.value.sortBy);
    filters.value.sortBy = options[(currentIndex + 1) % options.length];
  };

  return {
    markets,
    filteredMarkets,
    categories,
    loadingMarkets,
    totalVolume,
    activeTraders,
    error,
    filters,
    getCategoryCount,
    loadMarkets,
    setCategory,
    toggleSort,
  };
}
