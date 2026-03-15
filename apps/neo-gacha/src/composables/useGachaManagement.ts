import { ref } from "vue";
import { toFixed8, toFixedDecimals } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import type { Machine, MachineItem } from "@/types";

const APP_ID = "miniapp-neo-gacha";

export function useGachaManagement() {
  const { t } = createUseI18n(messages)();
  const { handleError } = useErrorHandler();
  const { address, invokeDirectly } = useContractInteraction({ appId: APP_ID, t });

  const actionLoading = ref<Record<string, boolean>>({});

  const gasInputFromRaw = (raw: number) => {
    if (!Number.isFinite(raw) || raw <= 0) return "0";
    const value = (raw / 1e8).toFixed(8);
    return value.replace(/\.?0+$/, "");
  };

  const toRawAmount = (value: string, decimals: number) => toFixedDecimals(value, decimals);

  const setActionLoading = (key: string, value: boolean) => {
    actionLoading.value[key] = value;
  };

  const updateMachinePrice = async (machine: Machine, onSuccess?: () => Promise<void>) => {
    if (!address.value) throw new Error(t("connectWallet"));
    const key = `price:${machine.id}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);
      const priceRaw = toFixed8(gasInputFromRaw(machine.priceRaw));
      await invokeDirectly("UpdateMachine", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: machine.id },
        { type: "String", value: machine.name },
        { type: "String", value: machine.description || "" },
        { type: "String", value: machine.category || "" },
        { type: "String", value: machine.tags || "" },
        { type: "Integer", value: priceRaw },
      ]);
      if (onSuccess) await onSuccess();
    } catch (e: unknown) {
      handleError(e, { operation: "updateMachinePrice" });
      throw e;
    } finally {
      setActionLoading(key, false);
    }
  };

  const toggleMachineActive = async (machine: Machine, onSuccess?: () => Promise<void>) => {
    if (!address.value) throw new Error(t("connectWallet"));
    const key = `active:${machine.id}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);
      await invokeDirectly("SetMachineActive", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: machine.id },
        { type: "Boolean", value: !machine.active },
      ]);
      if (onSuccess) await onSuccess();
    } catch (e: unknown) {
      handleError(e, { operation: "toggleMachineActive" });
      throw e;
    } finally {
      setActionLoading(key, false);
    }
  };

  const toggleMachineListed = async (machine: Machine, onSuccess?: () => Promise<void>) => {
    if (!address.value) throw new Error(t("connectWallet"));
    const key = `listed:${machine.id}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);
      await invokeDirectly("SetMachineListed", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: machine.id },
        { type: "Boolean", value: !machine.listed },
      ]);
      if (onSuccess) await onSuccess();
    } catch (e: unknown) {
      handleError(e, { operation: "toggleMachineListed" });
      throw e;
    } finally {
      setActionLoading(key, false);
    }
  };

  const listMachineForSale = async (machine: Machine, salePrice: string, onSuccess?: () => Promise<void>) => {
    if (!address.value) throw new Error(t("connectWallet"));
    const key = `sale:${machine.id}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);
      const salePriceRaw = toFixed8(salePrice);
      await invokeDirectly("ListMachineForSale", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: machine.id },
        { type: "Integer", value: salePriceRaw },
      ]);
      if (onSuccess) await onSuccess();
    } catch (e: unknown) {
      handleError(e, { operation: "listMachineForSale" });
      throw e;
    } finally {
      setActionLoading(key, false);
    }
  };

  const cancelMachineSale = async (machine: Machine, onSuccess?: () => Promise<void>) => {
    if (!address.value) throw new Error(t("connectWallet"));
    const key = `cancelSale:${machine.id}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);
      await invokeDirectly("cancelMachineSale", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: machine.id },
      ]);
      if (onSuccess) await onSuccess();
    } catch (e: unknown) {
      handleError(e, { operation: "cancelMachineSale" });
      throw e;
    } finally {
      setActionLoading(key, false);
    }
  };

  const withdrawMachineRevenue = async (machine: Machine, onSuccess?: () => Promise<void>) => {
    const key = `withdrawRevenue:${machine.id}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);
      await invokeDirectly("withdrawMachineRevenue", [{ type: "Integer", value: machine.id }]);
      if (onSuccess) await onSuccess();
    } catch (e: unknown) {
      handleError(e, { operation: "withdrawMachineRevenue" });
      throw e;
    } finally {
      setActionLoading(key, false);
    }
  };

  const depositItem = async (
    machine: Machine,
    item: MachineItem,
    index: number,
    depositAmount: string,
    tokenId: string,
    onSuccess?: () => Promise<void>
  ) => {
    if (!address.value) throw new Error(t("connectWallet"));
    const key = `deposit:${machine.id}:${index}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);

      if (item.assetType === 1) {
        if (!depositAmount) throw new Error(t("depositAmountRequired"));
        const amountRaw = toRawAmount(depositAmount, item.decimals || 8);
        await invokeDirectly("depositItem", [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: machine.id },
          { type: "Integer", value: String(index) },
          { type: "Integer", value: amountRaw },
        ]);
      } else if (item.assetType === 2) {
        const finalTokenId = tokenId || item.tokenId;
        if (!finalTokenId) throw new Error(t("tokenIdRequired"));
        await invokeDirectly("depositItemToken", [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: machine.id },
          { type: "Integer", value: String(index) },
          { type: "String", value: finalTokenId },
        ]);
      }
      if (onSuccess) await onSuccess();
    } catch (e: unknown) {
      handleError(e, { operation: "depositItem" });
      throw e;
    } finally {
      setActionLoading(key, false);
    }
  };

  const withdrawItem = async (
    machine: Machine,
    item: MachineItem,
    index: number,
    withdrawAmount: string,
    tokenId: string,
    onSuccess?: () => Promise<void>
  ) => {
    if (!address.value) throw new Error(t("connectWallet"));
    const key = `withdraw:${machine.id}:${index}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);

      if (item.assetType === 1) {
        if (!withdrawAmount) throw new Error(t("withdrawAmountRequired"));
        const amountRaw = toRawAmount(withdrawAmount, item.decimals || 8);
        await invokeDirectly("withdrawItem", [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: machine.id },
          { type: "Integer", value: String(index) },
          { type: "Integer", value: amountRaw },
        ]);
      } else if (item.assetType === 2) {
        const finalTokenId = tokenId || item.tokenId || "";
        await invokeDirectly("withdrawItemToken", [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: machine.id },
          { type: "Integer", value: String(index) },
          { type: "String", value: finalTokenId },
        ]);
      }
      if (onSuccess) await onSuccess();
    } catch (e: unknown) {
      handleError(e, { operation: "withdrawItem" });
      throw e;
    } finally {
      setActionLoading(key, false);
    }
  };

  return {
    actionLoading,
    setActionLoading,
    updateMachinePrice,
    toggleMachineActive,
    toggleMachineListed,
    listMachineForSale,
    cancelMachineSale,
    withdrawMachineRevenue,
    depositItem,
    withdrawItem,
    t,
  };
}
