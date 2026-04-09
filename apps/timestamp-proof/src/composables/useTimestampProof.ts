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
  const address = refToObservable(useWallet().address);

  const proofs = createObservable<TimestampProof[]>([]);
  const verifiedProof = createObservable<TimestampProof | null>(null);
  const verifyError = createObservable(false);
  const isCreating = createObservable(false);
  const isVerifying = createObservable(false);

  const currentActor = () => String(address.get() || "local");

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

  const myProofsCount = createDerived(() => proofs.get().filter((item) => item.creator === currentActor()).length, []);

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
      setStatus(t("createSuccess"), "success");
      onSuccess();
    } catch (e) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isCreating.set(false);
    }
  };

  const verifyProofById = async (id: string) => {
    try {
      isVerifying.set(true);
      verifyError.set(false);
      verifiedProof.set(null);

      const proofId = Number(id);
      if (!Number.isInteger(proofId) || proofId <= 0) {
        verifyError.set(true);
        return;
      }

      const matched = readStoredProofs().find((item) => item.id === proofId) || null;
      if (!matched) {
        verifyError.set(true);
        return;
      }

      proofs.set(readStoredProofs());
      verifiedProof.set(matched);
    } catch (_e) {
      verifyError.set(true);
    } finally {
      isVerifying.set(false);
    }
  };

  return {
    address,
    proofs,
    verifiedProof,
    verifyError,
    isCreating,
    isVerifying,
    myProofsCount,
    loadProofs,
    createProof,
    verifyProofById,
  };
}
