/**
 * useMultisigCreation — Multisig transaction creation logic
 *
 * Migrated from legacy pattern: no longer imports useWallet or useStatusMessage
 * directly. Uses EventBus for status notifications and ChainService for
 * chain context (chain ID).
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
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

  const step = createObservable(1);
  const isPreparing = createObservable(false);
  const isSubmitting = createObservable(false);

  const form = createObservable<MultisigFormData>({
    signers: ["", ""],
    threshold: 1,
    selectedChain: defaultChain,
    asset: "GAS",
    toAddress: "",
    amount: "",
    memo: "",
  });

  const multisigAccount = createObservable<MultisigAccount | null>(null);
  const preparedTx = createObservable<Record<string, unknown> | null>(null);
  const feeSummary = createObservable<FeeSummary>({
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

  const trimmedSigners = createDerived(() => form.get().signers.map((s) => s.trim()), []);
  const isValidSigners = createDerived(() => {
    if (trimmedSigners.get().some((s) => !s)) return false;
    try {
      normalizePublicKeys(trimmedSigners.get());
      return true;
    } catch {
      return false;
    }
  }, []);

  const isValidTx = createDerived(() => {
    return isValidAddress(form.get().toAddress) && validateAmount(form.get().amount, form.get().asset);
  }, []);

  const chainLabel = createDerived(() =>
    form.get().selectedChain === "neo-n3-mainnet" ? t("chainMainnet") : t("chainTestnet"),
  []);

  const addSigner = () => {
    const f = form.get();
    form.set({ ...f, signers: [...f.signers, ""] });
  };
  const removeSigner = (i: number) => {
    const f = form.get();
    form.set({ ...f, signers: f.signers.filter((_, idx) => idx !== i) });
  };
  const setChain = (chain: "neo-n3-mainnet" | "neo-n3-testnet") => {
    const f = form.get();
    form.set({ ...f, selectedChain: chain });
  };

  const finalizeConfig = () => {
    try {
      const normalized = normalizePublicKeys(trimmedSigners.get());
      const account = createMultisigAccount(form.get().threshold, normalized);
      multisigAccount.set({
        address: account.address,
        scriptHash: account.scriptHash,
        publicKeys: account.publicKeys,
      });
      step.set(3);
    } catch (e) {
      const message =
        e instanceof Error && e.message.includes("duplicate") ? t("toastDuplicateSigners") : t("toastInvalidSigners");
      setStatus(formatErrorMessage(e, message), "error");
    }
  };

  const prepareTransaction = async () => {
    if (!multisigAccount.get()) {
      setStatus(t("toastInvalidSigners"), "error");
      return;
    }
    if (!isValidAddress(form.get().toAddress)) {
      setStatus(t("toastInvalidAddress"), "error");
      return;
    }
    if (!validateAmount(form.get().amount, form.get().asset)) {
      setStatus(t("toastInvalidAmount"), "error");
      return;
    }

    isPreparing.set(true);
    try {
      const prepared = await buildTransferTransaction({
        chainId: form.get().selectedChain,
        fromAddress: multisigAccount.get().address,
        toAddress: form.get().toAddress,
        amount: form.get().amount,
        assetSymbol: form.get().asset,
        threshold: form.get().threshold,
        publicKeys: multisigAccount.get().publicKeys,
      });
      preparedTx.set(prepared.tx);
      feeSummary.set({
        systemFee: prepared.systemFee,
        networkFee: prepared.networkFee,
        validUntilBlock: prepared.validUntilBlock,
      });
      step.set(4);
    } catch (e) {
      setStatus(formatErrorMessage(e, t("toastPrepareFailed")), "error");
    } finally {
      isPreparing.set(false);
    }
  };

  const submit = async (onSuccess?: (id: string) => void) => {
    if (!preparedTx.get() || !multisigAccount.get()) return;
    isSubmitting.set(true);
    try {
      const result = await api.create({
        chainId: form.get().selectedChain,
        scriptHash: multisigAccount.get().scriptHash,
        threshold: form.get().threshold,
        signers: multisigAccount.get().publicKeys,
        transactionHex: (preparedTx.get() as { serialize: (unsigned: boolean) => string }).serialize(false),
        memo: form.get().memo || undefined,
      });

      const history = Array.isArray(readCachedJSON<Array<Record<string, unknown>>>("multisig_history"))
        ? (readCachedJSON<Array<Record<string, unknown>>>("multisig_history") as Array<Record<string, unknown>>)
        : [];
      history.unshift({
        id: result.id,
        scriptHash: multisigAccount.get().scriptHash,
        status: result.status || "pending",
        createdAt: result.created_at || new Date().toISOString(),
      });
      writeCachedJSON("multisig_history", history.slice(0, 10));

      onSuccess?.(result.id);
    } catch (e) {
      setStatus(formatErrorMessage(e, t("toastCreateFailed")), "error");
    } finally {
      isSubmitting.set(false);
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
    status: createObservable(null),
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
