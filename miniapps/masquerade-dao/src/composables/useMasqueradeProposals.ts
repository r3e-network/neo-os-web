import { ref, computed } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { sha256Hex } from "@shared/utils/hash";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";

export interface Mask {
  id: string;
  identityHash: string;
  active: boolean;
  createdAt: string;
  maskType: number;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  status: "active" | "closed" | "pending";
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  endTime: string;
}

export function useMasqueradeProposals(APP_ID: string) {
  const { address, chainType, invokeRead, getContractAddress } = useWallet() as WalletSDK;
  const { list: listEvents } = useEvents();
  const { processPayment, isLoading } = usePaymentFlow(APP_ID);

  const masks = ref<Mask[]>([]);
  const proposals = ref<Proposal[]>([]);
  const selectedMaskId = ref<string | null>(null);
  const { status, setStatus, clearStatus } = useStatusMessage();

  const identitySeed = ref("");
  const identityHash = ref("");
  const maskType = ref(1);
  const MASK_FEE = 0.1;

  const canCreateMask = computed(() => Boolean(identitySeed.value.trim()));

  const ensureContractAddress = async () => {
    if (!requireNeoChain(chainType, (key: string) => key)) {
      throw new Error("Wrong chain");
    }
    const contract = await getContractAddress();
    if (!contract) throw new Error("Contract unavailable");
    return contract;
  };

  const ownerMatches = (value: unknown) => {
    if (!address.value) return false;
    const val = String(value || "");
    if (val === address.value) return true;
    const normalized = normalizeScriptHash(val);
    const addrHash = addressToScriptHash(address.value);
    return Boolean(normalized && addrHash && normalized === addrHash);
  };

  const loadMasks = async (_t: Function) => {
    if (!address.value) return;
    try {
      const contract = await ensureContractAddress();
      const events = await listEvents({ app_id: APP_ID, event_name: "MaskCreated", limit: 50 });

      const owned = events.events
        .map((evt) => {
          const evtRecord = evt as unknown as Record<string, unknown>;
          const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
          const id = String(values[0] ?? "");
          const owner = values[1];
          if (!id || !ownerMatches(owner)) return null;
          return { id, createdAt: evt.created_at };
        })
        .filter(Boolean) as { id: string; createdAt?: string }[];

      const details = await Promise.all(
        owned.map(async (mask) => {
          const res = await invokeRead({
            scriptHash: contract,
            operation: "getMask",
            args: [{ type: "Integer", value: mask.id }],
          });
          const parsed = parseInvokeResult(res);
          const values = Array.isArray(parsed) ? parsed : [];
          const owner = String(values[0] ?? "");
          const identity = String(values[1] ?? "");
          const maskType = Number(values[2] ?? 1);
          const createdAt = mask.createdAt ? new Date(mask.createdAt).toLocaleString() : "--";
          const active = Boolean(values[9]);

          if (!owner || /^0+$/.test(normalizeScriptHash(owner))) return null;

          return {
            id: mask.id,
            identityHash: identity,
            active,
            createdAt,
            maskType,
          };
        })
      );

      masks.value = details.filter(Boolean) as Mask[];
      if (!selectedMaskId.value && masks.value.length > 0) {
        selectedMaskId.value = masks.value[0].id;
      }
    } catch (_e: unknown) {
      // Proposals load failure is non-critical
    }
  };

  const loadProposals = async (t: Function) => {
    try {
      const contract = await ensureContractAddress();
      // Load active proposals from contract
      const res = await invokeRead({
        scriptHash: contract,
        operation: "getActiveProposals",
        args: [],
      });

      const parsed = parseInvokeResult(res);
      if (Array.isArray(parsed)) {
        proposals.value = parsed.map((p: Record<string, unknown>, idx: number) => ({
          id: String(p.id || idx + 1),
          title: String(p.title || t("proposal", { id: idx + 1 })),
          description: String(p.description || ""),
          status: String(p.status || "active") as "active" | "closed" | "pending",
          forVotes: Number(p.forVotes || 0),
          againstVotes: Number(p.againstVotes || 0),
          abstainVotes: Number(p.abstainVotes || 0),
          endTime: p.endTime ? new Date(Number(p.endTime)).toLocaleString() : "--",
        }));
      }
    } catch (_e: unknown) {
      // Proposal details load failure is non-critical
    }
  };

  const createMask = async (t: Function) => {
    if (!canCreateMask.value || isLoading.value) return false;
    clearStatus();

    try {
      const contract = await ensureContractAddress();
      const hash = identityHash.value || (await sha256Hex(identitySeed.value));
      const { receiptId, invoke } = await processPayment(String(MASK_FEE), `mask:create:${hash.slice(0, 8)}`);

      if (!receiptId) throw new Error(t("receiptMissing"));

      await invoke(
        "createMask",
        [
          { type: "Hash160", value: address.value as string },
          { type: "ByteArray", value: hash },
          { type: "Integer", value: String(maskType.value) },
          { type: "Integer", value: String(receiptId) },
        ],
        contract
      );

      setStatus(t("maskCreated"), "success");
      identitySeed.value = "";
      identityHash.value = "";
      await loadMasks(t);
      return true;
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
      return false;
    }
  };

  return {
    masks,
    proposals,
    selectedMaskId,
    identitySeed,
    identityHash,
    maskType,
    status,
    isLoading,
    canCreateMask,
    loadMasks,
    loadProposals,
    createMask,
  };
}
