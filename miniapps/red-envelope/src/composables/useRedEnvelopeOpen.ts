import { ref } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "./useI18n";
import { fromFixed8, formatHash } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { pollForEvent } from "@shared/utils/errorHandling";

const APP_ID = "miniapp-redenvelope";

export type EnvelopeType = "spreading" | "lucky" | "claim";

export type EnvelopeItem = {
  id: string;
  type: EnvelopeType;
  creator: string;
  from: string;
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
  canOpen: boolean;
  currentHolder: string;
  message?: string;
  expiryTime?: number;
  parentEnvelopeId?: string;
};

export type ClaimItem = {
  id: string;
  poolId: string;
  holder: string;
  amount: number;
  opened: boolean;
  message: string;
};

export function useRedEnvelopeOpen() {
  const { t } = useI18n();
  const { address, connect, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
  const { list: listEvents } = useEvents();

  const envelopes = ref<EnvelopeItem[]>([]);
  const claims = ref<ClaimItem[]>([]);
  const pools = ref<EnvelopeItem[]>([]);
  const loadingEnvelopes = ref(false);
  const loadingClaims = ref(false);
  const loadingPools = ref(false);
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

  const parseEnvelopeData = (data: unknown): Record<string, unknown> | null => {
    if (!data || typeof data !== "object") return null;
    return data as Record<string, unknown>;
  };

  const mapEnvelopeType = (rawType: unknown): EnvelopeType => {
    const type = Number(rawType ?? 0);
    if (type === 1) return "lucky";
    if (type === 2) return "claim";
    return "spreading";
  };

  const fetchEnvelopeDetails = async (
    contract: string,
    envelopeId: string,
    eventData?: Record<string, unknown>
  ): Promise<EnvelopeItem | null> => {
    try {
      const res = await invokeRead({
        scriptHash: contract,
        operation: "getEnvelopeStateForFrontend",
        args: [{ type: "Integer", value: envelopeId }],
      });
      const parsed = parseEnvelopeData(parseInvokeResult(res));
      if (!parsed) return null;

      const packetCount = Number(parsed.packetCount ?? eventData?.packetCount ?? 0);
      const openedCount = Number(parsed.openedCount ?? parsed.claimedCount ?? 0);
      const remainingPackets = Math.max(0, packetCount - openedCount);
      const active = Boolean(parsed.active);
      const expiryTime = Number(parsed.expiryTime ?? 0);
      const now = Date.now() / 1000;
      const expired = expiryTime > 0 && now > expiryTime;
      const remainingAmountRaw = Number(parsed.remainingAmount ?? 0);
      const depleted = openedCount >= packetCount || remainingAmountRaw <= 0;
      const totalAmount = fromFixed8(Number(parsed.totalAmount ?? eventData?.totalAmount ?? 0));
      const creator = String(parsed.creator ?? eventData?.creator ?? "");
      const envelopeType = mapEnvelopeType(parsed.envelopeType ?? eventData?.envelopeType ?? 0);

      const canOpen =
        envelopeType === "spreading"
          ? active && !expired && !depleted
          : envelopeType === "claim"
            ? active && !expired && openedCount === 0 && remainingAmountRaw > 0
            : false;

      return {
        id: envelopeId,
        type: envelopeType,
        creator,
        from: formatHash(creator),
        totalAmount,
        packetCount,
        openedCount,
        remainingAmount: fromFixed8(remainingAmountRaw),
        remainingPackets,
        minNeoRequired: Number(parsed.minNeoRequired ?? 0),
        minHoldSeconds: Number(parsed.minHoldSeconds ?? 0),
        active,
        expired,
        depleted,
        canOpen,
        currentHolder: String(parsed.currentHolder ?? ""),
        message: String(parsed.message ?? ""),
        expiryTime,
        parentEnvelopeId: String(parsed.parentEnvelopeId ?? ""),
      };
    } catch (e: unknown) {
      /* non-critical: envelope details fetch */
      return null;
    }
  };

  const loadEnvelopes = async () => {
    if (!contractAddress.value) {
      contractAddress.value = await ensureContractAddress();
    }
    if (!contractAddress.value) return;

    loadingEnvelopes.value = true;
    loadingClaims.value = true;
    loadingPools.value = true;

    try {
      const res = await listEvents({
        app_id: APP_ID,
        event_name: "EnvelopeCreated",
        limit: 120,
      });

      const seen = new Set<string>();
      const list = await Promise.all(
        res.events.map(async (evt: unknown) => {
          const evtRecord = evt as unknown as Record<string, unknown>;
          const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
          const envelopeId = String(values[0] ?? "");
          if (!envelopeId || seen.has(envelopeId)) return null;
          seen.add(envelopeId);

          return fetchEnvelopeDetails(contractAddress.value!, envelopeId, {
            creator: String(values[1] ?? ""),
            totalAmount: Number(values[2] ?? 0),
            packetCount: Number(values[3] ?? 0),
            envelopeType: Number(values[4] ?? 0),
          });
        })
      );

      const allItems = (list.filter(Boolean) as EnvelopeItem[]).sort((a, b) => Number(b.id) - Number(a.id));

      envelopes.value = allItems.filter((item) => item.type !== "claim");
      pools.value = envelopes.value.filter(
        (item) => item.type === "lucky" && item.active && !item.expired && !item.depleted
      );

      const myAddress = String(address.value || "");
      claims.value = allItems
        .filter((item) => item.type === "claim")
        .filter((item) => !!myAddress && item.currentHolder === myAddress)
        .map((item) => ({
          id: item.id,
          poolId: String(item.parentEnvelopeId || ""),
          holder: item.currentHolder,
          amount: item.totalAmount,
          opened: item.openedCount > 0 || !item.active || item.remainingAmount <= 0,
          message: String(item.message || ""),
        }));
    } catch (e: unknown) {
      /* non-critical: envelope list load */
    } finally {
      loadingEnvelopes.value = false;
      loadingClaims.value = false;
      loadingPools.value = false;
    }
  };

  const parseClaimData = (data: unknown): ClaimItem | null => {
    if (!data || typeof data !== "object") return null;
    const d = data as Record<string, unknown>;
    return {
      id: String(d.id ?? ""),
      poolId: String(d.poolId ?? ""),
      holder: String(d.holder ?? ""),
      amount: fromFixed8(Number(d.amount ?? 0)),
      opened: Boolean(d.opened),
      message: String(d.message ?? ""),
    };
  };

  const fetchClaimState = async (claimId: string): Promise<ClaimItem | null> => {
    try {
      const contract = await ensureContractAddress();
      const res = await invokeRead({
        scriptHash: contract,
        operation: "getClaimState",
        args: [{ type: "Integer", value: claimId }],
      });
      return parseClaimData(parseInvokeResult(res));
    } catch (e: unknown) {
      /* non-critical: claim state fetch */
      return null;
    }
  };

  const fetchPoolState = async (poolId: string): Promise<EnvelopeItem | null> => {
    try {
      const contract = await ensureContractAddress();
      return fetchEnvelopeDetails(contract, poolId);
    } catch (e: unknown) {
      /* non-critical: pool state fetch */
      return null;
    }
  };

  const claimFromPool = async (poolId: string): Promise<{ txid: string }> => {
    const contract = await ensureContractAddress();
    if (!address.value) throw new Error(t("connectWallet"));

    const tx = await invokeContract({
      scriptHash: contract,
      operation: "claimFromPool",
      args: [
        { type: "Integer", value: poolId },
        { type: "Hash160", value: address.value },
      ],
    });

    const result = tx as unknown as Record<string, unknown> | undefined;
    return { txid: String(result?.txid || result?.txHash || "") };
  };

  const openClaim = async (claimId: string): Promise<{ txid: string }> => {
    const contract = await ensureContractAddress();
    if (!address.value) throw new Error(t("connectWallet"));

    const tx = await invokeContract({
      scriptHash: contract,
      operation: "openClaim",
      args: [
        { type: "Integer", value: claimId },
        { type: "Hash160", value: address.value },
      ],
    });

    const result = tx as unknown as Record<string, unknown> | undefined;
    return { txid: String(result?.txid || result?.txHash || "") };
  };

  const transferClaim = async (claimId: string, to: string): Promise<{ txid: string }> => {
    const contract = await ensureContractAddress();
    if (!address.value) throw new Error(t("connectWallet"));

    const tx = await invokeContract({
      scriptHash: contract,
      operation: "transferClaim",
      args: [
        { type: "Integer", value: claimId },
        { type: "Hash160", value: address.value },
        { type: "Hash160", value: to },
      ],
    });

    const result = tx as unknown as Record<string, unknown> | undefined;
    return { txid: String(result?.txid || result?.txHash || "") };
  };

  const reclaimPool = async (poolId: string): Promise<{ txid: string }> => {
    const contract = await ensureContractAddress();
    if (!address.value) throw new Error(t("connectWallet"));

    const tx = await invokeContract({
      scriptHash: contract,
      operation: "reclaimPool",
      args: [
        { type: "Integer", value: poolId },
        { type: "Hash160", value: address.value },
      ],
    });

    const result = tx as unknown as Record<string, unknown> | undefined;
    return { txid: String(result?.txid || result?.txHash || "") };
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
    claims,
    pools,
    loadingClaims,
    loadingPools,
    claimFromPool,
    openClaim,
    transferClaim,
    reclaimPool,
    fetchPoolState,
    fetchClaimState,
  };
}
