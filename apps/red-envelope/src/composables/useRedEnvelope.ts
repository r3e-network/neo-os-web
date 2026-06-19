/**
 * useRedEnvelope — Domain logic for the Red Envelope miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppRedEnvelope)
 * via ctx.services.chain. The earlier path routed create/claim through the OS
 * game/payment/storage/badge kernel proxies, which never actually distributed
 * packets — envelopes funded GAS that was never paid out to claimers. This
 * composable now drives the dedicated contract, which splits a funded GAS total
 * into N random packets and PAYS each claimer ATOMICALLY in the same tx (no
 * oracle, no pending settle state).
 *
 * Contract interaction model (verified against MiniAppRedEnvelope.cs / ABI):
 *
 *   READS (chain.read / chain.readArray, default app contract script hash):
 *     lastEnvelopeId()                          -> Integer (envs are ids 1..last)
 *     getEnvelope(envId)                        -> Map{id,creator,totalAmount,
 *                                                  remainingAmount,packetCount,
 *                                                  openedCount,expiryTime(ms),
 *                                                  bestLuckAddress,bestLuckAmount,
 *                                                  active}
 *     hasClaimed(envId, claimer)                -> Boolean
 *     claimedAmount(envId, claimer)             -> Integer (share, base units)
 *     creditOf(account)                         -> Integer (prepaid credit, base units)
 *     creatorEnvelopeCount(creator)             -> Integer
 *     getCreatorEnvelopes(creator, off, limit)  -> Integer[] (env ids)
 *     claimerEnvelopeCount(claimer)             -> Integer
 *     getClaimerEnvelopes(claimer, off, limit)  -> Integer[] (env ids)
 *
 *   MUTATIONS (chain.invoke):
 *     1. DEPOSIT (fund a create) — a GAS transfer to the contract with the memo
 *        "miniapp-redenvelope:create" so OnNEP17Payment credits the sender's
 *        prepaid balance:
 *          transfer(from, CONTRACT, totalBaseUnits, "miniapp-redenvelope:create")
 *          { scriptHash: GAS_HASH }
 *     2. createEnvelope(creator, totalAmount, packetCount, durationSeconds)
 *        -> envId. Consumes the prepaid credit, so the deposit MUST land first.
 *        If create fails after a successful deposit the credit simply remains on
 *        the contract as reusable prepaid credit for the next create — there is
 *        no refund call (and none is needed; funds are not lost).
 *     claim(envelopeId, claimer) -> share. Draws one random packet and pays the
 *        claimer atomically. One claim per address per envelope. The won amount
 *        is read from the "Claimed" event (state[2] = share), falling back to
 *        claimedAmount(envId, claimer).
 *     reclaim(envelopeId, creator) -> amount. After expiry, pays the unclaimed
 *        remainder of the creator's own envelope back to the creator's wallet
 *        ("Reclaimed" event, state[2] = amount).
 *     withdraw(account) -> credit. Pays the whole unused prepaid create-credit
 *        back to the wallet ("CreditWithdrawn" event, state[1] = amount).
 *
 * AMOUNT CONVENTION: the contract takes/returns BASE UNITS. GAS = human × 1e8.
 * getEnvelope.expiryTime is in MILLISECONDS (Runtime.Time units). Human GAS for
 * the UI = base / 1e8 (fromFixed8).
 *
 * The composable owns:
 *   - Reactive state (observables + derived) for manifest/PlayArea bindings
 *   - Preview distribution (pure frontend math, unchanged)
 *   - Loading/creating/opening UI flags (double-submit guards)
 *   - Building the envelopes/pools/claims lists straight from chain
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { ChainService } from "@shared/services/ChainService";
import { gasToBaseUnits as toBaseUnits } from "@shared/utils/amounts";
import { eventValue } from "@shared/utils/chain-events";
import { fromFixed8, formatHash } from "@shared/utils/format";
import { addressToScriptHash, ownerMatchesAddress } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

// ============================================================================
// Constants
// ============================================================================

const MIN_AMOUNT = 10000000n; // 0.1 GAS in base units
const MAX_PACKETS = 100;
const MIN_PER_PACKET = 1000000n; // 0.01 GAS in base units

/** Memo the contract requires on the create-funding transfer. */
const CREATE_MEMO = "miniapp-redenvelope:create";

/**
 * How many of the NEWEST envelopes a full refresh pages in. Each envelope
 * costs two reads (getEnvelope + hasClaimed), so this bounds a refresh at
 * ~60 RPC reads instead of the former 200-id scan (~400 reads).
 */
const ENVELOPE_PAGE_SIZE = 30;

/** How many env ids to page in per role (creator/claimer) on a refresh. */
const LIST_PAGE_LIMIT = 100;

/** Upper bound on chain reads in flight at once during list refreshes. */
const MAX_CONCURRENT_READS = 8;

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
  /** The connected wallet created this envelope, it expired with a remainder. */
  reclaimable: boolean;
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
  /** Shared chain service from ctx.services.chain. */
  chain: ChainService;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Helpers
// ============================================================================

/** The zero script hash a fresh envelope carries for bestLuckAddress. */
const ZERO_HASH = "0x0000000000000000000000000000000000000000";

/** Coerce an unknown to a finite number, defaulting to 0. */
const toFinite = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Coerce a raw env-id list value (number/string/bigint) to a string id. */
const toIdString = (value: unknown): string => {
  try {
    const n = parseBigInt(value);
    return n > 0n ? n.toString() : "";
  } catch {
    return "";
  }
};

/**
 * Map items through an async fn with at most `limit` calls in flight —
 * the host bridge / RPC node must never see an unbounded Promise.all burst.
 * Result order matches the input order.
 */
const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await fn(items[index] as T);
      }
    },
  );
  await Promise.all(workers);
  return results;
};

// ============================================================================
// Composable
// ============================================================================

export function useRedEnvelope({ chain, t }: UseRedEnvelopeOptions) {
  // ── State ────────────────────────────────────────────────────────────
  const envelopes = createObservable<EnvelopeItem[]>([]);
  const claims = createObservable<ClaimItem[]>([]);
  const pools = createObservable<EnvelopeItem[]>([]);
  const loadingEnvelopes = createObservable(false);
  const isLoading = createObservable(false);
  /** Connected wallet's unused prepaid create-credit (human GAS). */
  const prepaidCredit = createObservable(0);
  /**
   * The id of the most recently created envelope, captured from the
   * EnvelopeCreated event, so the UI can surface a share affordance (copy a
   * deep link the recipient claims from). Empty until a create succeeds this
   * session; reset when a new create starts.
   */
  const lastCreatedEnvelopeId = createObservable<string>("");

  // Opening state
  const luckyMessage = createObservable<{ amount: number; from: string } | null>(null);
  const openingId = createObservable<string | null>(null);

  // Connected wallet address (synced from main.tsx / chain).
  const address = createObservable<string | null>(chain.address.get() ?? null);

  const setAddress = (addr: string | null) => {
    address.set(addr ?? null);
  };

  // ── Computed ─────────────────────────────────────────────────────────
  const envelopeCount = createDerived(() => envelopes.get().length, [envelopes]);
  const claimCount = createDerived(() => claims.get().length, [claims]);
  const poolCount = createDerived(() => pools.get().length, [pools]);
  const isConnected = createDerived(() => Boolean(address.get()), [address]);
  const isOpening = createDerived(() => Boolean(openingId.get()), [openingId]);
  const hasCredit = createDerived(() => prepaidCredit.get() > 0, [prepaidCredit]);

  // ── Preview Distribution (pure computation) ─────────────────────────

  const generatePreviewSeed = (totalAmount: string, packetCount: string): Uint8Array => {
    const data = `preview:${totalAmount}:${packetCount}:${Date.now()}`;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    const hash = new Uint8Array(32);
    for (let i = 0; i < bytes.length; i++) {
      const index = i % hash.length;
      hash[index] = (hash[index] ?? 0) ^ (bytes[i] ?? 0);
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
      hash = (hash * 31n + BigInt(combined[i] ?? 0)) % 2n ** 256n;
    }
    return hash < 0n ? -hash : hash;
  };

  const previewDistribution = (totalAmountGas: number, packetCount: number): bigint[] => {
    if (packetCount <= 0 || packetCount > MAX_PACKETS) return [];

    const totalAmount = toBaseUnits(String(totalAmountGas));
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

  // ── Envelope Mapping (from getEnvelope Map) ────────────────────────

  /**
   * Map a getEnvelope Map (returned by chain.read as a plain object) into the
   * EnvelopeItem shape used by the UI. Returns null for an unknown / empty
   * envelope (no creator key).
   *
   * Amount fields are contract BASE UNITS → human GAS via fromFixed8.
   * expiryTime is MILLISECONDS, compared directly against Date.now().
   * `claimedByMe` is the result of hasClaimed(envId, currentWallet); a null
   * wallet means the current viewer has not claimed (canOpen stays true so the
   * claim attempt can prompt a connect).
   * `reclaimable` marks the connected creator's OWN expired envelopes that
   * still hold a remainder (raw contract `active` flag, not the UI `ready`
   * rebadge) — the precondition for the contract's reclaim() call.
   */
  const mapEnvelope = (
    raw: unknown,
    id: string,
    claimedByMe: boolean,
  ): EnvelopeItem | null => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const v = raw as Record<string, unknown>;
    const creator = String(v.creator ?? "");
    if (!creator || creator === ZERO_HASH) return null;

    const totalAmountBase = parseBigInt(v.totalAmount);
    const remainingAmountBase = parseBigInt(v.remainingAmount);
    const packetCount = toFinite(v.packetCount);
    const openedCount = toFinite(v.openedCount);
    const expiryTimeMs = toFinite(v.expiryTime); // milliseconds
    const bestLuckAddress = String(v.bestLuckAddress ?? "");
    const bestLuckAmountBase = parseBigInt(v.bestLuckAmount);
    const active = Boolean(v.active);

    const now = Date.now();
    const expired = expiryTimeMs > 0 && now >= expiryTimeMs;
    const depleted = openedCount >= packetCount || remainingAmountBase <= 0n;
    const ready = active && !expired && !depleted;
    const reclaimable =
      active &&
      expired &&
      remainingAmountBase > 0n &&
      ownerMatchesAddress(creator, address.get());

    return {
      id,
      type: "lucky",
      creator,
      from: formatHash(creator),
      totalAmount: fromFixed8(totalAmountBase),
      packetCount,
      openedCount,
      remainingAmount: fromFixed8(remainingAmountBase),
      remainingPackets: Math.max(0, packetCount - openedCount),
      minNeoRequired: 0,
      minHoldSeconds: 0,
      active: ready,
      expired,
      depleted,
      canOpen: ready && !claimedByMe,
      reclaimable,
      currentHolder: creator,
      ready,
      bestLuckAddress:
        bestLuckAddress && bestLuckAddress !== ZERO_HASH ? bestLuckAddress : "",
      bestLuckAmount: bestLuckAmountBase > 0n ? fromFixed8(bestLuckAmountBase) : 0,
      message: "",
      expiryTime: expiryTimeMs,
      parentEnvelopeId: "",
    };
  };

  /** Read a single envelope + the viewer's claim status into an EnvelopeItem. */
  const readEnvelope = async (
    id: string,
    claimerHash: string | null,
  ): Promise<EnvelopeItem | null> => {
    const raw = await chain.read("getEnvelope", [
      { type: "Integer", value: id },
    ]);

    let claimedByMe = false;
    if (claimerHash) {
      try {
        const claimed = await chain.read("hasClaimed", [
          { type: "Integer", value: id },
          { type: "Hash160", value: claimerHash },
        ]);
        claimedByMe = Boolean(claimed);
      } catch {
        claimedByMe = false;
      }
    }

    return mapEnvelope(raw, id, claimedByMe);
  };

  // ── Data Loading (direct chain reads) ──────────────────────────────

  /**
   * Rebuild the envelopes/pools/claims lists straight from the contract.
   *
   * PAGED refresh: only the NEWEST ENVELOPE_PAGE_SIZE ids ending at
   * lastEnvelopeId() are read (via getEnvelope + hasClaimed, at most
   * MAX_CONCURRENT_READS in flight). Pools = the claimable subset
   * (active && canOpen). Claims for the connected wallet are resolved from
   * getClaimerEnvelopes + claimedAmount.
   */
  const loadEnvelopes = async () => {
    if (loadingEnvelopes.get()) return;
    loadingEnvelopes.set(true);
    try {
      const claimerAddr = address.get();
      const claimerHash = claimerAddr ? addressToScriptHash(claimerAddr) || null : null;

      const lastRaw = await chain.read("lastEnvelopeId", []);
      const last = toFinite(lastRaw);

      // Scan newest-first, one page, so a long history never reads more than
      // ENVELOPE_PAGE_SIZE envelopes per refresh.
      const start = Math.max(1, last - ENVELOPE_PAGE_SIZE + 1);
      const ids: string[] = [];
      for (let id = last; id >= start; id -= 1) ids.push(String(id));

      const results = await mapWithConcurrency(ids, MAX_CONCURRENT_READS, async (id) => {
        try {
          return await readEnvelope(id, claimerHash);
        } catch (e) {
          console.warn(
            "[useRedEnvelope] getEnvelope failed for",
            id,
            ":",
            e instanceof Error ? e.message : String(e),
          );
          return null;
        }
      });

      const allEnvelopes = results
        .filter((item): item is EnvelopeItem => item !== null)
        .sort((a, b) => Number(b.id) - Number(a.id));

      envelopes.set(allEnvelopes);
      pools.set(allEnvelopes.filter((item) => item.active && item.canOpen));

      // Claims for the connected wallet: the envelopes this address has claimed
      // from, each with the share it drew. The prepaid create-credit refreshes
      // alongside so the withdraw affordance stays honest after every action.
      if (claimerHash) {
        await Promise.all([loadClaims(claimerHash), loadCredit(claimerHash)]);
      } else {
        claims.set([]);
        prepaidCredit.set(0);
      }
    } catch (e) {
      console.warn(
        "[useRedEnvelope] loadEnvelopes failed:",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      loadingEnvelopes.set(false);
    }
  };

  /**
   * Load the connected wallet's claim history from getClaimerEnvelopes +
   * claimedAmount. Each entry is one drawn packet (share in base units).
   */
  const loadClaims = async (claimerHash: string) => {
    try {
      const idsRaw = await chain.readArray("getClaimerEnvelopes", [
        { type: "Hash160", value: claimerHash },
        { type: "Integer", value: "0" },
        { type: "Integer", value: String(LIST_PAGE_LIMIT) },
      ]);

      const ids = (Array.isArray(idsRaw) ? idsRaw : [])
        .map(toIdString)
        .filter((id) => id !== "");

      const items = await mapWithConcurrency(ids, MAX_CONCURRENT_READS, async (envelopeId) => {
        try {
          const shareRaw = await chain.read("claimedAmount", [
            { type: "Integer", value: envelopeId },
            { type: "Hash160", value: claimerHash },
          ]);
          const share = parseBigInt(shareRaw);
          const claim: ClaimItem = {
            id: `${envelopeId}:${claimerHash}`,
            poolId: envelopeId,
            holder: claimerHash,
            amount: fromFixed8(share),
            opened: true,
            message: "",
          };
          return claim;
        } catch (e) {
          console.warn(
            "[useRedEnvelope] claimedAmount failed for",
            envelopeId,
            ":",
            e instanceof Error ? e.message : String(e),
          );
          return null;
        }
      });

      claims.set(
        items
          .filter((item): item is ClaimItem => item !== null)
          .sort((a, b) => Number(b.poolId) - Number(a.poolId)),
      );
    } catch (e) {
      console.warn(
        "[useRedEnvelope] loadClaims failed:",
        e instanceof Error ? e.message : String(e),
      );
      claims.set([]);
    }
  };

  /**
   * Re-read ONE envelope and patch it into the envelopes/pools lists in
   * place — the cheap post-claim refresh (2 reads) instead of re-running the
   * whole paged loadEnvelopes. A read failure leaves the lists untouched
   * (the next full refresh reconciles).
   */
  const refreshEnvelope = async (envelopeId: string) => {
    try {
      const claimerAddr = address.get();
      const claimerHash = claimerAddr ? addressToScriptHash(claimerAddr) || null : null;
      const updated = await readEnvelope(envelopeId, claimerHash);
      if (!updated) return;

      const patched = envelopes
        .get()
        .map((item) => (item.id === envelopeId ? updated : item));
      // An envelope outside the current page (e.g. claimed via a stale link)
      // is not inserted — the list stays the newest page.
      envelopes.set(patched);
      pools.set(patched.filter((item) => item.active && item.canOpen));
    } catch (e) {
      console.warn(
        "[useRedEnvelope] refreshEnvelope failed for",
        envelopeId,
        ":",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  /**
   * Read ONE envelope and ensure it is present in the lists — used on the
   * deep-link / QR-claim launch, where the recipient arrives with an envelope
   * id but their own paged loadEnvelopes() would not contain (or not run for)
   * someone else's envelope. Unlike refreshEnvelope (which only patches an
   * already-listed entry), this INSERTS the launched envelope so the claim
   * preview (remaining packets, pool progress) renders before claiming.
   */
  const hydrateEnvelope = async (envelopeId: string) => {
    const id = String(envelopeId || "").trim();
    if (!id) return;
    try {
      const claimerAddr = address.get();
      const claimerHash = claimerAddr ? addressToScriptHash(claimerAddr) || null : null;
      const item = await readEnvelope(id, claimerHash);
      if (!item) return;
      const existing = envelopes.get();
      const next = existing.some((e) => e.id === id)
        ? existing.map((e) => (e.id === id ? item : e))
        : [item, ...existing];
      envelopes.set(next);
      pools.set(next.filter((e) => e.active && e.canOpen));
    } catch (e) {
      console.warn(
        "[useRedEnvelope] hydrateEnvelope failed for",
        id,
        ":",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  /**
   * Refresh the connected wallet's unused prepaid create-credit from
   * creditOf(account). Base units → human GAS. A read failure leaves the last
   * known value in place (the withdraw path re-reads before acting anyway).
   */
  const loadCredit = async (accountHash: string) => {
    try {
      const raw = await chain.read("creditOf", [
        { type: "Hash160", value: accountHash },
      ]);
      prepaidCredit.set(fromFixed8(parseBigInt(raw)));
    } catch (e) {
      console.warn(
        "[useRedEnvelope] creditOf failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  // ── Actions (direct chain invocations) ─────────────────────────────

  /**
   * Connect the wallet and reload. The chain service prompts the wallet on
   * demand; here we just ensure an address is on hand and refresh.
   */
  const handleConnect = async () => {
    const addr = address.get() || (await chain.ensureWallet());
    setAddress(addr ?? null);
    await loadEnvelopes();
  };

  /**
   * Create a red envelope against the standalone contract.
   *
   * Two steps, both signed by the creator:
   *   1. DEPOSIT — only when creditOf(creator) can't cover the total, transfer
   *      the SHORTFALL in GAS to the contract with the
   *      "miniapp-redenvelope:create" memo, crediting the creator's prepaid
   *      balance. The transfer waits for the contract's "Credited" event so
   *      the deposit is confirmed in a block before step 2 consumes it.
   *   2. createEnvelope(creator, total, packetCount, durationSeconds) — consumes
   *      that credit and opens the envelope.
   *
   * If step 1 succeeds but step 2 fails, the prepaid credit simply remains on
   * the contract under the creator and is reused on the next create (or
   * withdrawn via withdrawCredit). We surface a "funds prepaid, envelope not
   * created" message in that case.
   */
  const create = async (formData: {
    amount: string;
    count: string;
    expiryHours: string;
  }) => {
    if (isLoading.get()) return;

    isLoading.set(true);
    // Clear any prior share card so a fresh attempt never shows a stale id.
    lastCreatedEnvelopeId.set("");
    try {
      const totalValue = Number(formData.amount);
      const packetCount = Number(formData.count);
      const expiryValue = Number(formData.expiryHours);

      if (!Number.isFinite(totalValue) || totalValue < 0.1) throw new Error(t("invalidAmount"));
      if (!Number.isFinite(packetCount) || packetCount < 1 || packetCount > 100)
        throw new Error(t("invalidPackets"));
      if (totalValue < packetCount * 0.01) throw new Error(t("invalidPerPacket"));
      if (!Number.isFinite(expiryValue) || expiryValue <= 0) throw new Error(t("invalidExpiry"));

      const totalBase = toBaseUnits(formData.amount);
      if (totalBase < MIN_AMOUNT) throw new Error(t("invalidAmount"));
      // The contract requires total >= packetCount (one base unit per packet);
      // the per-packet >= 0.01 GAS guard above already implies this.
      if (totalBase < BigInt(packetCount)) throw new Error(t("invalidPerPacket"));

      const creatorAddr = address.get() || (await chain.ensureWallet());
      const creatorHash = addressToScriptHash(creatorAddr || "");
      if (!creatorAddr || !creatorHash) throw new Error(t("walletNotConnected"));
      setAddress(creatorAddr);

      const contractHash = chain.contractAddress.get();
      if (!contractHash) throw new Error(t("envelopeNotReady"));

      const durationSeconds = Math.round(expiryValue * 3600);

      // Step 1: DEPOSIT — top up only the SHORTFALL beyond any prepaid credit
      // left from a previous aborted create, so stale credit is consumed
      // instead of accumulating.
      let credit = 0n;
      try {
        credit = parseBigInt(
          await chain.read("creditOf", [{ type: "Hash160", value: creatorHash }]),
        );
      } catch {
        credit = 0n;
      }

      if (credit < totalBase) {
        // Wait for the contract's "Credited" event so the deposit is confirmed
        // in a block before createEnvelope consumes it — an unconfirmed deposit
        // lets the create execute first and fault on "insufficient deposit
        // credit" with the funds already in flight.
        await chain.invoke(
          "transfer",
          [
            { type: "Hash160", value: creatorHash },
            { type: "Hash160", value: contractHash },
            { type: "Integer", value: (totalBase - credit).toString() },
            { type: "String", value: CREATE_MEMO },
          ],
          { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH, waitForEvent: "Credited" },
        );
      }

      // Step 2: createEnvelope — consumes the prepaid credit and opens the
      // envelope. If this fails the credit persists on the contract under the
      // creator and is reusable on the next create (or withdrawable).
      try {
        const result = await chain.invoke(
          "createEnvelope",
          [
            { type: "Hash160", value: creatorHash },
            { type: "Integer", value: totalBase.toString() },
            { type: "Integer", value: String(Math.trunc(packetCount)) },
            { type: "Integer", value: String(durationSeconds) },
          ],
          { waitForEvent: "EnvelopeCreated" },
        );

        // OnEnvelopeCreated(envId, creator, total, packets, expiry) — envId is
        // state index 0. Capture it so the UI can show a share affordance (the
        // distribution journey the product is named for). When the event wait
        // times out the id stays empty and the share card is simply not shown.
        const envId = parseBigInt(eventValue(result.event, 0));
        lastCreatedEnvelopeId.set(envId > 0n ? envId.toString() : "");
      } catch (createErr) {
        console.error(
          "[useRedEnvelope] createEnvelope failed after deposit succeeded:",
          createErr instanceof Error ? createErr.message : String(createErr),
        );
        // Deposit landed, envelope did not — credit is held under the creator.
        throw new Error(t("depositPrepaidNoEnvelope"));
      }

      await loadEnvelopes();
    } catch (e) {
      throw e;
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Claim one packet from an envelope against the standalone contract.
   *
   * claim(envelopeId, claimer) draws a random share and pays the claimer
   * atomically in the same tx. The won share is read from the "Claimed" event
   * (state[2] = share), falling back to claimedAmount(envId, claimer). Guards
   * against a re-claim via hasClaimed before signing. Returns the share in human
   * GAS (already converted from base units).
   */
  const claimEnvelope = async (envelopeId: string): Promise<{ amount: number }> => {
    const id = String(envelopeId ?? "").trim();
    if (!id) throw new Error(t("envelopeIdRequired"));

    const claimerAddr = address.get() || (await chain.ensureWallet());
    const claimerHash = addressToScriptHash(claimerAddr || "");
    if (!claimerAddr || !claimerHash) throw new Error(t("walletNotConnected"));
    setAddress(claimerAddr);

    // Re-claim guard: one claim per address per envelope (the contract enforces
    // this too, but surface a clean message before prompting the wallet).
    try {
      const already = await chain.read("hasClaimed", [
        { type: "Integer", value: id },
        { type: "Hash160", value: claimerHash },
      ]);
      if (already) throw new Error(t("alreadyOpened"));
    } catch (e) {
      // A read failure must not block a legitimate claim; only the explicit
      // "already claimed" signal short-circuits.
      if (e instanceof Error && e.message === t("alreadyOpened")) throw e;
    }

    const result = await chain.invoke(
      "claim",
      [
        { type: "Integer", value: id },
        { type: "Hash160", value: claimerHash },
      ],
      { waitForEvent: "Claimed" },
    );

    // OnClaimed(id, claimer, share, remainingPackets) — share is state index 2.
    let shareBase = parseBigInt(eventValue(result.event, 2));
    if (shareBase <= 0n) {
      // Event unavailable / unparsed — read the recorded share back.
      try {
        shareBase = parseBigInt(
          await chain.read("claimedAmount", [
            { type: "Integer", value: id },
            { type: "Hash160", value: claimerHash },
          ]),
        );
      } catch {
        shareBase = 0n;
      }
    }

    return { amount: fromFixed8(shareBase) };
  };

  /**
   * Claim from a pool by envelope ID — claims it and shows the lucky-message
   * overlay. This is the live claim path the UI dispatches.
   *
   * Post-claim refresh is SURGICAL: only the claimed envelope is re-read and
   * patched into the lists, and the new claim is appended locally from the
   * known share — no full paged refresh (a claim cannot change any other
   * envelope, and the prepaid credit is untouched by claims).
   */
  const handleClaimFromPool = async (envelopeId: string) => {
    if (openingId.get()) return;

    try {
      openingId.set(envelopeId);
      const result = await claimEnvelope(envelopeId);

      if (result.amount > 0) {
        luckyMessage.set({
          amount: Number(result.amount.toFixed(4)),
          from: `#${envelopeId}`,
        });
      }

      // Patch the single claimed envelope instead of reloading everything.
      await refreshEnvelope(envelopeId);

      // Record the wallet's new claim locally (dedupe on re-entry).
      const claimerAddr = address.get();
      const claimerHash = claimerAddr ? addressToScriptHash(claimerAddr) || "" : "";
      if (claimerHash) {
        const claimId = `${envelopeId}:${claimerHash}`;
        if (!claims.get().some((item) => item.id === claimId)) {
          claims.set(
            [
              {
                id: claimId,
                poolId: envelopeId,
                holder: claimerHash,
                amount: result.amount,
                opened: true,
                message: "",
              },
              ...claims.get(),
            ].sort((a, b) => Number(b.poolId) - Number(a.poolId)),
          );
        }
      }
    } finally {
      openingId.set(null);
    }
  };

  /**
   * Reclaim the unclaimed remainder of the creator's OWN expired envelope via
   * reclaim(envelopeId, creator). The contract pays the remainder straight back
   * to the creator's wallet and deactivates the envelope. Returns the reclaimed
   * amount in human GAS (from the "Reclaimed" event, state[2] = amount, falling
   * back to the locally known remainder when the event wait times out).
   */
  const reclaimEnvelope = async (envelopeId: string): Promise<{ amount: number }> => {
    const id = String(envelopeId ?? "").trim();
    if (!id) throw new Error(t("envelopeIdRequired"));
    if (isLoading.get()) return { amount: 0 };

    isLoading.set(true);
    try {
      const creatorAddr = address.get() || (await chain.ensureWallet());
      const creatorHash = addressToScriptHash(creatorAddr || "");
      if (!creatorAddr || !creatorHash) throw new Error(t("walletNotConnected"));
      setAddress(creatorAddr);

      const result = await chain.invoke(
        "reclaim",
        [
          { type: "Integer", value: id },
          { type: "Hash160", value: creatorHash },
        ],
        { waitForEvent: "Reclaimed" },
      );

      // OnReclaimed(id, creator, amount) — amount is state index 2.
      const amountBase = parseBigInt(eventValue(result.event, 2));
      const local = envelopes.get().find((item) => item.id === id);
      const amount = amountBase > 0n ? fromFixed8(amountBase) : local?.remainingAmount ?? 0;

      await loadEnvelopes();
      return { amount };
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Withdraw the connected wallet's unused prepaid create-credit via
   * withdraw(account). The contract pays the WHOLE credit back to the wallet —
   * the recovery path when a deposit landed but createEnvelope never completed.
   * Returns the withdrawn amount in human GAS (from the "CreditWithdrawn"
   * event, state[1] = amount).
   */
  const withdrawCredit = async (): Promise<{ amount: number }> => {
    if (isLoading.get()) return { amount: 0 };

    isLoading.set(true);
    try {
      const accountAddr = address.get() || (await chain.ensureWallet());
      const accountHash = addressToScriptHash(accountAddr || "");
      if (!accountAddr || !accountHash) throw new Error(t("walletNotConnected"));
      setAddress(accountAddr);

      // Read the live credit first — the contract reverts "no credit" on an
      // empty balance, so surface a clean message before prompting the wallet.
      let credit = 0n;
      try {
        credit = parseBigInt(
          await chain.read("creditOf", [{ type: "Hash160", value: accountHash }]),
        );
      } catch {
        credit = 0n;
      }
      if (credit <= 0n) throw new Error(t("noCredit"));

      const result = await chain.invoke(
        "withdraw",
        [{ type: "Hash160", value: accountHash }],
        { waitForEvent: "CreditWithdrawn" },
      );

      // OnCreditWithdrawn(account, amount) — amount is state index 1.
      const amountBase = parseBigInt(eventValue(result.event, 1));
      const amount = amountBase > 0n ? fromFixed8(amountBase) : fromFixed8(credit);

      await loadEnvelopes();
      return { amount };
    } finally {
      isLoading.set(false);
    }
  };

  // ── Load All ────────────────────────────────────────────────────────

  const loadAll = async () => {
    setAddress(chain.address.get() ?? null);
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
    address,
    prepaidCredit,
    lastCreatedEnvelopeId,

    // Computed
    envelopeCount,
    claimCount,
    poolCount,
    isConnected,
    isOpening,
    hasCredit,

    // Preview
    previewDistribution,
    MIN_AMOUNT,
    MAX_PACKETS,
    MIN_PER_PACKET,

    // Actions
    setAddress,
    handleConnect,
    create,
    handleClaimFromPool,
    claimEnvelope,
    reclaimEnvelope,
    withdrawCredit,

    // Lifecycle
    loadAll,
    loadEnvelopes,
    hydrateEnvelope,
  };
}

export type UseRedEnvelopeReturn = ReturnType<typeof useRedEnvelope>;
