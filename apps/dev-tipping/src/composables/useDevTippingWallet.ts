/**
 * Money-moving Developer Tipping flows.
 *
 * Every write is bound to an exact wallet/network/contract snapshot. A wallet
 * txid is only a recoverable broadcast record; success requires the matching
 * contract event plus an authoritative state readback.
 */

import { createObservable } from "@shared/react/context";
import { FrameworkPrepaidActionError, type MiniAppFramework } from "@shared/react";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { eventValue } from "@shared/utils/chain-events";
import {
  addressToScriptHash,
  normalizeScriptHash,
  parseHash160,
} from "@shared/utils/neo";
import {
  attestDevTippingContract,
  DEV_TIPPING_BINDINGS,
  normalizeDevTippingNetwork,
  readDevTippingExecutionState,
  type DevTippingAttestation,
  type DevTippingExecutionState,
  type DevTippingNetwork,
} from "../dev-tipping-rpc";
import {
  createDevTippingOperationStore,
  normalizeTipOperationScope,
  type DevTippingOperationKind,
  type DevTippingReceipt,
  type DevTippingReceiptStatus,
  type PendingDevTippingOperation,
  type PendingRegisterOperation,
  type PendingTipOperation,
  type PendingWithdrawCreditOperation,
  type PendingWithdrawTipsOperation,
  type TipOperationScope,
} from "../dev-tipping-operation-store";

const MIN_TIP_BASE = 100_000n;
/**
 * Contract text limits are UTF-8 BYTES, not JS UTF-16 chars: the devpack
 * compiles C# `string.Length` to the SIZE opcode over the UTF-8 ByteString
 * (MiniAppTipJar.cs asserts name.Length <= 64 / role.Length <= 64 on that
 * unit), so a 30-CJK-char name is 90 bytes — it passed a char-measured 64
 * cap and then deterministically reverted "invalid name" on-chain, after the
 * user already paid the transaction fee. Registration is identity, so
 * over-budget input is REJECTED (never silently truncated); the validation
 * must therefore measure bytes. On-chain names always satisfy
 * UTF-16 length <= UTF-8 bytes <= 64, so the readback check in
 * {@link parseDeveloper} measuring bytes can never falsely reject a record
 * the contract accepted.
 */
const MAX_NAME_BYTES = 64;
const MAX_ROLE_BYTES = 64;

const utf8Encoder = new TextEncoder();
const utf8ByteLength = (value: string): number => utf8Encoder.encode(value).length;
const TIP_MEMO = "miniapp-devtipping:tip";
const PENDING_OPERATION_STALE_MS = 24 * 60 * 60 * 1_000;
const TXID_RE = /^0x[0-9a-f]{64}$/;

export type DevTippingActionOutcome = "confirmed" | "pending";
export type DevTippingRecoveryOutcome = "none" | DevTippingReceiptStatus;
/**
 * "awaiting-wallet" is the normal pre-connect state: no wallet means no wallet
 * network, so there is nothing to compare against the launch network. It is
 * deliberately NOT "error" — collapsing it into one made a fresh visitor with
 * no wallet read "The wallet network does not match this Dev Tipping launch."
 */
export type DevTippingRuntimeStatus =
  | "idle"
  | "loading"
  | "ready"
  | "awaiting-wallet"
  | "error";

export interface UseDevTippingWalletOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
  launchNetwork?: unknown;
  attestContract?: (
    network: DevTippingNetwork,
    contract: string,
  ) => Promise<DevTippingAttestation>;
  readExecutionState?: (
    network: DevTippingNetwork,
    txid: string,
  ) => Promise<DevTippingExecutionState>;
}

type DeveloperRecord = {
  id: number;
  name: string;
  role: string;
  wallet: string;
  totalReceivedBase: bigint;
  tipCount: bigint;
  balanceBase: bigint;
};

type TipDraft = Omit<PendingTipOperation, "txid" | "createdAt">;
type RegisterDraft = Omit<PendingRegisterOperation, "txid" | "createdAt">;
type WithdrawTipsDraft = Omit<PendingWithdrawTipsOperation, "txid" | "createdAt">;
type WithdrawCreditDraft = Omit<PendingWithdrawCreditOperation, "txid" | "createdAt">;
type OperationDraft = TipDraft | RegisterDraft | WithdrawTipsDraft | WithdrawCreditDraft;

function exactNonNegativeInteger(value: unknown, label: string): bigint {
  let parsed: bigint;
  if (typeof value === "bigint") parsed = value;
  else if (typeof value === "number" && Number.isSafeInteger(value)) parsed = BigInt(value);
  else if (typeof value === "string" && /^\d+$/.test(value.trim())) parsed = BigInt(value.trim());
  else throw new Error(`Invalid ${label} chain value`);
  if (parsed < 0n) throw new Error(`Invalid negative ${label}`);
  return parsed;
}

function exactBoolean(value: unknown): boolean | null {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return null;
}

function normalizedTxid(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  return TXID_RE.test(raw) ? raw : "";
}

function canonicalAccount(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (/^(?:0x)?[0-9a-fA-F]{40}$/.test(raw)) return normalizeScriptHash(raw);
  const parsed = parseHash160(value);
  if (/^0x[0-9a-f]{40}$/.test(parsed)) return parsed;
  const converted = addressToScriptHash(raw);
  return /^0x[0-9a-f]{40}$/.test(converted) ? converted : "";
}

function accountMatches(value: unknown, expected: unknown): boolean {
  const left = canonicalAccount(value);
  const right = canonicalAccount(expected);
  return Boolean(left && right && left === right);
}

function parseDeveloper(raw: unknown, fallbackId: number): DeveloperRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Developer record is unavailable");
  }
  const value = raw as Record<string, unknown>;
  const wallet = canonicalAccount(value.wallet);
  const id = Number(exactNonNegativeInteger(value.id ?? fallbackId, "developer id"));
  const name = String(value.name ?? "").trim();
  const role = String(value.role ?? "").trim();
  const totalReceivedBase = exactNonNegativeInteger(value.totalReceived, "developer total");
  const tipCount = exactNonNegativeInteger(value.tipCount, "tip count");
  const balanceBase = exactNonNegativeInteger(value.balance, "claimable balance");
  if (
    !Number.isSafeInteger(id)
    || id !== fallbackId
    || !wallet
    || utf8ByteLength(name) > MAX_NAME_BYTES
    || utf8ByteLength(role) > MAX_ROLE_BYTES
    || balanceBase > totalReceivedBase
    || totalReceivedBase < tipCount * MIN_TIP_BASE
  ) {
    throw new Error("Developer record is invalid");
  }
  return {
    id,
    name: name || `Dev #${id}`,
    role,
    wallet,
    totalReceivedBase,
    tipCount,
    balanceBase,
  };
}

export function useDevTippingWallet({
  app,
  t,
  launchNetwork = null,
  attestContract = attestDevTippingContract,
  readExecutionState = readDevTippingExecutionState,
}: UseDevTippingWalletOptions) {
  const isLoading = createObservable(false);
  const isRegistering = createObservable(false);
  const isWithdrawing = createObservable(false);
  const isRecovering = createObservable(false);
  const runtimeStatus = createObservable<DevTippingRuntimeStatus>("idle");
  const runtimeCompatible = createObservable(false);
  const activeNetwork = createObservable<DevTippingNetwork | "">("");
  const runtimeChecksum = createObservable<number | null>(null);
  const runtimeError = createObservable("");
  const pendingOperation = createObservable<PendingDevTippingOperation | null>(null);
  const lastReceipt = createObservable<DevTippingReceipt | null>(null);
  const actionNotice = createObservable("");
  const recoveryStorageHealthy = createObservable(true);
  const operationStore = createDevTippingOperationStore(app.storage.local);
  let activeOperation: DevTippingOperationKind | "recovery" | null = null;
  let runtimeGeneration = 0;
  let recoveryGeneration = 0;

  const launchNetworkRaw = String(launchNetwork ?? "").trim();
  const expectedLaunchNetwork = normalizeDevTippingNetwork(launchNetwork);

  const receiptFor = (
    pending: PendingDevTippingOperation,
    status: DevTippingReceiptStatus,
  ): DevTippingReceipt => ({ ...pending, status, updatedAt: Date.now() });

  const publishReceipt = (scope: TipOperationScope, receipt: DevTippingReceipt): void => {
    operationStore.setReceipt(scope, receipt);
    lastReceipt.set(receipt);
  };

  const setRuntimeFailure = (generation: number, message: string) => {
    if (generation !== runtimeGeneration) return;
    runtimeStatus.set("error");
    runtimeCompatible.set(false);
    activeNetwork.set("");
    runtimeChecksum.set(null);
    runtimeError.set(message);
  };

  const refreshRuntime = async (expectedAddress?: string | null): Promise<TipOperationScope | null> => {
    const generation = ++runtimeGeneration;
    runtimeStatus.set("loading");
    runtimeCompatible.set(false);
    runtimeError.set("");
    activeNetwork.set("");
    runtimeChecksum.set(null);
    try {
      const detected = normalizeDevTippingNetwork(await app.chain.detectNetwork());
      const contract = normalizeScriptHash(
        await app.chain.resolveContractAddress(),
      );
      // No resolvable network means no wallet has told us one yet (detectNetwork
      // reports a bare "neo-n3" until a wallet connects). Nothing mismatches
      // nothing — hold in a neutral pre-connect state instead of erroring.
      if (!detected) {
        if (generation === runtimeGeneration) {
          runtimeStatus.set("awaiting-wallet");
          runtimeCompatible.set(false);
          runtimeError.set("");
        }
        return null;
      }
      if (
        (launchNetworkRaw && !expectedLaunchNetwork)
        || (expectedLaunchNetwork && expectedLaunchNetwork !== detected)
      ) {
        throw new Error(t("runtimeNetworkMismatch"));
      }
      const expected = DEV_TIPPING_BINDINGS[detected];
      if (contract !== normalizeScriptHash(expected.contract)) {
        throw new Error(t("runtimeBindingMismatch"));
      }
      const attestation = await attestContract(detected, contract);
      if (!attestation.compatible) throw new Error(t("runtimeBindingMismatch"));

      const [minTipRaw, totalDevelopersRaw] = await Promise.all([
        app.chain.readRaw("minTip", []),
        app.chain.readRaw("totalDevelopers", []),
      ]);
      if (
        exactNonNegativeInteger(minTipRaw, "minimum tip") !== MIN_TIP_BASE
        || exactNonNegativeInteger(totalDevelopersRaw, "developer count") > BigInt(Number.MAX_SAFE_INTEGER)
      ) {
        throw new Error(t("runtimeBindingMismatch"));
      }

      if (generation === runtimeGeneration) {
        runtimeCompatible.set(true);
        runtimeStatus.set("ready");
        activeNetwork.set(detected);
        runtimeChecksum.set(attestation.checksum);
      }
      const address = expectedAddress ?? app.chain.address.get();
      if (!address) return null;
      const scope = normalizeTipOperationScope({ network: detected, contract, sender: address });
      if (!scope) throw new Error(t("walletNotConnected"));
      return scope;
    } catch (error) {
      setRuntimeFailure(
        generation,
        app.errors.messageOf(error, t("runtimeUnavailable")),
      );
      return null;
    }
  };

  const assertScopeCurrent = async (scope: TipOperationScope): Promise<void> => {
    const currentAddress = app.chain.address.get();
    if (!currentAddress || !accountMatches(currentAddress, scope.sender)) {
      throw new Error(t("walletChangedDuringAction"));
    }
    const detected = normalizeDevTippingNetwork(await app.chain.detectNetwork());
    const contract = normalizeScriptHash(
      await app.chain.resolveContractAddress(),
    );
    if (
      !detected
      || detected !== scope.network
      || contract !== scope.contract
      || (expectedLaunchNetwork && expectedLaunchNetwork !== detected)
      || (launchNetworkRaw && !expectedLaunchNetwork)
    ) {
      throw new Error(t("runtimeNetworkMismatch"));
    }
  };

  const ensureRuntimeScope = async (): Promise<TipOperationScope> => {
    const address = app.chain.address.get() || (await app.chain.ensureWallet());
    if (!address) throw new Error(t("walletNotConnected"));
    const scope = await refreshRuntime(address);
    if (!scope) throw new Error(runtimeError.get() || t("runtimeUnavailable"));
    await assertScopeCurrent(scope);
    return scope;
  };

  const beginOperation = (kind: DevTippingOperationKind | "recovery") => {
    if (activeOperation) throw new Error(t("operationBusy"));
    activeOperation = kind;
  };

  const endOperation = (kind: DevTippingOperationKind | "recovery") => {
    if (activeOperation === kind) activeOperation = null;
  };

  const ensureNoPending = (scope: TipOperationScope) => {
    const pending = operationStore.getPending(scope);
    if (!pending) return;
    pendingOperation.set(pending);
    throw new Error(t("pendingActionBlocksAction"));
  };

  const ensureRecoveryStorage = (scope: TipOperationScope) => {
    const healthy = operationStore.canPersist(scope);
    recoveryStorageHealthy.set(healthy);
    if (!healthy) throw new Error(t("recoveryStorageUnavailable"));
  };

  const journalBroadcast = (
    scope: TipOperationScope,
    draft: OperationDraft,
    txidValue: unknown,
  ): PendingDevTippingOperation | null => {
    const txid = normalizedTxid(txidValue);
    if (!txid) {
      actionNotice.set(t("transactionIdInvalid"));
      return null;
    }
    const existing = operationStore.getPending(scope);
    if (existing) {
      if (existing.kind === draft.kind && existing.txid === txid) {
        pendingOperation.set(existing);
        return existing;
      }
      if (!(existing.kind === "deposit" && draft.kind === "tip")) {
        pendingOperation.set(existing);
        actionNotice.set(t("transactionIdConflict"));
        return existing;
      }
    }
    const record = {
      ...draft,
      txid,
      createdAt: existing?.createdAt ?? Date.now(),
    } as PendingDevTippingOperation;
    try {
      const persisted = operationStore.setPending(scope, record);
      recoveryStorageHealthy.set(true);
      pendingOperation.set(persisted);
    } catch {
      recoveryStorageHealthy.set(false);
      pendingOperation.set(record);
      actionNotice.set(t("receiptUnavailableAfterBroadcast"));
    }
    publishReceipt(scope, receiptFor(record, "pending"));
    if (recoveryStorageHealthy.get()) actionNotice.set(t("receiptPending"));
    return record;
  };

  const ensureBroadcastJournal = (
    scope: TipOperationScope,
    draft: OperationDraft,
    txidValue: unknown,
  ): PendingDevTippingOperation => {
    const txid = normalizedTxid(txidValue);
    if (!txid) throw new Error(t("transactionIdInvalid"));
    const existing = operationStore.getPending(scope);
    const pending = existing?.kind === draft.kind && existing.txid === txid
      ? existing
      : journalBroadcast(scope, draft, txid);
    if (!pending || pending.kind !== draft.kind || pending.txid !== txid) {
      throw new Error(t("transactionIdConflict"));
    }
    return pending;
  };

  const markTerminal = (
    scope: TipOperationScope,
    pending: PendingDevTippingOperation,
    status: "confirmed" | "fault" | "credit",
    noticeKey: string,
  ) => {
    const cleared = operationStore.clearPending(scope);
    pendingOperation.set(cleared ? null : pending);
    recoveryStorageHealthy.set(cleared);
    publishReceipt(scope, receiptFor(pending, status));
    actionNotice.set(t(cleared ? noticeKey : "receiptCleanupPending"));
  };

  const tipEventMatches = (pending: PendingTipOperation, event: unknown): boolean => {
    try {
      return (
        exactNonNegativeInteger(eventValue(event, 0), "event tip id") > 0n
        && exactNonNegativeInteger(eventValue(event, 1), "event developer id") === BigInt(pending.devId)
        && accountMatches(eventValue(event, 2), pending.sender)
        && exactNonNegativeInteger(eventValue(event, 3), "event amount") === BigInt(pending.amountBase)
        && exactBoolean(eventValue(event, 4)) === pending.anonymous
      );
    } catch {
      return false;
    }
  };

  const finalizeTip = async (
    scope: TipOperationScope,
    pending: PendingTipOperation,
    event: unknown,
  ): Promise<boolean> => {
    if (pending.kind !== "tip" || !tipEventMatches(pending, event)) {
      publishReceipt(scope, receiptFor(pending, "readback"));
      actionNotice.set(t("receiptEventMismatch"));
      return false;
    }
    try {
      await assertScopeCurrent(scope);
      const [developerRaw, creditRaw] = await Promise.all([
        app.chain.readRaw("getDeveloper", [app.chain.arg.integer(pending.devId)]),
        app.chain.readRaw("creditOf", [app.chain.arg.hash160(scope.sender)]),
      ]);
      await assertScopeCurrent(scope);
      const developer = parseDeveloper(developerRaw, pending.devId);
      const expectedTotal = BigInt(pending.beforeTotalReceivedBase) + BigInt(pending.amountBase);
      const expectedCount = BigInt(pending.beforeTipCount) + 1n;
      const expectedCredit = BigInt(pending.beforeCreditBase)
        + BigInt(pending.depositAmountBase)
        - BigInt(pending.amountBase);
      if (
        expectedCredit < 0n
        || !accountMatches(developer.wallet, pending.recipientWallet)
        || developer.totalReceivedBase < expectedTotal
        || developer.tipCount < expectedCount
        || exactNonNegativeInteger(creditRaw, "tip credit") !== expectedCredit
      ) {
        publishReceipt(scope, receiptFor(pending, "readback"));
        actionNotice.set(t("receiptReadbackPending"));
        return false;
      }
      markTerminal(scope, pending, "confirmed", "receiptConfirmed");
      return true;
    } catch {
      publishReceipt(scope, receiptFor(pending, "readback"));
      actionNotice.set(t("receiptReadbackPending"));
      return false;
    }
  };

  const depositEventMatches = (pending: PendingTipOperation, event: unknown): boolean => {
    try {
      const expectedBalance = BigInt(pending.beforeCreditBase) + BigInt(pending.depositAmountBase);
      return (
        pending.kind === "deposit"
        && accountMatches(eventValue(event, 0), pending.sender)
        && exactNonNegativeInteger(eventValue(event, 1), "deposit amount") === BigInt(pending.depositAmountBase)
        && exactNonNegativeInteger(eventValue(event, 2), "credit balance") >= expectedBalance
      );
    } catch {
      return false;
    }
  };

  const finalizeDeposit = async (
    scope: TipOperationScope,
    pending: PendingTipOperation,
    event: unknown,
  ): Promise<boolean> => {
    if (!depositEventMatches(pending, event)) {
      publishReceipt(scope, receiptFor(pending, "readback"));
      actionNotice.set(t("receiptEventMismatch"));
      return false;
    }
    try {
      await assertScopeCurrent(scope);
      const credit = exactNonNegativeInteger(
        await app.chain.readRaw("creditOf", [app.chain.arg.hash160(scope.sender)]),
        "tip credit",
      );
      await assertScopeCurrent(scope);
      const expected = BigInt(pending.beforeCreditBase) + BigInt(pending.depositAmountBase);
      if (credit < expected) {
        publishReceipt(scope, receiptFor(pending, "readback"));
        actionNotice.set(t("receiptReadbackPending"));
        return false;
      }
      markTerminal(scope, pending, "credit", "tipPrepaidNoTip");
      return true;
    } catch {
      publishReceipt(scope, receiptFor(pending, "readback"));
      actionNotice.set(t("receiptReadbackPending"));
      return false;
    }
  };

  const finalizeRegister = async (
    scope: TipOperationScope,
    pending: PendingRegisterOperation,
    event: unknown,
  ): Promise<boolean> => {
    let developerId: bigint;
    try {
      developerId = exactNonNegativeInteger(eventValue(event, 0), "developer id");
      if (
        developerId <= 0n
        || developerId > BigInt(Number.MAX_SAFE_INTEGER)
        || !accountMatches(eventValue(event, 1), scope.sender)
        || String(eventValue(event, 2) ?? "").trim() !== pending.name
      ) throw new Error("event mismatch");
    } catch {
      publishReceipt(scope, receiptFor(pending, "readback"));
      actionNotice.set(t("receiptEventMismatch"));
      return false;
    }
    try {
      await assertScopeCurrent(scope);
      const id = Number(developerId);
      const [registeredIdRaw, developerRaw] = await Promise.all([
        app.chain.readRaw("developerIdOf", [app.chain.arg.hash160(scope.sender)]),
        app.chain.readRaw("getDeveloper", [app.chain.arg.integer(id)]),
      ]);
      await assertScopeCurrent(scope);
      const developer = parseDeveloper(developerRaw, id);
      if (
        exactNonNegativeInteger(registeredIdRaw, "developer id") !== developerId
        || !accountMatches(developer.wallet, scope.sender)
        || developer.name !== pending.name
        || developer.role !== pending.role
      ) throw new Error("readback mismatch");
      markTerminal(scope, pending, "confirmed", "secondaryActionConfirmed");
      return true;
    } catch {
      publishReceipt(scope, receiptFor(pending, "readback"));
      actionNotice.set(t("receiptReadbackPending"));
      return false;
    }
  };

  const finalizeWithdrawTips = async (
    scope: TipOperationScope,
    pending: PendingWithdrawTipsOperation,
    event: unknown,
  ): Promise<boolean> => {
    try {
      if (
        exactNonNegativeInteger(eventValue(event, 0), "developer id") !== BigInt(pending.devId)
        || !accountMatches(eventValue(event, 1), scope.sender)
        || exactNonNegativeInteger(eventValue(event, 2), "withdraw amount") !== BigInt(pending.amountBase)
      ) throw new Error("event mismatch");
    } catch {
      publishReceipt(scope, receiptFor(pending, "readback"));
      actionNotice.set(t("receiptEventMismatch"));
      return false;
    }
    try {
      await assertScopeCurrent(scope);
      const developer = parseDeveloper(
        await app.chain.readRaw("getDeveloper", [app.chain.arg.integer(pending.devId)]),
        pending.devId,
      );
      await assertScopeCurrent(scope);
      const newTips = developer.totalReceivedBase - BigInt(pending.beforeTotalReceivedBase);
      if (
        !accountMatches(developer.wallet, pending.recipientWallet)
        || newTips < 0n
        || developer.balanceBase > newTips
      ) throw new Error("readback mismatch");
      markTerminal(scope, pending, "confirmed", "secondaryActionConfirmed");
      return true;
    } catch {
      publishReceipt(scope, receiptFor(pending, "readback"));
      actionNotice.set(t("receiptReadbackPending"));
      return false;
    }
  };

  const finalizeWithdrawCredit = async (
    scope: TipOperationScope,
    pending: PendingWithdrawCreditOperation,
    event: unknown,
  ): Promise<boolean> => {
    try {
      if (
        !accountMatches(eventValue(event, 0), scope.sender)
        || exactNonNegativeInteger(eventValue(event, 1), "credit amount") !== BigInt(pending.amountBase)
      ) throw new Error("event mismatch");
    } catch {
      publishReceipt(scope, receiptFor(pending, "readback"));
      actionNotice.set(t("receiptEventMismatch"));
      return false;
    }
    try {
      await assertScopeCurrent(scope);
      const remaining = exactNonNegativeInteger(
        await app.chain.readRaw("creditOf", [app.chain.arg.hash160(scope.sender)]),
        "tip credit",
      );
      await assertScopeCurrent(scope);
      if (remaining !== 0n) throw new Error("readback mismatch");
      markTerminal(scope, pending, "confirmed", "secondaryActionConfirmed");
      return true;
    } catch {
      publishReceipt(scope, receiptFor(pending, "readback"));
      actionNotice.set(t("receiptReadbackPending"));
      return false;
    }
  };

  const finalizeOperation = async (
    scope: TipOperationScope,
    pending: PendingDevTippingOperation,
    event: unknown,
  ): Promise<boolean> => {
    if (pending.kind === "tip") return finalizeTip(scope, pending, event);
    if (pending.kind === "deposit") return finalizeDeposit(scope, pending, event);
    if (pending.kind === "register") return finalizeRegister(scope, pending, event);
    if (pending.kind === "withdrawTips") return finalizeWithdrawTips(scope, pending, event);
    return finalizeWithdrawCredit(scope, pending as PendingWithdrawCreditOperation, event);
  };

  const recoverRecord = async (
    scope: TipOperationScope,
    pending: PendingDevTippingOperation,
    generation: number,
  ): Promise<DevTippingReceiptStatus> => {
    await assertScopeCurrent(scope);
    const stale = Date.now() - pending.createdAt >= PENDING_OPERATION_STALE_MS;
    if (stale) {
      publishReceipt(scope, receiptFor(pending, "expired"));
      actionNotice.set(t("receiptExpired"));
    }
    await assertScopeCurrent(scope);
    let event: unknown = null;
    try {
      event = await app.events.waitFor(pending.txid, pending.eventName, 2_500);
    } catch {
      event = null;
    }
    if (generation !== recoveryGeneration) return "pending";
    await assertScopeCurrent(scope);
    if (event) {
      const confirmed = await finalizeOperation(scope, pending, event);
      return confirmed
        ? pending.kind === "deposit" ? "credit" : "confirmed"
        : "readback";
    }

    const execution = await readExecutionState(pending.network, pending.txid);
    if (generation !== recoveryGeneration) return "pending";
    await assertScopeCurrent(scope);
    if (execution === "fault") {
      markTerminal(scope, pending, "fault", "receiptFault");
      return "fault";
    }
    const status = execution === "halt" ? "readback" : stale ? "expired" : "pending";
    publishReceipt(scope, receiptFor(pending, status));
    actionNotice.set(t(status === "readback" ? "receiptEventMissing" : "receiptPending"));
    return status;
  };

  const recoverPendingOperation = async (): Promise<DevTippingRecoveryOutcome> => {
    const pending = pendingOperation.get();
    if (!pending) return "none";
    if (activeOperation === "recovery") return lastReceipt.get()?.status ?? "pending";
    beginOperation("recovery");
    isRecovering.set(true);
    const generation = ++recoveryGeneration;
    try {
      const scope = normalizeTipOperationScope(pending);
      if (!scope) throw new Error(t("runtimeBindingMismatch"));
      return await recoverRecord(scope, pending, generation);
    } finally {
      isRecovering.set(false);
      endOperation("recovery");
    }
  };

  const clearRecoveryView = () => {
    recoveryGeneration += 1;
    pendingOperation.set(null);
    lastReceipt.set(null);
    actionNotice.set("");
  };

  const restoreRecovery = async (): Promise<void> => {
    const address = app.chain.address.get();
    clearRecoveryView();
    if (!address) return;
    const scope = await refreshRuntime(address);
    if (!scope) return;
    await assertScopeCurrent(scope);
    const pending = operationStore.getPending(scope);
    pendingOperation.set(pending);
    lastReceipt.set(operationStore.getReceipt(scope));
    if (pending && !activeOperation) await recoverPendingOperation();
  };

  const sendTip = async (
    selectedDevId: number,
    tipAmount: string,
    _tipMessage: string,
    _tipperName: string,
    anonymous: boolean,
    onSuccess?: () => void,
  ): Promise<DevTippingActionOutcome> => {
    if (!Number.isSafeInteger(selectedDevId) || selectedDevId <= 0) {
      throw new Error(t("selectDeveloper"));
    }
    if (typeof anonymous !== "boolean") throw new Error(t("invalidVisibility"));
    const parsed = app.amount.parseGasToFixed8(String(tipAmount ?? "").trim());
    if (!parsed) throw new Error(t("invalidAmount"));
    const amountBase = BigInt(parsed);
    if (amountBase < MIN_TIP_BASE) throw new Error(t("minTip"));

    beginOperation("tip");
    isLoading.set(true);
    try {
      const scope = await ensureRuntimeScope();
      ensureNoPending(scope);
      ensureRecoveryStorage(scope);
      const [developer, creditBase, gasBalanceBase] = await Promise.all([
        app.chain.readRaw("getDeveloper", [app.chain.arg.integer(selectedDevId)]).then((raw) =>
          parseDeveloper(raw, selectedDevId),
        ),
        app.chain.readRaw("creditOf", [app.chain.arg.hash160(scope.sender)]).then((raw) =>
          exactNonNegativeInteger(raw, "tip credit"),
        ),
        app.chain.readRaw(
          "balanceOf",
          [app.chain.arg.hash160(scope.sender)],
          { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
        ).then((raw) => exactNonNegativeInteger(raw, "GAS balance")),
      ]);
      const shortfall = amountBase > creditBase ? amountBase - creditBase : 0n;
      if (gasBalanceBase < shortfall) throw new Error(t("insufficientGas"));
      await assertScopeCurrent(scope);

      const common = {
        version: 2 as const,
        ...scope,
        devId: developer.id,
        recipientName: developer.name,
        recipientWallet: developer.wallet,
        amountBase: amountBase.toString(),
        anonymous,
        beforeTotalReceivedBase: developer.totalReceivedBase.toString(),
        beforeTipCount: developer.tipCount.toString(),
        beforeCreditBase: creditBase.toString(),
        depositAmountBase: shortfall.toString(),
      };
      const depositDraft: TipDraft = { ...common, kind: "deposit", eventName: "Credited" };
      const tipDraft: TipDraft = { ...common, kind: "tip", eventName: "Tipped" };
      const tipArgs = [
        app.chain.arg.hash160(scope.sender),
        app.chain.arg.integer(selectedDevId),
        app.chain.arg.integer(amountBase),
        app.chain.arg.boolean(anonymous),
      ];

      let result;
      try {
        result = shortfall > 0n
          ? await app.funds.payAndCall({
              amountFixed8: shortfall,
              memo: TIP_MEMO,
              operation: "tip",
              args: tipArgs,
              waitForEvent: "Tipped",
              notify: "silent",
              onPaymentSent: (txid) => journalBroadcast(scope, depositDraft, txid),
              onTransactionSent: (txid) => journalBroadcast(scope, tipDraft, txid),
            })
          : await app.chain.invoke("tip", tipArgs, {
              waitForEvent: "Tipped",
              onTransactionSent: (txid) => journalBroadcast(scope, tipDraft, txid),
            });
      } catch (error) {
        const pending = operationStore.getPending(scope) ?? pendingOperation.get();
        if (error instanceof FrameworkPrepaidActionError) {
          const deposit = pending?.kind === "deposit"
            ? pending
            : journalBroadcast(scope, depositDraft, error.txid);
          if (deposit?.kind === "deposit" && error.depositConfirmed) {
            const generation = ++recoveryGeneration;
            await recoverRecord(scope, deposit, generation);
          }
          return "pending";
        }
        if (pending && normalizeTipOperationScope(pending)) {
          actionNotice.set(t("receiptPending"));
          return "pending";
        }
        throw error;
      }

      await assertScopeCurrent(scope);
      const pending = ensureBroadcastJournal(scope, tipDraft, result.txid);
      if (result.verified === true && result.event && await finalizeTip(scope, pending as PendingTipOperation, result.event)) {
        onSuccess?.();
        return "confirmed";
      }
      publishReceipt(scope, receiptFor(pending, result.event ? "readback" : "pending"));
      actionNotice.set(t(result.event ? "receiptReadbackPending" : "receiptPending"));
      return "pending";
    } finally {
      isLoading.set(false);
      endOperation("tip");
    }
  };

  const registerDeveloper = async (
    name: string,
    role: string,
    onSuccess?: () => void,
  ): Promise<DevTippingActionOutcome> => {
    const trimmedName = String(name ?? "").trim();
    const trimmedRole = String(role ?? "").trim();
    // Measured in UTF-8 BYTES — the contract's unit (see MAX_NAME_BYTES).
    // Rejecting here spares the user a doomed transaction whose fee the
    // deterministic "invalid name"/"invalid role" revert would still charge.
    if (!trimmedName || utf8ByteLength(trimmedName) > MAX_NAME_BYTES) throw new Error(t("invalidDevName"));
    if (utf8ByteLength(trimmedRole) > MAX_ROLE_BYTES) throw new Error(t("invalidDevRole"));
    beginOperation("register");
    isRegistering.set(true);
    let scope: TipOperationScope | null = null;
    let broadcasted = false;
    try {
      scope = await ensureRuntimeScope();
      ensureNoPending(scope);
      ensureRecoveryStorage(scope);
      const existingId = exactNonNegativeInteger(
        await app.chain.readRaw("developerIdOf", [app.chain.arg.hash160(scope.sender)]),
        "developer id",
      );
      if (existingId > 0n) throw new Error(t("alreadyRegistered"));
      await assertScopeCurrent(scope);
      const draft: RegisterDraft = {
        version: 2,
        ...scope,
        kind: "register",
        eventName: "DeveloperRegistered",
        name: trimmedName,
        role: trimmedRole,
      };
      const result = await app.chain.invoke(
        "registerDeveloper",
        [
          app.chain.arg.hash160(scope.sender),
          app.chain.arg.string(trimmedName),
          app.chain.arg.string(trimmedRole),
        ],
        {
          waitForEvent: "DeveloperRegistered",
          onTransactionSent: (txid) => {
            const pending = journalBroadcast(scope as TipOperationScope, draft, txid);
            broadcasted = pending?.kind === "register";
          },
        },
      );
      await assertScopeCurrent(scope);
      const pending = ensureBroadcastJournal(scope, draft, result.txid) as PendingRegisterOperation;
      if (result.verified === true && result.event && await finalizeRegister(scope, pending, result.event)) {
        onSuccess?.();
        return "confirmed";
      }
      publishReceipt(scope, receiptFor(pending, result.event ? "readback" : "pending"));
      actionNotice.set(t(result.event ? "receiptReadbackPending" : "secondaryActionPending"));
      return "pending";
    } catch (error) {
      if (broadcasted && scope && operationStore.getPending(scope)) return "pending";
      throw error;
    } finally {
      isRegistering.set(false);
      endOperation("register");
    }
  };

  const withdrawTips = async (
    devId: number,
    onSuccess?: () => void,
  ): Promise<DevTippingActionOutcome> => {
    if (!Number.isSafeInteger(devId) || devId <= 0) throw new Error(t("nothingToWithdraw"));
    beginOperation("withdrawTips");
    isWithdrawing.set(true);
    let scope: TipOperationScope | null = null;
    let broadcasted = false;
    try {
      scope = await ensureRuntimeScope();
      ensureNoPending(scope);
      ensureRecoveryStorage(scope);
      const developer = parseDeveloper(
        await app.chain.readRaw("getDeveloper", [app.chain.arg.integer(devId)]),
        devId,
      );
      if (!accountMatches(developer.wallet, scope.sender)) throw new Error(t("developerWalletMismatch"));
      if (developer.balanceBase <= 0n) throw new Error(t("nothingToWithdraw"));
      await assertScopeCurrent(scope);
      const draft: WithdrawTipsDraft = {
        version: 2,
        ...scope,
        kind: "withdrawTips",
        eventName: "TipsWithdrawn",
        devId,
        recipientName: developer.name,
        recipientWallet: developer.wallet,
        amountBase: developer.balanceBase.toString(),
        beforeTotalReceivedBase: developer.totalReceivedBase.toString(),
      };
      const result = await app.chain.invoke(
        "withdrawTips",
        [app.chain.arg.integer(devId)],
        {
          waitForEvent: "TipsWithdrawn",
          onTransactionSent: (txid) => {
            const pending = journalBroadcast(scope as TipOperationScope, draft, txid);
            broadcasted = pending?.kind === "withdrawTips";
          },
        },
      );
      await assertScopeCurrent(scope);
      const pending = ensureBroadcastJournal(scope, draft, result.txid) as PendingWithdrawTipsOperation;
      if (result.verified === true && result.event && await finalizeWithdrawTips(scope, pending, result.event)) {
        onSuccess?.();
        return "confirmed";
      }
      publishReceipt(scope, receiptFor(pending, result.event ? "readback" : "pending"));
      actionNotice.set(t(result.event ? "receiptReadbackPending" : "secondaryActionPending"));
      return "pending";
    } catch (error) {
      if (broadcasted && scope && operationStore.getPending(scope)) return "pending";
      throw error;
    } finally {
      isWithdrawing.set(false);
      endOperation("withdrawTips");
    }
  };

  const withdrawCredit = async (
    onSuccess?: () => void,
  ): Promise<DevTippingActionOutcome> => {
    beginOperation("withdrawCredit");
    isWithdrawing.set(true);
    let scope: TipOperationScope | null = null;
    let broadcasted = false;
    try {
      scope = await ensureRuntimeScope();
      ensureNoPending(scope);
      ensureRecoveryStorage(scope);
      const credit = exactNonNegativeInteger(
        await app.chain.readRaw("creditOf", [app.chain.arg.hash160(scope.sender)]),
        "tip credit",
      );
      if (credit <= 0n) throw new Error(t("nothingToWithdraw"));
      await assertScopeCurrent(scope);
      const draft: WithdrawCreditDraft = {
        version: 2,
        ...scope,
        kind: "withdrawCredit",
        eventName: "CreditWithdrawn",
        amountBase: credit.toString(),
      };
      const result = await app.chain.invoke(
        "withdraw",
        [app.chain.arg.hash160(scope.sender)],
        {
          waitForEvent: "CreditWithdrawn",
          onTransactionSent: (txid) => {
            const pending = journalBroadcast(scope as TipOperationScope, draft, txid);
            broadcasted = pending?.kind === "withdrawCredit";
          },
        },
      );
      await assertScopeCurrent(scope);
      const pending = ensureBroadcastJournal(scope, draft, result.txid) as PendingWithdrawCreditOperation;
      if (result.verified === true && result.event && await finalizeWithdrawCredit(scope, pending, result.event)) {
        onSuccess?.();
        return "confirmed";
      }
      publishReceipt(scope, receiptFor(pending, result.event ? "readback" : "pending"));
      actionNotice.set(t(result.event ? "receiptReadbackPending" : "secondaryActionPending"));
      return "pending";
    } catch (error) {
      if (broadcasted && scope && operationStore.getPending(scope)) return "pending";
      throw error;
    } finally {
      isWithdrawing.set(false);
      endOperation("withdrawCredit");
    }
  };

  return {
    address: app.chain.address,
    isLoading,
    isRegistering,
    isWithdrawing,
    isRecovering,
    runtimeStatus,
    runtimeCompatible,
    activeNetwork,
    runtimeChecksum,
    runtimeError,
    pendingOperation,
    // Backward-compatible state alias for the existing PlayArea/test harness.
    pendingTip: pendingOperation,
    lastReceipt,
    actionNotice,
    recoveryStorageHealthy,
    refreshRuntime,
    restoreRecovery,
    clearRecoveryView,
    recoverPendingOperation,
    recoverPendingTip: recoverPendingOperation,
    sendTip,
    registerDeveloper,
    withdrawTips,
    withdrawCredit,
  };
}
