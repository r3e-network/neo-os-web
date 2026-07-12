import { createObservable, defineMiniApp, refsToObservables } from "@shared/react";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { eventValue } from "@shared/utils/chain-events";
import { ownerMatchesAddress } from "@shared/utils/neo";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useMultisigHistory } from "./composables/useMultisigHistory";
import { createVaultApi } from "./services/api";
import {
  isPendingMultisigOperation,
  MULTISIG_EVENT_WAIT_MS,
  multisigAccountMatches,
  normalizeMultisigHash,
  readMultisigTransactionOutcome,
  type MultisigChainContext,
  type MultisigPendingKind,
  type PendingMultisigOperation,
} from "./multisig-safety";
import {
  assetHash,
  canonicalSignerHashes,
  fromBaseUnits,
  isValidAddress,
  isValidAmount,
  toBaseUnits,
  validateSignerSet,
  type RequestView,
  type VaultAsset,
  type VaultView,
} from "./utils/vault";

type ChainDataSource = "none" | "loading" | "chain" | "partial" | "failed";
type PendingDraft = Omit<PendingMultisigOperation, "txid">;

interface UnfundedNotice {
  requestId: number;
  required: string;
  available: string;
  asset: string;
}

interface SignerApproval {
  signer: string;
  approved: boolean;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asAsset(value: unknown): VaultAsset {
  return value === "NEO" ? "NEO" : "GAS";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function positiveId(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function eventId(event: unknown, index: number): number {
  return positiveId(eventValue(event, index));
}

function eventBase(event: unknown, index: number): bigint {
  const raw = String(eventValue(event, index) ?? "").trim();
  if (!/^\d+$/.test(raw)) return -1n;
  try {
    return BigInt(raw);
  } catch {
    return -1n;
  }
}

defineMiniApp({
  appId: "miniapp-neo-multisig",
  playArea: PlayArea,
  manifest,
  messages,
  storagePrefix: "multisig_",

  setup(ctx) {
    const app = ctx.framework;
    const api = createVaultApi(app, ctx.t("multisigChainContextMismatch"));
    const {
      history,
      loadHistory,
      upsertHistory,
      updateHistoryStatus,
    } = useMultisigHistory(app);

    const connectedAddress = createObservable(app.chain.address.get() ?? "");
    const activeVault = createObservable<VaultView | null>(null);
    const activeRequest = createObservable<RequestView | null>(null);
    const signerApprovals = createObservable<SignerApproval[]>([]);
    const connectedIsSigner = createObservable(false);
    const connectedHasApproved = createObservable(false);
    const unfundedNotice = createObservable<UnfundedNotice | null>(null);
    const vaultSource = createObservable<ChainDataSource>("none");
    const requestSource = createObservable<ChainDataSource>("none");
    const approvalSource = createObservable<ChainDataSource>("none");
    const historySource = createObservable<ChainDataSource>("none");
    const contractHash = createObservable("");
    const transactionNotice = createObservable("");
    const pendingOperation = app.state.persisted<PendingMultisigOperation | null>("pendingOperation", null);
    if (pendingOperation.get() && !isPendingMultisigOperation(pendingOperation.get())) pendingOperation.set(null);

    const isCreatingVault = createObservable(false);
    const isDepositing = createObservable(false);
    const isProposing = createObservable(false);
    const isApproving = createObservable(false);
    const isCancelling = createObservable(false);
    const isLoading = createObservable(false);
    const isRecovering = createObservable(false);

    loadHistory();

    const rememberContext = async (): Promise<MultisigChainContext> => {
      const context = await api.context();
      contractHash.set(context.contractHash);
      return context;
    };

    const recordVault = (vault: VaultView, chain: MultisigChainContext) => {
      upsertHistory({
        kind: "vault",
        id: vault.id,
        network: chain.network,
        contractHash: chain.contractHash,
        label: ctx.t("vaultHistoryLabel", { id: vault.id, threshold: vault.threshold, signers: vault.signers.length }),
        createdAt: vault.createdTime ? new Date(vault.createdTime).toISOString() : new Date().toISOString(),
      });
    };

    const recordRequest = (request: RequestView, chain: MultisigChainContext) => {
      upsertHistory({
        kind: "request",
        id: request.id,
        vaultId: request.vaultId,
        network: chain.network,
        contractHash: chain.contractHash,
        status: request.status,
        label: ctx.t("requestHistoryLabel", {
          id: request.id,
          amount: fromBaseUnits(request.amount, request.assetSymbol),
          asset: request.assetSymbol,
        }),
        createdAt: request.createdTime ? new Date(request.createdTime).toISOString() : new Date().toISOString(),
      });
      updateHistoryStatus("request", request.id, request.status);
    };

    const refreshSignerApprovals = async (context?: MultisigChainContext) => {
      const vault = activeVault.get();
      const request = activeRequest.get();
      const address = connectedAddress.get();
      const isSigner = Boolean(address && vault?.signers.some((signer) => ownerMatchesAddress(signer, address)));
      connectedIsSigner.set(isSigner);
      if (!vault || !request || request.status !== "pending") {
        signerApprovals.set(vault?.signers.map((signer) => ({ signer, approved: false })) ?? []);
        connectedHasApproved.set(false);
        approvalSource.set("none");
        return;
      }
      approvalSource.set("loading");
      try {
        const chain = context ?? await rememberContext();
        const approvals = await Promise.all(vault.signers.map(async (signer) => ({
          signer,
          approved: await api.hasApproved(request.id, signer, chain),
        })));
        signerApprovals.set(approvals);
        connectedHasApproved.set(Boolean(address && approvals.some((entry) => entry.approved && ownerMatchesAddress(entry.signer, address))));
        approvalSource.set("chain");
      } catch (error) {
        approvalSource.set("failed");
        connectedHasApproved.set(false);
        console.warn("[neo-multisig] approval reads failed:", formatErrorMessage(error, ctx.t("toastLoadFailed")));
      }
    };

    const refreshVault = async (vaultId: number, context?: MultisigChainContext): Promise<VaultView | null> => {
      const previousVault = activeVault.get();
      vaultSource.set("loading");
      try {
        const chain = context ?? await rememberContext();
        const vault = await api.getVault(vaultId, chain);
        if (!vault) {
          vaultSource.set(previousVault ? "chain" : "none");
          return null;
        }
        activeVault.set(vault);
        recordVault(vault, chain);
        vaultSource.set("chain");
        await refreshSignerApprovals(chain);
        return vault;
      } catch (error) {
        vaultSource.set("failed");
        throw error;
      }
    };

    const refreshRequest = async (requestId: number, context?: MultisigChainContext): Promise<RequestView | null> => {
      const previousRequest = activeRequest.get();
      requestSource.set("loading");
      try {
        const chain = context ?? await rememberContext();
        const request = await api.getRequest(requestId, chain);
        if (!request) {
          requestSource.set(previousRequest ? "chain" : "none");
          return null;
        }
        activeRequest.set(request);
        recordRequest(request, chain);
        requestSource.set("chain");
        if (activeVault.get()?.id !== request.vaultId) await refreshVault(request.vaultId, chain);
        if (request.status === "cancelled") {
          unfundedNotice.set(null);
          const unfunded = await api.requestUnfunded(request.id);
          if (unfunded) {
            unfundedNotice.set({
              requestId: request.id,
              required: fromBaseUnits(unfunded.required, request.assetSymbol),
              available: fromBaseUnits(unfunded.available, request.assetSymbol),
              asset: request.assetSymbol,
            });
          }
        } else {
          unfundedNotice.set(null);
        }
        await refreshSignerApprovals(chain);
        return request;
      } catch (error) {
        requestSource.set("failed");
        throw error;
      }
    };

    const prepare = async (
      kind: MultisigPendingKind,
      actor: string,
      details: Omit<Partial<PendingMultisigOperation>, "version" | "kind" | "eventName" | "network" | "contractHash" | "actorHash" | "txid" | "createdAt">,
    ): Promise<PendingDraft> => {
      const chain = await rememberContext();
      const actorHash = normalizeMultisigHash(actor);
      if (!actorHash) throw new Error(ctx.t("walletRequired"));
      const eventName = kind === "create-vault" ? "VaultCreated" : kind === "deposit" ? "Deposited" : kind === "create-request" ? "RequestCreated" : kind === "approve" ? "Approved" : "RequestCancelled";
      return { version: 1, kind, eventName, network: chain.network, contractHash: chain.contractHash, actorHash, createdAt: Date.now(), ...details } as PendingDraft;
    };

    const persist = (draft: PendingDraft, txid: string) => {
      if (/^0x[0-9a-fA-F]{16,}$/.test(txid)) pendingOperation.set({ ...draft, txid });
    };

    const assertNoPending = () => {
      if (pendingOperation.get()) throw new Error(ctx.t("multisigPendingBlocksWrites"));
    };

    const markPending = () => {
      transactionNotice.set(ctx.t("multisigTransactionPending"));
      app.notify.info("multisigTransactionPending");
    };

    const finalizePending = async (pending: PendingDraft | PendingMultisigOperation, event: unknown) => {
      const chain = { network: pending.network, contractHash: pending.contractHash } satisfies MultisigChainContext;
      if (pending.kind === "create-vault") {
        const vaultId = eventId(event, 0);
        if (!vaultId || !multisigAccountMatches(eventValue(event, 1), pending.actorHash) ||
          Number(eventValue(event, 2)) !== pending.threshold || Number(eventValue(event, 3)) !== pending.signerHashes?.length) {
          throw new Error(ctx.t("multisigEventMismatch"));
        }
        const vault = await api.getVault(vaultId, chain);
        const readHashes = (vault?.signers ?? []).map(normalizeMultisigHash).sort();
        if (!vault || !multisigAccountMatches(vault.creator, pending.actorHash) || vault.threshold !== pending.threshold ||
          JSON.stringify(readHashes) !== JSON.stringify(pending.signerHashes)) throw new Error(ctx.t("multisigReadbackMismatch"));
        activeVault.set(vault);
        vaultSource.set("chain");
        recordVault(vault, chain);
      } else if (pending.kind === "deposit") {
        const vaultId = eventId(event, 0);
        if (String(vaultId) !== pending.vaultId || !multisigAccountMatches(eventValue(event, 1), pending.actorHash) ||
          !multisigAccountMatches(eventValue(event, 2), pending.assetHash) || eventBase(event, 3) !== BigInt(pending.amountBase ?? "0")) {
          throw new Error(ctx.t("multisigEventMismatch"));
        }
        const vault = await api.getVault(vaultId, chain);
        if (!vault) throw new Error(ctx.t("multisigReadbackMismatch"));
        const balance = pending.assetHash === assetHash("NEO") ? vault.neoBalance : vault.gasBalance;
        if (BigInt(balance) < BigInt(pending.beforeBalance ?? "0") + BigInt(pending.amountBase ?? "0")) {
          throw new Error(ctx.t("multisigReadbackMismatch"));
        }
        activeVault.set(vault);
        vaultSource.set("chain");
        recordVault(vault, chain);
      } else if (pending.kind === "create-request") {
        const requestId = eventId(event, 0);
        if (!requestId || String(eventId(event, 1)) !== pending.vaultId ||
          !multisigAccountMatches(eventValue(event, 2), pending.actorHash) ||
          !multisigAccountMatches(eventValue(event, 3), pending.recipientHash) ||
          eventBase(event, 4) !== BigInt(pending.amountBase ?? "0")) throw new Error(ctx.t("multisigEventMismatch"));
        const request = await api.getRequest(requestId, chain);
        if (!request || String(request.vaultId) !== pending.vaultId || !multisigAccountMatches(request.creator, pending.actorHash) ||
          !multisigAccountMatches(request.recipient, pending.recipientHash) || !multisigAccountMatches(request.asset, pending.assetHash) ||
          request.amount !== pending.amountBase || request.memo !== (pending.memo ?? "") || request.status !== "pending") {
          throw new Error(ctx.t("multisigReadbackMismatch"));
        }
        activeRequest.set(request);
        requestSource.set("chain");
        recordRequest(request, chain);
      } else if (pending.kind === "approve") {
        const requestId = eventId(event, 0);
        const eventCount = Number(eventValue(event, 2));
        if (String(requestId) !== pending.requestId || !multisigAccountMatches(eventValue(event, 1), pending.actorHash) ||
          !Number.isSafeInteger(eventCount) || eventCount <= Number(pending.beforeApprovalCount ?? -1)) {
          throw new Error(ctx.t("multisigEventMismatch"));
        }
        const [request, approved] = await Promise.all([
          api.getRequest(requestId, chain),
          api.hasApproved(requestId, pending.actorHash, chain),
        ]);
        if (!request || !approved || request.approvalCount < eventCount) throw new Error(ctx.t("multisigReadbackMismatch"));
        activeRequest.set(request);
        requestSource.set("chain");
        recordRequest(request, chain);
      } else {
        const requestId = eventId(event, 0);
        if (String(requestId) !== pending.requestId) throw new Error(ctx.t("multisigEventMismatch"));
        const request = await api.getRequest(requestId, chain);
        if (!request || request.status !== "cancelled") throw new Error(ctx.t("multisigReadbackMismatch"));
        activeRequest.set(request);
        requestSource.set("chain");
        recordRequest(request, chain);
      }

      pendingOperation.set(null);
      transactionNotice.set("");
      if (pending.kind === "create-vault" || pending.kind === "deposit") {
        if (activeVault.get()) await refreshVault(activeVault.get()!.id, chain);
      } else if (activeRequest.get()) {
        await refreshRequest(activeRequest.get()!.id, chain);
      }
    };

    const completeWrite = async (
      draft: PendingDraft,
      result: { txid?: string; verified?: boolean; event?: unknown },
    ): Promise<boolean> => {
      if (!pendingOperation.get() && result.txid) persist(draft, result.txid);
      const pending = pendingOperation.get();
      if (result.verified === true && result.event) {
        await finalizePending(pending ?? draft, result.event);
        return true;
      }
      markPending();
      return false;
    };

    const syncConnectedAddress = () => {
      connectedAddress.set(app.chain.address.get() ?? "");
      void refreshSignerApprovals();
    };
    const stopAddressSync = app.chain.address.subscribe(syncConnectedAddress);

    app.actions.register("createVault", async (rawPayload: unknown) => {
      if (isCreatingVault.get()) return null;
      try {
        assertNoPending();
        const payload = asRecord(rawPayload);
        const set = validateSignerSet(Array.isArray(payload.signers) ? payload.signers.map(asString) : [], payload.threshold);
        const creator = await app.chain.ensureWallet();
        if (!set.signers.some((signer) => ownerMatchesAddress(signer, creator))) throw new Error(ctx.t("multisigCreatorMustBeSigner"));
        const draft = await prepare("create-vault", creator, {
          signerHashes: canonicalSignerHashes(set.signers),
          threshold: set.threshold,
        });
        isCreatingVault.set(true);
        const result = await api.createVault({ creator, signers: set.signers, threshold: set.threshold }, { onTransactionSent: (txid) => persist(draft, txid) });
        if (await completeWrite(draft, result)) {
          app.notify.success("toastVaultCreated", { id: activeVault.get()?.id ?? "" });
          return activeVault.get();
        }
        return { pending: true };
      } catch (error) {
        if (pendingOperation.get()) {
          markPending();
          return { pending: true };
        }
        app.notify.error(formatErrorMessage(error, ctx.t("toastVaultFailed")));
        return null;
      } finally {
        isCreatingVault.set(false);
      }
    });

    app.actions.register("deposit", async (rawPayload: unknown) => {
      if (isDepositing.get()) return null;
      try {
        assertNoPending();
        const payload = asRecord(rawPayload);
        const vaultId = positiveId(payload.vaultId);
        const asset = asAsset(payload.asset);
        const amount = asString(payload.amount);
        if (!vaultId) throw new Error(ctx.t("toastNoVault"));
        if (!isValidAmount(amount, asset)) throw new Error(ctx.t("toastInvalidAmount"));
        const from = await app.chain.ensureWallet();
        const chain = await rememberContext();
        const vault = await api.getVault(vaultId, chain);
        if (!vault) throw new Error(ctx.t("toastVaultNotFound", { id: vaultId }));
        const beforeBalance = asset === "NEO" ? vault.neoBalance : vault.gasBalance;
        const draft = await prepare("deposit", from, {
          vaultId: String(vaultId), assetHash: assetHash(asset), amountBase: toBaseUnits(amount, asset), beforeBalance,
        });
        isDepositing.set(true);
        const result = await api.deposit({ from, vaultId, amount, asset }, { onTransactionSent: (txid) => persist(draft, txid) });
        if (await completeWrite(draft, result)) {
          app.notify.success("toastDeposited", { amount, asset });
          return activeVault.get();
        }
        return { pending: true };
      } catch (error) {
        if (pendingOperation.get()) { markPending(); return { pending: true }; }
        app.notify.error(formatErrorMessage(error, ctx.t("toastDepositFailed")));
        return null;
      } finally {
        isDepositing.set(false);
      }
    });

    app.actions.register("proposeRequest", async (rawPayload: unknown) => {
      if (isProposing.get()) return null;
      try {
        assertNoPending();
        const payload = asRecord(rawPayload);
        const vaultId = positiveId(payload.vaultId);
        const asset = asAsset(payload.asset);
        const recipient = asString(payload.recipient);
        const amount = asString(payload.amount);
        const memo = asString(payload.memo).slice(0, 160);
        if (!vaultId) throw new Error(ctx.t("toastNoVault"));
        if (!isValidAddress(recipient)) throw new Error(ctx.t("toastInvalidAddress"));
        if (!isValidAmount(amount, asset)) throw new Error(ctx.t("toastInvalidAmount"));
        const creator = await app.chain.ensureWallet();
        const chain = await rememberContext();
        const vault = await api.getVault(vaultId, chain);
        if (!vault || !vault.signers.some((signer) => ownerMatchesAddress(signer, creator))) throw new Error(ctx.t("multisigNotSignerHint"));
        const amountBase = toBaseUnits(amount, asset);
        const balance = asset === "NEO" ? vault.neoBalance : vault.gasBalance;
        if (BigInt(amountBase) > BigInt(balance)) throw new Error(ctx.t("multisigInsufficientBalance", { balance: fromBaseUnits(balance, asset), asset }));
        const draft = await prepare("create-request", creator, {
          vaultId: String(vaultId), recipientHash: normalizeMultisigHash(recipient), assetHash: assetHash(asset), amountBase, memo,
        });
        isProposing.set(true);
        const result = await api.createRequest({ vaultId, creator, recipient, asset, amount, memo }, { onTransactionSent: (txid) => persist(draft, txid) });
        if (await completeWrite(draft, result)) {
          app.notify.success("toastRequestCreated", { id: activeRequest.get()?.id ?? "" });
          return activeRequest.get();
        }
        return { pending: true };
      } catch (error) {
        if (pendingOperation.get()) { markPending(); return { pending: true }; }
        app.notify.error(formatErrorMessage(error, ctx.t("toastCreateFailed")));
        return null;
      } finally {
        isProposing.set(false);
      }
    });

    app.actions.register("approveRequest", async (...args: unknown[]) => {
      if (isApproving.get()) return null;
      try {
        assertNoPending();
        const requestId = positiveId(args[0] ?? activeRequest.get()?.id);
        if (!requestId) throw new Error(ctx.t("toastNoRequest"));
        const signer = await app.chain.ensureWallet();
        const chain = await rememberContext();
        const request = await api.getRequest(requestId, chain);
        if (!request || request.status !== "pending") throw new Error(ctx.t("multisigRequestNotPending"));
        const vault = await api.getVault(request.vaultId, chain);
        if (!vault?.signers.some((member) => ownerMatchesAddress(member, signer))) throw new Error(ctx.t("multisigNotSignerHint"));
        if (await api.hasApproved(requestId, normalizeMultisigHash(signer), chain)) throw new Error(ctx.t("multisigAlreadyApprovedHint"));
        const draft = await prepare("approve", signer, { requestId: String(requestId), beforeApprovalCount: request.approvalCount });
        isApproving.set(true);
        const result = await api.approve(requestId, signer, { onTransactionSent: (txid) => persist(draft, txid) });
        if (await completeWrite(draft, result)) {
          const refreshed = activeRequest.get();
          if (refreshed?.status === "executed") app.notify.success("toastRequestExecuted");
          else if (refreshed?.status === "cancelled") {
            const notice = unfundedNotice.get();
            if (notice) {
              app.notify.error(ctx.t("toastRequestUnfunded", {
                required: notice.required,
                available: notice.available,
                asset: notice.asset,
              }));
            } else {
              app.notify.error(ctx.t("toastRequestUnfundedShort"));
            }
          }
          else app.notify.success("toastApproved");
          return refreshed;
        }
        return { pending: true };
      } catch (error) {
        if (pendingOperation.get()) { markPending(); return { pending: true }; }
        app.notify.error(formatErrorMessage(error, ctx.t("toastApproveFailed")));
        return null;
      } finally {
        isApproving.set(false);
      }
    });

    app.actions.register("cancelRequest", async (...args: unknown[]) => {
      if (isCancelling.get()) return null;
      try {
        assertNoPending();
        const requestId = positiveId(args[0] ?? activeRequest.get()?.id);
        if (!requestId) throw new Error(ctx.t("toastNoRequest"));
        const caller = await app.chain.ensureWallet();
        const chain = await rememberContext();
        const request = await api.getRequest(requestId, chain);
        if (!request || request.status !== "pending") throw new Error(ctx.t("multisigRequestNotPending"));
        const vault = await api.getVault(request.vaultId, chain);
        if (!vault?.signers.some((member) => ownerMatchesAddress(member, caller))) throw new Error(ctx.t("multisigNotSignerHint"));
        const draft = await prepare("cancel", caller, { requestId: String(requestId) });
        isCancelling.set(true);
        const result = await api.cancel(requestId, caller, { onTransactionSent: (txid) => persist(draft, txid) });
        if (await completeWrite(draft, result)) {
          app.notify.success("toastCancelled");
          return activeRequest.get();
        }
        return { pending: true };
      } catch (error) {
        if (pendingOperation.get()) { markPending(); return { pending: true }; }
        app.notify.error(formatErrorMessage(error, ctx.t("toastCancelFailed")));
        return null;
      } finally {
        isCancelling.set(false);
      }
    });

    app.actions.register("loadVault", async (...args: unknown[]) => {
      const vaultId = positiveId(args[0]);
      if (!vaultId) { app.notify.error(ctx.t("toastNoVault")); return null; }
      isLoading.set(true);
      try {
        const vault = await refreshVault(vaultId);
        if (!vault) { app.notify.error(ctx.t("toastVaultNotFound", { id: vaultId })); return null; }
        activeRequest.set(null);
        requestSource.set("none");
        unfundedNotice.set(null);
        await refreshSignerApprovals();
        app.notify.success("toastVaultLoaded", { id: vaultId });
        return vault;
      } catch (error) {
        app.notify.error(formatErrorMessage(error, ctx.t("toastLoadFailed")));
        return null;
      } finally {
        isLoading.set(false);
      }
    });

    app.actions.register("loadRequest", async (...args: unknown[]) => {
      const requestId = positiveId(args[0]);
      if (!requestId) { app.notify.error(ctx.t("toastNoRequest")); return null; }
      isLoading.set(true);
      try {
        const request = await refreshRequest(requestId);
        if (!request) { app.notify.error(ctx.t("toastRequestNotFound", { id: requestId })); return null; }
        app.notify.success("toastRequestLoaded", { id: requestId });
        return request;
      } catch (error) {
        app.notify.error(formatErrorMessage(error, ctx.t("toastLoadFailed")));
        return null;
      } finally {
        isLoading.set(false);
      }
    });

    app.actions.register("recoverPending", async () => {
      const pending = pendingOperation.get();
      if (!pending) return "none";
      if (!isPendingMultisigOperation(pending)) {
        pendingOperation.set(null);
        app.notify.error(ctx.t("multisigPendingInvalid"));
        return "fault";
      }
      if (isRecovering.get()) return "pending";
      isRecovering.set(true);
      try {
        const wallet = app.chain.address.get() || await app.chain.ensureWallet();
        const context = await rememberContext();
        if (context.network !== pending.network || context.contractHash !== pending.contractHash || !multisigAccountMatches(wallet, pending.actorHash)) {
          throw new Error(ctx.t("multisigPendingContextMismatch"));
        }
        let event: unknown = null;
        try {
          event = await app.events.waitFor(pending.txid, pending.eventName, MULTISIG_EVENT_WAIT_MS);
        } catch {
          // Fall through to the canonical application-log lookup below.
        }
        if (!event) {
          const outcome = await readMultisigTransactionOutcome(pending.network, pending.txid, pending.eventName, pending.contractHash);
          if (outcome.state === "fault") {
            pendingOperation.set(null);
            transactionNotice.set(ctx.t("multisigTransactionFault"));
            return "fault";
          }
          event = outcome.event;
        }
        if (!event) {
          markPending();
          return "pending";
        }
        await finalizePending(pending, event);
        app.notify.success("multisigTransactionRecovered");
        return "confirmed";
      } catch (error) {
        app.notify.error(formatErrorMessage(error, ctx.t("toastLoadFailed")));
        return "pending";
      } finally {
        isRecovering.set(false);
      }
    });

    syncConnectedAddress();

    return {
      state: refsToObservables({
        history,
        connectedAddress,
        connectedIsSigner,
        connectedHasApproved,
        activeVault,
        activeRequest,
        signerApprovals,
        unfundedNotice,
        vaultSource,
        requestSource,
        approvalSource,
        historySource,
        contractHash,
        transactionNotice,
        pendingOperation,
        isRecovering,
        isCreatingVault,
        isDepositing,
        isProposing,
        isApproving,
        isCancelling,
        isLoading,
      }),
      loadData: async () => {
        const items = history.get();
        if (items.length === 0) {
          historySource.set("none");
          await rememberContext().catch(() => undefined);
          return;
        }
        const context = await rememberContext().catch(() => null);
        if (!context) {
          historySource.set("failed");
          return;
        }
        const scopedItems = items.filter((item) =>
          item.network === context.network && normalizeMultisigHash(item.contractHash) === context.contractHash,
        );
        if (scopedItems.length === 0) {
          // Legacy history remains visible for manual navigation, but is not
          // attributed to a network without an explicit chain read by the user.
          historySource.set("none");
          return;
        }
        historySource.set("loading");
        let successes = 0;
        for (const item of [...scopedItems].reverse()) {
          try {
            if (item.kind === "vault") await refreshVault(item.id);
            else await refreshRequest(item.id);
            successes += 1;
          } catch {
            // Keep the local navigation record but never count this item as a
            // verified live state on the current network.
          }
        }
        historySource.set(successes === scopedItems.length && scopedItems.length === items.length ? "chain" : successes > 0 ? "partial" : "failed");
      },
      cleanup: stopAddressSync,
    };
  },
});
