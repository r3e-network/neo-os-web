/**
 * useRedEnvelope — Domain logic for the Red Envelope miniapp
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (GameProxy, PaymentProxy, StorageProxy, BadgeProxy) via edge
 * functions, so this file contains zero contract hashes, parameter encoding,
 * or event parsing logic.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.read("getEnvelope", [{ type: "Integer", value: id }])
 *     chain.read("hasClaimed", [...])
 *     chain.listEvents("EnvelopeCreated", { limit: 120 })
 *     chain.listEvents("EnvelopeClaimed", { limit: 120 })
 *     chain.invoke("transfer", [...], { scriptHash: GAS_HASH })
 *     chain.invoke("createEnvelope", [...])
 *     chain.invoke("claim", [...])
 *     chain.read("checkEligibility", [...])
 *     chain.read("balanceOf", [...], { scriptHash: NEO_HASH })
 *     chain.ensureWallet()
 *     eventBus.emit("envelope:created", ...)
 *
 *   AFTER (OS proxy):
 *     storageService.get("envelope:<id>")
 *     storageService.get("claimed:<envelopeId>:<user>")
 *     storageService.list("envelopes:", 120)
 *     storageService.list("claims:", 120)
 *     paymentService.deposit(amount, memo)
 *     gameService.createPool(config)
 *     gameService.placeBet(poolId, "1")
 *     storageService.get("eligibility:<envelopeId>")
 *     paymentService.getBalance()
 *     badgeService.award(badgeId, user)
 *
 * The composable still owns:
 *   - Reactive state (refs + computed) for manifest bindings
 *   - Preview distribution (pure frontend math)
 *   - Loading/opening UI flags
 *   - Formatted display values
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { GameProxy } from "@shared/services/os/GameProxy";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { toFixed8, fromFixed8, formatHash } from "@shared/utils/format";

// ============================================================================
// Constants
// ============================================================================

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
  /** OS GameProxy instance from ctx.os.game */
  gameService: GameProxy;
  /** OS PaymentProxy instance from ctx.os.payment */
  paymentService: PaymentProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Shape of an envelope record returned by StorageProxy. */
interface StoredEnvelope {
  id: string;
  creator: string;
  totalAmount: number;
  packetCount: number;
  openedCount: number;
  remainingAmount: number;
  bestLuckAddress?: string;
  bestLuckAmount?: number;
  ready: boolean;
  expiryTime: number;
  claimedByCurrentUser?: boolean;
}

/** Shape of a claim record returned by StorageProxy. */
interface StoredClaim {
  envelopeId: string;
  holder: string;
  amount: number;
  txHash?: string;
}

// ============================================================================
// Composable
// ============================================================================

export function useRedEnvelope({
  gameService,
  paymentService,
  storageService,
  badgeService,
  t,
}: UseRedEnvelopeOptions) {
  // ── State ────────────────────────────────────────────────────────────
  const envelopes = createObservable<EnvelopeItem[]>([]);
  const claims = createObservable<ClaimItem[]>([]);
  const pools = createObservable<EnvelopeItem[]>([]);
  const loadingEnvelopes = createObservable(false);
  const isLoading = createObservable(false);

  // Opening state
  const luckyMessage = createObservable<{ amount: number; from: string } | null>(null);
  const openingId = createObservable<string | null>(null);
  const showOpeningModal = createObservable(false);
  const openingEnvelope = createObservable<EnvelopeItem | null>(null);

  // Eligibility state
  const isEligible = createObservable(false);
  const neoBalance = createObservable(0);
  const holdingDays = createObservable(0);
  const eligibilityReason = createObservable("");
  const checkingEligibility = createObservable(false);

  // ── Computed ─────────────────────────────────────────────────────────
  const envelopeCount = createDerived(() => envelopes.get().length, []);
  const claimCount = createDerived(() => claims.get().length, []);
  const poolCount = createDerived(() => pools.get().length, []);
  const isConnected = createDerived(() => true, []); // OS services handle auth
  const isOpening = createDerived(() => Boolean(openingId.get()), []);

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

  // ── Envelope Mapping (from StorageProxy data) ──────────────────────

  /**
   * Map a stored envelope record into the EnvelopeItem shape used by the UI.
   * The edge function behind StorageProxy handles contract reads and returns
   * normalized envelope data, so no contract hashes or parameter encoding here.
   */
  const mapStoredEnvelope = (data: StoredEnvelope): EnvelopeItem => {
    const creator = String(data.creator ?? "");
    const totalAmountRaw = Number(data.totalAmount ?? 0);
    const packetCount = Number(data.packetCount ?? 0);
    const openedCount = Number(data.openedCount ?? 0);
    const remainingAmountRaw = Number(data.remainingAmount ?? 0);
    const bestLuckAddress = String(data.bestLuckAddress ?? "");
    const bestLuckAmountRaw = Number(data.bestLuckAmount ?? 0);
    const ready = Boolean(data.ready);
    const expiryTime = Number(data.expiryTime ?? 0);
    const now = Math.floor(Date.now() / 1000);
    const expired = expiryTime > 0 && now > expiryTime;
    const depleted = openedCount >= packetCount || remainingAmountRaw <= 0;
    const claimedByMe = Boolean(data.claimedByCurrentUser);

    return {
      id: String(data.id),
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

  // ── Data Loading (via OS services) ─────────────────────────────────

  /**
   * Load all envelopes and claims via StorageProxy.
   * The edge function translates storage reads into the appropriate
   * contract queries and returns normalized data.
   */
  const loadEnvelopes = async () => {
    loadingEnvelopes.set(true);
    try {
      // Load all envelopes from storage
      const envelopeMap = await storageService.list("envelopes:", 120);

      const allEnvelopes: EnvelopeItem[] = [];
      if (envelopeMap && typeof envelopeMap === "object") {
        for (const [, value] of Object.entries(envelopeMap)) {
          const stored = value as StoredEnvelope;
          if (stored && stored.id) {
            allEnvelopes.push(mapStoredEnvelope(stored));
          }
        }
      }

      allEnvelopes.sort((a, b) => Number(b.id) - Number(a.id));
      envelopes.set(allEnvelopes);
      pools.set(allEnvelopes.filter((item) => item.active && item.canOpen));

      // Load claims for current user
      const claimMap = await storageService.list("claims:", 120);
      const claimItems: ClaimItem[] = [];

      if (claimMap && typeof claimMap === "object") {
        for (const [, value] of Object.entries(claimMap)) {
          const stored = value as StoredClaim;
          if (stored && stored.holder) {
            claimItems.push({
              id: `${stored.envelopeId}:${stored.txHash ?? ""}`,
              poolId: String(stored.envelopeId),
              holder: stored.holder,
              amount: fromFixed8(Number(stored.amount ?? 0)),
              opened: true,
              message: "",
            });
          }
        }
      }

      claims.set(claimItems);
    } catch (e) {
      console.warn("[useRedEnvelope] loadEnvelopes failed:", e instanceof Error ? e.message : String(e));
    } finally {
      loadingEnvelopes.set(false);
    }
  };

  // ── Actions (via OS services) ──────────────────────────────────────

  /**
   * Connect wallet — a no-op in the OS services pattern.
   * OS services handle auth transparently through the edge functions.
   * Kept for API compatibility with PlayArea action dispatch.
   */
  const handleConnect = async () => {
    // OS services handle wallet/auth transparently
  };

  /**
   * Create an envelope via PaymentProxy (deposit GAS) + GameProxy (create pool).
   *
   * The OS payment service handles wallet connection and GAS transfer.
   * The OS game service handles pool creation with random distribution.
   * Badge awarding (first envelope) is handled server-side by the edge
   * function, so we just fire-and-forget a badge hint.
   */
  const create = async (formData: {
    amount: string;
    count: string;
    expiryHours: string;
  }) => {
    if (isLoading.get()) return;

    isLoading.set(true);
    try {
      const totalValue = Number(formData.amount);
      const packetCount = Number(formData.count);
      const expiryValue = Number(formData.expiryHours);

      if (!Number.isFinite(totalValue) || totalValue < 0.1) throw new Error(t("invalidAmount"));
      if (!Number.isFinite(packetCount) || packetCount < 1 || packetCount > 100)
        throw new Error(t("invalidPackets"));
      if (totalValue < packetCount * 0.01) throw new Error(t("invalidPerPacket"));
      if (!Number.isFinite(expiryValue) || expiryValue <= 0) throw new Error(t("invalidExpiry"));

      // Step 1: Deposit GAS via PaymentProxy
      await paymentService.deposit(
        formData.amount,
        `redenvelope:create:${packetCount}`,
      );

      // Step 2: Create envelope pool via GameProxy
      await gameService.createPool({
        poolType: 2, // lottery (random distribution)
        maxPlayers: packetCount,
        entryFee: "0",
        duration: Math.round(expiryValue * 3600),
      });

      // Step 3: Hint badge service about first-envelope achievement (fire-and-forget)
      badgeService.award("first-envelope", "").catch(() => {});

      await loadEnvelopes();
    } catch (e) {
      throw e;
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Claim an envelope via GameProxy (place bet = draw from pool).
   *
   * The OS game service handles the claim contract call.
   * The edge function returns the claim result including the random amount.
   */
  const claimEnvelope = async (envelopeId: string): Promise<{ amount: number }> => {
    // placeBet with "1" means "claim one packet from this envelope pool"
    await gameService.placeBet(envelopeId, "1");

    // Read the claim result from storage (set by the edge function post-claim)
    const result = await storageService.get(`claimResult:${envelopeId}`);
    const claimData = result as { amount?: number } | null;
    return { amount: Number(claimData?.amount ?? 0) };
  };

  /**
   * Open an envelope — claims it and shows the lucky message overlay.
   */
  const openEnvelope = async (envelope: EnvelopeItem) => {
    if (openingId.get()) return;

    try {
      openingId.set(envelope.id);

      const result = await claimEnvelope(envelope.id);

      if (result.amount > 0) {
        luckyMessage.set({
          amount: Number(fromFixed8(result.amount).toFixed(4)),
          from: envelope.from,
        });
      }

      showOpeningModal.set(false);
      openingEnvelope.set(null);

      // Hint badge for lucky draw (fire-and-forget)
      badgeService.award("lucky-draw", "").catch(() => {});

      await loadEnvelopes();
    } catch (e) {
      throw e;
    } finally {
      openingId.set(null);
    }
  };

  const openFromList = (envelope: EnvelopeItem) => {
    openingEnvelope.set(envelope);
    showOpeningModal.set(true);
  };

  /**
   * Claim from a pool by envelope ID — same as openEnvelope but
   * without requiring the full EnvelopeItem object.
   */
  const handleClaimFromPool = async (envelopeId: string) => {
    try {
      const result = await claimEnvelope(envelopeId);

      if (result.amount > 0) {
        luckyMessage.set({
          amount: Number(fromFixed8(result.amount).toFixed(4)),
          from: `#${envelopeId}`,
        });
      }

      // Hint badge for pool claim (fire-and-forget)
      badgeService.award("pool-claimer", "").catch(() => {});

      await loadEnvelopes();
    } catch (e) {
      throw e;
    }
  };

  // ── NEO Eligibility (via OS services) ──────────────────────────────

  /**
   * Check eligibility for an envelope via StorageProxy.
   * The edge function reads the eligibility data from the contract.
   */
  const checkEligibility = async (envelopeId: string): Promise<boolean> => {
    checkingEligibility.set(true);
    try {
      const data = await storageService.get(`eligibility:${envelopeId}`) as Record<string, unknown> | null;

      if (!data) {
        isEligible.set(false);
        eligibilityReason.set(t("eligibilityCheckFailed"));
        return false;
      }

      isEligible.set(Boolean(data.eligible));
      neoBalance.set(Number(data.neoBalance ?? 0));
      holdingDays.set(Number(data.holdDays ?? 0));
      eligibilityReason.set(String(data.reason ?? ""));
      return isEligible.get();
    } catch (_e) {
      isEligible.set(false);
      eligibilityReason.set(t("checkFailed"));
      return false;
    } finally {
      checkingEligibility.set(false);
    }
  };

  /**
   * Check NEO balance via PaymentProxy.
   * The edge function reads the balance from the NEO token contract.
   */
  const checkNeoBalance = async (): Promise<number> => {
    try {
      const balance = Number(await paymentService.getBalance() ?? 0);
      neoBalance.set(balance);
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
