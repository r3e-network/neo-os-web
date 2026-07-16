/**
 * useGasBox — Domain logic for the GasBox (gacha/mystery box) miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppGasBox) via
 * the MiniApp framework (ctx.framework): reads/invokes on app.chain, the
 * deposit-then-commit lane on app.funds.prepayAndCall, and the capped
 * Committed/Settled recovery walks on app.events.listAll. The earlier path
 * SIMULATED prizes client-side
 * (os.game.placeBet + an os.storage machine catalog) and resolved the won item
 * with Math.random — players paid but never received a real on-chain prize. The
 * old PlatformGame gacha needed the Morpheus VRF oracle's off-chain signer to
 * settle, which is non-operational.
 *
 * MiniAppGasBoxV2 is self-contained and uses a COMMIT/REVEAL flow that closes
 * the v1 same-tx abort-on-loss drain: the v1 pull() drew + paid in ONE tx, so a
 * losing draw could be aborted in the wallet. V2 splits each play into two txs
 * that span a block boundary, so the outcome is UNKNOWABLE at commit and CANNOT
 * be aborted on a loss:
 *
 *   1. commit(machineId, player) -> betId   (deposit-then-commit, one tx)
 *      Consumes the machine price from prepaid play credit and RESERVES the
 *      machine's worst-case prize from its pool. The bet is escrowed and
 *      irrevocable. Emits Committed(betId, machineId, player, wager, commitIndex).
 *   2. settle(betId) -> itemIndex            (a STRICTLY LATER block, permissionless)
 *      Reverts unless Ledger.CurrentIndex > commitIndex, so it can only run from
 *      the next block onward. Draws the weighted item from that block's
 *      a fixed commitIndex+1 block beacon, pays it, and emits
 *      Settled(betId, machineId, player, itemIndex, prize). Safe to retry.
 *
 * The prize is real — drawn and paid ON-CHAIN, no oracle. The fixed
 * commitIndex+1 beacon closes abort-and-retry grinding, but it is intentionally
 * described as low-stakes commit/reveal rather than VRF-grade randomness.
 *
 * DEPLOYMENT GATE: the hash currently present in both app manifest bindings is
 * an older settle-block Runtime.GetRandom build. It remains readable so users
 * can inspect and recover funds, but new commits/publishing/top-ups/activation
 * are rejected until a fixed-beacon deployment replaces that binding.
 *
 * Contract interaction model (verified against the deployed v2 ABI):
 *
 *   READS (app.chain.readRaw, default app contract script hash):
 *     lastMachineId()                 -> Integer (machines are ids 1..lastMachineId)
 *     getMachine(machineId)           -> Map{id,creator,name,prizeAsset,price,
 *                                            itemCount,totalWeight,maxPrize,
 *                                            poolBalance,revenue,active}
 *     getItem(machineId,index)        -> Map{index,name,weight,amount}
 *     playCreditOf(player)            -> Integer (prepaid GAS credit in base units)
 *     getPendingBet(betId)            -> Map{betId,machineId,player,wager,reserved,
 *                                            commitIndex,settled}
 *     withdraw(account)               -> all unused prepaid GAS credit
 *
 *   PLAYER MUTATIONS (app.chain.invoke / app.funds.prepayAndCall):
 *     1. PREPAY play credit — a GAS transfer to the contract with the memo
 *        "miniapp-gasbox:play" so OnNEP17Payment credits the player's play
 *        balance (only when playCreditOf(player) < price):
 *          transfer(from, CONTRACT, priceBaseUnits, "miniapp-gasbox:play")
 *          { scriptHash: GAS_HASH }
 *     2a. commit(machineId, player) -> betId
 *        Consumes the price from play credit, reserves the worst-case prize, and
 *        escrows the bet. The betId + commitIndex are read from the "Committed"
 *        event (betId is slot 0); the commitIndex is taken authoritatively from
 *        getPendingBet(betId) when available, falling back to the event tail.
 *     2b. settle(betId) -> itemIndex
 *        Drawn on a later block. The won item index is read from the "Settled"
 *        event: Settled(betId, machineId, player, itemIndex, prize), then
 *        resolved against getItem(machineId, itemIndex). Permissionless + safe to
 *        retry; a second settle on an already-settled bet reverts, in which case
 *        the recorded outcome is recovered from getPendingBet / the Settled log.
 *
 *   STUDIO/CREATOR MUTATIONS (app.chain.invoke):
 *     createMachine(creator, name, prizeAsset, price) -> machineId
 *     addItem(creator, machineId, name, weight, amount) -> index
 *     FUND POOL — a prizeAsset transfer to the contract with the memo
 *       "miniapp-gasbox-pool:<machineId>":
 *         transfer(from, CONTRACT, amount, "miniapp-gasbox-pool:<machineId>")
 *         { scriptHash: prizeAssetHash }
 *     setActive(creator, machineId, active)        — activates only if pool >= maxPrize
 *     withdrawRevenue(creator, machineId, to)
 *     withdrawPool(creator, machineId, to, amount) — FREE pool only
 *
 * AMOUNT CONVENTION: the contract takes BASE UNITS. GAS is 1e8 base units per
 * GAS; NEO is indivisible (the integer token count, no scaling). The play price
 * is always GAS; prize amounts are in the machine's prizeAsset base units.
 *
 * The composable owns:
 *   - Reactive state (observables + derived) for manifest/PlayArea bindings
 *   - Machine selection + display logic
 *   - Loading/commit/reveal/publishing UI flags (double-submit guards)
 *   - The commit→wait-block→settle two-step play orchestration + Reveal-retry
 *   - Reading the machine catalog + items straight from chain
 *   - The won-item read from the Settled event + getItem
 */

import { singleFlight } from "@framework/utils/async-utils";
import { createObservable, createDerived, createReadCell } from "@shared/react/context";
import type { ReadCell } from "@shared/react/context";
import { FrameworkPrepaidActionError, type MiniAppFramework } from "@shared/react";
import { amountToBaseUnits as toBaseUnits } from "@shared/utils/amounts";
import { eventValue } from "@shared/utils/chain-events";
import { formatGas, formatAddress, sleep } from "@shared/utils/format";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { Machine, MachineItem } from "../types";
import { assessGasBoxDeployment } from "../deployment";

// ============================================================================
// Constants
// ============================================================================

const NEO_HASH_NORMALIZED = normalizeScriptHash(BLOCKCHAIN_CONSTANTS.NEO_HASH);
const GAS_HASH_NORMALIZED = normalizeScriptHash(BLOCKCHAIN_CONSTANTS.GAS_HASH);

/** Memo the contract requires on the play prepay transfer (appId + ":play"). */
const PLAY_MEMO = "miniapp-gasbox:play";

/** Memo prefix for funding a machine's prize pool (appId + "-pool:<machineId>"). */
const POOL_MEMO_PREFIX = "miniapp-gasbox-pool:";

/** Hard cap on how many machines to enumerate per refresh (defensive). */
const MAX_MACHINES = 500;

/** Hard cap on items read per machine (defensive). */
const MAX_ITEMS_PER_MACHINE = 100;

/**
 * settle() reverts until Ledger.CurrentIndex > commitIndex (i.e. from the next
 * block onward). There is no block-height read on the shared chain service, so
 * the reveal waits roughly one Neo N3 block (~15s) before the first settle, then
 * retries a few times with a short backoff to ride out indexer lag and a slow
 * block. The contract's revert IS the safety gate — these timings only avoid a
 * guaranteed-doomed first attempt.
 */
const REVEAL_FIRST_WAIT_MS = 15_000;
const REVEAL_RETRY_DELAY_MS = 6_000;
const REVEAL_MAX_ATTEMPTS = 4;

/**
 * A settle() reverts (rather than fails for another reason) when the reveal
 * block has not been minted yet OR when the bet was already settled. Both are
 * recoverable: the former is retried, the latter recovers the recorded outcome.
 * Matched loosely against the surfaced revert message.
 */
const isTooEarlyRevert = (message: string): boolean =>
  /current\s*index|commit|too\s*early|not\s*yet|later\s*block|reveal/i.test(message);

const isAlreadySettledRevert = (message: string): boolean =>
  /already\s*settled|settled|no\s*pending|unknown\s*bet|not\s*found/i.test(message);

/** Player-facing phase of a two-step play (commit → reveal → done). */
export type BetPhase = "idle" | "committing" | "committed" | "settling" | "settled";
export type CatalogStatus = "idle" | "loading" | "ready" | "empty" | "error";
export type RuntimeStatus = "idle" | "checking" | "ready" | "incompatible" | "error";
export type WalletStatus = "disconnected" | "loading" | "ready" | "error";

/**
 * One settled catalog read: the machines it yielded plus whether any machine
 * read failed ("partial"). The legacy CatalogStatus / catalogError pair is
 * DERIVED from this snapshot + the read-cell status (read-cell adoption):
 * partial → "error" + t("gasboxCatalogPartial"), an empty full read → "empty".
 */
interface CatalogSnapshot {
  machines: Machine[];
  partial: boolean;
}

/** Stable empty-catalog identity for the derived machines lane (no churn). */
const NO_MACHINES: Machine[] = [];

interface PendingBetJournal {
  version: 1;
  network: string;
  contractHash: string;
  playerHash: string;
  machineId: string;
  betId: string | null;
  commitTxid: string;
  committedAt: number;
}

// ============================================================================
// Types
// ============================================================================

export type PrizeAsset = "NEO" | "GAS";

/**
 * Studio publish-form item (string-typed for controlled inputs).
 *
 * Note: there is NO creator-chosen rarity. The contract stores only name +
 * weight + amount; the displayed rarity tier is DERIVED from each item's weight
 * share on read-back (rarityFromShare). A `rarity` field here would be silently
 * discarded, so the form does not collect one.
 */
export interface MachineItemData {
  name: string;
  /** Weight (relative draw probability) — positive integer. */
  weight: string;
  /** Prize amount in prizeAsset human units (GAS decimal / NEO integer). */
  amount: string;
}

/** Studio publish-form machine data. */
export interface MachineData {
  name: string;
  description?: string;
  category?: string;
  tags?: string;
  /** Play price in GAS human units (e.g. "0.1"). */
  price: string;
  /** Prize asset paid out by every item — GAS or NEO. */
  prizeAsset: PrizeAsset;
  items: MachineItemData[];
}

export interface UseGasBoxOptions {
  /** MiniApp framework SDK from ctx.framework. Routes reads, invokes, wallet
   *  address/contract accessors and ensureWallet through the framework chain
   *  layer, the deposit-then-commit lane through app.funds.prepayAndCall, and
   *  the Committed / Settled recovery log walks through app.events.listAll
   *  (capped, defensive). */
  app: MiniAppFramework;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Amount helpers
// ============================================================================
// toBaseUnits (amountToBaseUnits) comes from @shared/utils/amounts — GAS is
// scaled ×1e8 without floats; NEO is the integer token count (never scaled).

/** Parse a plain positive integer (weights, NOT scaled). 0n if invalid. */
const toPositiveInt = (raw: string): bigint => {
  const trimmed = String(raw ?? "").trim();
  if (!/^\d+$/.test(trimmed)) return 0n;
  const n = BigInt(trimmed);
  return n > 0n ? n : 0n;
};

/** Resolve the NEP-17 token script hash for an asset symbol. */
const assetHash = (asset: PrizeAsset): string =>
  asset === "NEO" ? BLOCKCHAIN_CONSTANTS.NEO_HASH : BLOCKCHAIN_CONSTANTS.GAS_HASH;

/** Resolve a prizeAsset script hash (from getMachine) to its symbol. */
const assetSymbolFromHash = (hash: unknown): PrizeAsset => {
  const normalized = normalizeScriptHash(String(hash ?? ""));
  if (normalized === NEO_HASH_NORMALIZED) return "NEO";
  // Default to GAS for the GAS hash and anything unresolved (play price is GAS).
  if (normalized === GAS_HASH_NORMALIZED) return "GAS";
  return "GAS";
};

/** Format a base-unit prize amount for display by asset. NEO is integer. */
const formatPrizeAmount = (amount: bigint, asset: PrizeAsset): string =>
  asset === "NEO" ? amount.toString() : formatGas(amount, 4);

// ============================================================================
// On-chain parsing
// ============================================================================

/** Coerce a raw map value to a number (NeoVM Integers parse as number/string). */
const asNumber = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const isIntegerLike = (value: unknown): boolean =>
  typeof value === "bigint" ||
  (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) ||
  (typeof value === "string" && /^-?\d+$/.test(value.trim()));

/** Build the icon hint for an item from its rarity / prize asset. */
const iconForItem = (rarity: string, asset: PrizeAsset): string => {
  const r = rarity.toUpperCase();
  if (r === "LEGENDARY") return "crown";
  if (r === "EPIC") return "gem";
  if (r === "RARE") return "gift";
  return asset === "NEO" ? "image" : "coin";
};

/** Default rarity bucket inferred from a weight share (used for display only). */
const rarityFromShare = (share: number): string => {
  if (share <= 5) return "LEGENDARY";
  if (share <= 15) return "EPIC";
  if (share <= 35) return "RARE";
  return "COMMON";
};

// ============================================================================
// Composable
// ============================================================================

export function useGasBox({ app, t }: UseGasBoxOptions) {
  // ── Machine State ──────────────────────────────────────────────────
  // The machine catalog rides the platform read-cell (read-cell adoption):
  // `catalog.value` holds the last settled snapshot (undefined until the first
  // read publishes; a failed re-read keeps the last good machines renderable)
  // and `catalog.status` is the platform-owned "have we asked yet?" signal.
  // The loader body lives with the other chain reads (readCatalog, below); the
  // legacy machines / isLoadingMachines / catalogStatus / catalogError quartet
  // is DERIVED so every existing binding keeps its Observable shape.
  const catalog: ReadCell<CatalogSnapshot> = createReadCell(() => readCatalog());
  const machines = createDerived<Machine[]>(
    () => catalog.value.get()?.machines ?? NO_MACHINES,
    [catalog.value],
  );
  const selectedMachine = createObservable<Machine | null>(null);
  const isLoadingMachines = createDerived(
    () => catalog.status.get() === "loading",
    [catalog.status],
  );
  // Cross-lane input: a runtime-check failure stamps the catalog lane in error
  // WITHOUT a load (the loader never ran, so the cell can't know — see
  // loadAll), and a total load failure records its message here. A settled
  // load overwrites the stamp — last-write-wins, exactly like the imperative
  // status writes this replaces.
  const catalogFault = createObservable<{ message: string | null } | null>(null);
  const catalogStatus = createDerived<CatalogStatus>(
    () => {
      const status = catalog.status.get();
      if (status === "loading") return "loading";
      if (catalogFault.get()) return "error";
      if (status !== "ready") return status; // "idle" | "error"
      const snapshot = catalog.value.get();
      if (snapshot?.partial) return "error";
      return (snapshot?.machines.length ?? 0) > 0 ? "ready" : "empty";
    },
    [catalog.status, catalog.value, catalogFault],
  );
  const catalogError = createDerived<string | null>(
    () => {
      const fault = catalogFault.get();
      if (fault) return fault.message;
      return catalog.value.get()?.partial ? t("gasboxCatalogPartial") : null;
    },
    [catalog.value, catalogFault],
  );

  // ── Runtime / Wallet Evidence ─────────────────────────────────────
  const runtimeStatus = createObservable<RuntimeStatus>("idle");
  const runtimeNetwork = createObservable("");
  const runtimeContract = createObservable("");
  const runtimeError = createObservable<string | null>(null);
  const pendingBetCount = createObservable("0");
  const walletStatus = createObservable<WalletStatus>("disconnected");
  const walletError = createObservable<string | null>(null);
  const walletGasBase = createObservable(0n);
  const walletNeoBase = createObservable(0n);

  // ── Play State ─────────────────────────────────────────────────────
  // isPlaying is true for the WHOLE two-step play (commit through settle) so the
  // existing single double-submit guard and the view's spinner still hold.
  const isPlaying = createObservable(false);
  const showResult = createObservable(false);
  const resultItem = createObservable<MachineItem | null>(null);
  const playError = createObservable<string | null>(null);
  const showFireworks = createObservable(false);
  // Prepaid play credit (base units, GAS) held on the contract under the player.
  // Surfaced so a stranded prepay is visible, auto-consumed by the next play,
  // or explicitly reclaimable through withdraw(account).
  const playCreditBase = createObservable(0n);

  // ── Commit/Reveal (two-step) State ─────────────────────────────────
  // The play is no longer instant: a committed bet awaits a later-block reveal.
  // These observables drive the pending "drawing on next block" UI and the
  // Reveal-retry button. pendingBetId is the resume handle — a settle can always
  // be retried against it (settle is permissionless + safe to retry).
  const betPhase = createObservable<BetPhase>("idle");
  const pendingBetId = createObservable<string | null>(null);
  const pendingMachineId = createObservable<string | null>(null);
  // True when a committed bet still needs (or is mid-) reveal. Drives the
  // Reveal-retry affordance so a timed-out settle is recoverable. Also true when
  // the bet is committed but its betId is still unknown (commit event missed) —
  // revealPending() then recovers the betId from the Committed log before
  // settling, so the button must be reachable.
  const canReveal = createDerived(
    () =>
      betPhase.get() !== "settled" &&
      betPhase.get() !== "idle" &&
      betPhase.get() !== "committing" &&
      (pendingBetId.get() !== null || betPhase.get() === "committed"),
    [pendingBetId, betPhase],
  );

  // ── Publish State ──────────────────────────────────────────────────
  const isPublishing = createObservable(false);
  const studioOpen = createObservable(false);
  const isWithdrawingCredit = createObservable(false);
  const isWithdrawingPool = createObservable(false);

  // ── Address State ──────────────────────────────────────────────────
  const address = createObservable<string | null>(app.chain.address.get() ?? null);

  const setAddress = (addr: string | null) => {
    address.set(addr ?? null);
  };

  const normalizeBinding = (value: string): string =>
    String(value ?? "").trim().toLowerCase();

  const pendingJournalKey = (
    network: string,
    contractHash: string,
    playerHash: string,
  ): string =>
    `pending-bet:v1:${normalizeBinding(network)}:${normalizeBinding(contractHash)}:${normalizeBinding(playerHash)}`;

  const currentPendingBinding = (): {
    network: string;
    contractHash: string;
    playerHash: string;
  } | null => {
    const playerAddr = address.get();
    const playerHash = playerAddr ? addressToScriptHash(playerAddr) : "";
    const network = runtimeNetwork.get();
    const contractHash = runtimeContract.get() || app.chain.contractAddress.get() || "";
    if (!network || !contractHash || !playerHash) return null;
    return { network, contractHash, playerHash };
  };

  const persistPendingJournal = (
    machineId: string,
    betId: string | null,
    commitTxid: string,
  ): void => {
    const binding = currentPendingBinding();
    if (!binding) return;
    const record: PendingBetJournal = {
      version: 1,
      ...binding,
      machineId,
      betId,
      commitTxid,
      committedAt: Date.now(),
    };
    app.storage.local.set(
      pendingJournalKey(binding.network, binding.contractHash, binding.playerHash),
      record,
    );
  };

  const readPendingJournal = (): PendingBetJournal | null => {
    const binding = currentPendingBinding();
    if (!binding) return null;
    const key = pendingJournalKey(binding.network, binding.contractHash, binding.playerHash);
    const record = app.storage.local.get<PendingBetJournal | null>(key, null);
    const valid =
      record?.version === 1 &&
      normalizeBinding(record.network) === normalizeBinding(binding.network) &&
      normalizeBinding(record.contractHash) === normalizeBinding(binding.contractHash) &&
      normalizeBinding(record.playerHash) === normalizeBinding(binding.playerHash) &&
      /^\d+$/.test(record.machineId) &&
      (record.betId === null || /^\d+$/.test(record.betId)) &&
      Number.isFinite(record.committedAt) && record.committedAt > 0;
    if (!valid) {
      app.storage.local.delete(key);
      return null;
    }
    return record;
  };

  const clearPendingJournal = (): void => {
    const binding = currentPendingBinding();
    if (!binding) return;
    app.storage.local.delete(
      pendingJournalKey(binding.network, binding.contractHash, binding.playerHash),
    );
  };

  // ── Helpers ────────────────────────────────────────────────────────

  const resetResult = () => {
    showResult.set(false);
    resultItem.set(null);
    playError.set(null);
    showFireworks.set(false);
    // Clearing the result also clears a fully-settled pending bet so the next
    // play starts clean. A still-pending (un-revealed) bet is preserved so the
    // Reveal-retry path survives a dismissed result.
    if (betPhase.get() === "settled") {
      betPhase.set("idle");
      pendingBetId.set(null);
      pendingMachineId.set(null);
    }
  };

  /** Build a MachineItem from a getItem Map (display + draw fields). */
  const buildItem = (
    raw: Record<string, unknown>,
    asset: PrizeAsset,
    totalWeight: number,
  ): MachineItem => {
    const index = asNumber(raw.index);
    const weight = asNumber(raw.weight);
    const amountBase = parseBigInt(raw.amount);
    const share = totalWeight > 0 ? Number(((weight / totalWeight) * 100).toFixed(2)) : 0;
    const rarity = rarityFromShare(share);
    return {
      index,
      name: String(raw.name ?? ""),
      probability: weight,
      displayProbability: share,
      rarity,
      // Map prize asset to the legacy assetType field (1 = NEP-17 fungible).
      assetType: 1,
      assetHash: assetHash(asset),
      amountRaw: Number(amountBase),
      amountBaseUnits: amountBase.toString(),
      amountDisplay: `${formatPrizeAmount(amountBase, asset)} ${asset}`,
      tokenId: "",
      stockRaw: 0,
      stockDisplay: "0",
      tokenCount: 0,
      decimals: asset === "NEO" ? 0 : 8,
      // A machine that is active has a pool covering its max prize, so every
      // item is payable. Inactive machines surface as not-ready below.
      available: weight > 0,
      icon: iconForItem(rarity, asset),
    };
  };

  /** Read a machine + all its items into a normalized Machine. */
  const readMachine = async (id: number): Promise<Machine | null> => {
    const raw = await app.chain.readRaw("getMachine", [
      { type: "Integer", value: String(id) },
    ]);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    // An unknown / zeroed machine yields an empty map (no creator key).
    if (!record.creator) return null;

    const asset = assetSymbolFromHash(record.prizeAsset);
    const priceBase = parseBigInt(record.price);
    const itemCount = Math.min(asNumber(record.itemCount), MAX_ITEMS_PER_MACHINE);
    const totalWeight = asNumber(record.totalWeight);
    const maxPrize = parseBigInt(record.maxPrize);
    const poolBalance = parseBigInt(record.poolBalance);
    const reservedPool = parseBigInt(record.reservedPool);
    const reportedFreePool = parseBigInt(record.freePool);
    const freePool =
      record.freePool !== undefined
        ? reportedFreePool
        : poolBalance >= reservedPool
          ? poolBalance - reservedPool
          : 0n;
    const revenue = parseBigInt(record.revenue);
    const active = Boolean(record.active);

    // V2 stores every item at indices 1..itemCount. Best-effort: a single failed
    // read drops that item rather than failing the whole machine.
    const itemPromises: Promise<MachineItem | null>[] = [];
    for (let index = 1; index <= itemCount; index += 1) {
      itemPromises.push(
        (async () => {
          try {
            const itemRaw = await app.chain.readRaw("getItem", [
              { type: "Integer", value: String(id) },
              { type: "Integer", value: String(index) },
            ]);
            if (!itemRaw || typeof itemRaw !== "object" || Array.isArray(itemRaw)) {
              return null;
            }
            return buildItem(itemRaw as Record<string, unknown>, asset, totalWeight);
          } catch (e) {
            console.warn(
              "[useGasBox] getItem failed for",
              `${id}:${index}`,
              ":",
              e instanceof Error ? e.message : String(e),
            );
            return null;
          }
        })(),
      );
    }
    const items = (await Promise.all(itemPromises)).filter(
      (item): item is MachineItem => item !== null,
    );
    if (items.length !== itemCount) {
      throw new Error(t("gasboxItemReadFailed"));
    }

    const availableItems = items.filter((item) => item.available);
    const availableWeight = availableItems.reduce((sum, item) => sum + item.probability, 0);
    // Only the FREE pool can accept another commit. Reserved funds already
    // belong to unsettled pulls and must never arm the next play.
    const poolReady = maxPrize > 0n ? freePool >= maxPrize : freePool > 0n;
    const inventoryReady = availableWeight > 0 && poolReady;

    const firstAvailable = availableItems[0];
    const topItem = firstAvailable
      ? availableItems.reduce(
          (prev, curr) => (curr.probability < prev.probability ? curr : prev),
          firstAvailable,
        )
      : items[0] ?? null;

    const creator = String(record.creator ?? "");
    const name = String(record.name ?? "");

    return {
      id: String(id),
      name,
      description: "",
      category: "",
      tags: "",
      tagsList: [],
      creator: formatAddress(creator),
      creatorHash: creator,
      owner: formatAddress(creator),
      ownerHash: creator,
      priceRaw: Number(priceBase),
      priceBaseUnits: priceBase.toString(),
      price: formatGas(priceBase, 4),
      itemCount: items.length,
      totalWeight,
      availableWeight,
      // Estimated plays = accrued revenue / play price (the contract keeps no
      // per-machine play counter). Under-reports after a revenue withdrawal, so
      // the card labels it "est. plays". 0 when price unknown.
      plays: priceBase > 0n ? Number(revenue / priceBase) : 0,
      revenueRaw: Number(revenue),
      revenueBaseUnits: revenue.toString(),
      revenue: formatGas(revenue, 4),
      sales: 0,
      salesVolume: "0",
      salesVolumeRaw: 0,
      createdAt: id,
      lastPlayedAt: 0,
      active,
      listed: active,
      banned: false,
      locked: false,
      forSale: false,
      salePrice: "0",
      salePriceRaw: 0,
      inventoryReady,
      items,
      topPrize: topItem?.name || "",
      winRate: topItem?.probability || 0,
      // GasBox-specific on-chain economics.
      prizeAsset: asset,
      poolBalanceRaw: Number(poolBalance),
      poolBalanceBaseUnits: poolBalance.toString(),
      poolBalance: formatPrizeAmount(poolBalance, asset),
      reservedPool: formatPrizeAmount(reservedPool, asset),
      reservedPoolBaseUnits: reservedPool.toString(),
      freePool: formatPrizeAmount(freePool, asset),
      freePoolBaseUnits: freePool.toString(),
      maxPrizeRaw: Number(maxPrize),
      maxPrizeBaseUnits: maxPrize.toString(),
      maxPrize: formatPrizeAmount(maxPrize, asset),
      poolReady,
    };
  };

  // ── Data Loading (direct chain reads) ──────────────────────────────

  /**
   * Read the machine catalog snapshot straight from the contract (the
   * read-cell's loader). Machines are ids 1..lastMachineId(); each is read via
   * getMachine + getItem. This replaces the os.storage catalog entirely.
   * Newest first (highest id). SOME failed machine reads still settle the
   * snapshot (partial: true — the derived legacy status surfaces it as "error"
   * + t("gasboxCatalogPartial")); ALL reads failing throws a catalog fault,
   * never an empty catalog.
   */
  const readCatalog = async (): Promise<CatalogSnapshot> => {
    const last = Math.min(
      await app.chain.query("lastMachineId", []).asInt(),
      MAX_MACHINES,
    );

    const ids: number[] = [];
    for (let id = 1; id <= last; id += 1) ids.push(id);

    let failedMachineReads = 0;
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          return await readMachine(id);
        } catch (e) {
          failedMachineReads += 1;
          console.warn(
            "[useGasBox] getMachine failed for",
            id,
            ":",
            e instanceof Error ? e.message : String(e),
          );
          return null;
        }
      }),
    );

    if (ids.length > 0 && failedMachineReads === ids.length) {
      throw new Error(t("gasboxCatalogReadFailed"));
    }

    return {
      machines: results
        .filter((m): m is Machine => m !== null)
        .sort((a, b) => b.createdAt - a.createdAt),
      partial: failedMachineReads > 0,
    };
  };

  /**
   * Load the machine catalog through the read-cell. In-flight dedup keeps the
   * old isLoadingMachines-guard semantics via the canonical singleFlight
   * (RFC P0-2 "drop": a re-entrant call resolves without running). A settled
   * load overwrites any cross-lane runtime stamp (catalogFault); a failed load
   * records its message there while the cell keeps the last good snapshot.
   */
  const loadMachines = singleFlight(
    () => "catalog",
    async () => {
      try {
        const snapshot = await catalog.load();
        catalogFault.set(null);
        // Sync the selected machine with the reloaded data.
        const current = selectedMachine.get();
        if (current) {
          selectedMachine.set(
            snapshot.machines.find((m) => m.id === current.id) || null,
          );
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn(
          "[useGasBox] loadMachines failed:",
          message,
        );
        catalogFault.set({ message });
      }
    },
    { mode: "drop" },
  );

  /** Verify that the selected network exposes the expected GasBox V2 reads. */
  const checkRuntime = async (): Promise<RuntimeStatus> => {
    runtimeStatus.set("checking");
    runtimeError.set(null);
    const contractHash = String(app.chain.contractAddress.get() ?? "").trim();
    runtimeContract.set(contractHash);
    if (!/^0x[0-9a-f]{40}$/i.test(contractHash)) {
      runtimeStatus.set("error");
      runtimeError.set(t("gasboxContractMissing"));
      return "error";
    }
    try {
      const network = String(await app.chain.detectNetwork()).trim() || "unknown";
      runtimeNetwork.set(network);
      const networkKey = network.toLowerCase().replace(/[\s_]+/g, "-");
      const supportedNetwork =
        networkKey === "mainnet" ||
        networkKey === "testnet" ||
        /^neo-?n3-?(?:mainnet|testnet)$/.test(networkKey) ||
        /^n3-?(?:mainnet|testnet)$/.test(networkKey);
      if (!supportedNetwork) {
        throw new Error(t("gasboxUnsupportedNetwork"));
      }
      const [owner, lastMachine, lastBet, pending] = await Promise.all([
        app.chain.readRaw("getOwner", []),
        app.chain.readRaw("lastMachineId", []),
        app.chain.readRaw("lastBetId", []),
        app.chain.readRaw("pendingBetCount", []),
      ]);
      if (!/^(0x)?[0-9a-f]{40}$/i.test(String(owner ?? "").trim())) {
        throw new Error(t("gasboxContractIdentityMismatch"));
      }
      // Parsing these reads is the functional ABI check; zero is valid on a new
      // deployment, while a missing/faulting operation is not.
      if (![lastMachine, lastBet, pending].every(isIntegerLike)) {
        throw new Error(t("gasboxContractIdentityMismatch"));
      }
      pendingBetCount.set(parseBigInt(pending).toString());
      const compatibility = assessGasBoxDeployment(contractHash);
      if (!compatibility.writeCompatible) {
        runtimeError.set(t("gasboxDeploymentIncompatible"));
        runtimeStatus.set("incompatible");
        return "incompatible";
      }
      runtimeStatus.set("ready");
      return "ready";
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      runtimeError.set(message);
      runtimeStatus.set("error");
      return "error";
    }
  };

  /** Read exact connected-wallet NEO/GAS balances without floating-point math. */
  const loadWalletBalances = async (): Promise<void> => {
    const owner = address.get();
    if (!owner) {
      walletGasBase.set(0n);
      walletNeoBase.set(0n);
      walletError.set(null);
      walletStatus.set("disconnected");
      return;
    }
    walletStatus.set("loading");
    walletError.set(null);
    try {
      const [gas, neo] = await Promise.all([
        app.wallet.raw("GAS", owner),
        app.wallet.raw("NEO", owner),
      ]);
      walletGasBase.set(gas);
      walletNeoBase.set(neo);
      walletStatus.set("ready");
    } catch (e) {
      walletGasBase.set(0n);
      walletNeoBase.set(0n);
      walletError.set(e instanceof Error ? e.message : String(e));
      walletStatus.set("error");
    }
  };

  /** Read the player's prepaid play credit (base units) for the credit chip. */
  const loadPlayCredit = async () => {
    const playerAddr = address.get();
    const playerHash = playerAddr ? addressToScriptHash(playerAddr) || null : null;
    if (!playerHash) {
      playCreditBase.set(0n);
      return;
    }
    try {
      playCreditBase.set(
        await app.chain
          .query("playCreditOf", [{ type: "Hash160", value: playerHash }])
          .asBigInt(),
      );
    } catch (e) {
      console.warn(
        "[useGasBox] playCreditOf read failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  const loadAll = async () => {
    setAddress(app.chain.address.get() ?? null);
    const checkedRuntime = await checkRuntime();
    const contractReadable = checkedRuntime === "ready" || checkedRuntime === "incompatible";
    await Promise.all([
      contractReadable ? loadMachines() : Promise.resolve(),
      contractReadable ? loadPlayCredit() : Promise.resolve(),
      loadWalletBalances(),
    ]);
    if (checkedRuntime === "error") {
      // Cross-lane stamp: the catalog is unreadable because the RUNTIME check
      // failed before any catalog read ran. Feeds the derived catalogStatus /
      // catalogError pair through the catalogFault input observable.
      catalogFault.set({ message: runtimeError.get() });
    }
    if (contractReadable) await restorePendingBet();
  };

  // Connecting lives in main.tsx as `actions.registerConnectWallet`
  // (ensureWallet → setAddress mirror seed → loadAll) — no composable wrapper.

  // ── Machine Selection ──────────────────────────────────────────────

  const selectMachine = (machine: Machine) => {
    selectedMachine.set(machine);
  };

  const deselectMachine = () => {
    selectedMachine.set(null);
  };

  // ── Studio (publish) panel routing ─────────────────────────────────

  const openStudio = () => {
    if (runtimeStatus.get() !== "ready") return;
    studioOpen.set(true);
  };

  const closeStudio = () => {
    studioOpen.set(false);
  };

  // ── Play Action (commit → reveal-on-later-block → settle) ──────────

  /**
   * Read getPendingBet(betId) into a normalized record. Returns null when the
   * bet is unknown. Settled V2 records remain readable but intentionally do not
   * contain the outcome item/prize; Settled events carry those fields.
   */
  const readPendingBet = async (
    betId: string,
  ): Promise<{
    machineId: string;
    player: string;
    wager: bigint;
    reserved: bigint;
    commitIndex: bigint;
    settled: boolean;
  } | null> => {
    try {
      const raw = await app.chain.readRaw("getPendingBet", [
        { type: "Integer", value: betId },
      ]);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const record = raw as Record<string, unknown>;
      // An unknown/faulting bet yields no usable machine id.
      if (record.machineId === undefined && record.machine === undefined) return null;
      return {
        machineId: String(record.machineId ?? record.machine ?? ""),
        player: String(record.player ?? ""),
        wager: parseBigInt(record.wager ?? 0),
        reserved: parseBigInt(record.reserved ?? 0),
        commitIndex: parseBigInt(record.commitIndex ?? record.commitBlock ?? 0),
        settled: Boolean(record.settled),
      };
    } catch {
      return null;
    }
  };

  /**
   * Recover the player's most recent still-pending betId from the Committed log.
   * Used when a commit broadcast but its event wasn't observed in the wait window
   * (betId unknown) — the bet is on chain, so the latest Committed(betId, player,
   * …) for this player that getPendingBet confirms is unsettled is the resume
   * handle the Reveal-retry button settles against. Returns null when none found.
   */
  const recoverPendingBetId = async (
    playerHash: string,
    machineIdHint: string,
  ): Promise<string | null> => {
    try {
      // Capped recovery walk (app.events.listAll defaults to the plan's
      // 500-event bound) — a runaway indexer page can't balloon the scan.
      const events = await app.events.listAll("Committed");
      // Newest first — pick the latest Committed for this player that is still
      // pending on chain. betId is slot 0; player is slot 2 for gacha's
      // Committed(betId, machineId, player, wager, commitIndex), but some indexers omit
      // the machineId, so match the player defensively across slots 1 and 2.
      const mine = events
        .filter((ev) => {
          const a = String(eventValue(ev, 1) ?? "").toLowerCase();
          const b = String(eventValue(ev, 2) ?? "").toLowerCase();
          const target = playerHash.toLowerCase();
          return a === target || b === target;
        })
        .map((ev) => String(parseBigInt(eventValue(ev, 0))))
        .filter((id) => id && id !== "0")
        .reverse();
      for (const id of mine) {
        const pending = await readPendingBet(id);
        if (pending && !pending.settled) return id;
      }
    } catch {
      /* fall through */
    }
    // The hint machine has no betId mapping to recover; nothing else to try.
    void machineIdHint;
    return null;
  };

  /**
   * Resolve the won MachineItem for display from an itemIndex + on-chain prize.
   * Prefers the selected machine's cached item table, falls back to a fresh
   * getItem read, and finally to a generic "prize" tile (the event/state already
   * proves the win, so a missing item table must not hide it).
   */
  const setResultFromOutcome = async (
    machineId: string,
    itemIndex: number,
    prizeAmount: bigint,
  ): Promise<void> => {
    const machine =
      machines.get().find((m) => String(m.id) === String(machineId)) ??
      selectedMachine.get();
    const asset: PrizeAsset = machine?.prizeAsset ?? "GAS";

    let wonItem: MachineItem | null =
      machine && Number.isInteger(itemIndex) && itemIndex >= 1
        ? machine.items.find((item) => item.index === itemIndex) ?? null
        : null;

    if (!wonItem && Number.isInteger(itemIndex) && itemIndex >= 1) {
      try {
        const itemRaw = await app.chain.readRaw("getItem", [
          { type: "Integer", value: String(Math.trunc(Number(machineId))) },
          { type: "Integer", value: String(itemIndex) },
        ]);
        if (itemRaw && typeof itemRaw === "object" && !Array.isArray(itemRaw)) {
          wonItem = buildItem(
            itemRaw as Record<string, unknown>,
            asset,
            machine?.totalWeight ?? 0,
          );
        }
      } catch {
        wonItem = null;
      }
    }

    if (wonItem) {
      // Prefer the on-chain prizeAmount from the event for the displayed payout.
      resultItem.set({
        ...wonItem,
        amountRaw: Number(prizeAmount),
        amountBaseUnits: prizeAmount.toString(),
        amountDisplay:
          prizeAmount > 0n
            ? `${formatPrizeAmount(prizeAmount, asset)} ${asset}`
            : wonItem.amountDisplay,
      });
    } else {
      resultItem.set({
        index: itemIndex,
        name: t("unknownPrize"),
        probability: 0,
        displayProbability: 0,
        rarity: "UNKNOWN",
        assetType: 1,
        assetHash: assetHash(asset),
        amountRaw: Number(prizeAmount),
        amountBaseUnits: prizeAmount.toString(),
        amountDisplay:
          prizeAmount > 0n ? `${formatPrizeAmount(prizeAmount, asset)} ${asset}` : "0",
        tokenId: "",
        stockRaw: 0,
        stockDisplay: "0",
        tokenCount: 0,
        decimals: asset === "NEO" ? 0 : 8,
        available: false,
        icon: "gift",
      });
    }

    showResult.set(true);
    showFireworks.set(true);
    betPhase.set("settled");
    clearPendingJournal();
    await Promise.all([loadMachines(), loadPlayCredit(), loadWalletBalances()]);
  };

  /**
   * Recover and show the recorded outcome of an already-settled bet (the retry
   * path raced a prior settle). The Settled event is the source of truth because
   * V2 pending records retain only bet accounting, not itemIndex/prize.
   * Returns true when an outcome was recovered and displayed.
   */
  const recoverSettledOutcome = async (betId: string): Promise<boolean> => {
    try {
      // Capped recovery walk (app.events.listAll defaults to the plan's
      // 500-event bound).
      const events = await app.events.listAll("Settled");
      const match = events.find(
        (ev) => String(eventValue(ev, 0)) === String(betId),
      );
      if (match) {
        const machineId = String(eventValue(match, 1));
        const itemIndex = Number(parseBigInt(eventValue(match, 3)));
        const prize = parseBigInt(eventValue(match, 4));
        await setResultFromOutcome(machineId, itemIndex, prize);
        return true;
      }
    } catch {
      /* fall through */
    }
    return false;
  };

  /**
   * Restore a network + contract + wallet-scoped pending pull after reload.
   * The journal is only a resume hint: getPendingBet and Settled logs remain
   * authoritative, and this function never broadcasts a settle automatically.
   */
  const restorePendingBet = async (): Promise<void> => {
    const binding = currentPendingBinding();
    if (!binding) return;
    const journal = readPendingJournal();
    let betId = journal?.betId ?? null;
    const machineHint = journal?.machineId ?? "";

    if (!betId) {
      betId = await recoverPendingBetId(binding.playerHash, machineHint);
    }

    if (!betId) {
      if (journal) {
        pendingMachineId.set(machineHint || null);
        betPhase.set("committed");
      }
      return;
    }

    const pending = await readPendingBet(betId);
    if (pending && !pending.settled) {
      pendingBetId.set(betId);
      pendingMachineId.set(pending.machineId || machineHint || null);
      betPhase.set("committed");
      persistPendingJournal(
        pending.machineId || machineHint,
        betId,
        journal?.commitTxid ?? "",
      );
      return;
    }

    // Settled records contain no item/prize fields. Recover the result from the
    // Settled event, then clear a stale journal if the indexer has no outcome.
    if (!(await recoverSettledOutcome(betId))) clearPendingJournal();
  };

  /**
   * SETTLE step — reveal a committed bet on a later block. Permissionless and
   * safe to retry. settle() reverts until Ledger.CurrentIndex > commitIndex, so
   * a too-early revert is retried with a short backoff; an already-settled
   * revert recovers the recorded outcome instead.
   *
   * On a confirmed reveal the Settled event is read:
   * Settled(betId, machineId, player, itemIndex, prize). Returns true once the
   * outcome is shown, throws when no reveal could be obtained (caller may retry
   * later via the Reveal button — the bet stays pending).
   */
  const settleBet = async (betId: string): Promise<boolean> => {
    if (!betId) return false;
    betPhase.set("settling");
    playError.set(null);

    let lastErr: unknown = null;
    for (let attempt = 0; attempt < REVEAL_MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await app.chain.invoke(
          "settle",
          [{ type: "Integer", value: String(betId) }],
          { waitForEvent: "Settled" },
        );

        // The reveal settled but no Settled event was observed within the wait
        // window — recover the recorded outcome rather than claim a result blindly.
        if (!result.event) {
          if (await recoverSettledOutcome(betId)) return true;
          lastErr = new Error(t("revealPendingRetry"));
          await sleep(REVEAL_RETRY_DELAY_MS);
          continue;
        }

        const machineId = String(eventValue(result.event, 1));
        const itemIndex = Number(parseBigInt(eventValue(result.event, 3)));
        const prize = parseBigInt(eventValue(result.event, 4));
        await setResultFromOutcome(machineId, itemIndex, prize);
        return true;
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        // Already settled (a prior settle won the race) — show that outcome.
        if (isAlreadySettledRevert(msg) && (await recoverSettledOutcome(betId))) {
          return true;
        }
        // Reveal block not minted yet — wait one more block and retry.
        if (isTooEarlyRevert(msg) && attempt < REVEAL_MAX_ATTEMPTS - 1) {
          await sleep(REVEAL_RETRY_DELAY_MS);
          continue;
        }
        // A different / terminal error — stop retrying.
        if (!isTooEarlyRevert(msg)) break;
      }
    }

    // No reveal obtained. Keep the bet pending so the Reveal-retry button can
    // try again later (settle is permissionless + idempotent-safe).
    betPhase.set("committed");
    const msg = app.errors.messageOf(lastErr, t("revealPendingRetry"));
    playError.set(msg);
    throw new Error(msg);
  };

  /**
   * Reveal-retry entry point (the "Reveal result" button). Settles the persisted
   * pending betId; when the betId is unknown (a commit whose event wasn't
   * observed) it first recovers the handle from the Committed log. Returns true
   * when the outcome is shown.
   */
  const revealPending = async (): Promise<boolean> => {
    let betId = pendingBetId.get();
    if (!betId) {
      // Recover a lost betId from the player's latest pending Committed event.
      const playerAddr = address.get();
      const playerHash = playerAddr ? addressToScriptHash(playerAddr) || "" : "";
      if (!playerHash) return false;
      const recoveredId = await recoverPendingBetId(
        playerHash,
        pendingMachineId.get() ?? "",
      );
      if (!recoveredId) return false;
      pendingBetId.set(recoveredId);
      betId = recoveredId;
    }
    // Already-settled bet from a prior session/race — recover without resigning.
    const recovered = await recoverSettledOutcome(betId);
    if (recovered) return true;
    return settleBet(betId);
  };

  /**
   * Play a gacha machine via the v2 commit/reveal flow.
   *
   * Three steps, the first two signed by the player:
   *   1. COMMIT — if playCreditOf(player) < price, deposit the price in GAS with
   *      the "miniapp-gasbox:play" memo, THEN commit(machineId, player) in the
   *      same flow. The bet is escrowed + the worst-case prize reserved; the
   *      outcome is UNKNOWABLE here, so a loss cannot be aborted. The betId is
   *      read from the "Committed" event (slot 0).
   *   2. WAIT one block — settle() reverts until the next block, so the reveal
   *      waits ~1 block before the first settle attempt.
   *   3. SETTLE — settle(betId) draws + pays the prize and emits Settled; the won
   *      item is read from that event. Permissionless + retryable.
   *
   * Returns `true` on a confirmed, settled win (caller advances per-user stats),
   * `false` for a no-op double-submit guard. Throws on commit failure AND when a
   * committed bet's reveal can't be obtained yet — but in the latter case the bet
   * is left pending (betPhase "committed", canReveal true) so the surfaced
   * "tap Reveal" message points the player at the Reveal-retry button, which
   * finishes the settle (no funds at risk — the bet is escrowed on chain).
   */
  const playMachine = async (): Promise<boolean> => {
    const machine = selectedMachine.get();
    if (!machine || isPlaying.get()) return false; // double-submit guard
    if (!machine.active || !machine.inventoryReady) {
      const msg = t("inventoryUnavailable");
      playError.set(msg);
      throw new Error(msg);
    }
    if (runtimeStatus.get() === "incompatible" || runtimeStatus.get() === "error") {
      const msg = runtimeError.get() || t("gasboxDeploymentIncompatible");
      playError.set(msg);
      throw new Error(msg);
    }

    const priceBase = parseBigInt(machine.priceBaseUnits ?? machine.priceRaw);
    if (priceBase <= 0n) {
      const msg = t("invalidPlayPrice");
      playError.set(msg);
      throw new Error(msg);
    }

    const playerAddr = address.get() || (await app.chain.ensureWallet());
    const playerHash = addressToScriptHash(playerAddr || "");
    if (!playerAddr || !playerHash) {
      const msg = t("connectWallet");
      playError.set(msg);
      throw new Error(msg);
    }
    setAddress(playerAddr);

    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) {
      const msg = t("machineNotFound");
      playError.set(msg);
      throw new Error(msg);
    }

    const machineIdInt = String(Math.trunc(Number(machine.id)));

    try {
      isPlaying.set(true);
      playError.set(null);
      resetResult();
      betPhase.set("committing");
      pendingBetId.set(null);
      pendingMachineId.set(machineIdInt);

      // ── Step 1: COMMIT ────────────────────────────────────────────
      // Top up only when the existing play credit can't cover the price (credit
      // may persist from a prior aborted commit).
      // Any failed/invalid read counts as zero credit (RFC P0-6 fallback lane).
      const credit = await app.chain
        .query("playCreditOf", [{ type: "Hash160", value: playerHash }])
        .asBigInt(0n);

      const commitArgs = [
        { type: "Integer" as const, value: machineIdInt },
        { type: "Hash160" as const, value: playerHash },
      ];

      // deposit-then-commit: when credit can't cover the price,
      // app.funds.prepayAndCall waits for the deposit to confirm in a block
      // before commit() test-invokes. notify:'silent' — this composable owns
      // the mid-flow messaging (playError + main.tsx's guard toasts).
      let commitResult;
      try {
        commitResult =
          credit < priceBase
            ? await app.funds.prepayAndCall({
                operation: "commit",
                args: commitArgs,
                amountFixed8: priceBase,
                memo: PLAY_MEMO,
                waitForEvent: "Committed",
                notify: "silent",
              })
            : await app.chain.invoke("commit", commitArgs, {
                waitForEvent: "Committed",
              });
      } catch (commitErr) {
        // Deposit confirmed but commit reverted — the prepaid play credit
        // persists on the contract and is reused on the next play (no funds lost).
        if (commitErr instanceof FrameworkPrepaidActionError) {
          betPhase.set("idle");
          pendingMachineId.set(null);
          await loadPlayCredit();
          throw new Error(t("playPrepaidNoCommit"));
        }
        throw commitErr;
      }

      // betId is slot 0 of Committed(betId, machineId, player, wager, commitIndex).
      let betId = String(parseBigInt(eventValue(commitResult.event, 0)));
      // Persist only after commit returned from the host. The journal is scoped
      // to network + contract + wallet and is a recovery hint, never proof.
      persistPendingJournal(
        machineIdInt,
        betId && betId !== "0" ? betId : null,
        String(commitResult.txid ?? ""),
      );
      if (!betId || betId === "0") {
        // The commit broadcast but its event wasn't observed in the wait window;
        // the bet is on chain. Recover the latest still-pending betId for this
        // player from the Committed log so the Reveal-retry path can settle it.
        const recovered = await recoverPendingBetId(playerHash, machineIdInt);
        await loadPlayCredit();
        if (recovered) {
          pendingBetId.set(recovered);
          betPhase.set("committed");
          betId = recovered;
          persistPendingJournal(machineIdInt, recovered, String(commitResult.txid ?? ""));
        } else {
          // No betId yet — leave pending without a handle and ask the player to
          // tap Reveal shortly (a later getPendingBet/Committed read will resolve
          // it). canReveal stays false until pendingBetId is known.
          betPhase.set("committed");
          throw new Error(t("commitPendingRetry"));
        }
      } else {
        pendingBetId.set(betId);
        betPhase.set("committed");
        persistPendingJournal(machineIdInt, betId, String(commitResult.txid ?? ""));
        await loadPlayCredit();
      }

      // ── Step 2: WAIT one block ────────────────────────────────────
      // settle() reverts until Ledger.CurrentIndex > commitIndex.
      await sleep(REVEAL_FIRST_WAIT_MS);

      // ── Step 3: SETTLE (reveal) ───────────────────────────────────
      // settleBet keeps the bet pending + throws if it can't reveal yet, so the
      // Reveal-retry button can finish it. A confirmed reveal returns true.
      return await settleBet(betId);
    } catch (e) {
      // Surface the failure so notify.guard reports the real error and suppresses
      // the false success toast. A committed-but-unrevealed bet stays pending
      // (canReveal) so the player can finish the reveal from the Reveal button.
      playError.set(app.errors.messageOf(e, t("error")));
      throw e;
    } finally {
      isPlaying.set(false);
    }
  };

  // ── Publish Machine (direct on-chain creation) ─────────────────────

  /**
   * Publish a machine against the standalone contract.
   *
   * Steps (all signed by the creator):
   *   1. createMachine(creator, name, prizeAsset, price) -> machineId
   *   2. addItem(creator, machineId, name, weight, amount) for each item
   *   3. FUND POOL — transfer the total max-prize coverage in prizeAsset to the
   *      contract with the "miniapp-gasbox-pool:<machineId>" memo
   *   4. setActive(creator, machineId, true) — the contract activates only when
   *      the pool covers the max prize, so a thin pool surfaces cleanly.
   *
   * Inputs are validated against the contract's rules (positive name, weight>0,
   * amount>0 base units, price>0; NEO prizes integer-only). The pool is funded
   * to cover maxPrize (the largest single item amount), which is the contract's
   * activation gate.
   */
  const publishMachine = async (
    machineData: MachineData,
    setStatus: (msg: string, type: "success" | "error" | "loading") => void,
  ): Promise<boolean> => {
    if (isPublishing.get()) return false; // double-submit guard
    if (runtimeStatus.get() === "incompatible" || runtimeStatus.get() === "error") {
      const message = runtimeError.get() || t("gasboxDeploymentIncompatible");
      setStatus(message, "error");
      throw new Error(message);
    }

    const asset: PrizeAsset = machineData.prizeAsset === "NEO" ? "NEO" : "GAS";

    const name = String(machineData.name ?? "").trim();
    if (!name) {
      setStatus(t("createNameRequired"), "error");
      throw new Error(t("createNameRequired"));
    }

    // Play price is ALWAYS GAS.
    const priceBase = toBaseUnits(machineData.price, "GAS");
    if (priceBase <= 0n) {
      setStatus(t("invalidPlayPrice"), "error");
      throw new Error(t("invalidPlayPrice"));
    }

    // Validate items: name + positive weight + positive base-unit amount.
    const validItems = (machineData.items ?? []).filter(
      (item) => String(item.name ?? "").trim().length > 0,
    );
    if (validItems.length === 0) {
      setStatus(t("createNeedsItem"), "error");
      throw new Error(t("createNeedsItem"));
    }

    const itemArgs: Array<{ name: string; weight: bigint; amount: bigint }> = [];
    let maxPrize = 0n;
    for (const item of validItems) {
      // weight is a plain positive integer (relative draw probability, not scaled).
      const weightInt = toPositiveInt(item.weight);
      if (weightInt <= 0n) {
        setStatus(t("invalidWeight"), "error");
        throw new Error(t("invalidWeight"));
      }
      const amount = toBaseUnits(item.amount, asset);
      if (amount <= 0n) {
        setStatus(asset === "NEO" ? t("invalidNeoAmount") : t("invalidAmount"), "error");
        throw new Error(asset === "NEO" ? t("invalidNeoAmount") : t("invalidAmount"));
      }
      if (amount > maxPrize) maxPrize = amount;
      itemArgs.push({ name: String(item.name).trim().slice(0, 60), weight: weightInt, amount });
    }

    const creatorAddr = address.get() || (await app.chain.ensureWallet());
    const creatorHash = addressToScriptHash(creatorAddr || "");
    if (!creatorAddr || !creatorHash) {
      setStatus(t("connectWallet"), "error");
      throw new Error(t("connectWallet"));
    }
    setAddress(creatorAddr);

    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) {
      setStatus(t("machineNotFound"), "error");
      throw new Error(t("machineNotFound"));
    }

    try {
      isPublishing.set(true);
      setStatus(t("publishing"), "loading");

      // Step 1: createMachine -> machineId (read from CreatedMachine-equivalent
      // or fall back to lastMachineId()).
      const createResult = await app.chain.invoke(
        "createMachine",
        [
          { type: "Hash160", value: creatorHash },
          { type: "String", value: name.slice(0, 60) },
          { type: "Hash160", value: assetHash(asset) },
          { type: "Integer", value: priceBase.toString() },
        ],
        { waitForEvent: "MachineCreated" },
      );

      let machineId = Number(parseBigInt(eventValue(createResult.event, 0)));
      if (!Number.isInteger(machineId) || machineId <= 0) {
        // Event slot 0 may carry a non-id field; try slot 1 then lastMachineId.
        machineId = Number(parseBigInt(eventValue(createResult.event, 1)));
      }
      if (!Number.isInteger(machineId) || machineId <= 0) {
        machineId = await app.chain.query("lastMachineId", []).asInt();
      }
      if (!Number.isInteger(machineId) || machineId <= 0) {
        throw new Error(t("createPending"));
      }
      const machineIdStr = String(machineId);

      // Step 2: addItem for each item.
      for (const item of itemArgs) {
        await app.chain.invoke(
          "addItem",
          [
            { type: "Hash160", value: creatorHash },
            { type: "Integer", value: machineIdStr },
            { type: "String", value: item.name },
            { type: "Integer", value: item.weight.toString() },
            { type: "Integer", value: item.amount.toString() },
          ],
          { waitForEvent: "ItemAdded" },
        );
      }

      // Step 3: FUND POOL — transfer the max-prize coverage in prizeAsset with
      // the pool memo so OnNEP17Payment credits this machine's pool. Funding to
      // maxPrize satisfies the contract's activation gate.
      if (maxPrize > 0n) {
        await app.chain.invoke(
          "transfer",
          [
            { type: "Hash160", value: creatorHash },
            { type: "Hash160", value: contractHash },
            { type: "Integer", value: maxPrize.toString() },
            { type: "String", value: `${POOL_MEMO_PREFIX}${machineIdStr}` },
          ],
          { scriptHash: assetHash(asset) },
        );
      }

      // Step 4: setActive — the contract rejects activation if the pool cannot
      // cover the max prize; surface that cleanly.
      try {
        await app.chain.invoke(
          "setActive",
          [
            { type: "Hash160", value: creatorHash },
            { type: "Integer", value: machineIdStr },
            { type: "Boolean", value: true },
          ],
          { waitForEvent: "MachineActiveChanged" },
        );
      } catch (activateErr) {
        const raw =
          activateErr instanceof Error ? activateErr.message : String(activateErr);
        // The created machine + items + pool persist; only activation failed.
        console.warn("[useGasBox] setActive failed:", raw);
        throw new Error(t("poolCannotCoverMaxPrize"));
      }

      setStatus(t("publishSuccess"), "success");
      await loadMachines();
      // Confirmed success — the view resets the studio form only on `true`.
      return true;
    } catch (e) {
      const msg = app.errors.messageOf(e, t("error"));
      setStatus(msg, "error");
      throw e;
    } finally {
      isPublishing.set(false);
    }
  };

  // ── Studio side-actions (creator) ──────────────────────────────────

  /** Withdraw accumulated revenue for a machine to the creator. */
  const withdrawRevenue = async (machineId: string) => {
    const creatorAddr = address.get() || (await app.chain.ensureWallet());
    const creatorHash = addressToScriptHash(creatorAddr || "");
    if (!creatorAddr || !creatorHash) throw new Error(t("connectWallet"));
    setAddress(creatorAddr);

    await app.chain.invoke(
      "withdrawRevenue",
      [
        { type: "Hash160", value: creatorHash },
        { type: "Integer", value: String(Math.trunc(Number(machineId))) },
        { type: "Hash160", value: creatorHash },
      ],
      { waitForEvent: "RevenueWithdrawn" },
    );
    await Promise.all([loadMachines(), loadWalletBalances()]);
  };

  /** Return all unused prepaid GAS play credit to the connected wallet. */
  const withdrawPlayCredit = async (): Promise<void> => {
    if (isWithdrawingCredit.get()) return;
    const playerAddr = address.get() || (await app.chain.ensureWallet());
    const playerHash = addressToScriptHash(playerAddr || "");
    if (!playerAddr || !playerHash) throw new Error(t("connectWallet"));
    setAddress(playerAddr);

    const before = await app.chain
      .query("playCreditOf", [{ type: "Hash160", value: playerHash }])
      .asBigInt();
    if (before <= 0n) throw new Error(t("gasboxNoPlayCredit"));

    try {
      isWithdrawingCredit.set(true);
      await app.chain.invoke(
        "withdraw",
        [{ type: "Hash160", value: playerHash }],
        { waitForEvent: "CreditWithdrawn" },
      );
      await Promise.all([loadPlayCredit(), loadWalletBalances()]);
    } finally {
      isWithdrawingCredit.set(false);
    }
  };

  /**
   * Top up a machine's prize pool: transfer `amount` (human units, in the
   * machine's prize asset) to the contract with the pool memo so OnNEP17Payment
   * credits this machine's pool. Used to re-fund a drained machine so it can be
   * reactivated — the contract already supports this; only the UI lacked it.
   */
  const topUpPool = async (machineId: string, amount: string): Promise<void> => {
    if (runtimeStatus.get() === "incompatible" || runtimeStatus.get() === "error") {
      throw new Error(runtimeError.get() || t("gasboxDeploymentIncompatible"));
    }
    const machine =
      machines.get().find((m) => String(m.id) === String(machineId)) ?? null;
    if (!machine) throw new Error(t("machineNotFound"));

    const asset: PrizeAsset = machine.prizeAsset ?? "GAS";
    const amountBase = toBaseUnits(amount, asset);
    if (amountBase <= 0n) {
      throw new Error(asset === "NEO" ? t("invalidNeoAmount") : t("invalidAmount"));
    }

    const creatorAddr = address.get() || (await app.chain.ensureWallet());
    const creatorHash = addressToScriptHash(creatorAddr || "");
    if (!creatorAddr || !creatorHash) throw new Error(t("connectWallet"));
    setAddress(creatorAddr);

    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) throw new Error(t("machineNotFound"));

    const machineIdStr = String(Math.trunc(Number(machineId)));
    await app.chain.invoke(
      "transfer",
      [
        { type: "Hash160", value: creatorHash },
        { type: "Hash160", value: contractHash },
        { type: "Integer", value: amountBase.toString() },
        { type: "String", value: `${POOL_MEMO_PREFIX}${machineIdStr}` },
      ],
      { scriptHash: assetHash(asset) },
    );
    await Promise.all([loadMachines(), loadWalletBalances()]);
  };

  /** Withdraw only unreserved creator bankroll from a machine's prize pool. */
  const withdrawPool = async (machineId: string, amount: string): Promise<void> => {
    if (isWithdrawingPool.get()) return;
    const machine =
      machines.get().find((m) => String(m.id) === String(machineId)) ?? null;
    if (!machine) throw new Error(t("machineNotFound"));

    const asset: PrizeAsset = machine.prizeAsset ?? "GAS";
    const amountBase = toBaseUnits(amount, asset);
    if (amountBase <= 0n) {
      throw new Error(asset === "NEO" ? t("invalidNeoAmount") : t("invalidAmount"));
    }
    const freePool = parseBigInt(machine.freePoolBaseUnits);
    if (amountBase > freePool) throw new Error(t("gasboxPoolAmountTooHigh"));

    const creatorAddr = address.get() || (await app.chain.ensureWallet());
    const creatorHash = addressToScriptHash(creatorAddr || "");
    if (!creatorAddr || !creatorHash) throw new Error(t("connectWallet"));
    if (normalizeBinding(creatorHash) !== normalizeBinding(machine.creatorHash)) {
      throw new Error(t("gasboxCreatorOnly"));
    }
    setAddress(creatorAddr);

    try {
      isWithdrawingPool.set(true);
      // V2 intentionally emits no WithdrawPool event; refresh exact getMachine
      // state after confirmation instead of pretending an event exists.
      await app.chain.invoke("withdrawPool", [
        { type: "Hash160", value: creatorHash },
        { type: "Integer", value: String(Math.trunc(Number(machineId))) },
        { type: "Hash160", value: creatorHash },
        { type: "Integer", value: amountBase.toString() },
      ]);
      await Promise.all([loadMachines(), loadWalletBalances()]);
    } finally {
      isWithdrawingPool.set(false);
    }
  };

  /**
   * Activate or deactivate a machine (creator only). The contract rejects
   * activation when the pool cannot cover the max prize, so surface that
   * cleanly. Mirrors the publish flow's setActive call.
   */
  const setMachineActive = async (
    machineId: string,
    active: boolean,
  ): Promise<void> => {
    if (active && (runtimeStatus.get() === "incompatible" || runtimeStatus.get() === "error")) {
      throw new Error(runtimeError.get() || t("gasboxDeploymentIncompatible"));
    }
    const creatorAddr = address.get() || (await app.chain.ensureWallet());
    const creatorHash = addressToScriptHash(creatorAddr || "");
    if (!creatorAddr || !creatorHash) throw new Error(t("connectWallet"));
    setAddress(creatorAddr);

    try {
      await app.chain.invoke(
        "setActive",
        [
          { type: "Hash160", value: creatorHash },
          { type: "Integer", value: String(Math.trunc(Number(machineId))) },
          { type: "Boolean", value: active },
        ],
        { waitForEvent: "MachineActiveChanged" },
      );
    } catch (activateErr) {
      // The most common activation fault is an under-funded pool; reword it.
      if (active) throw new Error(t("poolCannotCoverMaxPrize"));
      throw activateErr;
    }
    await Promise.all([loadMachines(), loadWalletBalances()]);
  };

  // ── Derived display values ─────────────────────────────────────────
  const machineCount = createDerived(() => machines.get().length, [machines]);
  const isPlayingDisplay = createDerived(
    () => (isPlaying.get() ? t("yes") : t("no")),
    [isPlaying],
  );
  const selectedMachineName = createDerived(
    () => selectedMachine.get()?.name || t("none"),
    [selectedMachine],
  );
  const hasPlayCredit = createDerived(() => playCreditBase.get() > 0n, [playCreditBase]);
  const formattedPlayCredit = createDerived(
    () => formatGas(playCreditBase.get(), 8),
    [playCreditBase],
  );
  const formattedWalletGas = createDerived(
    () => formatGas(walletGasBase.get(), 8),
    [walletGasBase],
  );
  const formattedWalletNeo = createDerived(
    () => walletNeoBase.get().toString(),
    [walletNeoBase],
  );
  const runtimeReady = createDerived(
    () => runtimeStatus.get() === "ready",
    [runtimeStatus],
  );
  const walletConnected = createDerived(
    () => Boolean(address.get()),
    [address],
  );
  // True only while a bet is committed and awaiting its later-block reveal — the
  // "drawing on next block" pending state. Distinct from canReveal (which also
  // stays true mid-settle so the Reveal button can re-fire after a failed retry).
  const isAwaitingReveal = createDerived(
    () => betPhase.get() === "committed" || betPhase.get() === "settling",
    [betPhase],
  );

  return {
    // ── Raw State ───────────────────────────────────────────────────
    machines,
    selectedMachine,
    isLoadingMachines,
    catalogStatus,
    catalogError,
    runtimeStatus,
    runtimeNetwork,
    runtimeContract,
    runtimeError,
    pendingBetCount,
    runtimeReady,
    walletStatus,
    walletError,
    walletGasBase,
    walletNeoBase,
    walletConnected,
    isPlaying,
    showResult,
    resultItem,
    playError,
    showFireworks,
    isPublishing,
    isWithdrawingCredit,
    isWithdrawingPool,
    studioOpen,
    address,
    // Commit/reveal (two-step) state.
    betPhase,
    pendingBetId,
    pendingMachineId,
    canReveal,
    isAwaitingReveal,

    // ── Formatted values (for manifest stat/sidebar bindings) ────────
    machineCount,
    isPlayingDisplay,
    selectedMachineName,
    playCreditBase,
    hasPlayCredit,
    formattedPlayCredit,
    formattedWalletGas,
    formattedWalletNeo,

    // ── Actions ─────────────────────────────────────────────────────
    setAddress,
    selectMachine,
    deselectMachine,
    openStudio,
    closeStudio,
    resetResult,
    playMachine,
    settleBet,
    revealPending,
    publishMachine,
    withdrawRevenue,
    withdrawPlayCredit,
    topUpPool,
    withdrawPool,
    setMachineActive,
    loadAll,
  };
}

export type UseGasBoxReturn = ReturnType<typeof useGasBox>;
