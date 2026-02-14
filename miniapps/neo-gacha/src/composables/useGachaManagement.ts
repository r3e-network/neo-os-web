import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { toFixed8, toFixedDecimals } from "@shared/utils/format";
import { parseInvokeResult, normalizeScriptHash, addressToScriptHash } from "@shared/utils/neo";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { messages } from "@/locale/messages";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import type { Machine, MachineItem } from "@/types";

export function useGachaManagement() {
  const { t } = createUseI18n(messages)();
  const { handleError } = useErrorHandler();
  const { address, invokeRead, invokeContract } = useWallet() as WalletSDK;
  const { ensure: ensureContractAddress } = useContractAddress(t);

  const actionLoading = ref<Record<string, boolean>>({});

  const numberFrom = (value: unknown) => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  };

  const gasInputFromRaw = (raw: number) => {
    if (!Number.isFinite(raw) || raw <= 0) return "0";
    const value = (raw / 1e8).toFixed(8);
    return value.replace(/\.?0+$/, "");
  };

  const toRawAmount = (value: string, decimals: number) => toFixedDecimals(value, decimals);

  const toHash160 = (value: string) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (/^(0x)?[0-9a-fA-F]{40}$/.test(trimmed)) {
      return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
    }
    const scriptHash = addressToScriptHash(trimmed);
    return scriptHash ? `0x${scriptHash}` : "";
  };

  const setActionLoading = (key: string, value: boolean) => {
    actionLoading.value[key] = value;
  };

  const updateMachinePrice = async (machine: Machine, onSuccess?: () => Promise<void>) => {
    if (!address.value) throw new Error(t("connectWallet"));
    const key = `price:${machine.id}`;
    if (actionLoading.value[key]) return;
    
    try {
      setActionLoading(key, true);
      const contract = await ensureContractAddress();
      if (!contract) return;
      const priceRaw = toFixed8(gasInputFromRaw(machine.priceRaw));
      await invokeContract({
        scriptHash: contract,
        operation: "UpdateMachine",
        args: [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: machine.id },
          { type: "String", value: machine.name },
          { type: "String", value: machine.description || "" },
          { type: "String", value: machine.category || "" },
          { type: "String", value: machine.tags || "" },
          { type: "Integer", value: priceRaw },
        ],
      });
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
      const contract = await ensureContractAddress();
      if (!contract) return;
      await invokeContract({
        scriptHash: contract,
        operation: "SetMachineActive",
        args: [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: machine.id },
          { type: "Boolean", value: !machine.active },
        ],
      });
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
      const contract = await ensureContractAddress();
      if (!contract) return;
      await invokeContract({
        scriptHash: contract,
        operation: "SetMachineListed",
        args: [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: machine.id },
          { type: "Boolean", value: !machine.listed },
        ],
      });
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
      const contract = await ensureContractAddress();
      if (!contract) return;
      const salePriceRaw = toFixed8(salePrice);
      await invokeContract({
        scriptHash: contract,
        operation: "ListMachineForSale",
        args: [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: machine.id },
          { type: "Integer", value: salePriceRaw },
        ],
      });
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
      const contract = await ensureContractAddress();
      if (!contract) return;
      await invokeContract({
        scriptHash: contract,
        operation: "cancelMachineSale",
        args: [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: machine.id },
        ],
      });
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
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "withdrawMachineRevenue",
        args: [{ type: "Integer", value: machine.id }],
      });
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
      const contract = await ensureContractAddress();
      if (!contract) return;
      
      if (item.assetType === 1) {
        if (!depositAmount) throw new Error(t("depositAmountRequired"));
        const amountRaw = toRawAmount(depositAmount, item.decimals || 8);
        await invokeContract({
          scriptHash: contract,
          operation: "depositItem",
          args: [
            { type: "Hash160", value: address.value as string },
            { type: "Integer", value: machine.id },
            { type: "Integer", value: String(index) },
            { type: "Integer", value: amountRaw },
          ],
        });
      } else if (item.assetType === 2) {
        const finalTokenId = tokenId || item.tokenId;
        if (!finalTokenId) throw new Error(t("tokenIdRequired"));
        await invokeContract({
          scriptHash: contract,
          operation: "depositItemToken",
          args: [
            { type: "Hash160", value: address.value as string },
            { type: "Integer", value: machine.id },
            { type: "Integer", value: String(index) },
            { type: "String", value: finalTokenId },
          ],
        });
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
      const contract = await ensureContractAddress();
      if (!contract) return;
      
      if (item.assetType === 1) {
        if (!withdrawAmount) throw new Error(t("withdrawAmountRequired"));
        const amountRaw = toRawAmount(withdrawAmount, item.decimals || 8);
        await invokeContract({
          scriptHash: contract,
          operation: "withdrawItem",
          args: [
            { type: "Hash160", value: address.value as string },
            { type: "Integer", value: machine.id },
            { type: "Integer", value: String(index) },
            { type: "Integer", value: amountRaw },
          ],
        });
      } else if (item.assetType === 2) {
        const finalTokenId = tokenId || item.tokenId || "";
        await invokeContract({
          scriptHash: contract,
          operation: "withdrawItemToken",
          args: [
            { type: "Hash160", value: address.value as string },
            { type: "Integer", value: machine.id },
            { type: "Integer", value: String(index) },
            { type: "String", value: finalTokenId },
          ],
        });
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
