/**
 * useRedEnvelope — Domain logic for the Red Envelope miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppRedEnvelope)
 * via the MiniApp framework chain layer (ctx.framework.chain). The earlier path
 * routed create/claim through the OS
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
 *        is read from the "Claimed" event (state[2] = share), or recovered only
 *        when hasClaimed + claimedAmount authoritatively prove settlement.
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
import type { MiniAppFramework } from "@shared/react";
import { gasToBaseUnits as toBaseUnits } from "@shared/utils/amounts";
import { eventValue } from "@shared/utils/chain-events";
import { fromFixed8, formatHash } from "@shared/utils/format";
import {
  addressToScriptHash,
  normalizeScriptHash,
  ownerMatchesAddress,
  parseHash160,
} from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import {
  createPendingRedEnvelopeOperation,
  createRedEnvelopeOperationStore,
  type PendingRedEnvelopeOperation,
  type RedEnvelopeOperationStorage,
  type RedEnvelopeOperationScope,
} from "../red-envelope-operation-store";
import {
  attestRedEnvelopeContract,
  normalizeRedEnvelopeId,
  normalizeRedEnvelopeNetwork,
  readRedEnvelopeExecutionState,
  type RedEnvelopeAttestation,
  type RedEnvelopeExecutionState,
  type RedEnvelopeNetwork,
} from "../red-envelope-rpc";

// ============================================================================
// Constants
// ============================================================================

const MIN_AMOUNT = 10000000n; // 0.1 GAS in base units
const MAX_AMOUNT = 20_00000000n; // 20 GAS; contract-enforced low-stakes ceiling
const MAX_PACKETS = 100;
const MIN_PER_PACKET = 1000000n; // 0.01 GAS in base units
const MIN_EXPIRY_HOURS = 1;
const MAX_EXPIRY_HOURS = 7 * 24;

/** Memo the contract requires on the create-funding transfer. */
const CREATE_MEMO = "miniapp-redenvelope:create";

/**
 * How many of the connected wallet's own creator/claimer envelopes a refresh
 * reads. Predictable global ids are not access control, so the app never
 * advertises a public "latest envelopes" pool; recipients arrive by a
 * network-bound shared link and hydrate that exact id.
 */
const ENVELOPE_PAGE_SIZE = 30;

/** How many env ids to page in per role (creator/claimer) on a refresh. */
const LIST_PAGE_LIMIT = 100;

/** Upper bound on chain reads in flight at once during list refreshes. */
const MAX_CONCURRENT_READS = 8;

/** A short exact-tx recheck after the invoke's normal confirmation wait. */
const EXACT_EVENT_RECHECK_MS = 2_500;

const compareNumericIdsDescending = (left: string, right: string): number => {
  const a = BigInt(left);
  const b = BigInt(right);
  return a === b ? 0 : a > b ? -1 : 1;
};

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
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Network explicitly encoded in a shared launch link, when present. */
  launchNetwork?: "mainnet" | "testnet" | null;
  /** Injectable only for deterministic unit tests; production pins live bytecode. */
  attestContract?: (
    network: RedEnvelopeNetwork,
    contractHash: string,
  ) => Promise<RedEnvelopeAttestation>;
  /** Injectable only for deterministic unit tests; production reads exact VM state. */
  readExecutionState?: (
    network: unknown,
    txid: unknown,
  ) => Promise<RedEnvelopeExecutionState>;
  /** Injectable durable storage for deterministic recovery tests. */
  operationStorage?: RedEnvelopeOperationStorage;
}

interface OperationConfirmation {
  confirmed: boolean;
  amountBase?: bigint;
  envelopeId?: string;
}

export interface RedEnvelopeRecoveryResult {
  status: "none" | "pending" | "confirmed" | "failed";
  operation: PendingRedEnvelopeOperation | null;
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

const toBigInt = (value: unknown): bigint => {
  try {
    return parseBigInt(value);
  } catch {
    return 0n;
  }
};

const chainBoolean = (value: unknown): boolean =>
  value === true || value === 1 || value === 1n || value === "1" || value === "true";

const canonicalHash160 = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!/^(?:0x)?[0-9a-fA-F]{40}$/.test(raw)) return "";
  return normalizeScriptHash(raw);
};

const accountMatches = (value: unknown, expectedHash: string): boolean =>
  Boolean(canonicalHash160(expectedHash)) &&
  (
    canonicalHash160(value) === canonicalHash160(expectedHash) ||
    canonicalHash160(parseHash160(value)) === canonicalHash160(expectedHash)
  );

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

export function useRedEnvelope({
  app,
  t,
  launchNetwork = null,
  attestContract = attestRedEnvelopeContract,
  readExecutionState = readRedEnvelopeExecutionState,
  operationStorage,
}: UseRedEnvelopeOptions) {
  // ── State ────────────────────────────────────────────────────────────
  const envelopes = createObservable<EnvelopeItem[]>([]);
  const claims = createObservable<ClaimItem[]>([]);
  const pools = createObservable<EnvelopeItem[]>([]);
  const loadingEnvelopes = createObservable(false);
  const isLoading = createObservable(false);
  const isRecovering = createObservable(false);
  const pendingOperation = createObservable<PendingRedEnvelopeOperation | null>(null);
  const transactionNotice = createObservable("");
  const serviceNotice = createObservable("");
  /**
   * Why the contract could not be verified, for DISPLAY only. This is not a
   * gate: contractCompatible above remains the sole authority over paid actions
   * and still refuses every case this reports as "awaiting-wallet".
   *
   * The split exists because a boolean could not tell two very different
   * situations apart, and the scene printed both as "The active network
   * contract could not be verified. Paid actions are paused":
   *   - "unverified": a network and contract WERE resolved and the attestation
   *     or the live probe read disagreed. A real fault; say so.
   *   - "awaiting-wallet": no wallet has named a network yet (a wallet-less
   *     host reports a bare "neo-n3", which normalizes to null), so no contract
   *     could be resolved to verify. Nothing failed — this is the first paint
   *     every visitor sees, and it must read as an invitation.
   */
  const contractProbe = createObservable<"awaiting-wallet" | "unverified" | "ready">(
    "awaiting-wallet",
  );

  /**
   * Publish the "contract could not be verified" notice ONLY when there was
   * actually something to verify. Every caller reaches this after
   * refreshContractCompatibility() has returned false, but that single false
   * covers both a real failure and the ordinary pre-wallet state; only the
   * probe can tell them apart. Pre-wallet the scene's own connect prompt is the
   * honest thing to show, so the notice stays empty.
   */
  const noticeUnverifiedContract = () => {
    serviceNotice.set(
      contractProbe.get() === "awaiting-wallet" ? "" : t("contractCompatibilityUnproven"),
    );
  };
  const operationStore = createRedEnvelopeOperationStore(
    operationStorage ?? app.storage.local,
  );
  let activeFinancialAction: PendingRedEnvelopeOperation["phase"] | "recover" | null = null;
  const beginFinancialAction = (
    action: PendingRedEnvelopeOperation["phase"] | "recover",
  ): void => {
    if (activeFinancialAction) throw new Error(t("operationBusy"));
    activeFinancialAction = action;
  };
  const endFinancialAction = (
    action: PendingRedEnvelopeOperation["phase"] | "recover",
  ): void => {
    if (activeFinancialAction === action) activeFinancialAction = null;
  };
  /** New creates require the bounded v1.1 ABI; legacy envelopes stay claimable. */
  const createAvailable = createObservable(false);
  /** True only after network, script hash, NEF checksum and ABI all match. */
  const contractCompatible = createObservable(false);
  /** Active, attested network used for recovery scopes and share links. */
  const activeNetwork = createObservable<RedEnvelopeNetwork | "">("");
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
  const address = createObservable<string | null>(app.chain.address.get() ?? null);

  const setAddress = (addr: string | null) => {
    if (String(address.get() ?? "") !== String(addr ?? "")) {
      pendingOperation.set(null);
      transactionNotice.set("");
    }
    address.set(addr ?? null);
  };

  const refreshContractCompatibility = async (): Promise<boolean> => {
    contractCompatible.set(false);
    createAvailable.set(false);
    activeNetwork.set("");
    try {
      // Detection being unavailable is not a conflict — a host with no wallet
      // bridge yet simply cannot answer. Treat a throw the same as an unnamed
      // network so it lands in the neutral pre-connect branch below rather than
      // the outer catch, which reports a genuine verification failure.
      let detectedRaw: unknown = "";
      try {
        detectedRaw = await app.chain.detectNetwork();
      } catch {
        detectedRaw = "";
      }
      const detected = normalizeRedEnvelopeNetwork(detectedRaw);
      const expectedLaunch = normalizeRedEnvelopeNetwork(launchNetwork);
      const contractHash = canonicalHash160(app.chain.contractAddress.get());
      // Nothing named, nothing to verify: hold the neutral pre-connect state.
      if (!detected || !contractHash) {
        contractProbe.set("awaiting-wallet");
        return false;
      }
      // A launch/wallet network disagreement IS a real fault worth reporting.
      if (expectedLaunch && expectedLaunch !== detected) {
        contractProbe.set("unverified");
        return false;
      }

      const attestation = await attestContract(detected, contractHash);
      if (!attestation.compatible) {
        contractProbe.set("unverified");
        return false;
      }

      // Exercise one common safe method through the host bridge as a second
      // source of truth: attestation alone must not authorize a stale bridge
      // that is actually bound to another script hash.
      await app.chain.query("lastEnvelopeId", []).asBigInt();
      contractCompatible.set(true);
      contractProbe.set("ready");
      activeNetwork.set(detected);

      if (!attestation.boundedCreate) return true;
      try {
        const owner = canonicalHash160(
          await app.chain.query("getOwner", []).as(parseHash160),
        );
        createAvailable.set(Boolean(owner && owner !== ZERO_HASH));
      } catch {
        createAvailable.set(false);
      }
      return true;
    } catch {
      // A throw means a read we DID attempt against a resolved contract failed.
      // That is a genuine fault, unlike the pre-wallet path returning above.
      contractCompatible.set(false);
      contractProbe.set("unverified");
      createAvailable.set(false);
      activeNetwork.set("");
      return false;
    }
  };

  const assertCompatibleContract = async (): Promise<void> => {
    if (!(await refreshContractCompatibility())) {
      throw new Error(t("contractCompatibilityUnproven"));
    }
  };

  const assertDurableRecovery = (scope: RedEnvelopeOperationScope): void => {
    if (!operationStore.canPersist(scope)) {
      throw new Error(t("transactionRecoveryUnavailable"));
    }
  };

  // ── Computed ─────────────────────────────────────────────────────────
  const envelopeCount = createDerived(() => envelopes.get().length, [envelopes]);
  const claimCount = createDerived(() => claims.get().length, [claims]);
  const poolCount = createDerived(() => pools.get().length, [pools]);
  const isConnected = createDerived(() => Boolean(address.get()), [address]);
  const isOpening = createDerived(() => Boolean(openingId.get()), [openingId]);
  const hasCredit = createDerived(() => prepaidCredit.get() > 0, [prepaidCredit]);
  const hasPendingOperation = createDerived(
    () => Boolean(pendingOperation.get()),
    [pendingOperation],
  );

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
    const creator = parseHash160(v.creator);
    if (!creator || creator === ZERO_HASH) return null;

    const totalAmountBase = parseBigInt(v.totalAmount);
    const remainingAmountBase = parseBigInt(v.remainingAmount);
    const packetCount = toFinite(v.packetCount);
    const openedCount = toFinite(v.openedCount);
    const expiryTimeMs = toFinite(v.expiryTime); // milliseconds
    const bestLuckAddress = parseHash160(v.bestLuckAddress);
    const bestLuckAmountBase = parseBigInt(v.bestLuckAmount);
    const active = chainBoolean(v.active);

    if (
      !Number.isSafeInteger(packetCount) ||
      packetCount <= 0 ||
      !Number.isSafeInteger(openedCount) ||
      openedCount < 0 ||
      openedCount > packetCount ||
      !Number.isSafeInteger(expiryTimeMs) ||
      expiryTimeMs <= 0
    ) return null;

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
    const raw = await app.chain.readRaw("getEnvelope", [
      app.chain.arg.integer(id),
    ]);

    let claimedByMe = false;
    if (claimerHash) {
      const claimed = await app.chain.readRaw("hasClaimed", [
        app.chain.arg.integer(id),
        app.chain.arg.hash160(claimerHash),
      ]);
      claimedByMe = chainBoolean(claimed);
    }

    return mapEnvelope(raw, id, claimedByMe);
  };

  // ── Data Loading (direct chain reads) ──────────────────────────────

  const readLatestIndexedIds = async (
    accountHash: string,
    countMethod: "creatorEnvelopeCount" | "claimerEnvelopeCount",
    listMethod: "getCreatorEnvelopes" | "getClaimerEnvelopes",
    limit: number,
  ): Promise<string[]> => {
    const count = await app.chain
      .query(countMethod, [app.chain.arg.hash160(accountHash)])
      .asInt();
    if (!Number.isSafeInteger(count) || count <= 0) return [];
    const pageSize = Math.min(limit, count);
    const offset = Math.max(0, count - pageSize);
    const raw = await app.chain.readArray(listMethod, [
      app.chain.arg.hash160(accountHash),
      app.chain.arg.integer(offset),
      app.chain.arg.integer(pageSize),
    ]);
    return raw.map(toIdString).filter(Boolean);
  };

  /**
   * Rebuild the envelopes/pools/claims lists straight from the contract.
   *
   * Only the connected wallet's creator/claimer indexes are read. Sequential
   * envelope ids are public and predictable, so scanning lastEnvelopeId would
   * advertise unrelated bearer-link gifts as a public free-for-all. A shared
   * link is hydrated separately by its exact network-bound id.
   */
  const loadEnvelopes = async () => {
    if (loadingEnvelopes.get()) return;
    loadingEnvelopes.set(true);
    serviceNotice.set("");
    try {
      if (!contractCompatible.get() && !(await refreshContractCompatibility())) {
        envelopes.set([]);
        pools.set([]);
        claims.set([]);
        prepaidCredit.set(0);
        noticeUnverifiedContract();
        return;
      }
      const claimerAddr = address.get();
      const claimerHash = claimerAddr ? addressToScriptHash(claimerAddr) || null : null;
      if (!claimerHash) {
        envelopes.set([]);
        pools.set([]);
        claims.set([]);
        prepaidCredit.set(0);
        return;
      }

      const [createdIds, claimedIds] = await Promise.all([
        readLatestIndexedIds(
          claimerHash,
          "creatorEnvelopeCount",
          "getCreatorEnvelopes",
          ENVELOPE_PAGE_SIZE,
        ),
        readLatestIndexedIds(
          claimerHash,
          "claimerEnvelopeCount",
          "getClaimerEnvelopes",
          ENVELOPE_PAGE_SIZE,
        ),
      ]);
      const ids = [...new Set([...createdIds, ...claimedIds])]
        .sort(compareNumericIdsDescending)
        .slice(0, ENVELOPE_PAGE_SIZE);

      let readFailures = 0;
      const results = await mapWithConcurrency(ids, MAX_CONCURRENT_READS, async (id) => {
        try {
          return await readEnvelope(id, claimerHash);
        } catch (e) {
          readFailures += 1;
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
        .sort((a, b) => compareNumericIdsDescending(a.id, b.id));

      envelopes.set(allEnvelopes);
      pools.set(allEnvelopes.filter((item) => item.active && item.canOpen));
      if (readFailures > 0) serviceNotice.set(t("chainReadUnavailable"));

      // Claims for the connected wallet: the envelopes this address has claimed
      // from, each with the share it drew. The prepaid create-credit refreshes
      // alongside so the withdraw affordance stays honest after every action.
      await Promise.all([loadClaims(claimerHash), loadCredit(claimerHash)]);
    } catch (e) {
      serviceNotice.set(t("chainReadUnavailable"));
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
      const ids = await readLatestIndexedIds(
        claimerHash,
        "claimerEnvelopeCount",
        "getClaimerEnvelopes",
        LIST_PAGE_LIMIT,
      );

      const items = await mapWithConcurrency(ids, MAX_CONCURRENT_READS, async (envelopeId) => {
        try {
          const shareRaw = await app.chain.readRaw("claimedAmount", [
            app.chain.arg.integer(envelopeId),
            app.chain.arg.hash160(claimerHash),
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
          .sort((a, b) => compareNumericIdsDescending(a.poolId, b.poolId)),
      );
    } catch (e) {
      serviceNotice.set(t("chainReadUnavailable"));
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
      serviceNotice.set(t("chainReadUnavailable"));
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
    const id = normalizeRedEnvelopeId(envelopeId);
    if (!id) return;
    serviceNotice.set("");
    try {
      if (!contractCompatible.get() && !(await refreshContractCompatibility())) {
        noticeUnverifiedContract();
        return;
      }
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
      serviceNotice.set(t("chainReadUnavailable"));
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
      const credit = await app.chain
        .query("creditOf", [app.chain.arg.hash160(accountHash)])
        .asBigInt();
      prepaidCredit.set(fromFixed8(credit));
    } catch (e) {
      serviceNotice.set(t("chainReadUnavailable"));
      console.warn(
        "[useRedEnvelope] creditOf failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  // ── Transaction confirmation + recovery ───────────────────────────

  const resolveOperationScope = async (
    accountHash?: string,
    contractHash?: string,
  ): Promise<RedEnvelopeOperationScope | null> => {
    const account = canonicalHash160(
      accountHash || addressToScriptHash(address.get() || ""),
    );
    const contract = canonicalHash160(
      contractHash || app.chain.contractAddress.get() || "",
    );
    if (!account || !contract) return null;
    try {
      const network = normalizeRedEnvelopeNetwork(await app.chain.detectNetwork());
      return network ? { account, contract, network } : null;
    } catch {
      return null;
    }
  };

  const persistBroadcast = (
    scope: RedEnvelopeOperationScope,
    input: Omit<
      Parameters<typeof createPendingRedEnvelopeOperation>[0],
      keyof RedEnvelopeOperationScope | "txid"
    >,
    txid: string,
  ): PendingRedEnvelopeOperation | null => {
    if (!String(txid ?? "").trim()) return null;
    const operation = operationStore.set(
      createPendingRedEnvelopeOperation({ ...scope, ...input, txid }),
    );
    pendingOperation.set(operation);
    transactionNotice.set(t("transactionConfirmationPending"));
    return operation;
  };

  const clearOperation = (scope: RedEnvelopeOperationScope): void => {
    operationStore.clear(scope);
    pendingOperation.set(null);
    transactionNotice.set("");
  };

  const pendingConfirmationError = (): Error =>
    new Error(t("transactionConfirmationPending"));

  const assertNoStoredOperation = (scope: RedEnvelopeOperationScope): void => {
    const stored = operationStore.get(scope);
    if (!stored) return;
    pendingOperation.set(stored);
    transactionNotice.set(t("transactionConfirmationPending"));
    // Never continue the new click after discovering an older broadcast. Even
    // if a refresh can now confirm it, continuing could duplicate a create or
    // claim. Recovery is an explicit, non-replaying step.
    throw pendingConfirmationError();
  };

  const exactEvent = async (
    result: { txid?: string; verified?: boolean; event?: unknown },
    eventName: string,
  ): Promise<unknown> => {
    if (result.verified === true && result.event) return result.event;
    const txid = String(result.txid ?? "").trim();
    if (!txid) return null;
    try {
      return await app.events.waitFor(txid, eventName, EXACT_EVENT_RECHECK_MS);
    } catch {
      return null;
    }
  };

  const eventNameFor = (phase: PendingRedEnvelopeOperation["phase"]): string => {
    switch (phase) {
      case "deposit": return "Credited";
      case "create": return "EnvelopeCreated";
      case "claim": return "Claimed";
      case "reclaim": return "Reclaimed";
      case "withdraw": return "CreditWithdrawn";
    }
  };

  const exactExecutionState = async (
    operation: PendingRedEnvelopeOperation,
    event: unknown,
  ): Promise<RedEnvelopeExecutionState> =>
    event ? "halt" : readExecutionState(operation.network, operation.txid);

  const assertTransactionDidNotFault = async (
    scope: RedEnvelopeOperationScope,
    operation: PendingRedEnvelopeOperation,
    event: unknown,
  ): Promise<void> => {
    if ((await exactExecutionState(operation, event)) !== "fault") return;
    clearOperation(scope);
    throw new Error(t("transactionExecutionFailed"));
  };

  const confirmOperation = async (
    operation: PendingRedEnvelopeOperation,
    event: unknown,
  ): Promise<OperationConfirmation> => {
    const expectedAmount = toBigInt(operation.amountBase);

    if (operation.phase === "deposit") {
      const targetCredit = toBigInt(operation.targetCreditBase);
      const eventAmount = toBigInt(eventValue(event, 1));
      const eventBalance = toBigInt(eventValue(event, 2));
      if (
        event &&
        accountMatches(eventValue(event, 0), operation.account) &&
        eventAmount === expectedAmount &&
        eventBalance >= targetCredit
      ) {
        return { confirmed: true, amountBase: eventAmount };
      }
      try {
        const credit = toBigInt(
          await app.chain.readRaw("creditOf", [
            app.chain.arg.hash160(operation.account),
          ]),
        );
        return { confirmed: credit >= targetCredit, amountBase: expectedAmount };
      } catch {
        return { confirmed: false };
      }
    }

    if (operation.phase === "create") {
      const eventId = toIdString(eventValue(event, 0));
      if (
        event &&
        eventId &&
        accountMatches(eventValue(event, 1), operation.account) &&
        toBigInt(eventValue(event, 2)) === expectedAmount &&
        Number(toBigInt(eventValue(event, 3))) === operation.packetCount
      ) {
        return { confirmed: true, envelopeId: eventId, amountBase: expectedAmount };
      }

      // Authoritative create recovery is anchored to the creator-list length
      // captured before broadcast. `lastEnvelopeId` or the newest event could
      // belong to another wallet and must never be substituted.
      try {
        const before = Number(operation.creatorCountBefore);
        const current = Number(
          toBigInt(
            await app.chain.readRaw("creatorEnvelopeCount", [
              app.chain.arg.hash160(operation.account),
            ]),
          ),
        );
        if (!Number.isSafeInteger(before) || current !== before + 1) {
          return { confirmed: false };
        }
        const ids = await app.chain.readArray("getCreatorEnvelopes", [
          app.chain.arg.hash160(operation.account),
          app.chain.arg.integer(before),
          app.chain.arg.integer(1),
        ]);
        const id = toIdString(ids[0]);
        if (!id || ids.length !== 1) return { confirmed: false };
        const raw = await app.chain.readRaw("getEnvelope", [
          app.chain.arg.integer(id),
        ]);
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
          return { confirmed: false };
        }
        const envelope = raw as Record<string, unknown>;
        if (
          !accountMatches(envelope.creator, operation.account) ||
          toBigInt(envelope.totalAmount) !== expectedAmount ||
          Number(toBigInt(envelope.packetCount)) !== operation.packetCount
        ) {
          return { confirmed: false };
        }
        return { confirmed: true, envelopeId: id, amountBase: expectedAmount };
      } catch {
        return { confirmed: false };
      }
    }

    if (operation.phase === "claim") {
      const eventShare = toBigInt(eventValue(event, 2));
      if (
        event &&
        toIdString(eventValue(event, 0)) === operation.envelopeId &&
        accountMatches(eventValue(event, 1), operation.account) &&
        eventShare > 0n
      ) {
        return { confirmed: true, amountBase: eventShare, envelopeId: operation.envelopeId };
      }
      try {
        const args = [
          app.chain.arg.integer(operation.envelopeId || "0"),
          app.chain.arg.hash160(operation.account),
        ];
        const [claimed, shareRaw] = await Promise.all([
          app.chain.readRaw("hasClaimed", args),
          app.chain.readRaw("claimedAmount", args),
        ]);
        const share = toBigInt(shareRaw);
        return {
          confirmed: chainBoolean(claimed) && share > 0n,
          amountBase: share,
          envelopeId: operation.envelopeId,
        };
      } catch {
        return { confirmed: false };
      }
    }

    if (operation.phase === "reclaim") {
      const eventAmount = toBigInt(eventValue(event, 2));
      if (
        event &&
        toIdString(eventValue(event, 0)) === operation.envelopeId &&
        accountMatches(eventValue(event, 1), operation.account) &&
        eventAmount === expectedAmount
      ) {
        return { confirmed: true, amountBase: eventAmount, envelopeId: operation.envelopeId };
      }
      try {
        const raw = await app.chain.readRaw("getEnvelope", [
          app.chain.arg.integer(operation.envelopeId || "0"),
        ]);
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
          return { confirmed: false };
        }
        const envelope = raw as Record<string, unknown>;
        return {
          confirmed:
            accountMatches(envelope.creator, operation.account) &&
            !chainBoolean(envelope.active) &&
            toBigInt(envelope.remainingAmount) === 0n &&
            Number(toBigInt(envelope.openedCount)) === operation.openedCountBefore &&
            Number(toBigInt(envelope.packetCount)) === operation.packetCount,
          amountBase: expectedAmount,
          envelopeId: operation.envelopeId,
        };
      } catch {
        return { confirmed: false };
      }
    }

    const eventAmount = toBigInt(eventValue(event, 1));
    if (
      event &&
      accountMatches(eventValue(event, 0), operation.account) &&
      eventAmount === expectedAmount
    ) {
      return { confirmed: true, amountBase: eventAmount };
    }
    // creditOf(account) == 0 is not proof of a withdrawal: another tab may
    // have consumed the credit in createEnvelope. Only this exact tx's matching
    // CreditWithdrawn event can prove that GAS reached the wallet.
    return { confirmed: false };
  };

  const recordClaimLocally = (
    envelopeId: string,
    claimerHash: string,
    amountBase: bigint,
  ): void => {
    const claimId = `${envelopeId}:${claimerHash}`;
    if (claims.get().some((item) => item.id === claimId)) return;
    claims.set(
      [
        {
          id: claimId,
          poolId: envelopeId,
          holder: claimerHash,
          amount: fromFixed8(amountBase),
          opened: true,
          message: "",
        },
        ...claims.get(),
      ].sort((a, b) => compareNumericIdsDescending(a.poolId, b.poolId)),
    );
  };

  /** Reconcile one exact persisted tx. This function never invokes a contract. */
  const recoverPendingOperation = async (): Promise<RedEnvelopeRecoveryResult> => {
    if (isRecovering.get()) {
      return { status: pendingOperation.get() ? "pending" : "none", operation: pendingOperation.get() };
    }
    if (activeFinancialAction) {
      return { status: pendingOperation.get() ? "pending" : "none", operation: pendingOperation.get() };
    }
    if (!contractCompatible.get() && !(await refreshContractCompatibility())) {
      noticeUnverifiedContract();
      return { status: "none", operation: null };
    }
    beginFinancialAction("recover");
    try {
      const scope = await resolveOperationScope();
      if (!scope) return { status: "none", operation: null };
      const operation = operationStore.get(scope);
      if (!operation) {
        pendingOperation.set(null);
        return { status: "none", operation: null };
      }

      isRecovering.set(true);
      pendingOperation.set(operation);
      transactionNotice.set(t("transactionConfirmationPending"));
      try {
        let event: unknown = null;
        try {
          event = await app.events.waitFor(
            operation.txid,
            eventNameFor(operation.phase),
            EXACT_EVENT_RECHECK_MS,
          );
        } catch {
          event = null;
        }
        const executionState = await exactExecutionState(operation, event);
        if (executionState === "fault") {
          clearOperation(scope);
          transactionNotice.set(t("transactionExecutionFailed"));
          return { status: "failed", operation };
        }
        const confirmation = await confirmOperation(operation, event);
        if (!confirmation.confirmed) {
          return { status: "pending", operation };
        }

        clearOperation(scope);
        transactionNotice.set(t("transactionRecovered"));
        if (operation.phase === "create" && confirmation.envelopeId) {
          lastCreatedEnvelopeId.set(confirmation.envelopeId);
        }
        if (
          operation.phase === "claim" &&
          confirmation.envelopeId &&
          (confirmation.amountBase ?? 0n) > 0n
        ) {
          const share = confirmation.amountBase ?? 0n;
          luckyMessage.set({
            amount: Number(fromFixed8(share).toFixed(4)),
            from: `#${confirmation.envelopeId}`,
          });
          recordClaimLocally(confirmation.envelopeId, operation.account, share);
        }
        return { status: "confirmed", operation };
      } finally {
        isRecovering.set(false);
      }
    } finally {
      endFinancialAction("recover");
    }
  };

  // ── Actions (direct chain invocations) ─────────────────────────────

  /**
   * Connect the wallet and reload. The chain service prompts the wallet on
   * demand; here we just ensure an address is on hand and refresh.
   */
  const handleConnect = async () => {
    const addr = address.get() || (await app.chain.ensureWallet());
    setAddress(addr ?? null);
    await loadAll();
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
  }): Promise<{ envelopeId: string }> => {
    if (isLoading.get() || openingId.get() || isRecovering.get()) {
      throw new Error(t("operationBusy"));
    }
    beginFinancialAction("create");
    try {
      await assertCompatibleContract();
      if (!createAvailable.get()) {
        throw new Error(t("createContractUpgradeRequired"));
      }

      isLoading.set(true);
      // Clear any prior share card so a fresh attempt never shows a stale id.
      lastCreatedEnvelopeId.set("");
      const totalValue = Number(formData.amount);
      const packetCount = Number(formData.count);
      const expiryValue = Number(formData.expiryHours);

      if (!Number.isFinite(totalValue) || totalValue < 0.1 || totalValue > 20)
        throw new Error(t("invalidAmount"));
      if (!Number.isInteger(packetCount) || packetCount < 1 || packetCount > 100)
        throw new Error(t("invalidPackets"));
      if (totalValue < packetCount * 0.01) throw new Error(t("invalidPerPacket"));
      if (
        !Number.isFinite(expiryValue) ||
        expiryValue < MIN_EXPIRY_HOURS ||
        expiryValue > MAX_EXPIRY_HOURS
      ) throw new Error(t("invalidExpiry"));

      const totalBase = toBaseUnits(formData.amount);
      if (totalBase < MIN_AMOUNT || totalBase > MAX_AMOUNT) throw new Error(t("invalidAmount"));
      if (totalBase < BigInt(packetCount) * MIN_PER_PACKET) {
        throw new Error(t("invalidPerPacket"));
      }

      // Connecting and spending are intentionally separate gestures. A create
      // action can only use an address that was already connected beforehand.
      const creatorAddr = address.get();
      const creatorHash = addressToScriptHash(creatorAddr || "");
      if (!creatorAddr || !creatorHash) throw new Error(t("walletNotConnected"));
      setAddress(creatorAddr);

      const contractHash = app.chain.contractAddress.get();
      if (!contractHash) throw new Error(t("envelopeNotReady"));
      const scope = await resolveOperationScope(creatorHash, contractHash);
      if (!scope) throw new Error(t("transactionRecoveryUnavailable"));
      assertNoStoredOperation(scope);
      assertDurableRecovery(scope);

      const durationSeconds = Math.round(expiryValue * 3600);

      // Step 1: DEPOSIT — top up only the SHORTFALL beyond any prepaid credit
      // left from a previous aborted create, so stale credit is consumed
      // instead of accumulating.
      let credit = 0n;
      try {
        credit = await app.chain
          .query("creditOf", [app.chain.arg.hash160(creatorHash)])
          .asBigInt();
      } catch {
        // Never assume zero after a failed read: doing so could deposit the
        // full amount on top of existing prepaid credit.
        throw new Error(t("chainReadUnavailable"));
      }

      if (credit < totalBase) {
        const shortfall = totalBase - credit;
        const depositInput = {
          phase: "deposit" as const,
          amountBase: shortfall.toString(),
          creditBeforeBase: credit.toString(),
          targetCreditBase: totalBase.toString(),
        };
        let depositResult;
        try {
          depositResult = await app.chain.invoke(
            "transfer",
            [
              app.chain.arg.hash160(creatorHash),
              app.chain.arg.hash160(contractHash),
              app.chain.arg.integer(shortfall.toString()),
              app.chain.arg.string(CREATE_MEMO),
            ],
            {
              scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
              waitForEvent: "Credited",
              onTransactionSent: (txid) => {
                persistBroadcast(scope, depositInput, txid);
              },
            },
          );
        } catch (error) {
          if (operationStore.get(scope)?.phase === "deposit") {
            throw pendingConfirmationError();
          }
          throw error;
        }
        const depositOperation =
          operationStore.get(scope) ??
          persistBroadcast(scope, depositInput, depositResult.txid);
        if (!depositOperation) throw new Error(t("transactionRecoveryUnavailable"));
        const depositEvent = await exactEvent(depositResult, "Credited");
        await assertTransactionDidNotFault(scope, depositOperation, depositEvent);
        const depositConfirmation = await confirmOperation(depositOperation, depositEvent);
        if (!depositConfirmation.confirmed) throw pendingConfirmationError();
        clearOperation(scope);
      }

      // Step 2: createEnvelope — consumes the prepaid credit and opens the
      // envelope. If this fails the credit persists on the contract under the
      // creator and is reusable on the next create (or withdrawable).
      try {
        let creatorCountBefore: number;
        try {
          creatorCountBefore = Number(
            toBigInt(
              await app.chain.readRaw("creatorEnvelopeCount", [
                app.chain.arg.hash160(creatorHash),
              ]),
            ),
          );
        } catch {
          throw new Error(t("transactionRecoveryUnavailable"));
        }
        if (!Number.isSafeInteger(creatorCountBefore) || creatorCountBefore < 0) {
          throw new Error(t("transactionRecoveryUnavailable"));
        }

        const createInput = {
          phase: "create" as const,
          amountBase: totalBase.toString(),
          packetCount: Math.trunc(packetCount),
          durationSeconds,
          creatorCountBefore,
        };
        const result = await app.chain.invoke(
          "createEnvelope",
          [
            app.chain.arg.hash160(creatorHash),
            app.chain.arg.integer(totalBase.toString()),
            app.chain.arg.integer(Math.trunc(packetCount)),
            app.chain.arg.integer(durationSeconds),
          ],
          {
            waitForEvent: "EnvelopeCreated",
            onTransactionSent: (txid) => {
              persistBroadcast(scope, createInput, txid);
            },
          },
        );
        const createOperation =
          operationStore.get(scope) ?? persistBroadcast(scope, createInput, result.txid);
        if (!createOperation) throw new Error(t("transactionRecoveryUnavailable"));
        const createEvent = await exactEvent(result, "EnvelopeCreated");
        await assertTransactionDidNotFault(scope, createOperation, createEvent);
        const confirmation = await confirmOperation(createOperation, createEvent);
        if (!confirmation.confirmed || !confirmation.envelopeId) {
          throw pendingConfirmationError();
        }
        clearOperation(scope);
        lastCreatedEnvelopeId.set(confirmation.envelopeId);
      } catch (createErr) {
        if (
          createErr instanceof Error &&
          (createErr.message === t("transactionConfirmationPending") ||
            createErr.message === t("transactionRecoveryUnavailable") ||
            createErr.message === t("transactionExecutionFailed"))
        ) {
          throw createErr;
        }
        if (operationStore.get(scope)?.phase === "create") {
          throw pendingConfirmationError();
        }
        console.error(
          "[useRedEnvelope] createEnvelope failed after deposit succeeded:",
          createErr instanceof Error ? createErr.message : String(createErr),
        );
        // Deposit landed, envelope did not — credit is held under the creator.
        throw new Error(t("depositPrepaidNoEnvelope"));
      }

      await loadEnvelopes();
      return { envelopeId: lastCreatedEnvelopeId.get() };
    } finally {
      isLoading.set(false);
      endFinancialAction("create");
    }
  };

  /**
   * Claim one packet from an envelope against the standalone contract.
   *
   * claim(envelopeId, claimer) draws a random share and pays the claimer
   * atomically in the same tx. The won share is read from the "Claimed" event
   * (state[2] = share), or from authoritative hasClaimed + claimedAmount
   * readback for this exact envelope/account. Guards against a re-claim via
   * hasClaimed before signing. Returns the share in human GAS.
   */
  const claimEnvelope = async (
    envelopeId: string,
  ): Promise<{ amount: number; amountBase: bigint }> => {
    const id = normalizeRedEnvelopeId(envelopeId);
    if (!id) throw new Error(t("envelopeIdRequired"));
    beginFinancialAction("claim");
    try {
      await assertCompatibleContract();

      const claimerAddr = address.get();
      const claimerHash = addressToScriptHash(claimerAddr || "");
      if (!claimerAddr || !claimerHash) throw new Error(t("walletNotConnected"));
      setAddress(claimerAddr);

    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) throw new Error(t("envelopeNotReady"));
    const scope = await resolveOperationScope(claimerHash, contractHash);
    if (!scope) throw new Error(t("transactionRecoveryUnavailable"));
    assertNoStoredOperation(scope);
    assertDurableRecovery(scope);

    // Re-claim guard: one claim per address per envelope (the contract enforces
    // this too, but surface a clean message before prompting the wallet).
    let already: unknown;
    try {
      already = await app.chain.readRaw("hasClaimed", [
        app.chain.arg.integer(id),
        app.chain.arg.hash160(claimerHash),
      ]);
    } catch {
      throw new Error(t("claimEligibilityUnavailable"));
    }
    if (chainBoolean(already)) throw new Error(t("alreadyOpened"));

    const claimInput = {
      phase: "claim" as const,
      amountBase: "0", // actual random share is learned only after confirmation
      envelopeId: id,
    };
    let result;
    try {
      result = await app.chain.invoke(
        "claim",
        [
          app.chain.arg.integer(id),
          app.chain.arg.hash160(claimerHash),
        ],
        {
          waitForEvent: "Claimed",
          onTransactionSent: (txid) => {
            persistBroadcast(scope, claimInput, txid);
          },
        },
      );
    } catch (error) {
      if (operationStore.get(scope)?.phase === "claim") {
        throw pendingConfirmationError();
      }
      throw error;
    }
    const operation =
      operationStore.get(scope) ?? persistBroadcast(scope, claimInput, result.txid);
    if (!operation) throw new Error(t("transactionRecoveryUnavailable"));
    const event = await exactEvent(result, "Claimed");
    await assertTransactionDidNotFault(scope, operation, event);
    const confirmation = await confirmOperation(operation, event);
    const shareBase = confirmation.amountBase ?? 0n;
    if (!confirmation.confirmed || shareBase <= 0n) {
      throw pendingConfirmationError();
    }
      clearOperation(scope);
      return { amount: fromFixed8(shareBase), amountBase: shareBase };
    } finally {
      endFinancialAction("claim");
    }
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
    if (openingId.get() || isLoading.get() || isRecovering.get()) {
      throw new Error(t("operationBusy"));
    }

    try {
      // A fresh attempt must not inherit an earlier success overlay. If the
      // wallet rejects or the invocation fails, the result remains empty and
      // the same claim can be retried after openingId is cleared in finally.
      luckyMessage.set(null);
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
        recordClaimLocally(envelopeId, claimerHash, result.amountBase);
      }
    } finally {
      openingId.set(null);
    }
  };

  /**
   * Reclaim the unclaimed remainder of the creator's OWN expired envelope via
   * reclaim(envelopeId, creator). The contract pays the remainder straight back
   * to the creator's wallet and deactivates the envelope. Returns the reclaimed
   * amount in human GAS only after the matching event, or after the same expired
   * envelope authoritatively reads inactive with zero remaining. The UI's local
   * remainder is never accepted as proof.
   */
  const reclaimEnvelope = async (envelopeId: string): Promise<{ amount: number }> => {
    const id = normalizeRedEnvelopeId(envelopeId);
    if (!id) throw new Error(t("envelopeIdRequired"));
    if (isLoading.get() || openingId.get() || isRecovering.get()) {
      throw new Error(t("operationBusy"));
    }

    beginFinancialAction("reclaim");
    isLoading.set(true);
    try {
      await assertCompatibleContract();
      const creatorAddr = address.get();
      const creatorHash = addressToScriptHash(creatorAddr || "");
      if (!creatorAddr || !creatorHash) throw new Error(t("walletNotConnected"));
      setAddress(creatorAddr);

      const contractHash = app.chain.contractAddress.get();
      if (!contractHash) throw new Error(t("envelopeNotReady"));
      const scope = await resolveOperationScope(creatorHash, contractHash);
      if (!scope) throw new Error(t("transactionRecoveryUnavailable"));
      assertNoStoredOperation(scope);
      assertDurableRecovery(scope);

      // Capture the exact pre-reclaim remainder. A missing event can only be
      // recovered if the same envelope later reads inactive with zero left;
      // never substitute a stale UI amount.
      const raw = await app.chain.readRaw("getEnvelope", [app.chain.arg.integer(id)]);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error(t("envelopeNotReady"));
      }
      const envelope = raw as Record<string, unknown>;
      const expectedAmount = toBigInt(envelope.remainingAmount);
      const expiryTime = Number(envelope.expiryTime ?? 0);
      const openedCountBefore = Number(toBigInt(envelope.openedCount));
      const packetCount = Number(toBigInt(envelope.packetCount));
      if (
        !accountMatches(envelope.creator, creatorHash) ||
        !chainBoolean(envelope.active) ||
        expectedAmount <= 0n ||
        !Number.isSafeInteger(openedCountBefore) ||
        openedCountBefore < 0 ||
        !Number.isSafeInteger(packetCount) ||
        packetCount <= openedCountBefore ||
        !Number.isFinite(expiryTime) ||
        expiryTime <= 0 ||
        Date.now() < expiryTime
      ) {
        throw new Error(t("envelopeNotReclaimable"));
      }

      const reclaimInput = {
        phase: "reclaim" as const,
        envelopeId: id,
        amountBase: expectedAmount.toString(),
        openedCountBefore,
        packetCount,
      };
      let result;
      try {
        result = await app.chain.invoke(
          "reclaim",
          [
            app.chain.arg.integer(id),
            app.chain.arg.hash160(creatorHash),
          ],
          {
            waitForEvent: "Reclaimed",
            onTransactionSent: (txid) => {
              persistBroadcast(scope, reclaimInput, txid);
            },
          },
        );
      } catch (error) {
        if (operationStore.get(scope)?.phase === "reclaim") {
          throw pendingConfirmationError();
        }
        throw error;
      }
      const operation =
        operationStore.get(scope) ?? persistBroadcast(scope, reclaimInput, result.txid);
      if (!operation) throw new Error(t("transactionRecoveryUnavailable"));
      const event = await exactEvent(result, "Reclaimed");
      await assertTransactionDidNotFault(scope, operation, event);
      const confirmation = await confirmOperation(operation, event);
      if (!confirmation.confirmed) throw pendingConfirmationError();
      clearOperation(scope);
      const amount = fromFixed8(confirmation.amountBase ?? expectedAmount);

      await loadEnvelopes();
      return { amount };
    } finally {
      isLoading.set(false);
      endFinancialAction("reclaim");
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
    if (isLoading.get() || openingId.get() || isRecovering.get()) {
      throw new Error(t("operationBusy"));
    }

    beginFinancialAction("withdraw");
    isLoading.set(true);
    try {
      await assertCompatibleContract();
      const accountAddr = address.get();
      const accountHash = addressToScriptHash(accountAddr || "");
      if (!accountAddr || !accountHash) throw new Error(t("walletNotConnected"));
      setAddress(accountAddr);

      const contractHash = app.chain.contractAddress.get();
      if (!contractHash) throw new Error(t("envelopeNotReady"));
      const scope = await resolveOperationScope(accountHash, contractHash);
      if (!scope) throw new Error(t("transactionRecoveryUnavailable"));
      assertNoStoredOperation(scope);
      assertDurableRecovery(scope);

      // Read the live credit first — the contract reverts "no credit" on an
      // empty balance, so surface a clean message before prompting the wallet.
      let credit = 0n;
      try {
        credit = await app.chain
          .query("creditOf", [app.chain.arg.hash160(accountHash)])
          .asBigInt();
      } catch {
        throw new Error(t("chainReadUnavailable"));
      }
      if (credit <= 0n) throw new Error(t("noCredit"));

      const withdrawInput = {
        phase: "withdraw" as const,
        amountBase: credit.toString(),
      };
      let result;
      try {
        result = await app.chain.invoke(
          "withdraw",
          [app.chain.arg.hash160(accountHash)],
          {
            waitForEvent: "CreditWithdrawn",
            onTransactionSent: (txid) => {
              persistBroadcast(scope, withdrawInput, txid);
            },
          },
        );
      } catch (error) {
        if (operationStore.get(scope)?.phase === "withdraw") {
          throw pendingConfirmationError();
        }
        throw error;
      }
      const operation =
        operationStore.get(scope) ?? persistBroadcast(scope, withdrawInput, result.txid);
      if (!operation) throw new Error(t("transactionRecoveryUnavailable"));
      const event = await exactEvent(result, "CreditWithdrawn");
      await assertTransactionDidNotFault(scope, operation, event);
      const confirmation = await confirmOperation(operation, event);
      if (!confirmation.confirmed) throw pendingConfirmationError();
      clearOperation(scope);
      const amount = fromFixed8(confirmation.amountBase ?? credit);

      await loadEnvelopes();
      return { amount };
    } finally {
      isLoading.set(false);
      endFinancialAction("withdraw");
    }
  };

  // ── Load All ────────────────────────────────────────────────────────

  const loadAll = async () => {
    // Some wallet bridges resolve ensureWallet() a tick before their address
    // observable updates. Preserve the explicitly connected identity instead
    // of briefly overwriting it with null during the connect-only action.
    setAddress(app.chain.address.get() ?? address.get() ?? null);
    const compatible = await refreshContractCompatibility();
    if (!compatible) {
      // This is the mount path — the very first thing a visitor triggers. Only
      // report a verification failure if a network and contract were actually
      // resolved to verify; pre-wallet there is nothing to verify and nothing
      // has gone wrong, so the scene shows its connect prompt instead. (The
      // scene reads transactionNotice ahead of serviceNotice, so an unguarded
      // set here surfaced the failure copy under every cold first paint.)
      transactionNotice.set(
        contractProbe.get() === "awaiting-wallet" ? "" : t("contractCompatibilityUnproven"),
      );
      envelopes.set([]);
      pools.set([]);
      claims.set([]);
      prepaidCredit.set(0);
      return;
    }
    await recoverPendingOperation();
    const canCreate = createAvailable.get();
    if (!canCreate && !pendingOperation.get() && !transactionNotice.get()) {
      transactionNotice.set(t("createContractUpgradeRequired"));
    } else if (canCreate && transactionNotice.get() === t("createContractUpgradeRequired")) {
      transactionNotice.set("");
    }
    await loadEnvelopes();
  };

  return {
    // State
    envelopes,
    claims,
    pools,
    loadingEnvelopes,
    isLoading,
    isRecovering,
    pendingOperation,
    transactionNotice,
    serviceNotice,
    contractProbe,
    createAvailable,
    contractCompatible,
    activeNetwork,
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
    hasPendingOperation,

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
    recoverPendingOperation,
    refreshContractCompatibility,

    // Lifecycle
    loadAll,
    loadEnvelopes,
    hydrateEnvelope,
  };
}

export type UseRedEnvelopeReturn = ReturnType<typeof useRedEnvelope>;
