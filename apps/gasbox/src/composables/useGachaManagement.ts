/**
 * useGachaManagement — Machine management actions for the GasBox miniapp
 *
 * Receives ChainService from PlatformServices.
 */

import { ref } from "vue";
import type { ChainService } from "@shared/services";
import { toFixed8, toFixedDecimals } from "@shared/utils/format";
import type { Machine, MachineItem } from "@/types";

export interface UseGachaManagementOptions {
  chain: ChainService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useGachaManagement({ chain, t }: UseGachaManagementOptions) {
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
    const addr = await chain.ensureWallet();
    const key = `price:${machine.id}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);
      const priceRaw = toFixed8(gasInputFromRaw(machine.priceRaw));
      await chain.invoke("UpdateMachine", [
        { type: "Hash160", value: addr },
        { type: "Integer", value: machine.id },
        { type: "String", value: machine.name },
        { type: "String", value: machine.description || "" },
        { type: "String", value: machine.category || "" },
        { type: "String", value: machine.tags || "" },
        { type: "Integer", value: priceRaw },
      ]);
      if (onSuccess) await onSuccess();
    } finally {
      setActionLoading(key, false);
    }
  };

  const toggleMachineActive = async (machine: Machine, onSuccess?: () => Promise<void>) => {
    const addr = await chain.ensureWallet();
    const key = `active:${machine.id}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);
      await chain.invoke("SetMachineActive", [
        { type: "Hash160", value: addr },
        { type: "Integer", value: machine.id },
        { type: "Boolean", value: !machine.active },
      ]);
      if (onSuccess) await onSuccess();
    } finally {
      setActionLoading(key, false);
    }
  };

  const toggleMachineListed = async (machine: Machine, onSuccess?: () => Promise<void>) => {
    const addr = await chain.ensureWallet();
    const key = `listed:${machine.id}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);
      await chain.invoke("SetMachineListed", [
        { type: "Hash160", value: addr },
        { type: "Integer", value: machine.id },
        { type: "Boolean", value: !machine.listed },
      ]);
      if (onSuccess) await onSuccess();
    } finally {
      setActionLoading(key, false);
    }
  };

  const listMachineForSale = async (machine: Machine, salePrice: string, onSuccess?: () => Promise<void>) => {
    const addr = await chain.ensureWallet();
    const key = `sale:${machine.id}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);
      const salePriceRaw = toFixed8(salePrice);
      await chain.invoke("ListMachineForSale", [
        { type: "Hash160", value: addr },
        { type: "Integer", value: machine.id },
        { type: "Integer", value: salePriceRaw },
      ]);
      if (onSuccess) await onSuccess();
    } finally {
      setActionLoading(key, false);
    }
  };

  const cancelMachineSale = async (machine: Machine, onSuccess?: () => Promise<void>) => {
    const addr = await chain.ensureWallet();
    const key = `cancelSale:${machine.id}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);
      await chain.invoke("cancelMachineSale", [
        { type: "Hash160", value: addr },
        { type: "Integer", value: machine.id },
      ]);
      if (onSuccess) await onSuccess();
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
    onSuccess?: () => Promise<void>,
  ) => {
    const addr = await chain.ensureWallet();
    const contract = chain.contractAddress.value;
    if (!contract) throw new Error(t("contractMissing"));
    const key = `deposit:${machine.id}:${index}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);

      if (item.assetType === 1) {
        if (!depositAmount) throw new Error(t("depositAmountRequired"));
        const amountRaw = toRawAmount(depositAmount, item.decimals || 8);

        // Transfer token to contract
        await chain.invoke(
          "transfer",
          [
            { type: "Hash160", value: addr },
            { type: "Hash160", value: contract },
            { type: "Integer", value: amountRaw },
          ],
          { scriptHash: item.assetHash },
        );

        await new Promise((resolve) => setTimeout(resolve, 4000));

        // Record deposit in contract
        await chain.invoke("depositItem", [
          { type: "Hash160", value: addr },
          { type: "Integer", value: machine.id },
          { type: "Integer", value: String(index) },
          { type: "Integer", value: amountRaw },
        ]);
      } else if (item.assetType === 2) {
        const finalTokenId = tokenId || item.tokenId;
        if (!finalTokenId) throw new Error(t("tokenIdRequired"));
        await chain.invoke("depositItemToken", [
          { type: "Hash160", value: addr },
          { type: "Integer", value: machine.id },
          { type: "Integer", value: String(index) },
          { type: "String", value: finalTokenId },
        ]);
      }
      if (onSuccess) await onSuccess();
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
    onSuccess?: () => Promise<void>,
  ) => {
    const addr = await chain.ensureWallet();
    const key = `withdraw:${machine.id}:${index}`;
    if (actionLoading.value[key]) return;

    try {
      setActionLoading(key, true);

      if (item.assetType === 1) {
        if (!withdrawAmount) throw new Error(t("withdrawAmountRequired"));
        const amountRaw = toRawAmount(withdrawAmount, item.decimals || 8);
        await chain.invoke("withdrawItem", [
          { type: "Hash160", value: addr },
          { type: "Integer", value: machine.id },
          { type: "Integer", value: String(index) },
          { type: "Integer", value: amountRaw },
        ]);
      } else if (item.assetType === 2) {
        const finalTokenId = tokenId || item.tokenId || "";
        await chain.invoke("withdrawItemToken", [
          { type: "Hash160", value: addr },
          { type: "Integer", value: machine.id },
          { type: "Integer", value: String(index) },
          { type: "String", value: finalTokenId },
        ]);
      }
      if (onSuccess) await onSuccess();
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
    depositItem,
    withdrawItem,
    t,
  };
}

export type UseGachaManagementReturn = ReturnType<typeof useGachaManagement>;
