import { ref, computed, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
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

export function useMultisigCreation() {
  const { t } = createUseI18n(messages)();
  const { chainId } = useWallet();
  const { status, setStatus, clearStatus } = useStatusMessage();

  const step = ref(1);
  const isPreparing = ref(false);
  const isSubmitting = ref(false);

  const form = ref<MultisigFormData>({
    signers: ["", ""],
    threshold: 1,
    selectedChain: chainId.value === "neo-n3-testnet" ? "neo-n3-testnet" : "neo-n3-mainnet",
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

  watch(
    () => form.value.signers,
    (next) => {
      if (form.value.threshold > next.length) {
        form.value.threshold = next.length || 1;
      }
    },
    { deep: true }
  );

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
    form.value.selectedChain === "neo-n3-mainnet" ? t("chainMainnet") : t("chainTestnet")
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
    } catch (e: unknown) {
      const message =
        e instanceof Error && e.message.includes("duplicate") ? t("toastDuplicateSigners") : t("toastInvalidSigners");
      setStatus(message, "error");
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
    } catch (e: unknown) {
      setStatus(t("toastPrepareFailed"), "error");
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

      const history = uni.getStorageSync("multisig_history") ? JSON.parse(uni.getStorageSync("multisig_history")) : [];
      history.unshift({
        id: result.id,
        scriptHash: multisigAccount.value.scriptHash,
        status: result.status || "pending",
        createdAt: result.created_at || new Date().toISOString(),
      });
      uni.setStorageSync("multisig_history", JSON.stringify(history.slice(0, 10)));

      onSuccess?.(result.id);
    } catch (e: unknown) {
      setStatus(t("toastCreateFailed"), "error");
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
    status,
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
