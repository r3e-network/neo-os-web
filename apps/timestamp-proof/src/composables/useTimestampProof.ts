import { computed, ref } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
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
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => sanitizeProof(item as Partial<TimestampProof>))
      .filter((item) => item.id > 0 && item.contentHash.length > 0 && item.timestamp > 0)
      .sort((a, b) => b.id - a.id)
      .slice(0, MAX_PROOFS);
  } catch (_e: unknown) {
    return [];
  }
}

function writeStoredProofs(items: TimestampProof[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useTimestampProofContract(t: (key: string) => string) {
  const { address } = useWallet();

  const proofs = ref<TimestampProof[]>([]);
  const verifiedProof = ref<TimestampProof | null>(null);
  const verifyError = ref(false);
  const isCreating = ref(false);
  const isVerifying = ref(false);

  const currentActor = () => String(address.value || "local");

  const loadProofs = async () => {
    proofs.value = readStoredProofs();
  };

  const persistProofs = (items: TimestampProof[]) => {
    const next = items
      .map((item) => sanitizeProof(item))
      .filter((item) => item.id > 0 && item.contentHash.length > 0 && item.timestamp > 0)
      .sort((a, b) => b.id - a.id)
      .slice(0, MAX_PROOFS);
    proofs.value = next;
    writeStoredProofs(next);
  };

  const myProofsCount = computed(() => proofs.value.filter((item) => item.creator === currentActor()).length);

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
      isCreating.value = true;
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
      verifiedProof.value = proof;
      verifyError.value = false;
      setStatus(t("createSuccess"), "success");
      onSuccess();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isCreating.value = false;
    }
  };

  const verifyProofById = async (id: string) => {
    try {
      isVerifying.value = true;
      verifyError.value = false;
      verifiedProof.value = null;

      const proofId = Number(id);
      if (!Number.isInteger(proofId) || proofId <= 0) {
        verifyError.value = true;
        return;
      }

      const matched = readStoredProofs().find((item) => item.id === proofId) || null;
      if (!matched) {
        verifyError.value = true;
        return;
      }

      proofs.value = readStoredProofs();
      verifiedProof.value = matched;
    } catch (_e: unknown) {
      verifyError.value = true;
    } finally {
      isVerifying.value = false;
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
