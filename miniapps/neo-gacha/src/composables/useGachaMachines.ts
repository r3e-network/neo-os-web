import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { formatGas, toFixed8, toFixedDecimals } from "@shared/utils/format";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { parseInvokeResult, normalizeScriptHash, addressToScriptHash } from "@shared/utils/neo";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import type { Machine, MachineItem } from "@/types";

export function useGachaMachines() {
  const { t } = createUseI18n(messages)();
  const { handleError } = useErrorHandler();
  const { address, invokeRead } = useWallet() as WalletSDK;
  const { contractAddress, ensure: ensureContractAddress } = useContractAddress(t);

  const machines = ref<Machine[]>([]);
  const selectedMachine = ref<Machine | null>(null);
  const isLoadingMachines = ref(false);
  const actionLoading = ref<Record<string, boolean>>({});

  const walletHash = computed(() => {
    if (!address.value) return "";
    const scriptHash = addressToScriptHash(address.value as string);
    return normalizeScriptHash(scriptHash);
  });

  const numberFrom = (value: unknown) => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  };

  const formatTokenAmount = (raw: number, decimals: number) => {
    if (!Number.isFinite(raw) || raw <= 0) return "0";
    const factor = Math.pow(10, decimals);
    return (raw / factor).toFixed(Math.min(4, Math.max(0, decimals)));
  };

  const toDisplayHash = (value: unknown) => {
    const normalized = normalizeScriptHash(String(value || ""));
    return normalized ? `0x${normalized}` : String(value || "");
  };

  const parseTags = (value: string) =>
    value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

  const isItemAvailable = (item: MachineItem) => {
    if (item.assetType === 1) return item.stockRaw >= item.amountRaw && item.amountRaw > 0;
    if (item.assetType === 2) return item.tokenCount > 0;
    return false;
  };

  const getItemIcon = (item: MachineItem) => {
    const rarity = String(item.rarity || "").toUpperCase();
    if (rarity === "LEGENDARY") return "👑";
    if (rarity === "EPIC") return "💎";
    if (rarity === "RARE") return "🎁";
    const assetType = Number(item.assetType || 0);
    if (assetType === 2) return "🖼️";
    if (assetType === 1) return "🪙";
    return "📦";
  };

  const fetchMachineItems = async (contract: string, machineId: number, itemCount: number) => {
    const items: MachineItem[] = [];
    for (let index = 1; index <= itemCount; index++) {
      const itemRes = await invokeRead({
        scriptHash: contract,
        operation: "GetMachineItem",
        args: [{ type: "Integer", value: String(machineId) }, { type: "Integer", value: String(index) }],
      });
      const itemMap = parseInvokeResult(itemRes) as Record<string, unknown> | null;
      if (!itemMap || typeof itemMap !== "object") continue;
      const decimals = numberFrom(itemMap.decimals);
      const amountRaw = numberFrom(itemMap.amount);
      const stockRaw = numberFrom(itemMap.stock);
      const item: MachineItem = {
        name: String(itemMap.name || ""),
        probability: numberFrom(itemMap.weight),
        displayProbability: 0,
        rarity: String(itemMap.rarity || t("rarityCommon")),
        assetType: numberFrom(itemMap.assetType),
        assetHash: toDisplayHash(itemMap.assetHash),
        amountRaw,
        amountDisplay: formatTokenAmount(amountRaw, decimals),
        tokenId: String(itemMap.tokenId || ""),
        stockRaw,
        stockDisplay: formatTokenAmount(stockRaw, decimals),
        tokenCount: numberFrom(itemMap.tokenCount),
        decimals,
        available: false,
      };
      item.icon = getItemIcon(item);
      items.push(item);
    }
    return items;
  };

  const fetchMachines = async () => {
    isLoadingMachines.value = true;
    try {
      const contract = await ensureContractAddress();
      if (!contract) { machines.value = []; return; }
      const totalRes = await invokeRead({ scriptHash: contract, operation: "TotalMachines" });
      const total = numberFrom(parseInvokeResult(totalRes));
      const loaded: Machine[] = [];
      for (let machineId = 1; machineId <= total; machineId++) {
        const machineRes = await invokeRead({ scriptHash: contract, operation: "GetMachine", args: [{ type: "Integer", value: String(machineId) }] });
        const machineMap = parseInvokeResult(machineRes) as Record<string, unknown> | null;
        if (!machineMap || typeof machineMap !== "object" || !machineMap.name) continue;
        const itemCount = numberFrom(machineMap.itemCount);
        const items = await fetchMachineItems(contract, machineId, itemCount);
        const availableItems = items.filter((item) => isItemAvailable(item));
        const availableWeight = availableItems.reduce((sum, item) => sum + item.probability, 0);
        const normalizedItems = items.map((item) => {
          const available = isItemAvailable(item);
          const displayProbability = availableWeight > 0 && available ? Number(((item.probability / availableWeight) * 100).toFixed(2)) : 0;
          return { ...item, available, displayProbability };
        });
        const topItem = availableItems.length ? availableItems.reduce((prev, curr) => (curr.probability < prev.probability ? curr : prev), availableItems[0]) : items.length ? items[0] : null;
        const creatorHash = normalizeScriptHash(String(machineMap.creator || ""));
        const ownerHash = normalizeScriptHash(String(machineMap.owner || ""));
        const salePriceRaw = numberFrom(machineMap.salePrice);
        const revenueRaw = numberFrom(machineMap.revenue);
        const salesVolumeRaw = numberFrom(machineMap.salesVolume);
        loaded.push({
          id: String(machineId),
          name: String(machineMap.name || ""),
          description: String(machineMap.description || ""),
          category: String(machineMap.category || ""),
          tags: String(machineMap.tags || ""),
          tagsList: parseTags(String(machineMap.tags || "")),
          creator: toDisplayHash(machineMap.creator),
          creatorHash,
          owner: toDisplayHash(machineMap.owner),
          ownerHash,
          priceRaw: numberFrom(machineMap.price),
          price: formatGas(numberFrom(machineMap.price)),
          itemCount,
          totalWeight: numberFrom(machineMap.totalWeight),
          availableWeight,
          plays: numberFrom(machineMap.plays),
          revenueRaw,
          revenue: formatGas(revenueRaw),
          sales: numberFrom(machineMap.sales),
          salesVolumeRaw,
          salesVolume: formatGas(salesVolumeRaw),
          createdAt: numberFrom(machineMap.createdAt),
          lastPlayedAt: numberFrom(machineMap.lastPlayedAt),
          active: Boolean(machineMap.active),
          listed: Boolean(machineMap.listed),
          banned: Boolean(machineMap.banned),
          locked: Boolean(machineMap.locked),
          forSale: salePriceRaw > 0,
          salePriceRaw,
          salePrice: salePriceRaw > 0 ? formatGas(salePriceRaw) : "0",
          inventoryReady: availableWeight > 0,
          items: normalizedItems,
          topPrize: topItem?.name || "",
          winRate: topItem?.probability || 0,
        });
      }
      machines.value = loaded;
      if (selectedMachine.value) {
        const updated = loaded.find((machine) => machine.id === selectedMachine.value?.id) || null;
        selectedMachine.value = updated;
      }
    } catch (e: unknown) {
      handleError(e, { operation: "fetchMachines" });
    } finally {
      isLoadingMachines.value = false;
    }
  };

  const selectMachine = (machine: Machine) => {
    selectedMachine.value = machine;
  };

  const setActionLoading = (key: string, value: boolean) => {
    actionLoading.value[key] = value;
  };

  return {
    machines,
    selectedMachine,
    isLoadingMachines,
    contractAddress,
    actionLoading,
    walletHash,
    ensureContractAddress,
    fetchMachines,
    selectMachine,
    setActionLoading,
    numberFrom,
    formatTokenAmount,
    toFixed8,
    toFixedDecimals,
    parseTags,
    isItemAvailable,
    invokeRead,
    address,
    handleError,
    t,
  };
}
