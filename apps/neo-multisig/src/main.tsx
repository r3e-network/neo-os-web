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
import { addressToScriptHash, ownerMatchesAddress } from "@shared/utils/neo";
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

/**
 * Why a request auto-cancelled (v2 contract): a threshold approval found the
 * vault underfunded (RequestUnfunded event). Amounts are pre-formatted display
 * strings; PlayArea renders this only for the matching active request.
 */
interface UnfundedNotice {
  requestId: number;
  required: string;
  available: string;
  asset: string;
}

defineMiniApp({
  appId: "miniapp-neo-multisig",
  playArea: PlayArea,
  manifest,
  messages,
  // Legacy storage namespace: the pre-framework activity log lived in raw
  // localStorage as "multisig_vault_history" (runtime-cache, unprefixed).
  // Pinning app.storage.local to "multisig_" keeps the composable's
  // "vault_history" key resolving to that exact legacy key, so existing
  // users keep their vault/request history (plan §3 migration hazard).
  storagePrefix: "multisig_",

  setup(ctx) {
    const app = ctx.framework;
    const api = createVaultApi(app);

    const {
      history,
      vaultCount,
      pendingCount,
      completedCount,
      loadHistory,
      upsertHistory,
      updateHistoryStatus,
    } = useMultisigHistory(app);
    const totalActions = createDerived(() => history.get().length, [history]);

    const connectedAddress = createObservable<string>(
      app.chain.address.get() ?? "",
    );
    const activeVault = createObservable<VaultView | null>(null);
    const activeRequest = createObservable<RequestView | null>(null);
    // Membership gating for Approve/Cancel: whether the connected wallet is a
    // signer of the active vault, and whether it has already approved the active
    // request. Both are re-derived whenever the vault/request/wallet changes so
    // a non-signer or a repeat approver gets a disabled button + reason instead
    // of a raw on-chain assert.
    const connectedIsSigner = createObservable(false);
    const connectedHasApproved = createObservable(false);
    // v2: RequestUnfunded explanation for an auto-cancelled request (keyed by
    // requestId; PlayArea only shows it for the matching active request).
    const unfundedNotice = createObservable<UnfundedNotice | null>(null);
    const isCreatingVault = createObservable(false);
    const isDepositing = createObservable(false);
    const isProposing = createObservable(false);
    const isApproving = createObservable(false);
    const isCancelling = createObservable(false);
    const isLoading = createObservable(false);

    loadHistory();

    /**
     * Recompute the Approve/Cancel gating for the connected wallet:
     *   - connectedIsSigner: is the wallet in the active vault's signer set?
     *     (signers come back as UInt160 chain values — compared via
     *     ownerMatchesAddress, which normalizes both sides to a script hash).
     *   - connectedHasApproved: has the wallet already approved the active
     *     request? (on-chain hasApproved(reqId, signerHash)).
     */
    const refreshGating = async () => {
      const addr = connectedAddress.get();
      const vault = activeVault.get();
      const request = activeRequest.get();

      const isSigner = Boolean(
        addr &&
          vault?.signers?.some((signer) => ownerMatchesAddress(signer, addr)),
      );
      connectedIsSigner.set(isSigner);

      // Only a signer can have an approval recorded; skip the read otherwise.
      if (!addr || !request || request.status !== "pending" || !isSigner) {
        connectedHasApproved.set(false);
        return;
      }
      // framework-exempt: false-not-throw comparison key (§3.6) — an
      // unparsable wallet address must resolve to "not approved" (disabled
      // button state), never a thrown error; app.chain.arg.hash160 throws.
      const signerHash = addressToScriptHash(addr);
      if (!signerHash) {
        connectedHasApproved.set(false);
        return;
      }
      try {
        connectedHasApproved.set(await api.hasApproved(request.id, signerHash));
      } catch {
        // A failed read must not enable a button that would revert — default to
        // "not approved" so the user can still attempt the approval.
        connectedHasApproved.set(false);
      }
    };

    const syncConnectedAddress = () => {
      connectedAddress.set(app.chain.address.get() ?? "");
      void refreshGating();
    };
    syncConnectedAddress();
    const stopAddressSync = app.chain.address.subscribe(syncConnectedAddress);

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
        await refreshGating();
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
            id: request.id,
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

        // v2: a threshold approval that finds the vault underfunded
        // AUTO-CANCELS the request and emits RequestUnfunded(reqId, required,
        // available). Resolve that event for cancelled requests so the UI can
        // explain WHY instead of showing a generic cancel.
        if (
          request.status === "cancelled" &&
          unfundedNotice.get()?.requestId !== request.id
        ) {
          const unfunded = await api.requestUnfunded(request.id);
          if (unfunded) {
            const asset: "GAS" | "NEO" =
              request.assetSymbol === "NEO" ? "NEO" : "GAS";
            unfundedNotice.set({
              requestId: request.id,
              required: fromBaseUnits(unfunded.required, asset),
              available: fromBaseUnits(unfunded.available, asset),
              asset: request.assetSymbol,
            });
          }
        }
        await refreshGating();
      }
      return request;
    };

    // -- Actions --------------------------------------------------------------
    //
    // Toasts ride app.notify (S1): success keys carry params interpolated from
    // POST-WRITE reads (the new vaultId/reqId, the resolved request status),
    // and error copy keeps the app's formatErrorMessage sanitization (raw
    // dumps → localized fallback) before the toast — app.notify.error still
    // maps known chain/RPC failure families to platform copy.

    ctx.framework.actions.register("createVault", async (rawPayload: unknown) => {
      const payload = asRecord(rawPayload);
      const signers = Array.isArray(payload.signers)
        ? payload.signers.map(asString).filter(Boolean)
        : [];
      const threshold = Math.floor(Number(payload.threshold));

      try {
        // Validate before invoking so a malformed signer set never hits chain.
        validateSignerSet(signers, threshold);
      } catch (err) {
        app.notify.error(formatErrorMessage(err, ctx.t("toastInvalidSigners")));
        return null;
      }

      isCreatingVault.set(true);
      try {
        const creator = await app.chain.ensureWallet();
        const result = await api.createVault({ creator, signers, threshold });
        // The new vaultId is the contract's lastVaultId after creation — the
        // post-write read that drives the success-toast params.
        const vaultId = await api.lastVaultId();
        if (vaultId > 0) await refreshVault(vaultId);
        app.notify.success("toastVaultCreated", { id: vaultId });
        return { ...result, vaultId };
      } catch (err) {
        app.notify.error(formatErrorMessage(err, ctx.t("toastVaultFailed")));
        return null;
      } finally {
        isCreatingVault.set(false);
      }
    });

    ctx.framework.actions.register("deposit", async (rawPayload: unknown) => {
      const payload = asRecord(rawPayload);
      const vaultId = parseVaultId(payload.vaultId);
      const asset = asAsset(payload.asset);
      const amount = asString(payload.amount);

      if (vaultId <= 0) {
        app.notify.error(ctx.t("toastNoVault"));
        return null;
      }
      if (!isValidAmount(amount, asset)) {
        app.notify.error(ctx.t("toastInvalidAmount"));
        return null;
      }

      isDepositing.set(true);
      try {
        const from = await app.chain.ensureWallet();
        const result = await api.deposit({ from, vaultId, amount, asset });
        await refreshVault(vaultId);
        app.notify.success("toastDeposited", { amount, asset });
        return result;
      } catch (err) {
        app.notify.error(formatErrorMessage(err, ctx.t("toastDepositFailed")));
        return null;
      } finally {
        isDepositing.set(false);
      }
    });

    ctx.framework.actions.register("proposeRequest", async (rawPayload: unknown) => {
      const payload = asRecord(rawPayload);
      const vaultId = parseVaultId(payload.vaultId);
      const asset = asAsset(payload.asset);
      const recipient = asString(payload.recipient);
      const amount = asString(payload.amount);
      const memo = asString(payload.memo);

      if (vaultId <= 0) {
        app.notify.error(ctx.t("toastNoVault"));
        return null;
      }
      if (!isValidAddress(recipient)) {
        app.notify.error(ctx.t("toastInvalidAddress"));
        return null;
      }
      if (!isValidAmount(amount, asset)) {
        app.notify.error(ctx.t("toastInvalidAmount"));
        return null;
      }

      isProposing.set(true);
      try {
        const creator = await app.chain.ensureWallet();
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
        app.notify.success("toastRequestCreated", { id: reqId });
        return { ...result, reqId };
      } catch (err) {
        app.notify.error(formatErrorMessage(err, ctx.t("toastCreateFailed")));
        return null;
      } finally {
        isProposing.set(false);
      }
    });

    ctx.framework.actions.register("approveRequest", async (...args: unknown[]) => {
      const reqId = parseVaultId(args[0] ?? activeRequest.get()?.id);
      if (reqId <= 0) {
        app.notify.error(ctx.t("toastNoRequest"));
        return null;
      }

      isApproving.set(true);
      try {
        const signer = await app.chain.ensureWallet();
        const result = await api.approve(reqId, signer);
        const request = await refreshRequest(reqId);
        if (request?.vaultId) await refreshVault(request.vaultId);
        // The toast is keyed on the POST-WRITE request status (an approval can
        // execute the request, auto-cancel it, or just record the signature).
        if (request?.status === "executed") {
          app.notify.success("toastRequestExecuted");
        } else if (request?.status === "cancelled") {
          // v2: the threshold approval found the vault underfunded and the
          // contract auto-cancelled the request (RequestUnfunded). Surface a
          // clear explanation — with amounts when the event resolved — instead
          // of a generic approval/cancel toast.
          const notice = unfundedNotice.get();
          if (notice && notice.requestId === reqId) {
            app.notify.error(
              ctx.t("toastRequestUnfunded", {
                required: notice.required,
                available: notice.available,
                asset: notice.asset,
              }),
            );
          } else {
            app.notify.error(ctx.t("toastRequestUnfundedShort"));
          }
        } else {
          app.notify.success("toastApproved");
        }
        return result;
      } catch (err) {
        app.notify.error(formatErrorMessage(err, ctx.t("toastApproveFailed")));
        return null;
      } finally {
        isApproving.set(false);
      }
    });

    ctx.framework.actions.register("cancelRequest", async (...args: unknown[]) => {
      const reqId = parseVaultId(args[0] ?? activeRequest.get()?.id);
      if (reqId <= 0) {
        app.notify.error(ctx.t("toastNoRequest"));
        return null;
      }

      isCancelling.set(true);
      try {
        const caller = await app.chain.ensureWallet();
        const result = await api.cancel(reqId, caller);
        await refreshRequest(reqId);
        app.notify.success("toastCancelled");
        return result;
      } catch (err) {
        app.notify.error(formatErrorMessage(err, ctx.t("toastCancelFailed")));
        return null;
      } finally {
        isCancelling.set(false);
      }
    });

    ctx.framework.actions.register("loadVault", async (...args: unknown[]) => {
      const vaultId = parseVaultId(args[0]);
      if (vaultId <= 0) {
        app.notify.error(ctx.t("toastNoVault"));
        return null;
      }
      isLoading.set(true);
      try {
        const vault = await refreshVault(vaultId);
        if (!vault) {
          app.notify.error(ctx.t("toastVaultNotFound", { id: vaultId }));
          return null;
        }
        app.notify.success("toastVaultLoaded", { id: vaultId });
        return vault;
      } catch (err) {
        app.notify.error(formatErrorMessage(err, ctx.t("toastLoadFailed")));
        return null;
      } finally {
        isLoading.set(false);
      }
    });

    ctx.framework.actions.register("loadRequest", async (...args: unknown[]) => {
      const reqId = parseVaultId(args[0]);
      if (reqId <= 0) {
        app.notify.error(ctx.t("toastNoRequest"));
        return null;
      }
      isLoading.set(true);
      try {
        const request = await refreshRequest(reqId);
        if (!request) {
          app.notify.error(ctx.t("toastRequestNotFound", { id: reqId }));
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
        app.notify.success("toastRequestLoaded", { id: reqId });
        return request;
      } catch (err) {
        app.notify.error(formatErrorMessage(err, ctx.t("toastLoadFailed")));
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
        connectedIsSigner,
        connectedHasApproved,
        activeVault,
        activeRequest,
        unfundedNotice,
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
