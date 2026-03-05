import { ref, computed } from "vue";
import { useEvents } from "@neo/uniapp-sdk";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import { sha256Hex } from "@shared/utils/hash";
import { normalizeScriptHash, ownerMatchesAddress, parseStackItem } from "@shared/utils/neo";
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
  const { t } = createUseI18n(messages)();
  const {
    address,
    read,
    invoke,
    isProcessing: isLoading,
    ensureContractAddress,
  } = useContractInteraction({ appId: APP_ID, t });
  const { list: listEvents } = useEvents();

  const masks = ref<Mask[]>([]);
  const proposals = ref<Proposal[]>([]);
  const selectedMaskId = ref<string | null>(null);
  const { status, setStatus, clearStatus } = useStatusMessage();

  const identitySeed = ref("");
  const identityHash = ref("");
  const maskType = ref(1);
  const MASK_FEE = 0.1;

  const canCreateMask = computed(() => Boolean(identitySeed.value.trim()));

  const ownerMatches = (value: unknown) => ownerMatchesAddress(value, address.value);

  const loadMasks = async () => {
    if (!address.value) return;
    try {
      await ensureContractAddress();
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
          const parsed = await read("getMask", [{ type: "Integer", value: mask.id }]);
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

  const loadProposals = async () => {
    try {
      const parsed = await read("getActiveProposals");

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

  const createMask = async () => {
    if (!canCreateMask.value || isLoading.value) return false;
    clearStatus();

    try {
      const hash = identityHash.value || (await sha256Hex(identitySeed.value));

      await invoke(String(MASK_FEE), `mask:create:${hash.slice(0, 8)}`, "createMask", [
        { type: "Hash160", value: address.value as string },
        { type: "ByteArray", value: hash },
        { type: "Integer", value: String(maskType.value) },
      ]);

      setStatus(t("maskCreated"), "success");
      identitySeed.value = "";
      identityHash.value = "";
      await loadMasks();
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
