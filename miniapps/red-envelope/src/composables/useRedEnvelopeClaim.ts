import { ref } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "./useI18n";
import { fromFixed8, formatHash } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { pollForEvent } from "@shared/utils/errorHandling";

const APP_ID = "miniapp-redenvelope";

type EnvelopeItem = {
  id: string;
  creator: string;
  from: string;
  name?: string;
  description?: string;
  total: number;
  remaining: number;
  totalAmount: number;
  bestLuckAddress?: string;
  bestLuckAmount?: number;
  ready: boolean;
  expired: boolean;
  canClaim: boolean;
};

export function useRedEnvelopeClaim() {
  const { t } = useI18n();
  const { address, connect, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
  const { list: listEvents } = useEvents();

  const envelopes = ref<EnvelopeItem[]>([]);
  const loadingEnvelopes = ref(false);
  const contractAddress = ref<string | null>(null);

  const ensureContractAddress = async () => {
    if (!requireNeoChain(chainType, t)) {
      throw new Error(t("wrongChain"));
    }
    if (!contractAddress.value) {
      contractAddress.value = await getContractAddress();
    }
    if (!contractAddress.value) {
      throw new Error(t("contractUnavailable"));
    }
    return contractAddress.value;
  };

  const parseEnvelopeData = (data: unknown) => {
    if (!data) return null;
    if (Array.isArray(data)) {
      return {
        creator: String(data[0] ?? ""),
        totalAmount: Number(data[1] ?? 0),
        packetCount: Number(data[2] ?? 0),
        claimedCount: Number(data[3] ?? 0),
        remainingAmount: Number(data[4] ?? 0),
        bestLuckAddress: String(data[5] ?? ""),
        bestLuckAmount: Number(data[6] ?? 0),
        ready: Boolean(data[7]),
        expiryTime: Number(data[8] ?? 0),
      };
    }
    if (typeof data === "object") {
      return {
        creator: String((data as any).creator ?? ""),
        totalAmount: Number((data as any).totalAmount ?? 0),
        packetCount: Number((data as any).packetCount ?? 0),
        claimedCount: Number((data as any).claimedCount ?? 0),
        remainingAmount: Number((data as any).remainingAmount ?? 0),
        bestLuckAddress: String((data as any).bestLuckAddress ?? ""),
        bestLuckAmount: Number((data as any).bestLuckAmount ?? 0),
        ready: Boolean((data as any).ready ?? false),
        expiryTime: Number((data as any).expiryTime ?? 0),
      };
    }
    return null;
  };

  const fetchEnvelopeDetails = async (
    contract: string,
    envelopeId: string,
    eventData?: unknown,
  ): Promise<EnvelopeItem | null> => {
    try {
      const envRes = await invokeRead({
        scriptHash: contract,
        operation: "GetEnvelope",
        args: [{ type: "Integer", value: envelopeId }],
      });
      const parsed = parseEnvelopeData(parseInvokeResult(envRes));
      if (!parsed) return null;

      const packetCount = Number(parsed.packetCount || (eventData as any)?.packetCount || 0);
      const claimedCount = Number(parsed.claimedCount || 0);
      const remainingPackets = Math.max(0, packetCount - claimedCount);
      const ready = Boolean(parsed.ready);
      const expiryTime = Number(parsed.expiryTime || 0);
      const expired = expiryTime > 0 && Date.now() > expiryTime * 1000;
      const totalAmount = fromFixed8(parsed.totalAmount || (eventData as any)?.totalAmount || 0);
      const canClaim = ready && !expired && remainingPackets > 0;
      const creator = parsed.creator || (eventData as any)?.creator || "";

      return {
        id: envelopeId,
        creator,
        from: formatHash(creator),
        total: packetCount,
        remaining: remainingPackets,
        totalAmount,
        bestLuckAddress: parsed.bestLuckAddress || undefined,
        bestLuckAmount: parsed.bestLuckAmount || undefined,
        ready,
        expired,
        canClaim,
      };
    } catch {
      return null;
    }
  };

  const loadEnvelopes = async () => {
    if (!contractAddress.value) {
      contractAddress.value = await ensureContractAddress();
    }
    if (!contractAddress.value) return;
    loadingEnvelopes.value = true;
    try {
      const res = await listEvents({ app_id: APP_ID, event_name: "EnvelopeCreated", limit: 25 });
      const seen = new Set<string>();
      const list = await Promise.all(
        res.events.map(async (evt) => {
          const values = Array.isArray((evt as any)?.state) ? (evt as any).state.map(parseStackItem) : [];
          const envelopeId = String(values[0] ?? "");
          if (!envelopeId || seen.has(envelopeId)) return null;
          seen.add(envelopeId);

          return fetchEnvelopeDetails(contractAddress.value!, envelopeId, {
            creator: String(values[1] ?? ""),
            totalAmount: Number(values[2] ?? 0),
            packetCount: Number(values[3] ?? 0),
          });
        }),
      );
      envelopes.value = list.filter(Boolean).sort((a, b) => Number(b!.id) - Number(a!.id)) as EnvelopeItem[];
    } catch (e: unknown) {
      // Silent fail
    } finally {
      loadingEnvelopes.value = false;
    }
  };

  return {
    envelopes,
    loadingEnvelopes,
    contractAddress,
    ensureContractAddress,
    fetchEnvelopeDetails,
    loadEnvelopes,
    parseEnvelopeData,
    address,
    connect,
    invokeContract,
    invokeRead,
    listEvents,
    APP_ID,
    t,
    fromFixed8,
    parseStackItem,
    pollForEvent,
  };
}
