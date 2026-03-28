/**
 * useMultisigCreation — Multisig transaction creation logic
 *
 * Migrated from legacy pattern: no longer imports useWallet or useStatusMessage
 * directly. Uses EventBus for status notifications and ChainService for
 * chain context (chain ID).
 */

import { ref, computed, watch, onUnmounted } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { api } from "@/services/api";
import {
  buildTransferTransaction,
  createMultisigAccount,
  formatFixed8,
  isValidAddress,
  normalizePublicKeys,
  validateAmount,
} from "@/utils/multisig";

export interface MultisigFormData {
  signers: string[];
  threshold: number;
  selectedChain: "neo-n3-mainnet" | "neo-n3-testnet";
  asset: "GAS" | "NEO";
  toAddress: string;
  amount: string;
  memo: string;
}

export interface MultisigAccount {
  address: string;
  scriptHash: string;
  publicKeys: string[];
}

export interface FeeSummary {
  systemFee: string;
  networkFee: string;
  validUntilBlock: number;
}

export interface UseMultisigCreationOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useMultisigCreation(options?: UseMultisigCreationOptions) {
  // Support both new (options-based) and legacy (no-args) calling conventions.
  // When called without options, fall back to a basic t function for backward compat.
  const t = options?.t ?? ((key: string) => key);
  const eventBus = options?.eventBus ?? null;

  // Determine default chain from ChainService or fall back to mainnet
  const defaultChain = "neo-n3-mainnet" as "neo-n3-mainnet" | "neo-n3-testnet";

  const step = ref(1);
  const isPreparing = ref(false);
  const isSubmitting = ref(false);

  const form = ref<MultisigFormData>({
    signers: ["", ""],
    threshold: 1,
    selectedChain: defaultChain,
    asset: "GAS",
    toAddress: "",
    amount: "",
    memo: "",
  });

  const multisigAccount = ref<MultisigAccount | null>(null);
  const preparedTx = ref<Record<string, unknown> | null>(null);
  const feeSummary = ref<FeeSummary>({
    systemFee: "0",
    networkFee: "0",
    validUntilBlock: 0,
  });

  // Status notification helper
  const setStatus = (msg: string, type: string) => {
    if (eventBus) {
      eventBus.emit("multisig:status", { message: msg, type });
    }
  };

  const clearStatus = () => {
    if (eventBus) {
      eventBus.emit("multisig:status:clear", {});
    }
  };

  const stopSignersWatch = watch(
    () => form.value.signers,
    (next) => {
      if (form.value.threshold > next.length) {
        form.value.threshold = next.length || 1;
      }
    },
    { deep: true },
  );

  onUnmounted(() => stopSignersWatch());

  const trimmedSigners = computed(() => form.value.signers.map((s) => s.trim()));
  const isValidSigners = computed(() => {
    if (trimmedSigners.value.some((s) => !s)) return false;
    try {
      normalizePublicKeys(trimmedSigners.value);
      return true;
    } catch {
      return false;
    }
  });

  const isValidTx = computed(() => {
    return isValidAddress(form.value.toAddress) && validateAmount(form.value.amount, form.value.asset);
  });

  const chainLabel = computed(() =>
    form.value.selectedChain === "neo-n3-mainnet" ? t("chainMainnet") : t("chainTestnet"),
  );

  const addSigner = () => form.value.signers.push("");
  const removeSigner = (i: number) => form.value.signers.splice(i, 1);
  const setChain = (chain: "neo-n3-mainnet" | "neo-n3-testnet") => {
    form.value.selectedChain = chain;
  };

  const finalizeConfig = () => {
    try {
      const normalized = normalizePublicKeys(trimmedSigners.value);
      const account = createMultisigAccount(form.value.threshold, normalized);
      multisigAccount.value = {
        address: account.address,
        scriptHash: account.scriptHash,
        publicKeys: account.publicKeys,
      };
      step.value = 3;
    } catch (e) {
      const message =
        e instanceof Error && e.message.includes("duplicate") ? t("toastDuplicateSigners") : t("toastInvalidSigners");
      setStatus(formatErrorMessage(e, message), "error");
    }
  };

  const prepareTransaction = async () => {
    if (!multisigAccount.value) {
      setStatus(t("toastInvalidSigners"), "error");
      return;
    }
    if (!isValidAddress(form.value.toAddress)) {
      setStatus(t("toastInvalidAddress"), "error");
      return;
    }
    if (!validateAmount(form.value.amount, form.value.asset)) {
      setStatus(t("toastInvalidAmount"), "error");
      return;
    }

    isPreparing.value = true;
    try {
      const prepared = await buildTransferTransaction({
        chainId: form.value.selectedChain,
        fromAddress: multisigAccount.value.address,
        toAddress: form.value.toAddress,
        amount: form.value.amount,
        assetSymbol: form.value.asset,
        threshold: form.value.threshold,
        publicKeys: multisigAccount.value.publicKeys,
      });
      preparedTx.value = prepared.tx;
      feeSummary.value = {
        systemFee: prepared.systemFee,
        networkFee: prepared.networkFee,
        validUntilBlock: prepared.validUntilBlock,
      };
      step.value = 4;
    } catch (e) {
      setStatus(formatErrorMessage(e, t("toastPrepareFailed")), "error");
    } finally {
      isPreparing.value = false;
    }
  };

  const submit = async (onSuccess?: (id: string) => void) => {
    if (!preparedTx.value || !multisigAccount.value) return;
    isSubmitting.value = true;
    try {
      const result = await api.create({
        chainId: form.value.selectedChain,
        scriptHash: multisigAccount.value.scriptHash,
        threshold: form.value.threshold,
        signers: multisigAccount.value.publicKeys,
        transactionHex: (preparedTx.value as { serialize: (unsigned: boolean) => string }).serialize(false),
        memo: form.value.memo || undefined,
      });

      const history = Array.isArray(readCachedJSON<Array<Record<string, unknown>>>("multisig_history"))
        ? (readCachedJSON<Array<Record<string, unknown>>>("multisig_history") as Array<Record<string, unknown>>)
        : [];
      history.unshift({
        id: result.id,
        scriptHash: multisigAccount.value.scriptHash,
        status: result.status || "pending",
        createdAt: result.created_at || new Date().toISOString(),
      });
      writeCachedJSON("multisig_history", history.slice(0, 10));

      onSuccess?.(result.id);
    } catch (e) {
      setStatus(formatErrorMessage(e, t("toastCreateFailed")), "error");
    } finally {
      isSubmitting.value = false;
    }
  };

  return {
    step,
    form,
    isPreparing,
    isSubmitting,
    multisigAccount,
    preparedTx,
    feeSummary,
    trimmedSigners,
    isValidSigners,
    isValidTx,
    chainLabel,
    // status/setStatus/clearStatus are provided for backward compat with sub-pages
    status: ref(null),
    setStatus,
    clearStatus,
    addSigner,
    removeSigner,
    setChain,
    finalizeConfig,
    prepareTransaction,
    submit,
    formatFixed8,
  };
}
