import { createDerived, createObservable, createReadCell } from "@shared/react/context";
import type { ReadCell } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { GAS_HASH } from "@shared/constants/rpc";
import { ownerMatchesAddress } from "@shared/utils/neo";
import {
  inspectTimestampProofAnchor,
  normalizeTimestampProofNetwork,
  normalizeTimestampProofTxid,
  type TimestampProofNetwork,
  type TimestampProofReceipt,
} from "../timestamp-proof-rpc";

const STORAGE_KEY = "proofs:v2";
const STORAGE_PROBE_KEY = "proofs:storage-probe";
const MAX_PROOFS = 200;
const MAX_CONTENT_CHARS = 50_000;
const MAX_RECOVERY_PROOFS = 6;
const RECOVERY_BATCH_SIZE = 3;
const ANCHOR_PREFIX = "timestamp-proof:";

export type TimestampProofAnchorStatus = "local" | "preparing" | "pending" | "anchored" | "fault";
export type TimestampProofAnchorMethod = "legacy-transfer" | "platform-notary";
export type TimestampProofVerificationSource =
  | "none"
  | "local"
  | "reference"
  | "pending"
  | "unavailable"
  | "chain"
  | "fault";
export type TimestampProofStorageState = "checking" | "ready" | "unavailable" | "corrupt";

/**
 * One settled journal read: the storage verdict plus the rows it yielded.
 * "checking" is deliberately not representable here — it is not a settled
 * answer; it is the read-cell's "not read yet" (value === undefined).
 */
interface TimestampProofJournalSnapshot {
  state: Exclude<TimestampProofStorageState, "checking">;
  items: TimestampProof[];
}

/** Stable empty journal for the pre-read phase (referential identity matters to the render bridge). */
const NO_PROOFS: TimestampProof[] = [];

function isSha256Digest(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value.trim());
}

function exactWalletNetwork(value: unknown): TimestampProofNetwork | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "neo-n3-mainnet" || normalized === "neo-n3-testnet") return normalized;
  return null;
}

function isExplicitWalletRejection(error: unknown): boolean {
  const record = error && typeof error === "object" ? error as { code?: unknown; message?: unknown } : null;
  const code = Number(record?.code ?? Number.NaN);
  const message = String(record?.message ?? (error instanceof Error ? error.message : error ?? "")).toLowerCase();
  return code === 4001 || /user (?:rejected|denied|cancelled)|request (?:rejected|denied|cancelled)|wallet rejected/.test(message);
}

export function isValidPlatformNotarization(
  anchorAddress: string,
  submitter: string,
  timestampMs: bigint,
): boolean {
  const blockTime = Number(timestampMs);
  return Number.isSafeInteger(blockTime) &&
    blockTime > 0 &&
    ownerMatchesAddress(submitter, anchorAddress);
}

export interface TimestampProof {
  id: number;
  content: string;
  contentHash: string;
  timestamp: number;
  creator: string;
  anchorTxid: string;
  anchorStatus: TimestampProofAnchorStatus;
  anchorMethod: TimestampProofAnchorMethod;
  anchorNetwork: TimestampProofNetwork | "";
  anchorAddress: string;
  anchorBroadcastAt: number;
  anchorConfirmedAt: number;
  anchorError: string;
  /** Compatibility projection for existing PlayAreas and exported references. */
  anchored: boolean;
}

type LegacyTimestampProof = Partial<TimestampProof> & { txHash?: string };

interface ParsedTimestampProofReference {
  id: number;
  digest: string;
  timestamp: number;
  creator: string;
  txid: string;
  method: TimestampProofAnchorMethod;
  network: TimestampProofNetwork | "";
  address: string;
}

function sanitizeProof(item: LegacyTimestampProof): TimestampProof {
  const legacyTxid = normalizeTimestampProofTxid(item.txHash);
  const anchorTxid = normalizeTimestampProofTxid(item.anchorTxid) || legacyTxid;
  const isLegacyMainnetReceipt =
    Boolean(anchorTxid) &&
    item.anchorStatus === undefined &&
    item.anchorNetwork === undefined;
  // The pre-v1.1 manifest supported Mainnet only and persisted a txid without
  // a network. Bind only that exact legacy shape to Mainnet so it can be
  // rechecked; never guess a network for newer incomplete records.
  const anchorNetwork = normalizeTimestampProofNetwork(item.anchorNetwork)
    ?? (isLegacyMainnetReceipt ? "neo-n3-mainnet" : "");
  const explicitStatus = String(item.anchorStatus ?? "");
  const anchorMethod: TimestampProofAnchorMethod = item.anchorMethod === "platform-notary"
    ? "platform-notary"
    : "legacy-transfer";
  let anchorStatus: TimestampProofAnchorStatus = "local";
  if (explicitStatus === "fault") anchorStatus = "fault";
  else if (explicitStatus === "anchored" && anchorTxid && anchorNetwork) anchorStatus = "anchored";
  else if (explicitStatus === "preparing" && anchorNetwork) {
    // A durable pre-broadcast reservation deliberately survives without a
    // txid. If the page closed while the wallet was submitting, keeping this
    // state prevents a blind replay; the user can review wallet history and
    // explicitly clear the retry lock.
    anchorStatus = "preparing";
  } else if (explicitStatus === "pending" && anchorTxid && anchorNetwork) {
    anchorStatus = "pending";
  } else if (anchorTxid) {
    // Legacy journals marked a txid as anchored at broadcast time and did not
    // persist a network. Downgrade them: a receipt must be checked before the
    // app can call them chain-verifiable.
    anchorStatus = "pending";
  }

  return {
    id: Number(item.id || 0),
    content: String(item.content || ""),
    contentHash: String(item.contentHash || "").trim().toLowerCase(),
    timestamp: Number(item.timestamp || 0),
    creator: String(item.creator || "local"),
    anchorTxid,
    anchorStatus,
    anchorMethod,
    anchorNetwork,
    anchorAddress: String(item.anchorAddress || ""),
    anchorBroadcastAt: Number(item.anchorBroadcastAt || 0),
    anchorConfirmedAt: Number(item.anchorConfirmedAt || 0),
    anchorError: String(item.anchorError || ""),
    anchored: anchorStatus === "anchored",
  };
}

function normalizeProofs(items: LegacyTimestampProof[]): TimestampProof[] {
  return items
    .map(sanitizeProof)
    .filter((item) =>
      Number.isSafeInteger(item.id) &&
      item.id > 0 &&
      isSha256Digest(item.contentHash) &&
      item.content.length <= MAX_CONTENT_CHARS &&
      Number.isFinite(item.timestamp) &&
      item.timestamp > 0
    )
    .sort((a, b) => b.id - a.id)
    .slice(0, MAX_PROOFS);
}

function hasInvalidProofRows(items: LegacyTimestampProof[]): boolean {
  const normalized = items.map(sanitizeProof);
  const ids = new Set<number>();
  return normalized.some((item) => {
    const invalid =
      !Number.isSafeInteger(item.id) ||
      item.id <= 0 ||
      !isSha256Digest(item.contentHash) ||
      item.content.length > MAX_CONTENT_CHARS ||
      !Number.isFinite(item.timestamp) ||
      item.timestamp <= 0 ||
      ids.has(item.id);
    ids.add(item.id);
    return invalid;
  });
}

function journalSignature(items: TimestampProof[]): string {
  return JSON.stringify(items.map((item) => ({
    id: item.id,
    content: item.content,
    contentHash: item.contentHash,
    timestamp: item.timestamp,
    creator: item.creator,
    anchorTxid: item.anchorTxid,
    anchorStatus: item.anchorStatus,
    anchorMethod: item.anchorMethod,
    anchorNetwork: item.anchorNetwork,
    anchorAddress: item.anchorAddress,
    anchorBroadcastAt: item.anchorBroadcastAt,
    anchorConfirmedAt: item.anchorConfirmedAt,
    anchorError: item.anchorError,
    anchored: item.anchored,
  })));
}

export interface UseTimestampProofOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
  inspectAnchor?: typeof inspectTimestampProofAnchor;
}

export function useTimestampProofContract({ app, t, inspectAnchor = inspectTimestampProofAnchor }: UseTimestampProofOptions) {
  const address = app.chain.address;

  /**
   * The proof journal's read lane on the platform read-cell (read-cell pilot).
   * value === undefined IS the old hand-rolled "checking" state: the first
   * paint stays "checking" until the first read settles, so a storage fault
   * never masquerades as an empty journal. A re-read that settles
   * unavailable/corrupt re-publishes the LAST GOOD items — pending anchor
   * receipts must never disappear behind a storage fault (the PlayArea shows
   * them alongside the journal alert).
   */
  const journal: ReadCell<TimestampProofJournalSnapshot> = createReadCell(
    (): TimestampProofJournalSnapshot => {
      const stored = readStoredProofs();
      if (stored.state === "ready") return stored;
      return { state: stored.state, items: journal.value.get()?.items ?? NO_PROOFS };
    },
  );
  const proofs = createDerived<TimestampProof[]>(
    () => journal.value.get()?.items ?? NO_PROOFS,
    [journal.value],
  );
  const storageState = createDerived<TimestampProofStorageState>(
    () => journal.value.get()?.state ?? "checking",
    [journal.value],
  );

  const verifiedProof = createObservable<TimestampProof | null>(null);
  const verificationSource = createObservable<TimestampProofVerificationSource>("none");
  const verifyError = createObservable(false);
  const isCreating = createObservable(false);
  const isVerifying = createObservable(false);
  const isAnchoring = createObservable(false);
  const isRecovering = createObservable(false);
  const anchoringId = createObservable<number | null>(null);
  const network = createObservable<TimestampProofNetwork | "">("");
  const lastMessage = createObservable("");

  const anchoredCount = createDerived(
    () => proofs.get().filter((item) => item.anchorStatus === "anchored").length,
    [proofs],
  );
  const pendingCount = createDerived(
    () => proofs.get().filter((item) => item.anchorStatus === "pending").length,
    [proofs],
  );
  const preparingCount = createDerived(
    () => proofs.get().filter((item) => item.anchorStatus === "preparing").length,
    [proofs],
  );
  const myProofsCount = createDerived(() => proofs.get().length, [proofs]);

  const setMessage = (key: string, params?: Record<string, string | number>) => {
    lastMessage.set(t(key, params));
  };

  const readStoredProofs = (): TimestampProofJournalSnapshot => {
    try {
      // The framework local-storage adapter intentionally degrades to a silent
      // no-op when browser storage is unavailable. Probe + exact readback lets
      // this app distinguish that failure from a genuinely empty journal.
      const probe = `timestamp-proof:${Date.now()}:${Math.random().toString(16).slice(2)}`;
      app.storage.local.set(STORAGE_PROBE_KEY, probe);
      if (app.storage.local.get<string>(STORAGE_PROBE_KEY) !== probe) {
        return { state: "unavailable", items: [] };
      }
      app.storage.local.delete(STORAGE_PROBE_KEY);

      const listed = app.storage.local.list("");
      if (!Object.prototype.hasOwnProperty.call(listed, STORAGE_KEY)) {
        return { state: "ready", items: [] };
      }
      const parsed = app.storage.local.get<unknown>(STORAGE_KEY);
      if (!Array.isArray(parsed) || hasInvalidProofRows(parsed as LegacyTimestampProof[])) {
        return { state: "corrupt", items: [] };
      }
      const restored = normalizeProofs(parsed as LegacyTimestampProof[]).map((item) =>
        item.anchorStatus === "anchored"
          ? {
              ...item,
              anchorStatus: "pending" as const,
              anchored: false,
              anchorError: "revalidation-required",
            }
          : item,
      );
      return { state: "ready", items: restored };
    } catch {
      return { state: "unavailable", items: [] };
    }
  };

  /**
   * Write, read back, and compare before publishing a new journal state.
   * The verified write path publishes straight onto the read-cell's value:
   * it just round-tripped the new truth, so it owns the snapshot as much as
   * a read does. A failed write settles the verdict to "unavailable" while
   * keeping the currently rendered items visible.
   */
  const persistProofs = (items: TimestampProof[]): boolean => {
    const next = normalizeProofs(items);
    try {
      app.storage.local.set(STORAGE_KEY, next);
      const persisted = app.storage.local.get<unknown[]>(STORAGE_KEY);
      if (!Array.isArray(persisted)) {
        journal.value.set({ state: "unavailable", items: proofs.get() });
        return false;
      }
      const roundTrip = normalizeProofs(persisted as LegacyTimestampProof[]);
      if (journalSignature(roundTrip) !== journalSignature(next)) {
        journal.value.set({ state: "unavailable", items: proofs.get() });
        return false;
      }
      journal.value.set({ state: "ready", items: roundTrip });
      return true;
    } catch {
      journal.value.set({ state: "unavailable", items: proofs.get() });
      return false;
    }
  };

  const updateProof = (id: number, update: (proof: TimestampProof) => TimestampProof): boolean => {
    const current = proofs.get();
    if (!current.some((item) => item.id === id)) return false;
    return persistProofs(current.map((item) => item.id === id ? update(item) : item));
  };

  const detectExactNetwork = async (): Promise<TimestampProofNetwork | null> => {
    let detected = "";
    try {
      detected = String(await app.chain.detectNetwork?.() ?? "");
    } catch {
      detected = "";
    }
    const exact = exactWalletNetwork(detected);
    if (exact) {
      network.set(exact);
      return exact;
    }
    // Never infer a wallet write network from a launch parameter when the live
    // detector is generic, unsupported, or unavailable. An exact wallet-bound
    // network is required before invoking GAS.
    network.set("");
    return null;
  };

  const copyToClipboard = (text: string, successKey: string): Promise<boolean> =>
    app.clipboard.copy(text, { successKey, errorKey: "copyFailed" });

  const hashContent = async (content: string): Promise<string> => {
    const data = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  const receiptFor = async (proof: TimestampProof): Promise<TimestampProofReceipt> => {
    if (!proof.anchorNetwork || !proof.anchorTxid) {
      return { status: "mismatch", digest: "", blockTime: 0, reason: "missing-network-or-txid" };
    }
    if (proof.anchorMethod === "platform-notary") {
      try {
        let notarization = await app.platformSocial.getNotarization(proof.contentHash);
        if (!notarization) {
          const event = await app.events.waitFor(proof.anchorTxid, "Notarized", 1_500).catch(() => null);
          if (event) notarization = await app.platformSocial.getNotarization(proof.contentHash);
        }
        if (!notarization) {
          return { status: "pending", digest: proof.contentHash, blockTime: 0, reason: "notarization-not-indexed" };
        }
        const blockTime = Number(notarization.timestampMs);
        if (!isValidPlatformNotarization(
          proof.anchorAddress,
          notarization.submitter,
          notarization.timestampMs,
        )) {
          return { status: "mismatch", digest: proof.contentHash, blockTime: 0, reason: "notarization-mismatch" };
        }
        return { status: "confirmed", digest: proof.contentHash, blockTime, reason: "" };
      } catch (error) {
        return {
          status: "unreachable",
          digest: proof.contentHash,
          blockTime: 0,
          reason: formatErrorMessage(error, "notarization-read-failed"),
        };
      }
    }
    const first = await inspectAnchor({
      network: proof.anchorNetwork,
      txid: proof.anchorTxid,
      expectedDigest: proof.contentHash,
      expectedAddress: proof.anchorAddress || undefined,
    });
    if (first.status !== "pending") return first;

    // Reuse the framework event lane as a short indexer hint. The authoritative
    // verdict still comes from the exact RPC execution + raw script binding,
    // because a native Transfer event does not include the data argument.
    const event = await app.events.waitFor(proof.anchorTxid, "Transfer", 1_500).catch(() => null);
    if (!event) return first;
    return inspectAnchor({
      network: proof.anchorNetwork,
      txid: proof.anchorTxid,
      expectedDigest: proof.contentHash,
      expectedAddress: proof.anchorAddress || undefined,
    });
  };

  const applyReceipt = (id: number, receipt: TimestampProofReceipt): boolean => {
    if (receipt.status === "pending" || receipt.status === "unreachable") return true;
    return updateProof(id, (proof) => {
      if (receipt.status === "confirmed") {
        return {
          ...proof,
          anchorStatus: "anchored",
          anchored: true,
          anchorConfirmedAt: receipt.blockTime,
          anchorError: "",
        };
      }
      return {
        ...proof,
        anchorStatus: "fault",
        anchored: false,
        anchorError: receipt.reason,
      };
    });
  };

  const reconcileProof = async (id: number): Promise<TimestampProofReceipt | null> => {
    const proof = proofs.get().find((item) => item.id === id);
    if (!proof || proof.anchorStatus !== "pending") return null;
    let receipt = await receiptFor(proof);
    if (
      receipt.status === "confirmed" &&
      (
        !Number.isFinite(receipt.blockTime) ||
        receipt.blockTime <= 0 ||
        !isSha256Digest(receipt.digest) ||
        receipt.digest !== proof.contentHash
      )
    ) {
      receipt = {
        status: "mismatch",
        digest: receipt.digest,
        blockTime: 0,
        reason: "confirmed-receipt-incomplete",
      };
    }
    if (!applyReceipt(id, receipt)) {
      setMessage("localSaveFailed");
      return { status: "unreachable", digest: "", blockTime: 0, reason: "journal-write-failed" };
    }
    return receipt;
  };

  const recoverPendingAnchors = async (): Promise<boolean> => {
    if (isRecovering.get() || isAnchoring.get() || isCreating.get() || isVerifying.get()) {
      setMessage("operationInProgress");
      return false;
    }
    const candidates = proofs.get()
      .filter((item) => item.anchorStatus === "pending" && item.anchorTxid && item.anchorNetwork)
      .slice(0, MAX_RECOVERY_PROOFS);
    if (candidates.length === 0) {
      if (proofs.get().some((item) => item.anchorStatus === "preparing")) {
        setMessage("anchorPreparationInterrupted");
        return false;
      }
      setMessage("noPendingAnchors");
      return false;
    }
    isRecovering.set(true);
    try {
      let confirmed = 0;
      let faulted = 0;
      for (let index = 0; index < candidates.length; index += RECOVERY_BATCH_SIZE) {
        const batch = candidates.slice(index, index + RECOVERY_BATCH_SIZE);
        const receipts = await Promise.all(batch.map((candidate) => reconcileProof(candidate.id)));
        for (const receipt of receipts) {
          if (receipt?.status === "confirmed") confirmed += 1;
          if (receipt?.status === "fault" || receipt?.status === "mismatch") faulted += 1;
        }
      }
      if (confirmed > 0) setMessage("anchorRecovered");
      else if (faulted > 0) setMessage("anchorFault");
      else setMessage("anchorStillPending");
      return confirmed > 0;
    } finally {
      isRecovering.set(false);
    }
  };

  const loadProofs = async () => {
    // The cell publishes value + settled status; the loader keeps the last
    // good items on a failed re-read, so a storage failure never turns into
    // a false "0 proofs" state.
    const stored = await journal.load();
    if (stored.state !== "ready") {
      setMessage(stored.state === "corrupt" ? "journalCorrupt" : "journalUnavailable");
      return false;
    }
    await detectExactNetwork();
    if (stored.items.some((item) => item.anchorStatus === "preparing")) {
      setMessage("anchorPreparationInterrupted");
    }
    if (stored.items.some((item) => item.anchorStatus === "pending")) {
      // Keep first paint fast. Pending receipts remain visibly locked against
      // replay while this bounded recovery pass runs in the background.
      void recoverPendingAnchors();
    }
    return true;
  };

  const createProof = async (
    content: string,
    setStatus: (msg: string, type: string) => void,
    onSuccess: () => void,
  ): Promise<boolean> => {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      setStatus(t("enterContent"), "error");
      return false;
    }
    if (isCreating.get() || isVerifying.get() || isAnchoring.get() || isRecovering.get()) {
      setMessage("operationInProgress");
      setStatus(t("operationInProgress"), "error");
      return false;
    }
    if (normalizedContent.length > MAX_CONTENT_CHARS) {
      setMessage("contentTooLong", { max: MAX_CONTENT_CHARS });
      setStatus(t("contentTooLong", { max: MAX_CONTENT_CHARS }), "error");
      return false;
    }

    if (storageState.get() === "checking") {
      // Synchronous re-probe: the loader is sync, so the cell publishes before
      // the next line runs — the double-submit guard ordering is unchanged.
      // (readStoredProofs never throws; it settles faults as "unavailable".)
      void journal.load();
    }
    if (storageState.get() !== "ready") {
      const key = storageState.get() === "corrupt" ? "journalCorrupt" : "localSaveFailed";
      setMessage(key);
      setStatus(t(key), "error");
      return false;
    }

    try {
      isCreating.set(true);
      const contentHash = isSha256Digest(normalizedContent)
        ? normalizedContent.toLowerCase()
        : await hashContent(normalizedContent);
      const currentProofs = proofs.get();
      const nextId = currentProofs.length > 0
        ? Math.max(...currentProofs.map((item) => item.id)) + 1
        : 1;
      if (!Number.isSafeInteger(nextId)) {
        setMessage("proofIdExhausted");
        setStatus(t("proofIdExhausted"), "error");
        return false;
      }
      const proof: TimestampProof = {
        id: nextId,
        content: normalizedContent,
        contentHash,
        timestamp: Date.now(),
        creator: String(address.get() || "local"),
        anchorTxid: "",
        anchorStatus: "local",
        anchorMethod: "legacy-transfer",
        anchorNetwork: "",
        anchorAddress: "",
        anchorBroadcastAt: 0,
        anchorConfirmedAt: 0,
        anchorError: "",
        anchored: false,
      };

      if (!persistProofs([proof, ...currentProofs])) {
        setMessage("localSaveFailed");
        setStatus(t("localSaveFailed"), "error");
        return false;
      }
      verifiedProof.set(proof);
      verificationSource.set("local");
      verifyError.set(false);
      setMessage("createSuccess");
      setStatus(t("createSuccess"), "success");
      onSuccess();
      return true;
    } catch (error) {
      const message = formatErrorMessage(error, t("error"));
      lastMessage.set(message);
      setStatus(message, "error");
      return false;
    } finally {
      isCreating.set(false);
    }
  };

  const anchorProof = async (
    id: number,
    setStatus?: (msg: string, type: string) => void,
  ): Promise<boolean> => {
    if (isAnchoring.get() || isRecovering.get() || isCreating.get() || isVerifying.get()) {
      setMessage("operationInProgress");
      setStatus?.(t("operationInProgress"), "info");
      return false;
    }
    const targetId = Number(id);
    const proof = proofs.get().find((item) => item.id === targetId);
    if (!proof) {
      setMessage("invalidProof");
      setStatus?.(t("invalidProof"), "error");
      return false;
    }
    if (proof.anchorStatus === "anchored") {
      setMessage("alreadyAnchored");
      setStatus?.(t("alreadyAnchored"), "info");
      return false;
    }
    if (proof.anchorStatus === "pending") {
      setMessage("anchorStillPending");
      setStatus?.(t("anchorStillPending"), "info");
      return false;
    }
    if (proof.anchorStatus === "preparing") {
      setMessage("anchorPreparationInterrupted");
      setStatus?.(t("anchorPreparationInterrupted"), "error");
      return false;
    }

    let broadcastTxid = "";
    let pendingStored = false;
    let reservationStored = false;
    try {
      isAnchoring.set(true);
      anchoringId.set(targetId);
      const self = String(await app.chain.ensureWallet() || address.get() || "");
      if (!self) throw new Error(t("connectWalletToAnchor"));
      const selfHash = app.chain.arg.hash160(self);
      const anchorMethod: TimestampProofAnchorMethod = app.platformSocial.available
        ? "platform-notary"
        : "legacy-transfer";
      const anchorNetwork = await detectExactNetwork();
      if (!anchorNetwork) throw new Error(t("unsupportedAnchorNetwork"));
      const observedAddress = String(address.get() || "");
      if (observedAddress && !ownerMatchesAddress(observedAddress, self)) {
        throw new Error(t("walletChangedBeforeAnchor"));
      }

      const reserved = updateProof(targetId, (item) => ({
        ...item,
        anchorTxid: "",
        anchorStatus: "preparing",
        anchorMethod,
        anchorNetwork,
        anchorAddress: self,
        anchorBroadcastAt: 0,
        anchorConfirmedAt: 0,
        anchorError: "",
        anchored: false,
      }));
      if (!reserved) {
        setMessage("localSaveFailed");
        setStatus?.(t("localSaveFailed"), "error");
        return false;
      }
      reservationStored = true;

      const rememberBroadcast = (txidValue: string) => {
        const txid = normalizeTimestampProofTxid(txidValue);
        if (!txid) return;
        broadcastTxid = txid;
        const pending = proofs.get().map((item) => item.id === targetId ? {
          ...item,
          anchorTxid: txid,
          anchorStatus: "pending" as const,
          anchorBroadcastAt: Date.now(),
          anchorError: "",
          anchored: false,
        } : item);
        pendingStored = persistProofs(pending);
        if (!pendingStored) {
          // The broadcast receipt must stay visible even though the journal
          // write failed: publish the pending rows over the failed snapshot
          // without upgrading the storage verdict persistProofs just settled.
          journal.value.set({
            state: journal.value.get()?.state ?? "unavailable",
            items: pending,
          });
        }
      };

      const result = anchorMethod === "platform-notary"
        ? await app.platformSocial.notarize(proof.contentHash, self, {
          waitForEvent: "Notarized",
          waitTimeoutMs: 15_000,
          onTransactionSent: rememberBroadcast,
        })
        : await app.chain.invoke(
          "transfer",
          [
            selfHash,
            selfHash,
            app.chain.arg.integer(0),
            app.chain.arg.string(`${ANCHOR_PREFIX}${proof.contentHash}`),
          ],
          {
            scriptHash: GAS_HASH,
            waitForEvent: "Transfer",
            waitTimeoutMs: 15_000,
            onTransactionSent: rememberBroadcast,
          },
        );
      const returnedTxid = normalizeTimestampProofTxid(result.txid);
      if (!broadcastTxid && returnedTxid) rememberBroadcast(returnedTxid);
      if (!broadcastTxid) {
        updateProof(targetId, (item) => ({
          ...item,
          // A resolved wallet call without a usable txid is ambiguous. Keep
          // the durable retry lock instead of allowing a blind second submit.
          anchorStatus: "preparing",
          anchorError: "missing-transaction-id",
        }));
        setMessage("anchorNoReceipt");
        setStatus?.(t("anchorNoReceipt"), "error");
        return false;
      }
      if (!pendingStored) {
        setMessage("anchorReceiptNotSaved", { txid: broadcastTxid });
        setStatus?.(t("anchorReceiptNotSaved", { txid: broadcastTxid }), "error");
        return false;
      }

      const receipt = await reconcileProof(targetId);
      const refreshed = proofs.get().find((item) => item.id === targetId) ?? null;
      if (refreshed && verifiedProof.get()?.id === targetId) verifiedProof.set(refreshed);
      if (receipt?.status === "confirmed") {
        verificationSource.set("chain");
        setMessage("proofAnchored");
        setStatus?.(t("proofAnchored"), "success");
        return true;
      }
      if (receipt?.status === "fault" || receipt?.status === "mismatch") {
        verificationSource.set("fault");
        setMessage(receipt.status === "fault" ? "anchorFault" : "anchorMismatch");
        setStatus?.(t(receipt.status === "fault" ? "anchorFault" : "anchorMismatch"), "error");
        return false;
      }
      verificationSource.set("pending");
      setMessage("anchorBroadcastPending");
      setStatus?.(t("anchorBroadcastPending"), "info");
      return true;
    } catch (error) {
      if (broadcastTxid) {
        if (!pendingStored) {
          verificationSource.set("pending");
          setMessage("anchorReceiptNotSaved", { txid: broadcastTxid });
          setStatus?.(t("anchorReceiptNotSaved", { txid: broadcastTxid }), "error");
          return false;
        }
        verificationSource.set("pending");
        setMessage("anchorBroadcastPending");
        setStatus?.(t("anchorBroadcastPending"), "info");
        return true;
      }
      if (reservationStored && !isExplicitWalletRejection(error)) {
        updateProof(targetId, (item) => ({
          ...item,
          anchorStatus: "preparing",
          anchorError: formatErrorMessage(error, "submission-interrupted"),
          anchored: false,
        }));
        setMessage("anchorPreparationInterrupted");
        setStatus?.(t("anchorPreparationInterrupted"), "error");
        return false;
      }
      if (reservationStored) {
        const released = updateProof(targetId, (item) => ({
          ...item,
          anchorStatus: "local",
          anchorNetwork: "",
          anchorAddress: "",
          anchorError: "",
          anchored: false,
        }));
        if (!released) {
          setMessage("localSaveFailed");
          setStatus?.(t("localSaveFailed"), "error");
          return false;
        }
      }
      const message = formatErrorMessage(error, t("anchorFailed"));
      lastMessage.set(message);
      setStatus?.(message, "error");
      return false;
    } finally {
      isAnchoring.set(false);
      anchoringId.set(null);
    }
  };

  const releasePreparingAnchor = async (id: number): Promise<boolean> => {
    if (isAnchoring.get() || isRecovering.get() || isCreating.get() || isVerifying.get()) {
      setMessage("operationInProgress");
      return false;
    }
    const targetId = Number(id);
    const proof = proofs.get().find((item) => item.id === targetId);
    if (!proof || proof.anchorStatus !== "preparing") return false;
    const cleared = updateProof(targetId, (item) => ({
      ...item,
      anchorTxid: "",
      anchorStatus: "local",
      anchorMethod: "legacy-transfer",
      anchorNetwork: "",
      anchorAddress: "",
      anchorBroadcastAt: 0,
      anchorConfirmedAt: 0,
      anchorError: "",
      anchored: false,
    }));
    setMessage(cleared ? "anchorRetryLockCleared" : "localSaveFailed");
    return cleared;
  };

  const findProof = (query: string): TimestampProof | null => {
    const normalized = query.trim();
    if (!normalized) return null;
    const stored = proofs.get();
    const asId = Number(normalized);
    if (Number.isInteger(asId) && asId > 0) {
      const byId = stored.find((item) => item.id === asId);
      if (byId) return byId;
    }
    if (isSha256Digest(normalized)) {
      const lower = normalized.toLowerCase();
      const byHash = stored.find((item) => item.contentHash === lower);
      if (byHash) return byHash;
    }
    return stored.find((item) => item.content === normalized) ?? null;
  };

  const parseReference = (query: string): ParsedTimestampProofReference | null => {
    try {
      const parsed = JSON.parse(query) as Record<string, unknown>;
      const digest = String(parsed.sha256 ?? parsed.contentHash ?? "").trim().toLowerCase();
      const txid = normalizeTimestampProofTxid(parsed.anchorTxid);
      const anchorNetwork = normalizeTimestampProofNetwork(parsed.anchorNetwork ?? parsed.network) ?? "";
      const rawTxid = String(parsed.anchorTxid ?? "").trim();
      const rawNetwork = String(parsed.anchorNetwork ?? parsed.network ?? "").trim();
      const rawStatus = String(parsed.anchorStatus ?? "").trim().toLowerCase();
      const method: TimestampProofAnchorMethod = parsed.anchorMethod === "platform-notary"
        ? "platform-notary"
        : "legacy-transfer";
      const timestamp = Number(parsed.timestamp || 0);
      const id = Number(parsed.id || 0);
      if (!isSha256Digest(digest)) return null;
      if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
      if (id !== 0 && (!Number.isSafeInteger(id) || id <= 0)) return null;
      if (rawTxid && !txid) return null;
      if (rawNetwork && !anchorNetwork) return null;
      if (
        !txid &&
        (parsed.anchored === true || rawStatus === "anchored" || rawStatus === "pending" || rawStatus === "preparing")
      ) return null;
      return {
        id,
        digest,
        timestamp,
        creator: String(parsed.creator || "on-chain"),
        txid,
        method,
        network: anchorNetwork,
        address: String(parsed.anchorAddress || ""),
      };
    } catch {
      return null;
    }
  };

  const externalProof = (
    reference: ParsedTimestampProofReference | null,
    txid: string,
    verificationNetwork: TimestampProofNetwork,
    status: TimestampProofAnchorStatus,
    digest = reference?.digest ?? "",
    blockTime = reference?.timestamp ?? 0,
    reason = "",
  ): TimestampProof => ({
    id: reference?.id ?? 0,
    content: "",
    contentHash: digest,
    timestamp: blockTime,
    creator: reference?.creator ?? "on-chain",
    anchorTxid: txid,
    anchorStatus: status,
    anchorMethod: reference?.method ?? "legacy-transfer",
    anchorNetwork: verificationNetwork,
    anchorAddress: reference?.address ?? "",
    anchorBroadcastAt: 0,
    anchorConfirmedAt: status === "anchored" ? blockTime : 0,
    anchorError: reason,
    anchored: status === "anchored",
  });

  const verifyProof = async (query: string, requestedNetwork?: string) => {
    if (isVerifying.get() || isCreating.get() || isAnchoring.get() || isRecovering.get()) {
      setMessage("operationInProgress");
      return;
    }
    try {
      isVerifying.set(true);
      verifyError.set(false);
      verifiedProof.set(null);
      verificationSource.set("none");

      const normalizedQuery = String(query ?? "").trim();
      const localMatch = findProof(normalizedQuery);
      if (localMatch) {
        const receipt = localMatch.anchorStatus === "pending"
          ? await reconcileProof(localMatch.id)
          : null;
        const refreshed = proofs.get().find((item) => item.id === localMatch.id) ?? localMatch;
        verifiedProof.set(refreshed);
        if (refreshed.anchorStatus === "anchored") verificationSource.set("chain");
        else if (receipt?.status === "unreachable") verificationSource.set("unavailable");
        else if (refreshed.anchorStatus === "pending" || refreshed.anchorStatus === "preparing") {
          verificationSource.set("pending");
        } else if (refreshed.anchorStatus === "fault") {
          verificationSource.set("fault");
          verifyError.set(true);
        }
        else verificationSource.set("local");
        setMessage(
          refreshed.anchorStatus === "anchored"
            ? "chainProofVerified"
            : receipt?.status === "unreachable"
              ? "anchorRpcUnavailable"
              : refreshed.anchorStatus === "pending"
              ? "anchorStillPending"
              : refreshed.anchorStatus === "preparing"
                ? "anchorPreparationInterrupted"
              : refreshed.anchorStatus === "fault"
                ? "anchorFault"
                : "localProofFound",
        );
        return;
      }

      const reference = parseReference(normalizedQuery);
      if (reference && !reference.txid) {
        verifiedProof.set({
          id: reference.id,
          content: "",
          contentHash: reference.digest,
          timestamp: reference.timestamp,
          creator: reference.creator,
          anchorTxid: "",
          anchorStatus: "local",
          anchorMethod: reference.method,
          anchorNetwork: "",
          anchorAddress: "",
          anchorBroadcastAt: 0,
          anchorConfirmedAt: 0,
          anchorError: "",
          anchored: false,
        });
        verificationSource.set("reference");
        setMessage("referenceInspected");
        return;
      }

      const txid = reference?.txid || normalizeTimestampProofTxid(normalizedQuery);
      if (!txid) {
        verifyError.set(true);
        setMessage("verifyFailed");
        return;
      }
      const verificationNetwork = normalizeTimestampProofNetwork(reference?.network || requestedNetwork)
        ?? normalizeTimestampProofNetwork(app.platform.launch.network);
      if (!verificationNetwork) {
        verifyError.set(true);
        setMessage("verificationNetworkRequired");
        return;
      }
      const receipt = reference?.method === "platform-notary"
        ? await receiptFor(externalProof(reference, txid, verificationNetwork, "pending"))
        : await inspectAnchor({
          network: verificationNetwork,
          txid,
          expectedDigest: reference?.digest || undefined,
          expectedAddress: reference?.address || undefined,
        });
      if (receipt.status === "confirmed") {
        verifiedProof.set(externalProof(
          reference,
          txid,
          verificationNetwork,
          "anchored",
          receipt.digest,
          receipt.blockTime,
        ));
        verificationSource.set("chain");
        setMessage("chainProofVerified");
        return;
      }
      if (receipt.status === "pending" || receipt.status === "unreachable") {
        verifiedProof.set(externalProof(
          reference,
          txid,
          verificationNetwork,
          "pending",
          reference?.digest ?? "",
          reference?.timestamp ?? 0,
          receipt.reason,
        ));
        verificationSource.set(receipt.status === "pending" ? "pending" : "unavailable");
        setMessage(receipt.status === "pending" ? "anchorStillPending" : "anchorRpcUnavailable");
        return;
      }
      verifiedProof.set(externalProof(
        reference,
        txid,
        verificationNetwork,
        "fault",
        receipt.digest || reference?.digest || "",
        reference?.timestamp ?? 0,
        receipt.reason,
      ));
      verificationSource.set("fault");
      verifyError.set(true);
      setMessage(receipt.status === "fault" ? "anchorFault" : "anchorMismatch");
    } catch {
      verifyError.set(true);
      verificationSource.set("fault");
      setMessage("verifyFailed");
    } finally {
      isVerifying.set(false);
    }
  };

  const buildReference = (proof: TimestampProof) => JSON.stringify({
    version: 2,
    id: proof.id,
    sha256: proof.contentHash,
    timestamp: proof.timestamp,
    creator: proof.creator,
    proofSource: proof.anchorStatus === "anchored" ? "neo-n3" : "device-local",
    anchorStatus: proof.anchorStatus,
    anchorMethod: proof.anchorMethod,
    anchored: proof.anchorStatus === "anchored",
    ...(proof.anchorNetwork ? { anchorNetwork: proof.anchorNetwork } : {}),
    ...(proof.anchorAddress ? { anchorAddress: proof.anchorAddress } : {}),
    ...(proof.anchorTxid ? { anchorTxid: proof.anchorTxid } : {}),
    ...(proof.anchorConfirmedAt ? { anchorConfirmedAt: proof.anchorConfirmedAt } : {}),
  }, null, 2);

  const copyProofDigest = async (id: number): Promise<boolean> => {
    const proof = proofs.get().find((item) => item.id === Number(id));
    if (!proof) {
      setMessage("invalidProof");
      return false;
    }
    const copied = await copyToClipboard(proof.contentHash, "digestCopied");
    setMessage(copied ? "digestCopied" : "error");
    return copied;
  };

  const copyProofReference = async (id: number): Promise<boolean> => {
    const proof = proofs.get().find((item) => item.id === Number(id));
    if (!proof) {
      setMessage("invalidProof");
      return false;
    }
    const copied = await copyToClipboard(buildReference(proof), "referenceCopied");
    setMessage(copied ? "referenceCopied" : "error");
    return copied;
  };

  const copyAnchorTxid = async (id: number): Promise<boolean> => {
    const proof = proofs.get().find((item) => item.id === Number(id));
    if (!proof?.anchorTxid) {
      setMessage("invalidProof");
      return false;
    }
    const copied = await copyToClipboard(proof.anchorTxid, "receiptCopied");
    setMessage(copied ? "receiptCopied" : "error");
    return copied;
  };

  const deleteProof = async (id: number): Promise<boolean> => {
    if (isCreating.get() || isVerifying.get() || isAnchoring.get() || isRecovering.get()) {
      setMessage("operationInProgress");
      return false;
    }
    if (storageState.get() !== "ready") {
      setMessage(storageState.get() === "corrupt" ? "journalCorrupt" : "journalUnavailable");
      return false;
    }
    const targetId = Number(id);
    const target = proofs.get().find((item) => item.id === targetId);
    if (!target) {
      setMessage("invalidProof");
      return false;
    }
    if (target.anchorStatus === "preparing" || target.anchorStatus === "pending") {
      setMessage("pendingProofDeleteBlocked");
      return false;
    }
    const remaining = proofs.get().filter((item) => item.id !== targetId);
    if (!persistProofs(remaining)) {
      setMessage("localSaveFailed");
      return false;
    }
    if (verifiedProof.get()?.id === targetId) {
      verifiedProof.set(null);
      verificationSource.set("none");
      verifyError.set(false);
    }
    setMessage("proofDeleted");
    return true;
  };

  const clearProofs = async (): Promise<boolean> => {
    if (isCreating.get() || isVerifying.get() || isAnchoring.get() || isRecovering.get()) {
      setMessage("operationInProgress");
      return false;
    }
    if (proofs.get().some((item) => item.anchorStatus === "preparing" || item.anchorStatus === "pending")) {
      setMessage("pendingProofsClearBlocked");
      return false;
    }
    if (storageState.get() !== "ready") {
      setMessage(storageState.get() === "corrupt" ? "journalCorrupt" : "journalUnavailable");
      return false;
    }
    if (!persistProofs([])) {
      setMessage("localSaveFailed");
      return false;
    }
    verifiedProof.set(null);
    verificationSource.set("none");
    verifyError.set(false);
    setMessage("proofsCleared");
    return true;
  };

  const verifyProofById = async (id: string) => verifyProof(String(id));
  const clearVerifyError = () => {
    if (verifyError.get()) verifyError.set(false);
  };

  return {
    address,
    network,
    storageState,
    proofs,
    verifiedProof,
    verificationSource,
    verifyError,
    lastMessage,
    isCreating,
    isVerifying,
    isAnchoring,
    isRecovering,
    anchoringId,
    myProofsCount,
    anchoredCount,
    pendingCount,
    preparingCount,
    loadProofs,
    createProof,
    anchorProof,
    recoverPendingAnchors,
    releasePreparingAnchor,
    verifyProof,
    verifyProofById,
    clearVerifyError,
    copyProofDigest,
    copyProofReference,
    copyAnchorTxid,
    deleteProof,
    clearProofs,
    stopAddressPolling: () => {},
  };
}
