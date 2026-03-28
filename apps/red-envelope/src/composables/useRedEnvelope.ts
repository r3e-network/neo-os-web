/**
 * useRedEnvelope — Unified domain composable for Red Envelope miniapp
 *
 * Replaces the legacy 4-file pattern:
 *   useRedEnvelopeCreation.ts + useRedEnvelopeOpen.ts + useNeoEligibility.ts + useEnvelopeActions.ts
 *
 * Uses PlatformServices (ChainService + EventBus) instead of:
 *   - useContractInteraction(hash) -> chain.read() / chain.invoke()
 *   - useStatusMessage() -> eventBus.emit()
 *   - useEvents() -> chain.listEvents() / chain.waitForEvent()
 *   - useWallet() -> chain.ensureWallet()
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { toFixed8, fromFixed8, formatHash } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

// ============================================================================
// Constants
// ============================================================================

const APP_ID = "miniapp-redenvelope";
const MIN_AMOUNT = 10000000n; // 0.1 GAS in fixed8
const MAX_PACKETS = 100;
const MIN_PER_PACKET = 1000000n; // 0.01 GAS in fixed8

// ============================================================================
// Types
// ============================================================================

export type EnvelopeType = "lucky";

export interface EnvelopeItem {
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
}

export interface ClaimItem {
  id: string;
  poolId: string;
  holder: string;
  amount: number;
  opened: boolean;
  message: string;
}

export interface UseRedEnvelopeOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Helpers
// ============================================================================

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// ============================================================================
// Composable
// ============================================================================

export function useRedEnvelope({ chain, eventBus, t }: UseRedEnvelopeOptions) {
  // ── State ────────────────────────────────────────────────────────────
  const envelopes = ref<EnvelopeItem[]>([]);
  const claims = ref<ClaimItem[]>([]);
  const pools = ref<EnvelopeItem[]>([]);
  const loadingEnvelopes = ref(false);
  const isLoading = ref(false);

  // Opening state
  const luckyMessage = ref<{ amount: number; from: string } | null>(null);
  const openingId = ref<string | null>(null);
  const showOpeningModal = ref(false);
  const openingEnvelope = ref<EnvelopeItem | null>(null);

  // Eligibility state
  const isEligible = ref(false);
  const neoBalance = ref(0);
  const holdingDays = ref(0);
  const eligibilityReason = ref("");
  const checkingEligibility = ref(false);

  // ── Computed ─────────────────────────────────────────────────────────
  const envelopeCount = computed(() => envelopes.value.length);
  const claimCount = computed(() => claims.value.length);
  const poolCount = computed(() => pools.value.length);
  const isConnected = computed(() => Boolean(chain.address.value));
  const isOpening = computed(() => Boolean(openingId.value));

  // ── Preview Distribution (pure computation) ─────────────────────────

  const generatePreviewSeed = (totalAmount: string, packetCount: string): Uint8Array => {
    const data = `preview:${totalAmount}:${packetCount}:${Date.now()}`;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    const hash = new Uint8Array(32);
    for (let i = 0; i < bytes.length; i++) {
      hash[i % 32] ^= bytes[i];
    }
    return hash;
  };

  const getRandFromSeed = (seed: Uint8Array, index: number): bigint => {
    const combined = new Uint8Array(seed.length + 4);
    combined.set(seed);
    combined[seed.length] = index & 0xff;
    combined[seed.length + 1] = (index >> 8) & 0xff;
    combined[seed.length + 2] = (index >> 16) & 0xff;
    combined[seed.length + 3] = (index >> 24) & 0xff;

    let hash = 0n;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash * 31n + BigInt(combined[i])) % 2n ** 256n;
    }
    return hash < 0n ? -hash : hash;
  };

  const previewDistribution = (totalAmountGas: number, packetCount: number): bigint[] => {
    if (packetCount <= 0 || packetCount > MAX_PACKETS) return [];

    const totalAmount = BigInt(toFixed8(totalAmountGas));
    if (totalAmount < BigInt(packetCount) * MIN_PER_PACKET) return [];

    const seed = generatePreviewSeed(totalAmountGas.toString(), packetCount.toString());
    const amounts: bigint[] = [];
    let remaining = totalAmount;

    for (let i = 0; i < packetCount - 1; i++) {
      const packetsLeft = BigInt(packetCount - i);
      const maxForThis = remaining - (packetsLeft - 1n) * MIN_PER_PACKET;

      const randValue = getRandFromSeed(seed, i);
      const range = maxForThis - MIN_PER_PACKET;
      let amount = MIN_PER_PACKET;

      if (range > 0n) {
        amount = MIN_PER_PACKET + (randValue % range);
      }

      amounts.push(amount);
      remaining -= amount;
    }

    amounts.push(remaining);
    return amounts;
  };

  // ── Envelope Mapping ────────────────────────────────────────────────

  const mapEnvelope = async (envelopeId: string): Promise<EnvelopeItem | null> => {
    const decoded = asArray(
      await chain.read("getEnvelope", [{ type: "Integer", value: envelopeId }]),
    );
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

    const claimedByMe = chain.address.value
      ? Boolean(
          await chain.read("hasClaimed", [
            { type: "Integer", value: envelopeId },
            { type: "Hash160", value: chain.address.value },
          ]),
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
      bestLuckAddress:
        bestLuckAddress && bestLuckAddress !== "0x0000000000000000000000000000000000000000"
          ? bestLuckAddress
          : "",
      bestLuckAmount: bestLuckAmountRaw > 0 ? bestLuckAmountRaw : 0,
      message: "",
      expiryTime,
      parentEnvelopeId: "",
    };
  };

  // ── Data Loading ────────────────────────────────────────────────────

  const loadEnvelopes = async () => {
    loadingEnvelopes.value = true;
    try {
      const createdEvents = await chain.listEvents("EnvelopeCreated", { limit: 120 });

      const seen = new Set<string>();
      const rows = await Promise.all(
        (createdEvents as { state?: unknown[]; tx_hash?: string }[]).map(
          async (evt) => {
            const values = Array.isArray(evt?.state)
              ? (evt.state as unknown[]).map(parseStackItem)
              : [];
            const envelopeId = String(values[0] ?? "");
            if (!envelopeId || seen.has(envelopeId)) return null;
            seen.add(envelopeId);
            return mapEnvelope(envelopeId);
          },
        ),
      );

      const allEnvelopes = (rows.filter(Boolean) as EnvelopeItem[]).sort(
        (a, b) => Number(b.id) - Number(a.id),
      );
      envelopes.value = allEnvelopes;
      pools.value = allEnvelopes.filter((item) => item.active && item.canOpen);

      // Load claims for current user
      const currentAddress = String(chain.address.value || "");
      if (!currentAddress) {
        claims.value = [];
      } else {
        const claimEvents = await chain.listEvents("EnvelopeClaimed", { limit: 120 });
        claims.value = (claimEvents as { state?: unknown[]; tx_hash?: string }[])
          .map((evt) => {
            const values = Array.isArray(evt?.state)
              ? (evt.state as unknown[]).map(parseStackItem)
              : [];
            const holder = String(values[1] ?? "");
            if (holder !== currentAddress) return null;
            return {
              id: `${String(values[0] ?? "")}:${String(evt.tx_hash || "")}`,
              poolId: String(values[0] ?? ""),
              holder,
              amount: fromFixed8(Number(values[2] ?? 0)),
              opened: true,
              message: "",
            } as ClaimItem;
          })
          .filter(Boolean) as ClaimItem[];
      }
    } finally {
      loadingEnvelopes.value = false;
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────

  const handleConnect = async () => {
    try {
      await chain.ensureWallet();
    } catch (e) {
      console.warn(
        "[red-envelope] handleConnect wallet error:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  const create = async (formData: {
    amount: string;
    count: string;
    expiryHours: string;
  }) => {
    if (isLoading.value) return;

    isLoading.value = true;
    try {
      await chain.ensureWallet();
      if (!chain.address.value) throw new Error(t("connectWallet"));

      const totalValue = Number(formData.amount);
      const packetCount = Number(formData.count);
      const expiryValue = Number(formData.expiryHours);

      if (!Number.isFinite(totalValue) || totalValue < 0.1) throw new Error(t("invalidAmount"));
      if (!Number.isFinite(packetCount) || packetCount < 1 || packetCount > 100)
        throw new Error(t("invalidPackets"));
      if (totalValue < packetCount * 0.01) throw new Error(t("invalidPerPacket"));
      if (!Number.isFinite(expiryValue) || expiryValue <= 0) throw new Error(t("invalidExpiry"));

      // Step 1: Transfer GAS to the contract
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: chain.address.value },
          { type: "Hash160", value: chain.contractAddress.value as string },
          { type: "Integer", value: toFixed8(formData.amount) },
          { type: "String", value: `${APP_ID}:create` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      // Give the GAS credit transfer a short head start
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Step 2: Create the envelope
      const result = await chain.invoke(
        "createEnvelope",
        [
          { type: "Hash160", value: chain.address.value },
          { type: "Integer", value: toFixed8(formData.amount) },
          { type: "Integer", value: String(packetCount) },
          { type: "Integer", value: String(Math.round(expiryValue * 3600)) },
        ],
        { waitForEvent: "EnvelopeCreated", waitTimeoutMs: 45000 },
      );

      if (result.success) {
        eventBus.emit("envelope:created", { action: t("envelopeSent") });
      }

      await loadEnvelopes();
    } catch (e) {
      eventBus.emit("envelope:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  const claimEnvelope = async (envelopeId: string): Promise<{ txid: string }> => {
    await chain.ensureWallet();
    if (!chain.address.value) throw new Error(t("connectWallet"));

    const result = await chain.invoke("claim", [
      { type: "Integer", value: envelopeId },
      { type: "Hash160", value: chain.address.value },
    ]);
    return { txid: result.txid };
  };

  const openEnvelope = async (envelope: EnvelopeItem) => {
    if (openingId.value) return;

    try {
      await chain.ensureWallet();
      if (!chain.address.value) throw new Error(t("connectWallet"));

      openingId.value = envelope.id;

      const result = await claimEnvelope(envelope.id);

      // Wait for the claim event
      const claimEvt = result.txid
        ? await chain.waitForEvent(result.txid, "EnvelopeClaimed", 45000)
        : null;

      if (claimEvt) {
        const evtRecord = claimEvt as { state?: unknown[] };
        const values = Array.isArray(evtRecord?.state)
          ? evtRecord.state.map(parseStackItem)
          : [];
        luckyMessage.value = {
          amount: Number(fromFixed8(Number(values[2] ?? 0)).toFixed(4)),
          from: envelope.from,
        };
      }

      showOpeningModal.value = false;
      openingEnvelope.value = null;
      eventBus.emit("envelope:opened", { action: t("openedFrom", { sender: envelope.from }) });
      await loadEnvelopes();
    } catch (e) {
      eventBus.emit("envelope:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      openingId.value = null;
    }
  };

  const openFromList = (envelope: EnvelopeItem) => {
    openingEnvelope.value = envelope;
    showOpeningModal.value = true;
  };

  const handleClaimFromPool = async (envelopeId: string) => {
    try {
      await chain.ensureWallet();
      const result = await claimEnvelope(envelopeId);

      const claimEvt = result.txid
        ? await chain.waitForEvent(result.txid, "EnvelopeClaimed", 45000)
        : null;

      if (claimEvt) {
        const evtRecord = claimEvt as { state?: unknown[] };
        const values = Array.isArray(evtRecord?.state)
          ? evtRecord.state.map(parseStackItem)
          : [];
        luckyMessage.value = {
          amount: Number(fromFixed8(Number(values[2] ?? 0)).toFixed(4)),
          from: `#${envelopeId}`,
        };
      }

      eventBus.emit("envelope:claimed", { action: t("claimSuccess") });
      await loadEnvelopes();
    } catch (e) {
      eventBus.emit("envelope:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    }
  };

  // ── NEO Eligibility ─────────────────────────────────────────────────

  const checkEligibility = async (envelopeId: string): Promise<boolean> => {
    if (!chain.address.value) {
      isEligible.value = false;
      eligibilityReason.value = t("walletNotConnected");
      return false;
    }

    checkingEligibility.value = true;
    try {
      const data = (await chain.read("checkEligibility", [
        { type: "Integer", value: envelopeId },
        { type: "Hash160", value: chain.address.value },
      ])) as Record<string, unknown> | null;

      if (!data) {
        isEligible.value = false;
        eligibilityReason.value = t("eligibilityCheckFailed");
        return false;
      }

      isEligible.value = Boolean(data.eligible);
      neoBalance.value = Number(data.neoBalance ?? 0);
      holdingDays.value = Number(data.holdDays ?? 0);
      eligibilityReason.value = String(data.reason ?? "");
      return isEligible.value;
    } catch (_e) {
      isEligible.value = false;
      eligibilityReason.value = t("checkFailed");
      return false;
    } finally {
      checkingEligibility.value = false;
    }
  };

  const checkNeoBalance = async (): Promise<number> => {
    if (!chain.address.value) return 0;
    try {
      const balance = Number(
        (await chain.read(
          "balanceOf",
          [{ type: "Hash160", value: chain.address.value }],
          { scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH },
        )) ?? 0,
      );
      neoBalance.value = balance;
      return balance;
    } catch (_e) {
      return 0;
    }
  };

  // ── Load All ────────────────────────────────────────────────────────

  const loadAll = async () => {
    await loadEnvelopes();
  };

  return {
    // State
    envelopes,
    claims,
    pools,
    loadingEnvelopes,
    isLoading,
    luckyMessage,
    openingId,
    showOpeningModal,
    openingEnvelope,

    // Eligibility
    isEligible,
    neoBalance,
    holdingDays,
    eligibilityReason,
    checkingEligibility,

    // Computed
    envelopeCount,
    claimCount,
    poolCount,
    isConnected,
    isOpening,

    // Preview
    previewDistribution,
    MIN_AMOUNT,
    MAX_PACKETS,
    MIN_PER_PACKET,

    // Actions
    handleConnect,
    create,
    openEnvelope,
    openFromList,
    handleClaimFromPool,
    claimEnvelope,
    checkEligibility,
    checkNeoBalance,

    // Lifecycle
    loadAll,
    loadEnvelopes,
  };
}

export type UseRedEnvelopeReturn = ReturnType<typeof useRedEnvelope>;
