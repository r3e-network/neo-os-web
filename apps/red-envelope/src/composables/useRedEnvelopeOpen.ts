import { ref } from "vue";
import { useEvents } from "@shared/utils/wallet-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { fromFixed8, formatHash } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";

const APP_ID = "miniapp-redenvelope";

export type EnvelopeType = "lucky";

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
  ready: boolean;
  bestLuckAddress?: string;
  bestLuckAmount?: number;
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

type ContractArg = {
  type: string;
  value: string | number | boolean;
};

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function useRedEnvelopeOpen() {
  const { t } = createUseI18n(messages)();
  const { address, ensureWallet, ensureContractAddress, contractAddress, read, invokeDirectly } =
    useContractInteraction({ appId: APP_ID, t });
  const { list: listEvents } = useEvents();

  const envelopes = ref<EnvelopeItem[]>([]);
  const claims = ref<ClaimItem[]>([]);
  const pools = ref<EnvelopeItem[]>([]);
  const loadingEnvelopes = ref(false);
  const loadingClaims = ref(false);
  const loadingPools = ref(false);

  const mapEnvelope = async (contract: string, envelopeId: string): Promise<EnvelopeItem | null> => {
    const decoded = asArray(await read("getEnvelope", [{ type: "Integer", value: envelopeId }], contract));
    if (decoded.length < 9) return null;

    const creator = String(decoded[0] ?? "");
    if (!creator) return null;

    const totalAmountRaw = Number(decoded[1] ?? 0);
    const packetCount = Number(decoded[2] ?? 0);
    const openedCount = Number(decoded[3] ?? 0);
    const remainingAmountRaw = Number(decoded[4] ?? 0);
    const bestLuckAddress = String(decoded[5] ?? "");
    const bestLuckAmountRaw = Number(decoded[6] ?? 0);
    const ready = Boolean(decoded[7]);
    const expiryTime = Number(decoded[8] ?? 0);
    const now = Math.floor(Date.now() / 1000);
    const expired = expiryTime > 0 && now > expiryTime;
    const depleted = openedCount >= packetCount || remainingAmountRaw <= 0;

    const claimedByMe = address.value
      ? Boolean(
          await read(
            "hasClaimed",
            [
              { type: "Integer", value: envelopeId },
              { type: "Hash160", value: address.value },
            ],
            contract
          )
        )
      : false;

    return {
      id: envelopeId,
      type: "lucky",
      creator,
      from: formatHash(creator),
      totalAmount: fromFixed8(totalAmountRaw),
      packetCount,
      openedCount,
      remainingAmount: fromFixed8(remainingAmountRaw),
      remainingPackets: Math.max(0, packetCount - openedCount),
      minNeoRequired: 0,
      minHoldSeconds: 0,
      active: ready && !expired && !depleted,
      expired,
      depleted,
      canOpen: ready && !expired && !depleted && !claimedByMe,
      currentHolder: creator,
      ready,
      bestLuckAddress: bestLuckAddress && bestLuckAddress !== "0x0000000000000000000000000000000000000000" ? bestLuckAddress : "",
      bestLuckAmount: bestLuckAmountRaw > 0 ? bestLuckAmountRaw : 0,
      message: "",
      expiryTime,
      parentEnvelopeId: "",
    };
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
      const createdEvents = await listEvents({
        app_id: APP_ID,
        event_name: "EnvelopeCreated",
        limit: 120,
      });

      const seen = new Set<string>();
      const rows = await Promise.all(
        (createdEvents.events || []).map(async (evt: unknown) => {
          const values = Array.isArray((evt as Record<string, unknown>)?.state)
            ? ((evt as Record<string, unknown>).state as unknown[]).map(parseStackItem)
            : [];
          const envelopeId = String(values[0] ?? "");
          if (!envelopeId || seen.has(envelopeId)) return null;
          seen.add(envelopeId);
          return mapEnvelope(contractAddress.value!, envelopeId);
        })
      );

      const allEnvelopes = (rows.filter(Boolean) as EnvelopeItem[]).sort((a, b) => Number(b.id) - Number(a.id));
      envelopes.value = allEnvelopes;
      pools.value = allEnvelopes.filter((item) => item.active && item.canOpen);

      const currentAddress = String(address.value || "");
      if (!currentAddress) {
        claims.value = [];
      } else {
        const claimEvents = await listEvents({
          app_id: APP_ID,
          event_name: "EnvelopeClaimed",
          limit: 120,
        });

        claims.value = (claimEvents.events || [])
          .map((evt: unknown) => {
            const record = evt as Record<string, unknown>;
            const values = Array.isArray(record?.state) ? (record.state as unknown[]).map(parseStackItem) : [];
            const holder = String(values[1] ?? "");
            if (holder !== currentAddress) return null;
            return {
              id: `${String(values[0] ?? "")}:${String(record.tx_hash || "")}`,
              poolId: String(values[0] ?? ""),
              holder,
              amount: fromFixed8(Number(values[2] ?? 0)),
              opened: true,
              message: "",
            } satisfies ClaimItem;
          })
          .filter(Boolean) as ClaimItem[];
      }
    } finally {
      loadingEnvelopes.value = false;
      loadingClaims.value = false;
      loadingPools.value = false;
    }
  };

  const claimEnvelope = async (envelopeId: string): Promise<{ txid: string }> => {
    await ensureWallet();
    if (!address.value) throw new Error(t("connectWallet"));

    const result = await invokeDirectly("claim", [
      { type: "Integer", value: envelopeId },
      { type: "Hash160", value: address.value },
    ]);
    return { txid: result.txid };
  };

  const loadEnvelopeDetails = async (contract: string, envelopeId: string): Promise<EnvelopeItem | null> => {
    return mapEnvelope(contract, envelopeId);
  };

  const invokeEnvelopeAction = async (
    operation: string,
    buildArgs: (userAddress: string) => ContractArg[]
  ): Promise<{ txid: string }> => {
    await ensureWallet();
    if (!address.value) throw new Error(t("connectWallet"));

    const result = await invokeDirectly(operation, buildArgs(address.value));
    return { txid: result.txid };
  };

  return {
    address,
    ensureWallet,
    ensureContractAddress,
    contractAddress,
    envelopes,
    claims,
    pools,
    loadingEnvelopes,
    loadingClaims,
    loadingPools,
    loadEnvelopes,
    loadEnvelopeDetails,
    claimEnvelope,
    invokeEnvelopeAction,
  };
}
