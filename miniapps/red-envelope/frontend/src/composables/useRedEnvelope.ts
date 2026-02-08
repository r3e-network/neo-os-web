import { ref } from "vue";
import { useWallet } from "./useWallet";
import { fromFixed8, toFixed8 } from "@/utils/format";
import { parseInvokeResult } from "@/utils/neo";

/** Replace with your deployed contract script hash */
export const CONTRACT_HASH = "0x0000000000000000000000000000000000000000";
export const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

export const MIN_AMOUNT = 10_000_000; // 0.1 GAS fixed8
export const MAX_PACKETS = 100;
export const MIN_PER_PACKET = 1_000_000; // 0.01 GAS fixed8

export type EnvelopeItem = {
  id: string;
  creator: string;
  totalAmount: number;
  packetCount: number;
  openedCount: number;
  remainingAmount: number;
  remainingPackets: number;
  minNeoRequired: number;
  minHoldSeconds: number;
  active: boolean;
  expired: boolean;
  depleted: boolean;
  currentHolder: string;
  message: string;
  expiryTime: number;
};

export function useRedEnvelope() {
  const { address, invoke, invokeRead } = useWallet();

  const isLoading = ref(false);
  const envelopes = ref<EnvelopeItem[]>([]);
  const loadingEnvelopes = ref(false);

  /** Create envelope by sending GAS to contract via OnNEP17Payment */
  const createEnvelope = async (params: {
    totalGas: number;
    packetCount: number;
    expiryHours: number;
    message: string;
    minNeo: number;
    minHoldDays: number;
  }): Promise<string> => {
    isLoading.value = true;
    try {
      const amount = toFixed8(params.totalGas);
      validate(amount, params.packetCount);

      const expirySeconds = params.expiryHours * 3600;
      const minHoldSeconds = params.minHoldDays * 86400;

      // Send GAS to contract with config data array
      const res = (await invoke({
        scriptHash: GAS_HASH,
        operation: "transfer",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Hash160", value: CONTRACT_HASH },
          { type: "Integer", value: String(amount) },
          {
            type: "Array",
            value: [
              { type: "Integer", value: String(params.packetCount) },
              { type: "Integer", value: String(expirySeconds) },
              { type: "String", value: params.message },
              { type: "Integer", value: String(params.minNeo) },
              { type: "Integer", value: String(minHoldSeconds) },
            ],
          },
        ],
      })) as { txid: string };

      return res.txid;
    } finally {
      isLoading.value = false;
    }
  };

  /** Open an envelope (caller must be NFT holder) */
  const openEnvelope = async (envelopeId: string): Promise<{ txid: string }> => {
    return (await invoke({
      scriptHash: CONTRACT_HASH,
      operation: "openEnvelope",
      args: [
        { type: "Integer", value: envelopeId },
        { type: "Hash160", value: address.value },
      ],
    })) as { txid: string };
  };

  /** Transfer envelope NFT to another address */
  const transferEnvelope = async (envelopeId: string, to: string): Promise<{ txid: string }> => {
    return (await invoke({
      scriptHash: CONTRACT_HASH,
      operation: "transferEnvelope",
      args: [
        { type: "Integer", value: envelopeId },
        { type: "Hash160", value: address.value },
        { type: "Hash160", value: to },
        { type: "Any", value: null },
      ],
    })) as { txid: string };
  };

  /** Reclaim expired envelope GAS */
  const reclaimEnvelope = async (envelopeId: string): Promise<{ txid: string }> => {
    return (await invoke({
      scriptHash: CONTRACT_HASH,
      operation: "reclaimEnvelope",
      args: [
        { type: "Integer", value: envelopeId },
        { type: "Hash160", value: address.value },
      ],
    })) as { txid: string };
  };

  /** Fetch single envelope state from contract */
  const fetchEnvelopeState = async (envelopeId: string): Promise<EnvelopeItem | null> => {
    try {
      const res = await invokeRead({
        scriptHash: CONTRACT_HASH,
        operation: "getEnvelopeState",
        args: [{ type: "Integer", value: envelopeId }],
      });
      const data = parseInvokeResult(res) as Record<string, unknown>;
      if (!data || !data.creator) return null;
      return mapEnvelopeData(envelopeId, data);
    } catch {
      return null;
    }
  };

  /** Load envelopes by scanning recent IDs */
  const loadEnvelopes = async () => {
    loadingEnvelopes.value = true;
    try {
      const countRes = await invokeRead({
        scriptHash: CONTRACT_HASH,
        operation: "getTotalEnvelopes",
        args: [],
      });
      const total = Number(parseInvokeResult(countRes) ?? 0);
      if (total === 0) {
        envelopes.value = [];
        return;
      }

      const start = Math.max(1, total - 24);
      const promises: Promise<EnvelopeItem | null>[] = [];
      for (let i = total; i >= start; i--) {
        promises.push(fetchEnvelopeState(String(i)));
      }
      const results = await Promise.all(promises);
      envelopes.value = results.filter(Boolean) as EnvelopeItem[];
    } catch {
      // silent
    } finally {
      loadingEnvelopes.value = false;
    }
  };

  return {
    isLoading,
    envelopes,
    loadingEnvelopes,
    createEnvelope,
    openEnvelope,
    transferEnvelope,
    reclaimEnvelope,
    fetchEnvelopeState,
    loadEnvelopes,
  };
}

function validate(amount: number, packets: number) {
  if (amount < MIN_AMOUNT) throw new Error("min 0.1 GAS");
  if (packets < 1 || packets > MAX_PACKETS) throw new Error("1-100 packets");
  if (amount < packets * MIN_PER_PACKET) throw new Error("min 0.01 GAS/packet");
}

function mapEnvelopeData(id: string, d: Record<string, unknown>): EnvelopeItem {
  const packetCount = Number(d.packetCount ?? 0);
  const openedCount = Number(d.openedCount ?? 0);
  const active = Boolean(d.active);
  const expiryTime = Number(d.expiryTime ?? 0);
  const currentTime = Number(d.currentTime ?? 0);
  const expired = !active || (expiryTime > 0 && currentTime > expiryTime);
  const depleted = openedCount >= packetCount;

  return {
    id,
    creator: String(d.creator ?? ""),
    totalAmount: fromFixed8(Number(d.totalAmount ?? 0)),
    packetCount,
    openedCount,
    remainingAmount: fromFixed8(Number(d.remainingAmount ?? 0)),
    remainingPackets: Math.max(0, packetCount - openedCount),
    minNeoRequired: Number(d.minNeoRequired ?? 0),
    minHoldSeconds: Number(d.minHoldSeconds ?? 0),
    active,
    expired,
    depleted,
    currentHolder: String(d.currentHolder ?? ""),
    message: String(d.message ?? ""),
    expiryTime,
  };
}
