import { ref, computed } from "vue";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { waitForEventByTransaction } from "@shared/utils";

const APP_ID = "miniapp-timestamp-proof";

export interface TimestampProof {
  id: number;
  content: string;
  contentHash: string;
  timestamp: number;
  creator: string;
  txHash: string;
}

export function useTimestampProofContract(t: (key: string) => string) {
  const { address, read, ensureContractAddress, contractAddress } = useContractInteraction({ appId: APP_ID, t });
  const { processPayment } = usePaymentFlow(APP_ID);

  const proofs = ref<TimestampProof[]>([]);
  const verifiedProof = ref<TimestampProof | null>(null);
  const verifyError = ref(false);
  const isCreating = ref(false);
  const isVerifying = ref(false);

  const myProofsCount = computed(() => {
    if (!address.value) return 0;
    return proofs.value.filter((p) => p.creator === address.value).length;
  });

  const parseProofItem = (item: Record<string, unknown>): TimestampProof => ({
    id: Number(item.id || 0),
    content: String(item.content || ""),
    contentHash: String(item.contentHash || ""),
    timestamp: Number(item.timestamp || 0) * 1000,
    creator: String(item.creator || ""),
    txHash: String(item.txHash || ""),
  });

  const loadProofs = async () => {
    try {
      await ensureContractAddress();
      const parsed = (await read("getProofs")) as unknown[];
      if (Array.isArray(parsed)) {
        proofs.value = parsed.map((p: unknown) => parseProofItem(p as Record<string, unknown>));
      }
    } catch (_e: unknown) {
      // Proof load failure handled silently
    }
  };

  const hashContent = async (content: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const createProof = async (
    content: string,
    setStatus: (msg: string, type: string) => void,
    onSuccess: () => void
  ) => {
    if (!address.value) {
      setStatus(t("wpTitle"), "error");
      return;
    }
    try {
      await ensureContractAddress();
    } catch {
      return;
    }

    try {
      isCreating.value = true;
      const hash = await hashContent(content);
      const { receiptId, invoke, waitForEvent } = await processPayment("0.5", `proof:${hash.slice(0, 16)}`);

      const tx = await invoke(
        "createProof",
        [
          { type: "String", value: content },
          { type: "String", value: hash },
          { type: "Integer", value: String(receiptId) },
        ],
        contractAddress.value as string
      );

      const proofEvent = await waitForEventByTransaction(tx, "ProofCreated", waitForEvent);
      if (proofEvent) {
        onSuccess();
        await loadProofs();
      }
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isCreating.value = false;
    }
  };

  const verifyProofById = async (id: string) => {
    try {
      await ensureContractAddress();
    } catch {
      return;
    }

    try {
      isVerifying.value = true;
      verifyError.value = false;
      verifiedProof.value = null;

      const parsed = await read("getProof", [{ type: "Integer", value: id }]);
      if (parsed) {
        verifiedProof.value = parseProofItem(parsed as Record<string, unknown>);
      } else {
        verifyError.value = true;
      }
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
    ensureContractAddress,
  };
}
