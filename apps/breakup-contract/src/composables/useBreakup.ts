/**
 * useBreakup — Domain logic for the Breakup Contract miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppBreakupPact)
 * via ctx.services.chain. The earlier path routed create/sign/break through the
 * OS escrow/storage/badge kernel proxies, which never actually held the stakes
 * or paid anyone — the kernel escrow id never even materialized (the earlier
 * audit's "revise"). This composable now drives the dedicated contract, a
 * TWO-PARTY MATCHED-STAKE COMMITMENT PACT (no oracle, no pending settle kernel):
 *
 *   - createContract() LOCKS party1's GAS stake against a named partner and a
 *     duration; the pact starts PENDING (only party1 staked).
 *   - signContract() lets the named partner (party2) match the stake; the pact
 *     becomes ACTIVE (both staked).
 *   - breakContract() forfeits the breaker's stake: while ACTIVE the OTHER party
 *     receives BOTH stakes (BROKEN); while still PENDING party1 may break to
 *     cancel and reclaim their own stake (CANCELLED).
 *   - settleContract() is PERMISSIONLESS: after expiry an honored ACTIVE pact
 *     refunds both parties their stake (SETTLED).
 *
 * Contract interaction model (verified against MiniAppBreakupPact.cs / ABI):
 *
 *   READS (chain.read / chain.readArray, default app contract script hash):
 *     lastPactId()                          -> Integer (pacts are ids 1..last)
 *     creditOf(who)                         -> Integer (prepaid stake credit)
 *     getPact(id)                           -> Map{id,party1,party2,stake,
 *                                              endTime(ms),party1Staked,
 *                                              party2Staked,status,breaker}
 *     partyPactCount(who)                   -> Integer
 *     getPartyPacts(who, off, limit)        -> Integer[] (pacts where who is
 *                                              party1 OR party2)
 *
 *   MUTATIONS (chain.invoke):
 *     1. DEPOSIT (fund a stake) — a GAS transfer to the contract with the memo
 *        "miniapp-breakup:stake" so OnNEP17Payment credits the sender:
 *          transfer(party, CONTRACT, stakeBaseUnits, "miniapp-breakup:stake")
 *          { scriptHash: GAS_HASH }
 *     2. createPact(party1, party2, stake, durationSeconds) -> pactId. Consumes
 *        the prepaid credit as party1's stake, so the deposit MUST land first.
 *        The new id is read from the "PactCreated" event (state[0]), falling
 *        back to lastPactId().
 *     signPact(pactId, party2). Consumes a matching stake from party2's credit
 *        (so the matching deposit MUST land first) -> ACTIVE.
 *     breakPact(pactId, breaker). ACTIVE -> the other party gets both stakes;
 *        PENDING & breaker==party1 -> cancel & refund party1.
 *     settlePact(pactId). PERMISSIONLESS; after expiry refunds both -> SETTLED.
 *
 * AMOUNT CONVENTION: the contract takes/returns BASE UNITS. GAS = human × 1e8;
 * stake >= 1 GAS. getPact.endTime is in MILLISECONDS (Runtime.Time units),
 * compared directly against Date.now(). durationSeconds = days × 86400.
 *
 * ON-DEVICE vs ON-CHAIN: the contract stores only the stake + the lock — NOT the
 * title or terms. The human-readable title + terms stay on THIS device in a
 * local store keyed by the on-chain pactId. createContract() persists them
 * locally; mapPact() rebuilds the display title/terms from that store while the
 * authoritative lifecycle (stake, endTime, staked flags, status, breaker) comes
 * from getPact(). A foreign pact you are party2 on has no local entry → it falls
 * back to a placeholder title.
 *
 * PREPAID CREDIT: a create/sign that fails AFTER its deposit landed leaves the
 * stake on the contract as reusable prepaid credit under the depositor
 * (readable via creditOf, consumed by the next createPact/signPact, and — for a
 * pending pact — reclaimable by party1 via breakPact). There is no separate
 * refund call and none is needed; funds are not lost.
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { ChainService } from "@shared/services/ChainService";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import { addressToScriptHash } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { parseGas } from "@shared/utils/format";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { ContractStatus, RelationshipContractView } from "../types";

// ============================================================================
// Constants
// ============================================================================

/** Minimum partner stake in whole GAS (contract floor is 1 GAS). */
const MIN_STAKE_GAS = 1;
/** Minimum pact duration in days (UI floor; contract floor is 1 second). */
const MIN_DURATION_DAYS = 30;
const TITLE_MAX = 100;
const TERMS_MAX = 2000;

/** GAS base units per whole GAS (1e8). */
const GAS_DECIMALS_MULTIPLIER = 100_000_000n;

/** Memo the contract requires on the stake-deposit transfer. */
const STAKE_MEMO = "miniapp-breakup:stake";

/** Local store for per-pact title/terms (kept on-device, keyed by pactId). */
const META_STORE_KEY = "breakup-contract-meta";

/** How many pact ids to page in per refresh. */
const PARTY_PAGE_LIMIT = 100;

const isValidNeoAddress = (value: string) => /^N[0-9a-zA-Z]{33}$/.test(value.trim());

// ── getPact status codes (see MiniAppBreakupPact.cs) ──────────────────────
const STATUS_PENDING = 0;
const STATUS_ACTIVE = 1;
const STATUS_BROKEN = 2;
const STATUS_SETTLED = 3;
const STATUS_CANCELLED = 4;

// ============================================================================
// Types
// ============================================================================

export interface UseBreakupOptions {
  /**
   * ChainService from ctx.services.chain. Used for every on-chain read/write
   * (stake deposit + createPact/signPact/breakPact/settlePact) and to read the
   * connected wallet so the list and hero counts scope to the current user.
   */
  chain: ChainService;
  /** EventBus for UI events. */
  eventBus: { emit: (event: string, payload?: unknown) => void };
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

/** On-device metadata for a pact (title + terms never leave this device). */
interface PactMeta {
  title: string;
  terms: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Coerce an unknown to a finite number, defaulting to 0. */
const toFinite = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Coerce a raw pact-id list value (number/string/bigint) to a string id. */
const toIdString = (value: unknown): string => {
  try {
    const n = parseBigInt(value);
    return n > 0n ? n.toString() : "";
  } catch {
    return "";
  }
};

/**
 * Convert a human-entered GAS amount string to BASE UNITS without floats.
 * Returns 0n for any invalid / non-positive input.
 */
const toBaseUnits = (raw: string): bigint => {
  const trimmed = String(raw ?? "").trim();
  if (!/^\d+(\.\d{1,8})?$/.test(trimmed)) return 0n;
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const paddedFraction = (fraction + "00000000").slice(0, 8);
  const base = BigInt(whole) * GAS_DECIMALS_MULTIPLIER + BigInt(paddedFraction);
  return base > 0n ? base : 0n;
};

/** Read a single state slot from a contract event payload (positional). */
const eventValue = (entry: unknown, index: number): unknown => {
  if (!entry || typeof entry !== "object") return undefined;
  const state = (entry as { state?: unknown }).state;
  if (Array.isArray(state)) {
    const item = state[index] as unknown;
    if (item && typeof item === "object" && "value" in item) {
      return (item as { value?: unknown }).value;
    }
    return item;
  }
  return undefined;
};

// ============================================================================
// Composable
// ============================================================================

export function useBreakup({ chain, eventBus, t }: UseBreakupOptions) {
  // -- Form state -----------------------------------------------------------
  const partnerAddress = createObservable("");
  const stakeAmount = createObservable("");
  const duration = createObservable("");
  const contractTitle = createObservable("");
  const contractTerms = createObservable("");

  // -- Data state -----------------------------------------------------------
  const contracts = createObservable<RelationshipContractView[]>([]);
  const isLoading = createObservable(false);
  const serviceNotice = createObservable("");
  const actionNotice = createObservable("");
  const validationNotice = createObservable("");
  const lastSubmittedTitle = createObservable("");

  // -- Wallet (synced from main.tsx) ---------------------------------------
  const address = createObservable("");

  // -- Derived state --------------------------------------------------------
  const contractCount = createDerived(() => contracts.get().length, [contracts]);
  const activeCount = createDerived(() => contracts.get().filter((c) => c.status === "active").length, [contracts]);
  const pendingCount = createDerived(() => contracts.get().filter((c) => c.status === "pending").length, [contracts]);
  const brokenCount = createDerived(() => contracts.get().filter((c) => c.status === "broken").length, [contracts]);

  // -- On-device title/terms store -----------------------------------------

  const loadLocalMeta = (): Record<string, PactMeta> => {
    try {
      const parsed = readCachedJSON<Record<string, PactMeta>>(META_STORE_KEY);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  /**
   * Persist a pact's title/terms under its on-chain id. Neither leaves the
   * device — only the stake + lock are on-chain — so this is the source of
   * truth mapPact() reads the title/terms from.
   */
  const saveLocalMeta = (pactId: string, meta: PactMeta) => {
    if (!pactId) return;
    try {
      const store = readCachedJSON<Record<string, PactMeta>>(META_STORE_KEY) ?? {};
      store[pactId] = meta;
      writeCachedJSON(META_STORE_KEY, store);
    } catch (e) {
      console.warn("[useBreakup] local meta write failed:", e instanceof Error ? e.message : String(e));
    }
  };

  // -- Pact mapping (from getPact Map) -------------------------------------

  /**
   * Map a getPact Map (returned by chain.read as a plain object) into the
   * RelationshipContractView the UI consumes. Returns null for an unknown /
   * empty pact (no party1 key).
   *
   * The authoritative lifecycle (stake base units, endTime ms, staked flags,
   * status, breaker) comes from the chain; the display title + terms are
   * rebuilt from the on-device store keyed by id. A foreign pact (you are
   * party2) has no local entry → it falls back to a placeholder title.
   *
   * Status mapping (getPact.status -> display):
   *   0 pending  -> "pending"  (awaiting partner)
   *   1 active   -> "active"   (both staked)
   *   2 broken   -> "broken"   (breaker forfeited to the other party)
   *   3 settled  -> "ended"    (honored to expiry; both refunded)
   *   4 cancelled-> "ended"    (party1 reclaimed a pending pact)
   */
  const mapPact = (raw: unknown, id: string, meta?: PactMeta): RelationshipContractView | null => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const v = raw as Record<string, unknown>;
    const party1 = String(v.party1 ?? "");
    const party2 = String(v.party2 ?? "");
    if (!party1 || !party2) return null;

    const stakeBase = parseBigInt(v.stake);
    const endTimeMs = toFinite(v.endTime); // milliseconds
    const status = toFinite(v.status);

    const party1Staked = Boolean(v.party1Staked);
    const party2Staked = Boolean(v.party2Staked);
    const active = status === STATUS_ACTIVE;
    const completed = status >= STATUS_BROKEN;

    let contractStatus: ContractStatus = "pending";
    if (status === STATUS_ACTIVE) contractStatus = "active";
    else if (status === STATUS_BROKEN) contractStatus = "broken";
    else if (status === STATUS_SETTLED || status === STATUS_CANCELLED) contractStatus = "ended";

    const now = Date.now();
    const daysLeft = endTimeMs > 0 ? Math.max(0, Math.ceil((endTimeMs - now) / 86_400_000)) : 0;
    // The contract does not store a pact start time, so true elapsed-share
    // progress is not derivable. Report a faithful coarse value instead of an
    // invented one: terminal (broken/settled/cancelled) reads full; an ACTIVE
    // pact past its endTime (awaiting settle) reads full; otherwise 0. The UI's
    // contract cards surface daysLeft, not this bar, so no information is lost.
    const progress = completed || (active && endTimeMs > 0 && now >= endTimeMs) ? 100 : 0;

    const title = meta?.title ? meta.title : t("untitledContract");
    const terms = meta?.terms ?? "";

    const addr = address.get();
    const me = addr ? addr.toLowerCase() : "";
    const partner = me && me === party1.toLowerCase() ? party2 : party1;

    // settleContract is only meaningful for an honored ACTIVE pact past expiry.
    const settleable = active && endTimeMs > 0 && now >= endTimeMs;

    return {
      id: Number(id),
      pactId: id,
      party1,
      party2,
      partner,
      title,
      terms,
      stake: parseGas(stakeBase),
      stakeRaw: stakeBase.toString(),
      progress,
      daysLeft,
      status: contractStatus,
      party1Signed: party1Staked,
      party2Signed: party2Staked,
      settleable,
    };
  };

  /** Read a single pact by id into a view, using the on-device meta store. */
  const readPact = async (
    id: string,
    metaStore: Record<string, PactMeta>,
  ): Promise<RelationshipContractView | null> => {
    try {
      const raw = await chain.read("getPact", [{ type: "Integer", value: id }]);
      return mapPact(raw, id, metaStore[id]);
    } catch (e) {
      console.warn("[useBreakup] getPact failed for", id, ":", e instanceof Error ? e.message : String(e));
      return null;
    }
  };

  // -- Data loading (direct chain reads) -----------------------------------

  /**
   * Load the connected wallet's pacts from getPartyPacts (covers pacts where
   * the address is party1 OR party2), each read via getPact and mapped. When no
   * wallet is connected there is nothing party-scoped to show.
   */
  const loadContracts = async () => {
    isLoading.set(true);
    try {
      const wallet = address.get();
      const partyHash = wallet ? addressToScriptHash(wallet) || null : null;
      if (!partyHash) {
        contracts.set([]);
        serviceNotice.set("");
        return;
      }

      const idsRaw = await chain.readArray("getPartyPacts", [
        { type: "Hash160", value: partyHash },
        { type: "Integer", value: "0" },
        { type: "Integer", value: String(PARTY_PAGE_LIMIT) },
      ]);
      const ids = (Array.isArray(idsRaw) ? idsRaw : [])
        .map(toIdString)
        .filter((id) => id !== "");

      const metaStore = loadLocalMeta();
      const results = await Promise.all(ids.map((id) => readPact(id, metaStore)));
      const views = results
        .filter((c): c is RelationshipContractView => c !== null)
        .sort((a, b) => b.id - a.id);

      contracts.set(views);
      serviceNotice.set("");
    } catch (e) {
      contracts.set([]);
      serviceNotice.set(t("loadFailed"));
      eventBus.emit("breakup:error", { message: t("loadFailed") });
    } finally {
      isLoading.set(false);
    }
  };

  // -- Actions (direct chain invocations) ----------------------------------

  /**
   * Resolve + validate the creator's wallet and script hash, or throw a clean
   * wallet-required error. Centralizes the connect-on-demand path.
   */
  const requireWallet = async (): Promise<{ addr: string; hash: string }> => {
    const addr = address.get() || (await chain.ensureWallet());
    const hash = addressToScriptHash(addr || "");
    if (!addr || !hash) throw new Error(t("contractWalletUnavailable"));
    address.set(addr);
    return { addr, hash };
  };

  /** Resolve the on-chain pact id for an action, or throw a clean error. */
  const resolvePactId = (contract: { id?: number; pactId?: string }): string => {
    const fromPact = contract.pactId != null ? String(contract.pactId) : "";
    if (/^\d+$/.test(fromPact) && fromPact !== "0") return fromPact;
    const fromId = contract.id != null ? String(contract.id) : "";
    if (/^\d+$/.test(fromId) && fromId !== "0") return fromId;
    throw new Error(t("pactIdRequired"));
  };

  /**
   * Create a relationship pact against the standalone contract.
   *
   * Two steps, both signed by the creator (party1):
   *   1. DEPOSIT — transfer the stake in GAS to the contract with the
   *      "miniapp-breakup:stake" memo, crediting party1's prepaid balance.
   *   2. createPact(party1, party2, stakeBase, durationDays*86400) — consumes
   *      that credit as party1's stake and opens the pact PENDING. The new id is
   *      read from the "PactCreated" event (state[0]), falling back to
   *      lastPactId().
   *
   * The title + terms NEVER leave the device: only the stake + lock are
   * on-chain. We persist them locally keyed by the on-chain pactId so the list
   * can rebuild the title/terms later.
   *
   * If step 2 fails after a successful deposit, the prepaid credit simply
   * remains on the contract under party1 and is reused on the next createPact —
   * there is no refund call (and none is needed; funds are not lost).
   */
  const createContract = async () => {
    if (isLoading.get()) return;

    const partnerValue = partnerAddress.get().trim();
    if (!partnerValue) throw new Error(t("partnerRequired"));
    if (!isValidNeoAddress(partnerValue)) throw new Error(t("partnerInvalid"));
    if (!stakeAmount.get()) throw new Error(t("stakeRequired"));

    const stake = parseFloat(stakeAmount.get());
    const durationDays = parseInt(duration.get(), 10);
    const titleValue = contractTitle.get().trim();
    const termsValue = contractTerms.get().trim();

    if (
      !Number.isFinite(stake) ||
      stake < MIN_STAKE_GAS ||
      !Number.isFinite(durationDays) ||
      durationDays < MIN_DURATION_DAYS
    ) {
      throw new Error(t("stakeOrDurationInvalid"));
    }
    if (!titleValue) throw new Error(t("titleRequired"));
    if (titleValue.length > TITLE_MAX) throw new Error(t("titleTooLong"));
    if (termsValue.length > TERMS_MAX) throw new Error(t("termsTooLong"));

    const stakeBase = toBaseUnits(stakeAmount.get());
    if (stakeBase < MIN_STAKE_GAS * Number(GAS_DECIMALS_MULTIPLIER)) {
      throw new Error(t("stakeOrDurationInvalid"));
    }

    validationNotice.set("");
    actionNotice.set(t("contractPreparing", { title: titleValue, amount: `${stakeAmount.get()} GAS` }));
    isLoading.set(true);
    try {
      const { addr: creatorAddr, hash: creatorHash } = await requireWallet();
      // The creator must not name themselves as the partner (the contract
      // rejects party1 == party2; surface a clean message pre-submit).
      const partnerHash = addressToScriptHash(partnerValue);
      if (!partnerHash) throw new Error(t("partnerInvalid"));
      if (partnerHash.toLowerCase() === creatorHash.toLowerCase()) {
        throw new Error(t("partnerSelf"));
      }

      const contractHash = chain.contractAddress.get();
      if (!contractHash) throw new Error(t("contractUnavailable"));

      const durationSeconds = durationDays * 86_400;

      // Step 1: DEPOSIT — GAS transfer to the contract with the stake memo so
      // OnNEP17Payment credits party1's prepaid balance.
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: creatorHash },
          { type: "Hash160", value: contractHash },
          { type: "Integer", value: stakeBase.toString() },
          { type: "String", value: STAKE_MEMO },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      // Step 2: createPact — consumes the prepaid credit as party1's stake and
      // opens the pact. Read the new id from the PactCreated event (state[0]).
      let pactId = "";
      try {
        const result = await chain.invoke(
          "createPact",
          [
            { type: "Hash160", value: creatorHash },
            { type: "Hash160", value: partnerHash },
            { type: "Integer", value: stakeBase.toString() },
            { type: "Integer", value: String(durationSeconds) },
          ],
          { waitForEvent: "PactCreated" },
        );
        pactId = toIdString(eventValue(result.event, 0));
        if (!pactId) {
          // Event slot unavailable / unparsed — fall back to lastPactId().
          pactId = toIdString(await chain.read("lastPactId", []));
        }
      } catch (createErr) {
        console.error(
          "[useBreakup] createPact failed after deposit succeeded:",
          createErr instanceof Error ? createErr.message : String(createErr),
        );
        // Deposit landed, pact not created — the credit is held under party1 as
        // reusable prepaid credit for the next createPact (no refund needed).
        throw new Error(t("depositPrepaidNoContract"));
      }

      // Persist the title + terms ON-DEVICE under the on-chain pact id (only the
      // stake + lock are on-chain).
      if (pactId) {
        saveLocalMeta(pactId, { title: titleValue, terms: termsValue });
      }

      eventBus.emit("breakup:created", { action: t("contractCreated") });

      // Reset form.
      partnerAddress.set("");
      stakeAmount.set("");
      duration.set("");
      contractTitle.set("");
      contractTerms.set("");
      lastSubmittedTitle.set(titleValue);
      actionNotice.set(t("contractSubmitted", { title: titleValue }));

      await loadContracts();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      actionNotice.set(message);
      eventBus.emit("breakup:error", { message });
      throw e;
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Sign (match) a pending pact as the named partner (party2).
   *
   * Two steps, both signed by party2:
   *   1. DEPOSIT — transfer the MATCHING stake to the contract with the stake
   *      memo, crediting party2's prepaid balance.
   *   2. signPact(pactId, party2) — consumes that credit as party2's stake and
   *      flips the pact to ACTIVE.
   *
   * If step 2 fails after a successful deposit, the prepaid credit remains under
   * party2 and is reused on the next signPact (no refund needed). The matching
   * stake is taken from the pact's on-chain stake field (base units), not from
   * the human-rounded view value, so it always exactly matches party1's lock.
   */
  const signContract = async (contract: { id?: number; pactId?: string; stake?: number; stakeRaw?: string }) => {
    if (isLoading.get()) return;

    const pactId = resolvePactId(contract);
    actionNotice.set(t("contractSigning", { id: pactId }));
    isLoading.set(true);
    try {
      const { hash: party2Hash } = await requireWallet();
      const contractHash = chain.contractAddress.get();
      if (!contractHash) throw new Error(t("contractUnavailable"));

      // Read the pact's exact stake (base units) so party2's deposit matches
      // party1's lock precisely, independent of any human-rounded view value.
      const raw = await chain.read("getPact", [{ type: "Integer", value: pactId }]);
      const stakeBase = parseBigInt((raw as Record<string, unknown> | null)?.stake);
      if (stakeBase <= 0n) {
        // Fall back to the carried raw stake (also base units) if present.
        const carried = parseBigInt(contract.stakeRaw);
        if (carried <= 0n) throw new Error(t("contractUnavailable"));
      }
      const matchBase = stakeBase > 0n ? stakeBase : parseBigInt(contract.stakeRaw);

      // Step 1: DEPOSIT — matching stake with the stake memo (credits party2).
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: party2Hash },
          { type: "Hash160", value: contractHash },
          { type: "Integer", value: matchBase.toString() },
          { type: "String", value: STAKE_MEMO },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      // Step 2: signPact — consumes the matching credit and activates the pact.
      try {
        await chain.invoke(
          "signPact",
          [
            { type: "Integer", value: pactId },
            { type: "Hash160", value: party2Hash },
          ],
          { waitForEvent: "PactSigned" },
        );
      } catch (signErr) {
        console.error(
          "[useBreakup] signPact failed after deposit succeeded:",
          signErr instanceof Error ? signErr.message : String(signErr),
        );
        throw new Error(t("depositPrepaidNoSign"));
      }

      eventBus.emit("breakup:signed", { action: t("contractSigned") });
      actionNotice.set(t("contractSigned"));
      await loadContracts();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      actionNotice.set(message);
      eventBus.emit("breakup:error", { message });
      throw e;
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Break a pact via breakPact(pactId, breaker), where breaker = connected
   * wallet. If the pact is ACTIVE the OTHER party receives BOTH stakes (the
   * breaker forfeits); if it is still PENDING and the breaker is party1, the
   * pact is cancelled and party1's stake refunded.
   */
  const breakContract = async (contract: { id?: number; pactId?: string }) => {
    if (isLoading.get()) return;

    const pactId = resolvePactId(contract);
    actionNotice.set(t("contractBreaking", { id: pactId }));
    isLoading.set(true);
    try {
      const { hash: breakerHash } = await requireWallet();

      await chain.invoke(
        "breakPact",
        [
          { type: "Integer", value: pactId },
          { type: "Hash160", value: breakerHash },
        ],
        { waitForEvent: "PactBroken" },
      );

      eventBus.emit("breakup:broken", { action: t("contractBroken") });
      actionNotice.set(t("contractBroken"));
      await loadContracts();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      actionNotice.set(message);
      eventBus.emit("breakup:error", { message });
      throw e;
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Settle an honored, expired pact via settlePact(pactId). PERMISSIONLESS — any
   * caller can trigger it once an ACTIVE pact passes its endTime — so both
   * parties get their stake refunded. Surfaced on a card whose `settleable`
   * flag is set (active && now >= endTime).
   */
  const settleContract = async (contract: { id?: number; pactId?: string }) => {
    if (isLoading.get()) return;

    const pactId = resolvePactId(contract);
    actionNotice.set(t("contractSettling", { id: pactId }));
    isLoading.set(true);
    try {
      // settlePact takes no witness (permissionless), but ensure a wallet is
      // available to submit the transaction.
      await requireWallet();

      await chain.invoke(
        "settlePact",
        [{ type: "Integer", value: pactId }],
        { waitForEvent: "PactSettled" },
      );

      eventBus.emit("breakup:settled", { action: t("contractSettled") });
      actionNotice.set(t("contractSettled"));
      await loadContracts();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      actionNotice.set(message);
      eventBus.emit("breakup:error", { message });
      throw e;
    } finally {
      isLoading.set(false);
    }
  };

  return {
    // Wallet state
    address,

    // Form state
    partnerAddress,
    stakeAmount,
    duration,
    contractTitle,
    contractTerms,

    // Data state
    contracts,
    isLoading,
    serviceNotice,
    actionNotice,
    validationNotice,
    lastSubmittedTitle,

    // Derived state
    contractCount,
    activeCount,
    pendingCount,
    brokenCount,

    // Methods
    loadContracts,
    createContract,
    signContract,
    breakContract,
    settleContract,
  };
}

export type UseBreakupReturn = ReturnType<typeof useBreakup>;
