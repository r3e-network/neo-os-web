import { createObservable, createDerived, refToObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { useWallet } from "@shared/utils/wallet-sdk";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import { formatErrorMessage } from "@shared/utils/errorHandling";

const STORAGE_KEY = "miniapp-timestamp-proof:proofs:v2";
const MAX_PROOFS = 200;

export interface TimestampProof {
  id: number;
  content: string;
  contentHash: string;
  timestamp: number;
  creator: string;
  txHash: string;
}

function sanitizeProof(item: Partial<TimestampProof>): TimestampProof {
  return {
    id: Number(item.id || 0),
    content: String(item.content || ""),
    contentHash: String(item.contentHash || ""),
    timestamp: Number(item.timestamp || 0),
    creator: String(item.creator || "local"),
    txHash: String(item.txHash || ""),
  };
}

function readStoredProofs(): TimestampProof[] {
  try {
    const parsed = readCachedJSON<unknown[]>(STORAGE_KEY);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => sanitizeProof(item as Partial<TimestampProof>))
      .filter((item) => item.id > 0 && item.contentHash.length > 0 && item.timestamp > 0)
      .sort((a, b) => b.id - a.id)
      .slice(0, MAX_PROOFS);
  } catch (_e) {
    return [];
  }
}

function writeStoredProofs(items: TimestampProof[]) {
  writeCachedJSON(STORAGE_KEY, items);
}

export function useTimestampProofContract(t: (key: string) => string) {
  const walletAddress = useWallet().address;
  const address = refToObservable(walletAddress);

  // The wallet SDK mutates `walletAddress.value` directly on connect/switch
  // rather than routing through this wrapper's `.set()`, so subscribers are
  // never notified by the wrapper alone. Poll the underlying ref and emit
  // through `.set()` so any address change propagates to bound derives
  // (e.g. `myProofsCount`). Cheap reference compare every 500ms.
  let lastSeenAddress = walletAddress.value;
  const addressPollHandle = setInterval(() => {
    if (!Object.is(lastSeenAddress, walletAddress.value)) {
      lastSeenAddress = walletAddress.value;
      address.set(walletAddress.value);
    }
  }, 500);
  const stopAddressPolling = () => clearInterval(addressPollHandle);

  const proofs = createObservable<TimestampProof[]>([]);
  const verifiedProof = createObservable<TimestampProof | null>(null);
  const verifyError = createObservable(false);
  const isCreating = createObservable(false);
  const isVerifying = createObservable(false);
  const lastMessage = createObservable("");

  const currentActor = () => String(address.get() || "local");

  const setMessage = (key: string) => {
    lastMessage.set(t(key));
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      const clipboard = (globalThis.navigator as Navigator | undefined)?.clipboard;
      if (!clipboard?.writeText) return false;
      await clipboard.writeText(text);
      return true;
    } catch (_e) {
      return false;
    }
  };

  const loadProofs = async () => {
    proofs.set(readStoredProofs());
  };

  const persistProofs = (items: TimestampProof[]) => {
    const next = items
      .map((item) => sanitizeProof(item))
      .filter((item) => item.id > 0 && item.contentHash.length > 0 && item.timestamp > 0)
      .sort((a, b) => b.id - a.id)
      .slice(0, MAX_PROOFS);
    proofs.set(next);
    writeStoredProofs(next);
  };

  // This is a device-local journal: every saved proof belongs to this device,
  // so "Your Proofs" counts all of them. Filtering by `currentActor()` made the
  // tile fluctuate on wallet connect/disconnect (proofs stamped `local` stopped
  // counting once an address connected, and vice-versa) even though no proof
  // changed. Counting all device proofs keeps the figure stable and honest.
  const myProofsCount = createDerived(
    () => proofs.get().length,
    [proofs],
  );

  const hashContent = async (content: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  const createProof = async (
    content: string,
    setStatus: (msg: string, type: string) => void,
    onSuccess: () => void,
  ) => {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      setStatus(t("enterContent"), "error");
      return;
    }

    try {
      isCreating.set(true);
      const contentHash = await hashContent(normalizedContent);
      const currentProofs = readStoredProofs();
      const nextId = currentProofs.length > 0 ? Math.max(...currentProofs.map((item) => item.id)) + 1 : 1;

      const proof: TimestampProof = {
        id: nextId,
        content: normalizedContent,
        contentHash,
        timestamp: Date.now(),
        creator: currentActor(),
        txHash: `local:${contentHash.slice(0, 16)}`,
      };

      persistProofs([proof, ...currentProofs]);
      verifiedProof.set(proof);
      verifyError.set(false);
      setMessage("createSuccess");
      setStatus(t("createSuccess"), "success");
      onSuccess();
    } catch (e) {
      const message = formatErrorMessage(e, t("error"));
      lastMessage.set(message);
      setStatus(message, "error");
    } finally {
      isCreating.set(false);
    }
  };

  const findProof = (query: string): TimestampProof | null => {
    const normalized = query.trim();
    if (!normalized) return null;

    const stored = readStoredProofs();

    // 1) Match by numeric proof id.
    const asId = Number(normalized);
    if (Number.isInteger(asId) && asId > 0) {
      const byId = stored.find((item) => item.id === asId);
      if (byId) return byId;
    }

    // 2) Match by SHA-256 digest (case-insensitive 64-hex string).
    if (/^[0-9a-f]{64}$/i.test(normalized)) {
      const lower = normalized.toLowerCase();
      const byHash = stored.find((item) => item.contentHash.toLowerCase() === lower);
      if (byHash) return byHash;
    }

    // 3) Match by original content (exact value).
    const byContent = stored.find((item) => item.content === normalized);
    if (byContent) return byContent;

    return null;
  };

  const verifyProof = async (query: string) => {
    try {
      isVerifying.set(true);
      verifyError.set(false);
      verifiedProof.set(null);

      proofs.set(readStoredProofs());

      const matched = findProof(String(query ?? ""));
      if (!matched) {
        verifyError.set(true);
        setMessage("verifyFailed");
        return;
      }

      verifiedProof.set(matched);
      verifyError.set(false);
      setMessage("validProof");
    } catch (_e) {
      verifyError.set(true);
      setMessage("verifyFailed");
    } finally {
      isVerifying.set(false);
    }
  };

  const buildReference = (proof: TimestampProof) =>
    JSON.stringify(
      {
        id: proof.id,
        sha256: proof.contentHash,
        timestamp: proof.timestamp,
        creator: proof.creator,
        txHash: proof.txHash,
      },
      null,
      2,
    );

  const copyProofDigest = async (id: number): Promise<boolean> => {
    const proof = readStoredProofs().find((item) => item.id === Number(id));
    if (!proof) {
      setMessage("invalidProof");
      return false;
    }
    const copied = await copyToClipboard(proof.contentHash);
    setMessage(copied ? "digestCopied" : "error");
    return copied;
  };

  const copyProofReference = async (id: number): Promise<boolean> => {
    const proof = readStoredProofs().find((item) => item.id === Number(id));
    if (!proof) {
      setMessage("invalidProof");
      return false;
    }
    const copied = await copyToClipboard(buildReference(proof));
    setMessage(copied ? "referenceCopied" : "error");
    return copied;
  };

  const deleteProof = async (id: number) => {
    const targetId = Number(id);
    const remaining = readStoredProofs().filter((item) => item.id !== targetId);
    persistProofs(remaining);
    if (verifiedProof.get()?.id === targetId) {
      verifiedProof.set(null);
      verifyError.set(false);
    }
    setMessage("proofDeleted");
  };

  const clearProofs = async () => {
    persistProofs([]);
    verifiedProof.set(null);
    verifyError.set(false);
    setMessage("proofsCleared");
  };

  // Backwards-compatible alias: verify by proof id only.
  const verifyProofById = async (id: string) => {
    await verifyProof(String(id));
  };

  // Clear a stale "invalid proof" error while the user edits the lookup field,
  // so a corrected/valid id is not shown as still-invalid until re-verify.
  const clearVerifyError = () => {
    if (verifyError.get()) verifyError.set(false);
  };

  return {
    address,
    proofs,
    verifiedProof,
    verifyError,
    lastMessage,
    isCreating,
    isVerifying,
    myProofsCount,
    loadProofs,
    createProof,
    verifyProof,
    verifyProofById,
    clearVerifyError,
    copyProofDigest,
    copyProofReference,
    deleteProof,
    clearProofs,
    stopAddressPolling,
  };
}
