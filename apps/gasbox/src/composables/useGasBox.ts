/**
 * useGasBox — Domain logic for the GasBox (gacha/mystery box) miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppGasBox) via
 * ctx.services.chain. The earlier path SIMULATED prizes client-side
 * (os.game.placeBet + an os.storage machine catalog) and resolved the won item
 * with Math.random — players paid but never received a real on-chain prize. The
 * old PlatformGame gacha needed the Morpheus VRF oracle's off-chain signer to
 * settle, which is non-operational.
 *
 * MiniAppGasBox is self-contained: pull() draws a weighted item ON-CHAIN with
 * Runtime.GetRandom and PAYS THE PRIZE ATOMICALLY in the same transaction — no
 * oracle. This composable drives it directly, so the prize is real.
 *
 * Contract interaction model (verified against the deployed ABI):
 *
 *   READS (chain.read / chain.readArray, default app contract script hash):
 *     lastMachineId()                 -> Integer (machines are ids 1..lastMachineId)
 *     getMachine(machineId)           -> Map{id,creator,name,prizeAsset,price,
 *                                            itemCount,totalWeight,maxPrize,
 *                                            poolBalance,revenue,active}
 *     getItem(machineId,index)        -> Map{index,name,weight,amount}
 *     playCreditOf(player)            -> Integer (prepaid GAS credit in base units)
 *
 *   PLAYER MUTATIONS (chain.invoke):
 *     1. PREPAY play credit — a GAS transfer to the contract with the memo
 *        "miniapp-gasbox:play" so OnNEP17Payment credits the player's play
 *        balance (only when playCreditOf(player) < price):
 *          transfer(from, CONTRACT, priceBaseUnits, "miniapp-gasbox:play")
 *          { scriptHash: GAS_HASH }
 *     2. pull(machineId, player) -> Integer itemIndex
 *        Consumes the price from play credit, draws a weighted item, and
 *        transfers the prize to the player in the SAME tx. The won item is read
 *        from the "Pulled" event: Pulled(playId, machineId, player, itemIndex,
 *        prizeAmount), then resolved against getItem(machineId, itemIndex).
 *
 *   STUDIO/CREATOR MUTATIONS (chain.invoke):
 *     createMachine(creator, name, prizeAsset, price) -> machineId
 *     addItem(creator, machineId, name, weight, amount) -> index
 *     FUND POOL — a prizeAsset transfer to the contract with the memo
 *       "miniapp-gasbox-pool:<machineId>":
 *         transfer(from, CONTRACT, amount, "miniapp-gasbox-pool:<machineId>")
 *         { scriptHash: prizeAssetHash }
 *     setActive(creator, machineId, active)        — activates only if pool >= maxPrize
 *     withdrawRevenue(creator, machineId, to)
 *
 * AMOUNT CONVENTION: the contract takes BASE UNITS. GAS is 1e8 base units per
 * GAS; NEO is indivisible (the integer token count, no scaling). The play price
 * is always GAS; prize amounts are in the machine's prizeAsset base units.
 *
 * The composable owns:
 *   - Reactive state (observables + derived) for manifest/PlayArea bindings
 *   - Machine selection + display logic
 *   - Loading/pulling/publishing UI flags (double-submit guards)
 *   - Reading the machine catalog + items straight from chain
 *   - The won-item read from the Pulled event + getItem
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { ChainService } from "@shared/services/ChainService";
import { formatGas, formatAddress } from "@shared/utils/format";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { Machine, MachineItem } from "../types";

// ============================================================================
// Constants
// ============================================================================

const NEO_HASH_NORMALIZED = normalizeScriptHash(BLOCKCHAIN_CONSTANTS.NEO_HASH);
const GAS_HASH_NORMALIZED = normalizeScriptHash(BLOCKCHAIN_CONSTANTS.GAS_HASH);

/** GAS base units per whole GAS (1e8). */
const GAS_DECIMALS_MULTIPLIER = 100_000_000n;

/** Memo the contract requires on the play prepay transfer (appId + ":play"). */
const PLAY_MEMO = "miniapp-gasbox:play";

/** Memo prefix for funding a machine's prize pool (appId + "-pool:<machineId>"). */
const POOL_MEMO_PREFIX = "miniapp-gasbox-pool:";

/** Hard cap on how many machines to enumerate per refresh (defensive). */
const MAX_MACHINES = 500;

/** Hard cap on items read per machine (defensive). */
const MAX_ITEMS_PER_MACHINE = 100;

// ============================================================================
// Types
// ============================================================================

export type PrizeAsset = "NEO" | "GAS";

/** Studio publish-form item (string-typed for controlled inputs). */
export interface MachineItemData {
  name: string;
  /** Weight (relative draw probability) — positive integer. */
  weight: string;
  rarity?: string;
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
  /** Shared chain service from ctx.services.chain. */
  chain: ChainService;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Amount helpers
// ============================================================================

/**
 * Convert a human-entered amount string to contract BASE UNITS for an asset.
 *
 * GAS: value * 1e8, up to 8 decimal places, scaled without floats. NEO: the
 * integer token count with NO scaling — fractional NEO is rejected (NEO is
 * indivisible). Returns 0n for any invalid / non-positive input so callers can
 * reject before touching the chain.
 */
const toBaseUnits = (raw: string, asset: PrizeAsset): bigint => {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return 0n;

  if (asset === "NEO") {
    // Indivisible: reject anything that is not a positive integer.
    if (!/^\d+$/.test(trimmed)) return 0n;
    const n = BigInt(trimmed);
    return n > 0n ? n : 0n;
  }

  // GAS: accept up to 8 decimal places, scale to base units without floats.
  if (!/^\d+(\.\d{1,8})?$/.test(trimmed)) return 0n;
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const paddedFraction = (fraction + "00000000").slice(0, 8);
  const base = BigInt(whole) * GAS_DECIMALS_MULTIPLIER + BigInt(paddedFraction);
  return base > 0n ? base : 0n;
};

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

/** Read a single state slot from a Pulled event payload. */
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

export function useGasBox({ chain, t }: UseGasBoxOptions) {
  // ── Machine State ──────────────────────────────────────────────────
  const machines = createObservable<Machine[]>([]);
  const selectedMachine = createObservable<Machine | null>(null);
  const isLoadingMachines = createObservable(false);

  // ── Play State ─────────────────────────────────────────────────────
  const isPlaying = createObservable(false);
  const showResult = createObservable(false);
  const resultItem = createObservable<MachineItem | null>(null);
  const playError = createObservable<string | null>(null);
  const showFireworks = createObservable(false);

  // ── Publish State ──────────────────────────────────────────────────
  const isPublishing = createObservable(false);
  const studioOpen = createObservable(false);

  // ── Address State ──────────────────────────────────────────────────
  const address = createObservable<string | null>(chain.address.get() ?? null);

  const setAddress = (addr: string | null) => {
    address.set(addr ?? null);
  };

  // ── Helpers ────────────────────────────────────────────────────────

  const resetResult = () => {
    showResult.set(false);
    resultItem.set(null);
    playError.set(null);
    showFireworks.set(false);
  };

  /** Build a MachineItem from a getItem Map (display + draw fields). */
  const buildItem = (
    raw: Record<string, unknown>,
    asset: PrizeAsset,
    totalWeight: number,
  ): MachineItem => {
    const weight = asNumber(raw.weight);
    const amountBase = parseBigInt(raw.amount);
    const share = totalWeight > 0 ? Number(((weight / totalWeight) * 100).toFixed(2)) : 0;
    const rarity = rarityFromShare(share);
    return {
      name: String(raw.name ?? ""),
      probability: weight,
      displayProbability: share,
      rarity,
      // Map prize asset to the legacy assetType field (1 = NEP-17 fungible).
      assetType: 1,
      assetHash: assetHash(asset),
      amountRaw: Number(amountBase),
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
    const raw = await chain.read("getMachine", [
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
    const revenue = parseBigInt(record.revenue);
    const active = Boolean(record.active);

    // Read every item (indices 0..itemCount-1). Best-effort: a single failed
    // read drops that item rather than failing the whole machine.
    const itemPromises: Promise<MachineItem | null>[] = [];
    for (let index = 0; index < itemCount; index += 1) {
      itemPromises.push(
        (async () => {
          try {
            const itemRaw = await chain.read("getItem", [
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

    const availableItems = items.filter((item) => item.available);
    const availableWeight = availableItems.reduce((sum, item) => sum + item.probability, 0);
    // Pool covers the max prize ⇒ the machine can pay any draw.
    const poolReady = maxPrize > 0n ? poolBalance >= maxPrize : poolBalance > 0n;
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
      price: formatGas(priceBase, 4),
      itemCount: items.length,
      totalWeight,
      availableWeight,
      plays: 0,
      revenueRaw: Number(revenue),
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
      poolBalance: formatPrizeAmount(poolBalance, asset),
      maxPrizeRaw: Number(maxPrize),
      maxPrize: formatPrizeAmount(maxPrize, asset),
      poolReady,
    };
  };

  // ── Data Loading (direct chain reads) ──────────────────────────────

  /**
   * Load the machine catalog straight from the contract. Machines are ids
   * 1..lastMachineId(); each is read via getMachine + getItem. This replaces
   * the os.storage catalog entirely. Newest first (highest id).
   */
  const loadMachines = async () => {
    if (isLoadingMachines.get()) return;
    isLoadingMachines.set(true);
    try {
      const lastRaw = await chain.read("lastMachineId", []);
      const last = Math.min(asNumber(lastRaw), MAX_MACHINES);

      const ids: number[] = [];
      for (let id = 1; id <= last; id += 1) ids.push(id);

      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            return await readMachine(id);
          } catch (e) {
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

      const collected = results
        .filter((m): m is Machine => m !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
      machines.set(collected);

      // Sync the selected machine with the reloaded data.
      const current = selectedMachine.get();
      if (current) {
        selectedMachine.set(collected.find((m) => m.id === current.id) || null);
      }
    } catch (e) {
      console.warn(
        "[useGasBox] loadMachines failed:",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      isLoadingMachines.set(false);
    }
  };

  const loadAll = async () => {
    setAddress(chain.address.get() ?? null);
    await loadMachines();
  };

  // ── Machine Selection ──────────────────────────────────────────────

  const selectMachine = (machine: Machine) => {
    selectedMachine.set(machine);
  };

  const deselectMachine = () => {
    selectedMachine.set(null);
  };

  // ── Studio (publish) panel routing ─────────────────────────────────

  const openStudio = () => {
    studioOpen.set(true);
  };

  const closeStudio = () => {
    studioOpen.set(false);
  };

  // ── Play Action (direct on-chain pull) ─────────────────────────────

  /**
   * Pull a gacha machine against the standalone contract.
   *
   * Two signed steps, both by the player:
   *   1. PREPAY — if playCreditOf(player) < price, transfer the price in GAS to
   *      the contract with the "miniapp-gasbox:play" memo so OnNEP17Payment
   *      credits the player's play balance.
   *   2. pull(machineId, player) — consumes the price from play credit, draws a
   *      weighted item ON-CHAIN, and transfers the prize to the player in the
   *      SAME tx. The won item is read from the "Pulled" event and resolved
   *      against getItem(machineId, itemIndex). The prize is REAL — paid on
   *      chain, not simulated.
   *
   * The pull's nested prize transfer needs a healthy systemFee; fee estimation
   * is delegated to the chain service / dApi wallet (which budgets a buffer), so
   * no manual fee is set here.
   */
  const playMachine = async () => {
    const machine = selectedMachine.get();
    if (!machine || isPlaying.get()) return; // double-submit guard
    if (!machine.active || !machine.inventoryReady) {
      const msg = t("inventoryUnavailable");
      playError.set(msg);
      throw new Error(msg);
    }

    const priceBase = BigInt(Math.max(0, Math.trunc(machine.priceRaw)));
    if (priceBase <= 0n) {
      const msg = t("invalidPlayPrice");
      playError.set(msg);
      throw new Error(msg);
    }

    const playerAddr = address.get() || (await chain.ensureWallet());
    const playerHash = addressToScriptHash(playerAddr || "");
    if (!playerAddr || !playerHash) {
      const msg = t("connectWallet");
      playError.set(msg);
      throw new Error(msg);
    }
    setAddress(playerAddr);

    const contractHash = chain.contractAddress.get();
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

      // Step 1: PREPAY — only top up when the existing play credit can't cover
      // the price (credit may persist from a prior aborted pull).
      let credit = 0n;
      try {
        credit = parseBigInt(
          await chain.read("playCreditOf", [
            { type: "Hash160", value: playerHash },
          ]),
        );
      } catch {
        credit = 0n;
      }

      if (credit < priceBase) {
        await chain.invoke(
          "transfer",
          [
            { type: "Hash160", value: playerHash },
            { type: "Hash160", value: contractHash },
            { type: "Integer", value: priceBase.toString() },
            { type: "String", value: PLAY_MEMO },
          ],
          { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
        );
      }

      // Step 2: pull — draws + pays the prize ON-CHAIN in this tx. Read the won
      // item index from the Pulled event: Pulled(playId, machineId, player,
      // itemIndex, prizeAmount).
      const result = await chain.invoke(
        "pull",
        [
          { type: "Integer", value: machineIdInt },
          { type: "Hash160", value: playerHash },
        ],
        { waitForEvent: "Pulled" },
      );

      const itemIndex = Number(parseBigInt(eventValue(result.event, 3)));
      const prizeAmount = parseBigInt(eventValue(result.event, 4));

      // Resolve the won item from getItem(machineId, itemIndex). Fall back to the
      // cached item table if the read fails (the event already proves the win).
      let wonItem: MachineItem | null =
        Number.isInteger(itemIndex) && itemIndex >= 0
          ? machine.items[itemIndex] ?? null
          : null;
      const asset: PrizeAsset = machine.prizeAsset ?? "GAS";

      if (!wonItem && Number.isInteger(itemIndex) && itemIndex >= 0) {
        try {
          const itemRaw = await chain.read("getItem", [
            { type: "Integer", value: machineIdInt },
            { type: "Integer", value: String(itemIndex) },
          ]);
          if (itemRaw && typeof itemRaw === "object" && !Array.isArray(itemRaw)) {
            wonItem = buildItem(
              itemRaw as Record<string, unknown>,
              asset,
              machine.totalWeight,
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
          amountDisplay:
            prizeAmount > 0n
              ? `${formatPrizeAmount(prizeAmount, asset)} ${asset}`
              : wonItem.amountDisplay,
        });
      } else {
        resultItem.set({
          name: t("unknownPrize"),
          probability: 0,
          displayProbability: 0,
          rarity: "UNKNOWN",
          assetType: 1,
          assetHash: assetHash(asset),
          amountRaw: Number(prizeAmount),
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

      await loadMachines();
    } catch (e) {
      // Surface the failure so notify.guard reports the real error and
      // suppresses the false success toast. The prepay may have settled, so the
      // credit persists on the contract and the pull can be retried.
      playError.set(e instanceof Error ? e.message : t("error"));
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

    const creatorAddr = address.get() || (await chain.ensureWallet());
    const creatorHash = addressToScriptHash(creatorAddr || "");
    if (!creatorAddr || !creatorHash) {
      setStatus(t("connectWallet"), "error");
      throw new Error(t("connectWallet"));
    }
    setAddress(creatorAddr);

    const contractHash = chain.contractAddress.get();
    if (!contractHash) {
      setStatus(t("machineNotFound"), "error");
      throw new Error(t("machineNotFound"));
    }

    try {
      isPublishing.set(true);
      setStatus(t("publishing"), "loading");

      // Step 1: createMachine -> machineId (read from CreatedMachine-equivalent
      // or fall back to lastMachineId()).
      const createResult = await chain.invoke(
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
        machineId = asNumber(await chain.read("lastMachineId", []));
      }
      if (!Number.isInteger(machineId) || machineId <= 0) {
        throw new Error(t("createPending"));
      }
      const machineIdStr = String(machineId);

      // Step 2: addItem for each item.
      for (const item of itemArgs) {
        await chain.invoke(
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
        await chain.invoke(
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
        await chain.invoke(
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
      const msg = e instanceof Error ? e.message : t("error");
      setStatus(msg, "error");
      throw e;
    } finally {
      isPublishing.set(false);
    }
  };

  // ── Studio side-actions (creator) ──────────────────────────────────

  /** Withdraw accumulated revenue for a machine to the creator. */
  const withdrawRevenue = async (machineId: string) => {
    const creatorAddr = address.get() || (await chain.ensureWallet());
    const creatorHash = addressToScriptHash(creatorAddr || "");
    if (!creatorAddr || !creatorHash) throw new Error(t("connectWallet"));
    setAddress(creatorAddr);

    await chain.invoke(
      "withdrawRevenue",
      [
        { type: "Hash160", value: creatorHash },
        { type: "Integer", value: String(Math.trunc(Number(machineId))) },
        { type: "Hash160", value: creatorHash },
      ],
      { waitForEvent: "RevenueWithdrawn" },
    );
    await loadMachines();
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

  return {
    // ── Raw State ───────────────────────────────────────────────────
    machines,
    selectedMachine,
    isLoadingMachines,
    isPlaying,
    showResult,
    resultItem,
    playError,
    showFireworks,
    isPublishing,
    studioOpen,
    address,

    // ── Formatted values (for manifest stat/sidebar bindings) ────────
    machineCount,
    isPlayingDisplay,
    selectedMachineName,

    // ── Actions ─────────────────────────────────────────────────────
    setAddress,
    selectMachine,
    deselectMachine,
    openStudio,
    closeStudio,
    resetResult,
    playMachine,
    publishMachine,
    withdrawRevenue,
    loadAll,
  };
}

export type UseGasBoxReturn = ReturnType<typeof useGasBox>;
