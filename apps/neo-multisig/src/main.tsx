/**
 * Neo Multisig — Entry Point (React)
 */

import {
  createObservable,
  defineMiniApp,
  refsToObservables,
} from "@shared/react";
import { createDerived } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useMultisigHistory } from "./composables/useMultisigHistory";
import { api, type MultisigRequest } from "./services/api";
import {
  buildTransferTransaction,
  createMultisigAccount,
  isValidAddress,
  normalizePublicKeys,
  validateAmount,
} from "./utils/multisig";

type CreateRequestPayload = {
  signers: string[];
  threshold: number;
  selectedChain: "neo-n3-mainnet" | "neo-n3-testnet";
  asset: "GAS" | "NEO";
  toAddress: string;
  amount: string;
  memo: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCreateRequestPayload(value: unknown): CreateRequestPayload {
  const payload =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const signers = Array.isArray(payload.signers)
    ? payload.signers.map(asString).filter(Boolean)
    : [];
  const threshold = Number(payload.threshold);
  const selectedChain =
    payload.selectedChain === "neo-n3-mainnet"
      ? "neo-n3-mainnet"
      : "neo-n3-testnet";
  const asset = payload.asset === "NEO" ? "NEO" : "GAS";

  return {
    signers,
    threshold: Number.isFinite(threshold) ? Math.floor(threshold) : 0,
    selectedChain,
    asset,
    toAddress: asString(payload.toAddress),
    amount: asString(payload.amount),
    memo: asString(payload.memo),
  };
}

function serializePreparedTransaction(tx: Record<string, unknown>) {
  const serializable = tx as { serialize?: (signed?: boolean) => string };
  if (typeof serializable.serialize === "function") {
    return serializable.serialize(false);
  }
  throw new Error("Prepared transaction cannot be serialized");
}

defineMiniApp({
  appId: "miniapp-neo-multisig",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const { history, pendingCount, completedCount, loadHistory, addToHistory } =
      useMultisigHistory();
    const totalTxs = createDerived(() => history.get().length, [history]);
    const lastRequest = createObservable<MultisigRequest | null>(null);
    const selectedRequest = createObservable<MultisigRequest | null>(null);
    const isCreatingRequest = createObservable(false);
    const isLoadingRequest = createObservable(false);

    loadHistory();

    ctx.registerAction("createRequest", async (rawPayload: unknown) => {
      const payload = parseCreateRequestPayload(rawPayload);
      if (payload.signers.length < 2) {
        ctx.setStatus(ctx.t("toastNotEnoughSigners"), "error");
        return null;
      }
      if (payload.threshold < 1 || payload.threshold > payload.signers.length) {
        ctx.setStatus(ctx.t("toastInvalidThreshold"), "error");
        return null;
      }
      if (!isValidAddress(payload.toAddress)) {
        ctx.setStatus(ctx.t("toastInvalidAddress"), "error");
        return null;
      }
      if (!validateAmount(payload.amount, payload.asset)) {
        ctx.setStatus(ctx.t("toastInvalidAmount"), "error");
        return null;
      }

      isCreatingRequest.set(true);
      try {
        const normalizedSigners = normalizePublicKeys(payload.signers);
        const multisigAccount = createMultisigAccount(
          payload.threshold,
          normalizedSigners,
        );
        const prepared = await buildTransferTransaction({
          chainId: payload.selectedChain,
          fromAddress: multisigAccount.address,
          toAddress: payload.toAddress,
          amount: payload.amount,
          assetSymbol: payload.asset,
          threshold: payload.threshold,
          publicKeys: multisigAccount.publicKeys,
        });
        const request = await api.create({
          chainId: payload.selectedChain,
          scriptHash: multisigAccount.scriptHash,
          threshold: payload.threshold,
          signers: multisigAccount.publicKeys,
          transactionHex: serializePreparedTransaction(prepared.tx),
          memo: payload.memo || undefined,
        });

        lastRequest.set(request);
        selectedRequest.set(request);
        addToHistory({
          id: request.id,
          scriptHash: request.script_hash,
          status: request.status,
          createdAt: request.created_at,
        });
        ctx.setStatus(
          ctx.t("toastRequestCreated", { id: request.id.slice(0, 8) }),
          "success",
        );
        return request;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : ctx.t("toastCreateFailed");
        ctx.setStatus(`${ctx.t("toastCreateFailed")} ${message}`, "error");
        return null;
      } finally {
        isCreatingRequest.set(false);
      }
    });

    ctx.registerAction("loadTransaction", async (...args: unknown[]) => {
      const id = args[0] as string;
      if (!id) {
        ctx.setStatus(ctx.t("toastNoId"), "error");
        return null;
      }

      isLoadingRequest.set(true);
      try {
        const request = await api.get(id.trim());
        selectedRequest.set(request);
        ctx.setStatus(
          ctx.t("toastRequestLoaded", { id: request.id.slice(0, 8) }),
          "success",
        );
        return request;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : ctx.t("toastLoadFailed");
        ctx.setStatus(`${ctx.t("toastLoadFailed")} ${message}`, "error");
        return null;
      } finally {
        isLoadingRequest.set(false);
      }
    });

    return {
      state: refsToObservables({
        history,
        pendingCount,
        completedCount,
        totalTxs,
        lastRequest,
        selectedRequest,
        isCreatingRequest,
        isLoadingRequest,
      }),
      loadData: async () => {},
    };
  },
});
