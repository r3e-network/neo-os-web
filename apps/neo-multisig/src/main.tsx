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
import { api, configureStorage, type MultisigRequest } from "./services/api";
import {
  assembleSignedTransaction,
  broadcastTransaction,
  buildTransferTransaction,
  createMultisigAccount,
  getRequestSignData,
  isValidAddress,
  normalizePublicKey,
  normalizePublicKeys,
  orderSignatures,
  validateAmount,
  verifySignature,
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
    const chain = ctx.services.chain;
    // Persist requests to shared OS storage so other signers can load + sign
    // them from their own device, replacing the local-only runtime cache.
    configureStorage(ctx.os.storage);

    const {
      history,
      pendingCount,
      completedCount,
      loadHistory,
      addToHistory,
      updateHistoryItem,
    } = useMultisigHistory();
    const totalTxs = createDerived(() => history.get().length, [history]);
    const lastRequest = createObservable<MultisigRequest | null>(null);
    const selectedRequest = createObservable<MultisigRequest | null>(null);
    // Connected wallet address, mirrored so the view can tell whether the
    // current signer has already approved the selected request.
    const connectedAddress = createObservable<string>("");
    const isCreatingRequest = createObservable(false);
    const isLoadingRequest = createObservable(false);
    const isSigningRequest = createObservable(false);
    const isBroadcastingRequest = createObservable(false);

    loadHistory();

    // Keep the connected-wallet address observable in sync with the chain
    // service so the Sign affordance can reflect who is connected.
    const syncConnectedAddress = () => {
      connectedAddress.set(chain.address?.get?.() ?? "");
    };
    syncConnectedAddress();
    chain.address?.subscribe?.(syncConnectedAddress);

    // Rebuild history from the shared index so requests created on other
    // devices show up in the activity feed (client-derived state).
    const syncHistoryFromStorage = async () => {
      try {
        const requests = await api.list();
        for (const request of requests) {
          // addToHistory writes when the item is new; updateHistoryItem writes
          // when an existing item's status changed. Inserting then immediately
          // updating the same item caused two serialize+persist passes per new
          // request — guard so each request triggers at most one write.
          const existing = history.get().find((h) => h.id === request.id);
          if (existing) {
            if (existing.status !== request.status) {
              updateHistoryItem(request.id, { status: request.status });
            }
          } else {
            addToHistory({
              id: request.id,
              scriptHash: request.script_hash,
              status: request.status,
              createdAt: request.created_at,
            });
          }
        }
      } catch {
        // Storage may be unavailable (e.g. offline); keep local history.
      }
    };

    /** Extract the witness signature + signer pubkey from a wallet result. */
    const extractSignature = (
      result: unknown,
    ): { publicKey: string; signature: string } | null => {
      if (!result || typeof result !== "object") return null;
      const record = result as Record<string, unknown>;
      const signature =
        typeof record.data === "string"
          ? record.data
          : typeof record.signature === "string"
            ? record.signature
            : "";
      const publicKey =
        typeof record.publicKey === "string"
          ? record.publicKey
          : typeof record.pubkey === "string"
            ? record.pubkey
            : "";
      if (!signature || !publicKey) return null;
      return { publicKey, signature };
    };

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
        addToHistory({
          id: request.id,
          scriptHash: request.script_hash,
          status: request.status,
          createdAt: request.created_at,
        });
        updateHistoryItem(request.id, { status: request.status });
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

    // Sign the currently-loaded request with the connected wallet and append
    // the signature to the shared record so other signers can see progress.
    ctx.registerAction("signRequest", async (...args: unknown[]) => {
      const id = (args[0] as string) || selectedRequest.get()?.id || "";
      if (!id) {
        ctx.setStatus(ctx.t("toastNoId"), "error");
        return null;
      }

      isSigningRequest.set(true);
      try {
        const request = await api.get(id.trim());
        if (request.status === "broadcasted") {
          ctx.setStatus(ctx.t("toastBroadcastSuccess"), "info");
          selectedRequest.set(request);
          return request;
        }

        // Each signer signs the canonical transaction sign-data so the
        // signature is valid inside the multisig witness.
        const signData = getRequestSignData(
          request.transaction_hex,
          request.chain_id,
        );
        const signed = await chain.signMessage(signData);
        const extracted = extractSignature(signed);
        if (!extracted) {
          ctx.setStatus(ctx.t("toastSignFailed"), "error");
          return null;
        }

        // Only listed public keys may approve the request.
        const signerKey = normalizePublicKey(extracted.publicKey);
        const isAuthorized = request.signers
          .map(normalizePublicKey)
          .includes(signerKey);
        if (!isAuthorized) {
          ctx.setStatus(ctx.t("toastNotSigner"), "error");
          return null;
        }

        // The signature must verify against the exact transaction sign-data
        // under the signer's public key, otherwise it is worthless inside the
        // multisig witness and would only be discovered at broadcast time.
        // Rejecting it here prevents an invalid signature from counting toward
        // the threshold and falsely advancing the request to 'ready'.
        if (!verifySignature(signData, extracted.signature, signerKey)) {
          ctx.setStatus(ctx.t("toastSignatureInvalid"), "error");
          return null;
        }

        const updated = await api.addSignature(
          request.id,
          signerKey,
          extracted.signature,
        );
        selectedRequest.set(updated);
        updateHistoryItem(updated.id, { status: updated.status });
        if (lastRequest.get()?.id === updated.id) lastRequest.set(updated);
        ctx.setStatus(ctx.t("toastSignSuccess"), "success");
        return updated;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : ctx.t("toastSignFailed");
        ctx.setStatus(`${ctx.t("toastSignFailed")} ${message}`, "error");
        return null;
      } finally {
        isSigningRequest.set(false);
      }
    });

    // Assemble the multisig witness from collected signatures and relay the
    // transaction once the threshold is met.
    ctx.registerAction("broadcastRequest", async (...args: unknown[]) => {
      const id = (args[0] as string) || selectedRequest.get()?.id || "";
      if (!id) {
        ctx.setStatus(ctx.t("toastNoId"), "error");
        return null;
      }

      isBroadcastingRequest.set(true);
      try {
        const request = await api.get(id.trim());
        if (request.broadcast_txid) {
          ctx.setStatus(ctx.t("toastBroadcastSuccess"), "info");
          selectedRequest.set(request);
          return request;
        }

        const ordered = orderSignatures(
          request.signers,
          request.signatures,
          request.threshold,
        );
        if (!ordered) {
          ctx.setStatus(ctx.t("toastNotEnoughSignatures"), "error");
          return null;
        }

        const signedTxHex = assembleSignedTransaction({
          transactionHex: request.transaction_hex,
          signers: request.signers,
          threshold: request.threshold,
          signatures: request.signatures,
        });
        const txid = await broadcastTransaction(request.chain_id, signedTxHex);

        const updated = await api.updateStatus(
          request.id,
          "broadcasted",
          txid,
        );
        selectedRequest.set(updated);
        updateHistoryItem(updated.id, { status: updated.status });
        if (lastRequest.get()?.id === updated.id) lastRequest.set(updated);
        ctx.setStatus(ctx.t("toastBroadcastSuccess"), "success");
        return updated;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : ctx.t("toastBroadcastFailed");
        ctx.setStatus(`${ctx.t("toastBroadcastFailed")} ${message}`, "error");
        return null;
      } finally {
        isBroadcastingRequest.set(false);
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
        connectedAddress,
        isCreatingRequest,
        isLoadingRequest,
        isSigningRequest,
        isBroadcastingRequest,
      }),
      loadData: async () => {
        await syncHistoryFromStorage();
      },
    };
  },
});
