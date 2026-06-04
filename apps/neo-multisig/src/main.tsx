/**
 * Neo Multisig — Entry Point (React)
 *
 * On-chain custody vault. The app talks to the deployed MiniAppMultisig
 * contract (resolved from the manifest as the app's primary contract):
 *   1. createVault(creator, signers[], threshold) -> vaultId
 *   2. deposit GAS/NEO into the vault (NEP-17 transfer with vaultId as data)
 *   3. createRequest(vaultId, recipient, asset, amount, memo) -> reqId
 *   4. each signer approve(reqId) — at threshold the contract releases funds
 *
 * There is no off-chain store and no native-multisig witness assembly; every
 * state change is a direct contract invoke and every read comes from the
 * contract (getVault / getRequest / balanceOf).
 */

import {
  createObservable,
  defineMiniApp,
  refsToObservables,
} from "@shared/react";
import { createDerived } from "@shared/react/context";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useMultisigHistory } from "./composables/useMultisigHistory";
import { createVaultApi } from "./services/api";
import {
  fromBaseUnits,
  isValidAddress,
  isValidAmount,
  validateSignerSet,
  type RequestView,
  type VaultAsset,
  type VaultView,
} from "./utils/vault";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asAsset(value: unknown): VaultAsset {
  return value === "NEO" ? "NEO" : "GAS";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function parseVaultId(value: unknown): number {
  const id = Math.floor(Number(value));
  return Number.isInteger(id) && id > 0 ? id : 0;
}

defineMiniApp({
  appId: "miniapp-neo-multisig",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const chain = ctx.services.chain;
    const api = createVaultApi(chain);

    const {
      history,
      vaultCount,
      pendingCount,
      completedCount,
      loadHistory,
      upsertHistory,
      updateHistoryStatus,
    } = useMultisigHistory();
    const totalActions = createDerived(() => history.get().length, [history]);

    const connectedAddress = createObservable<string>(
      chain.address.get() ?? "",
    );
    const activeVault = createObservable<VaultView | null>(null);
    const activeRequest = createObservable<RequestView | null>(null);
    const isCreatingVault = createObservable(false);
    const isDepositing = createObservable(false);
    const isProposing = createObservable(false);
    const isApproving = createObservable(false);
    const isCancelling = createObservable(false);
    const isLoading = createObservable(false);

    loadHistory();

    const syncConnectedAddress = () => {
      connectedAddress.set(chain.address.get() ?? "");
    };
    syncConnectedAddress();
    const stopAddressSync = chain.address.subscribe(syncConnectedAddress);

    // -- Read refreshers ------------------------------------------------------

    const refreshVault = async (vaultId: number): Promise<VaultView | null> => {
      const vault = await api.getVault(vaultId);
      if (vault) {
        activeVault.set(vault);
        upsertHistory({
          kind: "vault",
          id: vault.id,
          label: ctx.t("vaultHistoryLabel", {
            id: vault.id,
            threshold: vault.threshold,
            signers: vault.signers.length,
          }),
          createdAt: vault.createdTime
            ? new Date(vault.createdTime).toISOString()
            : new Date().toISOString(),
        });
      }
      return vault;
    };

    const refreshRequest = async (
      reqId: number,
    ): Promise<RequestView | null> => {
      const request = await api.getRequest(reqId);
      if (request) {
        activeRequest.set(request);
        upsertHistory({
          kind: "request",
          id: request.id,
          vaultId: request.vaultId,
          status: request.status,
          label: ctx.t("requestHistoryLabel", {
            amount: fromBaseUnits(
              request.amount,
              request.assetSymbol === "NEO" ? "NEO" : "GAS",
            ),
            asset: request.assetSymbol,
          }),
          createdAt: request.createdTime
            ? new Date(request.createdTime).toISOString()
            : new Date().toISOString(),
        });
        updateHistoryStatus("request", request.id, request.status);
      }
      return request;
    };

    // -- Actions --------------------------------------------------------------

    ctx.registerAction("createVault", async (rawPayload: unknown) => {
      const payload = asRecord(rawPayload);
      const signers = Array.isArray(payload.signers)
        ? payload.signers.map(asString).filter(Boolean)
        : [];
      const threshold = Math.floor(Number(payload.threshold));

      try {
        // Validate before invoking so a malformed signer set never hits chain.
        validateSignerSet(signers, threshold);
      } catch (err) {
        ctx.setStatus(formatErrorMessage(err, ctx.t("toastInvalidSigners")), "error");
        return null;
      }

      isCreatingVault.set(true);
      try {
        const creator = await chain.ensureWallet();
        const result = await api.createVault({ creator, signers, threshold });
        // The new vaultId is the contract's lastVaultId after creation.
        const vaultId = await api.lastVaultId();
        if (vaultId > 0) await refreshVault(vaultId);
        ctx.setStatus(ctx.t("toastVaultCreated", { id: vaultId }), "success");
        return { ...result, vaultId };
      } catch (err) {
        ctx.setStatus(formatErrorMessage(err, ctx.t("toastVaultFailed")), "error");
        return null;
      } finally {
        isCreatingVault.set(false);
      }
    });

    ctx.registerAction("deposit", async (rawPayload: unknown) => {
      const payload = asRecord(rawPayload);
      const vaultId = parseVaultId(payload.vaultId);
      const asset = asAsset(payload.asset);
      const amount = asString(payload.amount);

      if (vaultId <= 0) {
        ctx.setStatus(ctx.t("toastNoVault"), "error");
        return null;
      }
      if (!isValidAmount(amount, asset)) {
        ctx.setStatus(ctx.t("toastInvalidAmount"), "error");
        return null;
      }

      isDepositing.set(true);
      try {
        const from = await chain.ensureWallet();
        const result = await api.deposit({ from, vaultId, amount, asset });
        await refreshVault(vaultId);
        ctx.setStatus(
          ctx.t("toastDeposited", { amount, asset }),
          "success",
        );
        return result;
      } catch (err) {
        ctx.setStatus(formatErrorMessage(err, ctx.t("toastDepositFailed")), "error");
        return null;
      } finally {
        isDepositing.set(false);
      }
    });

    ctx.registerAction("proposeRequest", async (rawPayload: unknown) => {
      const payload = asRecord(rawPayload);
      const vaultId = parseVaultId(payload.vaultId);
      const asset = asAsset(payload.asset);
      const recipient = asString(payload.recipient);
      const amount = asString(payload.amount);
      const memo = asString(payload.memo);

      if (vaultId <= 0) {
        ctx.setStatus(ctx.t("toastNoVault"), "error");
        return null;
      }
      if (!isValidAddress(recipient)) {
        ctx.setStatus(ctx.t("toastInvalidAddress"), "error");
        return null;
      }
      if (!isValidAmount(amount, asset)) {
        ctx.setStatus(ctx.t("toastInvalidAmount"), "error");
        return null;
      }

      isProposing.set(true);
      try {
        const creator = await chain.ensureWallet();
        const result = await api.createRequest({
          vaultId,
          creator,
          recipient,
          asset,
          amount,
          memo,
        });
        const reqId = await api.lastRequestId();
        if (reqId > 0) await refreshRequest(reqId);
        await refreshVault(vaultId);
        ctx.setStatus(ctx.t("toastRequestCreated", { id: reqId }), "success");
        return { ...result, reqId };
      } catch (err) {
        ctx.setStatus(formatErrorMessage(err, ctx.t("toastCreateFailed")), "error");
        return null;
      } finally {
        isProposing.set(false);
      }
    });

    ctx.registerAction("approveRequest", async (...args: unknown[]) => {
      const reqId = parseVaultId(args[0] ?? activeRequest.get()?.id);
      if (reqId <= 0) {
        ctx.setStatus(ctx.t("toastNoRequest"), "error");
        return null;
      }

      isApproving.set(true);
      try {
        const signer = await chain.ensureWallet();
        const result = await api.approve(reqId, signer);
        const request = await refreshRequest(reqId);
        if (request?.vaultId) await refreshVault(request.vaultId);
        if (request?.status === "executed") {
          ctx.setStatus(ctx.t("toastRequestExecuted"), "success");
        } else {
          ctx.setStatus(ctx.t("toastApproved"), "success");
        }
        return result;
      } catch (err) {
        ctx.setStatus(formatErrorMessage(err, ctx.t("toastApproveFailed")), "error");
        return null;
      } finally {
        isApproving.set(false);
      }
    });

    ctx.registerAction("cancelRequest", async (...args: unknown[]) => {
      const reqId = parseVaultId(args[0] ?? activeRequest.get()?.id);
      if (reqId <= 0) {
        ctx.setStatus(ctx.t("toastNoRequest"), "error");
        return null;
      }

      isCancelling.set(true);
      try {
        const caller = await chain.ensureWallet();
        const result = await api.cancel(reqId, caller);
        await refreshRequest(reqId);
        ctx.setStatus(ctx.t("toastCancelled"), "success");
        return result;
      } catch (err) {
        ctx.setStatus(formatErrorMessage(err, ctx.t("toastCancelFailed")), "error");
        return null;
      } finally {
        isCancelling.set(false);
      }
    });

    ctx.registerAction("loadVault", async (...args: unknown[]) => {
      const vaultId = parseVaultId(args[0]);
      if (vaultId <= 0) {
        ctx.setStatus(ctx.t("toastNoVault"), "error");
        return null;
      }
      isLoading.set(true);
      try {
        const vault = await refreshVault(vaultId);
        if (!vault) {
          ctx.setStatus(ctx.t("toastVaultNotFound", { id: vaultId }), "error");
          return null;
        }
        ctx.setStatus(ctx.t("toastVaultLoaded", { id: vaultId }), "success");
        return vault;
      } catch (err) {
        ctx.setStatus(formatErrorMessage(err, ctx.t("toastLoadFailed")), "error");
        return null;
      } finally {
        isLoading.set(false);
      }
    });

    ctx.registerAction("loadRequest", async (...args: unknown[]) => {
      const reqId = parseVaultId(args[0]);
      if (reqId <= 0) {
        ctx.setStatus(ctx.t("toastNoRequest"), "error");
        return null;
      }
      isLoading.set(true);
      try {
        const request = await refreshRequest(reqId);
        if (!request) {
          ctx.setStatus(ctx.t("toastRequestNotFound", { id: reqId }), "error");
          return null;
        }
        // Load the parent vault too so the approval display can show the real
        // threshold (activeVault.threshold) instead of "?". This is the natural
        // co-signer entry point — they receive a request ID and load it cold,
        // with no vault in state — so the vault read is what makes the
        // "N / threshold" progress meaningful.
        if (request.vaultId > 0) {
          await refreshVault(request.vaultId);
        }
        ctx.setStatus(ctx.t("toastRequestLoaded", { id: reqId }), "success");
        return request;
      } catch (err) {
        ctx.setStatus(formatErrorMessage(err, ctx.t("toastLoadFailed")), "error");
        return null;
      } finally {
        isLoading.set(false);
      }
    });

    return {
      state: refsToObservables({
        history,
        vaultCount,
        pendingCount,
        completedCount,
        totalActions,
        connectedAddress,
        activeVault,
        activeRequest,
        isCreatingVault,
        isDepositing,
        isProposing,
        isApproving,
        isCancelling,
        isLoading,
      }),
      loadData: async () => {
        // Reconcile any locally-known vaults/requests against fresh chain reads
        // so balances and statuses are current when the app mounts.
        const items = history.get();
        for (const item of items) {
          try {
            if (item.kind === "vault") {
              await refreshVault(item.id);
            } else {
              await refreshRequest(item.id);
            }
          } catch {
            // A stale id (e.g. wrong network) should not break the load.
          }
        }
      },
      cleanup: stopAddressSync,
    };
  },
});
