/**
 * useGasBox — Domain logic for the GasBox (gacha/mystery box) miniapp
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (GameProxy, PaymentProxy, StorageProxy, BadgeProxy, EscrowProxy)
 * via edge functions, so this file contains zero contract hashes, parameter
 * encoding, or event parsing logic.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.read("TotalMachines", [])
 *     chain.read("GetMachine", [{ type: "Integer", value: id }])
 *     chain.read("GetMachineItem", [...])
 *     chain.invoke("transfer", [...], { scriptHash: GAS_HASH })
 *     chain.invoke("initiatePlay", [...], { waitForEvent: "PlayInitiated" })
 *     chain.invoke("settlePlay", [...], { waitForEvent: "PlayResolved" })
 *     chain.invoke("CreateMachine", [...], { waitForEvent: "MachineCreated" })
 *     chain.invoke("AddMachineItem", [...])
 *     chain.invoke("buyMachine", [...])
 *     chain.invoke("UpdateMachine", [...])
 *     chain.invoke("SetMachineActive", [...])
 *     chain.invoke("SetMachineListed", [...])
 *     chain.invoke("ListMachineForSale", [...])
 *     chain.invoke("cancelMachineSale", [...])
 *     chain.invoke("depositItem", [...])
 *     chain.invoke("withdrawItem", [...])
 *
 *   AFTER (OS proxy / os-storage catalog):
 *     The kernel game contract exposes no machine/escrow enumeration, so the
 *     machine catalog is app data kept in os-storage. The core publish → list →
 *     play loop runs entirely over StorageProxy + PaymentProxy:
 *
 *     ctx.os.storage.list("machine:")                 — enumerate the catalog
 *     ctx.os.storage.get(`machine:${id}`)             — load single machine record
 *     ctx.os.storage.set(`machine:${id}`, record)     — publish / update a machine
 *     ctx.os.payment.deposit(amount, "play:${id}")     — charge the pull price
 *     (prize resolved client-side from the published odds — no game pool exists)
 *     ctx.os.badge.award(badgeId, "")                 — achievement hints
 *
 *     Marketplace side-actions still use the generic primitives:
 *     ctx.os.game.placeBet("buy", machineId)          — buy a listed machine
 *     ctx.os.escrow.create(...) / refund(machineId)   — list / cancel sale
 *     ctx.os.payment.deposit / withdraw(...)           — inventory deposit/withdraw
 *
 * The composable still owns:
 *   - Reactive state (refs + computed) for manifest bindings
 *   - Machine selection and display logic
 *   - Loading/playing/publishing UI flags
 *   - Formatted display values
 *   - Item availability + probability normalization (pure frontend math)
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { GameProxy } from "@shared/services/os/GameProxy";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import type { EscrowProxy } from "@shared/services/os/EscrowProxy";
import { formatGas, toFixed8, toSafeNumber } from "@shared/utils/format";
import type { Machine, MachineItem } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface UseGasBoxOptions {
  /** OS GameProxy instance from ctx.os.game */
  gameService: GameProxy;
  /** OS PaymentProxy instance from ctx.os.payment */
  paymentService: PaymentProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** OS EscrowProxy instance from ctx.os.escrow */
  escrowService: EscrowProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

/** Raw machine data from the edge function. */
interface MachineRaw {
  id: string | number;
  name: string;
  description?: string;
  category?: string;
  tags?: string;
  creator?: string;
  owner?: string;
  price?: number;
  itemCount?: number;
  totalWeight?: number;
  plays?: number;
  revenue?: number;
  sales?: number;
  salesVolume?: number;
  createdAt?: number;
  lastPlayedAt?: number;
  active?: boolean;
  listed?: boolean;
  banned?: boolean;
  locked?: boolean;
  salePrice?: number;
  items?: MachineItemRaw[];
}

/** Raw item data from the edge function. */
interface MachineItemRaw {
  name?: string;
  weight?: number;
  rarity?: string;
  assetType?: number;
  assetHash?: string;
  amount?: number;
  tokenId?: string;
  stock?: number;
  tokenCount?: number;
  decimals?: number;
}

/** Machine item data for publish action. */
export interface MachineItemData {
  name: string;
  probability: number;
  icon?: string;
  rarity: string;
  assetType: string;
  assetHash: string;
  amount: string;
  tokenId: string;
  /** Initial inventory units (NEP-17 stock or NEP-11 token count). */
  stock?: string;
}

/** Machine data for publish action. */
export interface MachineData {
  name: string;
  description: string;
  category: string;
  tags: string;
  price: string;
  items: MachineItemData[];
}

// ============================================================================
// Helpers (pure functions — no chain dependency)
// ============================================================================

const numberFrom = toSafeNumber;

const formatTokenAmount = (raw: number, decimals: number): string => {
  if (!Number.isFinite(raw) || raw <= 0) return "0";
  const factor = Math.pow(10, decimals);
  return (raw / factor).toFixed(Math.min(4, Math.max(0, decimals)));
};

const toDisplayHash = (value: unknown): string => {
  const str = String(value || "");
  return str ? (str.startsWith("0x") ? str : `0x${str}`) : "";
};

const parseTags = (value: string): string[] =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

const isItemAvailable = (item: MachineItem): boolean => {
  if (item.assetType === 1) return item.stockRaw >= item.amountRaw && item.amountRaw > 0;
  if (item.assetType === 2) return item.tokenCount > 0;
  return false;
};

const getItemIcon = (item: MachineItem): string => {
  const rarity = String(item.rarity || "").toUpperCase();
  if (rarity === "LEGENDARY") return "crown";
  if (rarity === "EPIC") return "gem";
  if (rarity === "RARE") return "gift";
  if (item.assetType === 2) return "image";
  if (item.assetType === 1) return "coin";
  return "package";
};

// ============================================================================
// Composable
// ============================================================================

export function useGasBox({
  gameService,
  paymentService,
  storageService,
  badgeService,
  escrowService,
  t,
}: UseGasBoxOptions) {
  // ── Machine State ──────────────────────────────────────────────────
  const machines = createObservable<Machine[]>([]);
  const selectedMachine = createObservable<Machine | null>(null);
  const isLoadingMachines = createObservable(false);
  const actionLoading = createObservable<Record<string, boolean>>({});
  const walletHash = createObservable("");

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
  const address = createObservable<string | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────

  const setActionLoading = (key: string, value: boolean) => {
    actionLoading.set({ ...actionLoading.get(), [key]: value });
  };

  const resetResult = () => {
    showResult.set(false);
    resultItem.set(null);
    playError.set(null);
  };

  // ── Item Normalization ────────────────────────────────────────────

  const normalizeItem = (raw: MachineItemRaw, rarity_t: string): MachineItem => {
    const decimals = numberFrom(raw.decimals);
    const amountRaw = numberFrom(raw.amount);
    const stockRaw = numberFrom(raw.stock);
    const item: MachineItem = {
      name: String(raw.name || ""),
      probability: numberFrom(raw.weight),
      displayProbability: 0,
      rarity: String(raw.rarity || rarity_t),
      assetType: numberFrom(raw.assetType),
      assetHash: toDisplayHash(raw.assetHash),
      amountRaw,
      amountDisplay: formatTokenAmount(amountRaw, decimals),
      tokenId: String(raw.tokenId || ""),
      stockRaw,
      stockDisplay: formatTokenAmount(stockRaw, decimals),
      tokenCount: numberFrom(raw.tokenCount),
      decimals,
      available: false,
    };
    item.icon = getItemIcon(item);
    return item;
  };

  const normalizeMachine = (raw: MachineRaw): Machine => {
    const items = (raw.items || []).map((i) => normalizeItem(i, t("rarityCommon")));
    const availableItems = items.filter((item) => isItemAvailable(item));
    const availableWeight = availableItems.reduce((sum, item) => sum + item.probability, 0);
    const normalizedItems = items.map((item) => {
      const available = isItemAvailable(item);
      const displayProbability =
        availableWeight > 0 && available
          ? Number(((item.probability / availableWeight) * 100).toFixed(2))
          : 0;
      return { ...item, available, displayProbability };
    });
    const firstAvailable = availableItems[0];
    const topItem = firstAvailable
      ? availableItems.reduce(
          (prev, curr) => (curr.probability < prev.probability ? curr : prev),
          firstAvailable,
        )
      : items[0] ?? null;
    const salePriceRaw = numberFrom(raw.salePrice);
    const revenueRaw = numberFrom(raw.revenue);
    const salesVolumeRaw = numberFrom(raw.salesVolume);
    return {
      id: String(raw.id),
      name: String(raw.name || ""),
      description: String(raw.description || ""),
      category: String(raw.category || ""),
      tags: String(raw.tags || ""),
      tagsList: parseTags(String(raw.tags || "")),
      creator: toDisplayHash(raw.creator),
      creatorHash: String(raw.creator || ""),
      owner: toDisplayHash(raw.owner),
      ownerHash: String(raw.owner || ""),
      priceRaw: numberFrom(raw.price),
      price: formatGas(numberFrom(raw.price)),
      itemCount: numberFrom(raw.itemCount),
      totalWeight: numberFrom(raw.totalWeight),
      availableWeight,
      plays: numberFrom(raw.plays),
      revenueRaw,
      revenue: formatGas(revenueRaw),
      sales: numberFrom(raw.sales),
      salesVolumeRaw,
      salesVolume: formatGas(salesVolumeRaw),
      createdAt: numberFrom(raw.createdAt),
      lastPlayedAt: numberFrom(raw.lastPlayedAt),
      active: Boolean(raw.active),
      listed: Boolean(raw.listed),
      banned: Boolean(raw.banned),
      locked: Boolean(raw.locked),
      forSale: salePriceRaw > 0,
      salePriceRaw,
      salePrice: salePriceRaw > 0 ? formatGas(salePriceRaw) : "0",
      inventoryReady: availableWeight > 0,
      items: normalizedItems,
      topPrize: topItem?.name || "",
      winRate: topItem?.probability || 0,
    };
  };

  // ── Data Loading (via OS services) ─────────────────────────────────

  /**
   * Load all machines from os-storage.
   *
   * The kernel game contract has no escrow/game enumeration, so the machine
   * catalog is maintained as app data in os-storage: each machine is published
   * under the `machine:<id>` key (see publishMachine), and the catalog is
   * rebuilt by enumerating that prefix via StorageProxy.list and normalizing
   * every record. Item/prize data is embedded in the stored record, so a single
   * list call rebuilds the full grid (no per-item fetch needed).
   */
  const loadMachines = async () => {
    isLoadingMachines.set(true);
    try {
      const records = await storageService.list("machine:");
      const collected: Machine[] = [];

      if (records && typeof records === "object") {
        for (const [key, value] of Object.entries(records)) {
          // Only top-level machine records (`machine:<id>`). Skip any nested
          // sub-keys such as `machine:<id>:item:*` written by legacy paths.
          const suffix = key.startsWith("machine:") ? key.slice("machine:".length) : key;
          if (suffix.includes(":")) continue;
          if (!value || typeof value !== "object") continue;
          const raw = value as MachineRaw;
          if (raw.id === undefined || raw.id === null || raw.id === "") continue;
          collected.push(normalizeMachine(raw));
        }
      }

      collected.sort((a, b) => b.createdAt - a.createdAt);
      machines.set(collected);

      // Load wallet hash from storage (set by platform on wallet connect)
      try {
        const hash = await storageService.get("walletHash");
        walletHash.set(String(hash || ""));
        const addr = await storageService.get("walletAddress");
        address.set(addr ? String(addr) : null);
      } catch {
        // Wallet state not available yet
      }

      // Sync selected machine with reloaded data
      if (selectedMachine.get()) {
        const updated = machines.get().find(
          (m) => m.id === selectedMachine.get()?.id,
        ) || null;
        selectedMachine.set(updated);
      }
    } catch (e) {
      console.warn("[useGasBox] loadMachines failed:", e instanceof Error ? e.message : String(e));
    } finally {
      isLoadingMachines.set(false);
    }
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

  // ── Play Action (via OS services) ──────────────────────────────────

  /**
   * Weighted random selection over the machine's available prize items.
   * Pure frontend RNG: the kernel game contract has no per-machine prize
   * pool, so the prize is resolved client-side against the published odds
   * (the same weights rendered as readable odds in the UI).
   */
  const selectPrizeIndex = (items: MachineItem[]): number => {
    const availableEntries = items
      .map((item, index) => ({ item, index }))
      .filter((entry) => entry.item.available && entry.item.probability > 0);
    const firstEntry = availableEntries[0];
    if (!firstEntry) return -1;

    const totalWeight = availableEntries.reduce(
      (sum, entry) => sum + entry.item.probability,
      0,
    );
    if (totalWeight <= 0) return firstEntry.index;

    let roll = Math.random() * totalWeight;
    let lastIndex = firstEntry.index;
    for (const entry of availableEntries) {
      lastIndex = entry.index;
      roll -= entry.item.probability;
      if (roll <= 0) return entry.index;
    }
    return lastIndex;
  };

  /**
   * Play a gacha machine: charge GAS via PaymentProxy, then resolve the prize
   * client-side from the published odds. The kernel exposes no game/prize pool
   * to enumerate, so the catalog + prize table live in os-storage and the draw
   * is settled locally against those weights. The winning NEP-17 item's stock
   * is decremented and the play count is persisted back to the machine record.
   */
  const playMachine = async () => {
    const machine = selectedMachine.get();
    if (!machine || isPlaying.get()) return;
    if (!machine.active || !machine.inventoryReady) {
      const msg = t("inventoryUnavailable");
      playError.set(msg);
      throw new Error(msg);
    }

    // Validate the play price BEFORE charging: os-payment-deposit rejects a
    // non-positive / malformed amount with a raw edge error, so surface a
    // friendly localized message instead. priceRaw is base units (fixed8).
    if (!Number.isFinite(machine.priceRaw) || machine.priceRaw <= 0) {
      const msg = t("invalidPlayPrice");
      playError.set(msg);
      throw new Error(msg);
    }

    try {
      isPlaying.set(true);
      playError.set(null);
      resetResult();

      // Step 1: Charge the play price via PaymentProxy (GAS deposit).
      // os-payment-deposit expects a HUMAN-DECIMAL amount and scales by 10^8
      // itself (same convention as buyMachine and every other OS app); passing
      // pre-scaled base units here would double-scale (~1e8x overpay). machine.price
      // is formatGas(priceRaw) — the human-readable decimal string the edge wants.
      const depositAmount = machine.price;
      await paymentService.deposit(depositAmount, `play:${machine.id}`);

      // Step 2: Resolve the prize client-side from published odds.
      const prizeIndex = selectPrizeIndex(machine.items);
      const wonItem = prizeIndex >= 0 ? machine.items[prizeIndex] : null;

      // Step 3: Persist play count + stock decrement back to storage so the
      // catalog reflects the draw on the next load (and odds stay honest).
      try {
        const stored = (await storageService.get(`machine:${machine.id}`)) as MachineRaw | null;
        if (stored && typeof stored === "object") {
          const updated: MachineRaw = {
            ...stored,
            plays: numberFrom(stored.plays) + 1,
            lastPlayedAt: Date.now(),
          };
          if (wonItem && Array.isArray(updated.items) && prizeIndex < updated.items.length) {
            const storedItem = updated.items[prizeIndex];
            if (storedItem && numberFrom(storedItem.assetType) === 1) {
              const remaining = numberFrom(storedItem.stock) - numberFrom(storedItem.amount);
              storedItem.stock = remaining > 0 ? remaining : 0;
            } else if (storedItem && numberFrom(storedItem.assetType) === 2) {
              const remaining = numberFrom(storedItem.tokenCount) - 1;
              storedItem.tokenCount = remaining > 0 ? remaining : 0;
            }
          }
          await storageService.set(`machine:${machine.id}`, updated);
        }
      } catch (persistErr) {
        console.warn(
          "[useGasBox] play persistence failed:",
          persistErr instanceof Error ? persistErr.message : String(persistErr),
        );
      }

      // Step 4: Display result
      if (wonItem) {
        resultItem.set({ ...wonItem });
      } else {
        resultItem.set({
          name: t("unknownPrize"),
          probability: 0,
          displayProbability: 0,
          rarity: "UNKNOWN",
          assetType: 0,
          assetHash: "",
          amountRaw: 0,
          amountDisplay: "0",
          tokenId: "",
          stockRaw: 0,
          stockDisplay: "0",
          tokenCount: 0,
          decimals: 0,
          available: false,
          icon: "gift",
        });
      }
      showResult.set(true);
      showFireworks.set(true);

      // Step 5: Hint badge for first play (fire-and-forget)
      badgeService.award("first-play", "").catch(() => {});

      await loadMachines();
    } catch (e) {
      // Surface the failure to the caller so the host's notify.guard reports
      // the real error and suppresses the false success toast. The deposit may
      // have already settled on chain, so the play must not be reported as ok.
      playError.set(e instanceof Error ? e.message : t("error"));
      throw e;
    } finally {
      isPlaying.set(false);
    }
  };

  // ── Buy Machine (via OS services) ──────────────────────────────────

  /**
   * Buy a machine listed for sale via PaymentProxy + GameProxy.
   */
  const buyMachine = async () => {
    const machine = selectedMachine.get();
    if (!machine || !machine.forSale || machine.salePriceRaw <= 0) return;

    const key = `buy:${machine.id}`;
    setActionLoading(key, true);

    try {
      // Step 1: Deposit GAS payment via PaymentProxy.
      // machine.salePrice is formatGas(salePriceRaw) — the human-decimal string
      // os-payment-deposit expects (it scales by 10^8 itself). Same convention
      // as playMachine; do NOT pass pre-scaled base units here (~1e8x overpay).
      await paymentService.deposit(
        machine.salePrice,
        `sale:${machine.id}`,
      );

      // Step 2: Execute buy via GameProxy
      await gameService.placeBet("buy", machine.id);

      // Step 3: Hint badge for first machine purchase (fire-and-forget)
      badgeService.award("first-purchase", "").catch(() => {});

      await loadMachines();
    } finally {
      setActionLoading(key, false);
    }
  };

  // ── Publish Machine (via OS storage catalog) ───────────────────────

  /**
   * Build the raw item record persisted to os-storage from a publish-form item.
   * Probability is kept as the weight; NEP-17 items get a base-unit per-win
   * amount + seeded stock; NEP-11 items get a token count. These map 1:1 onto
   * the fields normalizeItem/isItemAvailable consume on read.
   */
  const buildItemRaw = (item: MachineItemData): MachineItemRaw => {
    const assetType = numberFrom(item.assetType) || 1;
    const weight = Math.max(0, Number(item.probability) || 0);
    if (assetType === 2) {
      const tokenCount = Math.max(0, Math.trunc(numberFrom(item.stock) || 1));
      return {
        name: item.name,
        weight,
        rarity: item.rarity,
        assetType: 2,
        assetHash: item.assetHash,
        amount: 1,
        tokenId: item.tokenId,
        stock: 0,
        tokenCount,
        decimals: 0,
      };
    }
    // NEP-17: amount is the per-win payout (display GAS → base units).
    const amountBase = numberFrom(toFixed8(item.amount || "0"));
    const stockUnits = Math.max(1, Math.trunc(numberFrom(item.stock) || 10));
    return {
      name: item.name,
      weight,
      rarity: item.rarity,
      assetType: 1,
      assetHash: item.assetHash,
      amount: amountBase,
      tokenId: "",
      // Seed enough stock to cover the configured units so the machine is
      // immediately playable (inventoryReady) after publish.
      stock: amountBase * stockUnits,
      tokenCount: 0,
      decimals: 8,
    };
  };

  /**
   * Publish a new machine into the os-storage catalog.
   *
   * The kernel game contract has no machine/escrow enumeration, so a machine is
   * app data: a single self-contained record (metadata + embedded prize table)
   * written to `machine:<id>`. loadMachines rebuilds the grid by enumerating
   * that prefix, so the publish → list → play loop closes entirely over
   * os-storage without any new edge endpoint.
   */
  const publishMachine = async (
    machineData: MachineData,
    setStatus: (msg: string, type: "success" | "error" | "loading") => void,
  ): Promise<boolean> => {
    if (isPublishing.get()) return false;

    try {
      isPublishing.set(true);
      setStatus(t("publishing"), "loading");

      const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
      const owner = walletHash.get();
      const items = machineData.items
        .filter((item) => item.name.trim().length > 0)
        .map(buildItemRaw);
      const priceBase = numberFrom(toFixed8(machineData.price || "0"));

      const record: MachineRaw = {
        id,
        name: machineData.name,
        description: machineData.description,
        category: machineData.category,
        tags: machineData.tags,
        creator: owner,
        owner,
        price: priceBase,
        itemCount: items.length,
        plays: 0,
        revenue: 0,
        sales: 0,
        salesVolume: 0,
        createdAt: Date.now(),
        lastPlayedAt: 0,
        active: true,
        listed: true,
        banned: false,
        locked: false,
        salePrice: 0,
        items,
      };

      // Persist the catalog record (machine:<id>) — the index loadMachines reads.
      await storageService.set(`machine:${id}`, record);

      // Hint badge for first machine creation (fire-and-forget)
      badgeService.award("first-creation", "").catch(() => {});

      setStatus(t("publishSuccess"), "success");
      await loadMachines();
      // Signal confirmed success so the view only resets the studio form when
      // the machine was actually published (the action's notify.guard swallows
      // the throw below, so the view cannot rely on dispatch rejecting).
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("error");
      setStatus(msg, "error");
      throw e;
    } finally {
      isPublishing.set(false);
    }
  };

  // ── Management Actions (via OS services) ───────────────────────────

  /**
   * Update machine price/metadata via StorageProxy.
   * The edge function translates this to an UpdateMachine contract call.
   */
  const updateMachinePrice = async (machine: Machine) => {
    const key = `price:${machine.id}`;
    if (actionLoading.get()[key]) return;

    try {
      setActionLoading(key, true);
      await storageService.set(`machine:${machine.id}:config`, {
        name: machine.name,
        description: machine.description || "",
        category: machine.category || "",
        tags: machine.tags || "",
        price: machine.price,
      });
      await loadMachines();
    } finally {
      setActionLoading(key, false);
    }
  };

  /**
   * Toggle machine active state via StorageProxy.
   * The edge function translates this to a SetMachineActive contract call.
   */
  const toggleMachineActive = async (machine: Machine) => {
    const key = `active:${machine.id}`;
    if (actionLoading.get()[key]) return;

    try {
      setActionLoading(key, true);
      await storageService.set(`machine:${machine.id}:active`, !machine.active);
      await loadMachines();
    } finally {
      setActionLoading(key, false);
    }
  };

  /**
   * Toggle machine listed state via StorageProxy.
   * The edge function translates this to a SetMachineListed contract call.
   */
  const toggleMachineListed = async (machine: Machine) => {
    const key = `listed:${machine.id}`;
    if (actionLoading.get()[key]) return;

    try {
      setActionLoading(key, true);
      await storageService.set(`machine:${machine.id}:listed`, !machine.listed);
      await loadMachines();
    } finally {
      setActionLoading(key, false);
    }
  };

  /**
   * List machine for sale via EscrowProxy.
   * The edge function translates this to a ListMachineForSale contract call.
   */
  const listMachineForSale = async (machine: Machine, salePrice: string) => {
    const key = `sale:${machine.id}`;
    if (actionLoading.get()[key]) return;

    try {
      setActionLoading(key, true);
      await escrowService.create({
        beneficiary: machine.ownerHash,
        amount: salePrice,
        milestones: [{ name: "sale", amount: salePrice }],
      });
      await loadMachines();
    } finally {
      setActionLoading(key, false);
    }
  };

  /**
   * Cancel machine sale via EscrowProxy.
   * The edge function translates this to a cancelMachineSale contract call.
   */
  const cancelMachineSale = async (machine: Machine) => {
    const key = `cancelSale:${machine.id}`;
    if (actionLoading.get()[key]) return;

    try {
      setActionLoading(key, true);
      await escrowService.refund(machine.id);
      await loadMachines();
    } finally {
      setActionLoading(key, false);
    }
  };

  /**
   * Deposit inventory item via PaymentProxy.
   * The edge function handles the token transfer + depositItem contract call.
   */
  const depositItem = async (
    machine: Machine,
    item: MachineItem,
    index: number,
    depositAmount: string,
    tokenId: string,
  ) => {
    const key = `deposit:${machine.id}:${index}`;
    if (actionLoading.get()[key]) return;

    try {
      setActionLoading(key, true);

      if (item.assetType === 1) {
        if (!depositAmount) throw new Error(t("depositAmountRequired"));
        await paymentService.deposit(
          depositAmount,
          `deposit:${machine.id}:${index}:token`,
        );
      } else if (item.assetType === 2) {
        const finalTokenId = tokenId || item.tokenId;
        if (!finalTokenId) throw new Error(t("tokenIdRequired"));
        await paymentService.deposit(
          "0",
          `deposit:${machine.id}:${index}:nft:${finalTokenId}`,
        );
      }

      await loadMachines();
    } finally {
      setActionLoading(key, false);
    }
  };

  /**
   * Withdraw inventory item via PaymentProxy.
   * The edge function handles the withdrawItem contract call + token transfer.
   */
  const withdrawItem = async (
    machine: Machine,
    item: MachineItem,
    index: number,
    withdrawAmount: string,
    tokenId: string,
  ) => {
    const key = `withdraw:${machine.id}:${index}`;
    if (actionLoading.get()[key]) return;

    try {
      setActionLoading(key, true);

      if (item.assetType === 1) {
        if (!withdrawAmount) throw new Error(t("withdrawAmountRequired"));
        await paymentService.withdraw(
          `withdraw:${machine.id}:${index}:${withdrawAmount}`,
        );
      } else if (item.assetType === 2) {
        const finalTokenId = tokenId || item.tokenId || "";
        await paymentService.withdraw(
          `withdraw:${machine.id}:${index}:nft:${finalTokenId}`,
        );
      }

      await loadMachines();
    } finally {
      setActionLoading(key, false);
    }
  };

  // ── Derived display values ────────────────────────────────────────
  const machineCount = createDerived(() => machines.get().length, [machines]);
  const isPlayingDisplay = createDerived(
    () => (isPlaying.get() ? t("yes") : t("no")),
    [isPlaying],
  );
  const selectedMachineName = createDerived(
    () => selectedMachine.get()?.name || t("none"),
    [selectedMachine],
  );

  // ── Load All ───────────────────────────────────────────────────────

  const loadAll = async () => {
    await loadMachines();
  };

  return {
    // ── Raw State ───────────────────────────────────────────────────
    machines,
    selectedMachine,
    isLoadingMachines,
    actionLoading,
    walletHash,
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
    selectMachine,
    deselectMachine,
    openStudio,
    closeStudio,
    resetResult,
    playMachine,
    buyMachine,
    publishMachine,
    updateMachinePrice,
    toggleMachineActive,
    toggleMachineListed,
    listMachineForSale,
    cancelMachineSale,
    depositItem,
    withdrawItem,
    loadAll,
  };
}

export type UseGasBoxReturn = ReturnType<typeof useGasBox>;
