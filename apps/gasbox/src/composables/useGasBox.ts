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
 *   AFTER (OS proxy):
 *     ctx.os.game.getPoolState("machines")          — load all machines
 *     ctx.os.storage.get(`machine:${id}`)            — load single machine
 *     ctx.os.storage.get(`machine:${id}:items`)      — load machine items
 *     ctx.os.payment.deposit(amount, memo)            — pay for play/purchase
 *     ctx.os.game.placeBet("play", machineId)         — initiate + settle play
 *     ctx.os.game.placeBet("buy", machineId)          — buy a machine
 *     ctx.os.game.createPool(config)                  — create machine
 *     ctx.os.storage.set(`machine:${id}:item`, data)  — add machine item
 *     ctx.os.storage.set(`machine:${id}:config`, ...)  — update machine config
 *     ctx.os.storage.set(`machine:${id}:active`, ...)  — toggle active
 *     ctx.os.storage.set(`machine:${id}:listed`, ...)  — toggle listed
 *     ctx.os.escrow.create(...)                       — list machine for sale
 *     ctx.os.escrow.refund(machineId)                 — cancel sale
 *     ctx.os.payment.deposit(amount, "deposit:...")    — deposit inventory
 *     ctx.os.payment.withdraw(amount)                 — withdraw inventory
 *     ctx.os.badge.award(badgeId, "")                 — achievement hints
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
import { formatGas, toSafeNumber } from "@shared/utils/format";
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

/** Shape returned by GameProxy.getPoolState("machines") for GasBox. */
interface GasBoxPoolState {
  poolId: string;
  appId: string;
  status: string;
  playerCount: number;
  totalBets: string;
  machines?: MachineRaw[];
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
interface MachineItemData {
  name: string;
  probability: number;
  icon: string;
  rarity: string;
  assetType: string;
  assetHash: string;
  amount: string;
  tokenId: string;
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
   * Load all machines via GameProxy + StorageProxy.
   * The edge function translates getPoolState("machines") into the
   * contract's TotalMachines + GetMachine + GetMachineItem calls and
   * returns normalized data.
   */
  const loadMachines = async () => {
    isLoadingMachines.set(true);
    try {
      const state = (await gameService.getPoolState("machines")) as GasBoxPoolState;
      if (state && Array.isArray(state.machines)) {
        machines.set(state.machines.map(normalizeMachine));
      } else {
        machines.set([]);
      }

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

  // ── Play Action (via OS services) ──────────────────────────────────

  /**
   * Play a gacha machine via PaymentProxy + GameProxy.
   *
   * The OS payment service handles the GAS transfer.
   * The OS game service handles initiatePlay + settlePlay via edge function,
   * including RNG seed generation and item selection.
   */
  const playMachine = async () => {
    const machine = selectedMachine.get();
    if (!machine || isPlaying.get()) return;
    if (!machine.active || !machine.inventoryReady) {
      playError.set(t("inventoryUnavailable"));
      return;
    }

    try {
      isPlaying.set(true);
      playError.set(null);
      resetResult();

      // Step 1: Deposit GAS payment via PaymentProxy
      await paymentService.deposit(
        machine.price,
        `play:${machine.id}`,
      );

      // Step 2: Place bet (initiate + settle play) via GameProxy
      // The edge function handles initiatePlay, seed generation,
      // item selection, and settlePlay as an atomic operation.
      const result = (await gameService.placeBet(
        "play",
        machine.id,
      )) as { selectedIndex?: number; item?: MachineItemRaw } | void;

      // Step 3: Display result
      if (result && typeof result === "object" && result.item) {
        resultItem.set(normalizeItem(result.item, t("rarityCommon")));
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

      // Step 4: Hint badge for first play (fire-and-forget)
      badgeService.award("first-play", "").catch(() => {});

      await loadMachines();
    } catch (e) {
      playError.set(e instanceof Error ? e.message : t("error"));
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
      // Step 1: Deposit GAS payment via PaymentProxy
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

  // ── Publish Machine (via OS services) ──────────────────────────────

  /**
   * Create a new machine + add items via GameProxy + StorageProxy.
   *
   * The edge function handles CreateMachine and AddMachineItem contract
   * calls, event parsing, and returns the new machine ID.
   */
  const publishMachine = async (
    machineData: MachineData,
    setStatus: (msg: string, type: "success" | "error" | "loading") => void,
  ) => {
    if (isPublishing.get()) return;

    try {
      isPublishing.set(true);
      setStatus(t("publishing"), "loading");

      // Create machine via GameProxy
      const machineId = await gameService.createPool({
        poolType: 2, // lottery/gacha type
        maxPlayers: 0, // unlimited
        entryFee: machineData.price,
        duration: 0, // perpetual
      });

      // Store machine metadata via StorageProxy
      await storageService.set(`machine:${machineId}:meta`, {
        name: machineData.name,
        description: machineData.description,
        category: machineData.category,
        tags: machineData.tags,
        price: machineData.price,
      });

      // Add items via StorageProxy
      for (const item of machineData.items) {
        await storageService.set(`machine:${machineId}:item:${item.name}`, {
          name: item.name,
          probability: item.probability,
          rarity: item.rarity,
          assetType: item.assetType,
          assetHash: item.assetHash,
          amount: item.amount,
          tokenId: item.tokenId,
        });
      }

      // Hint badge for first machine creation (fire-and-forget)
      badgeService.award("first-creation", "").catch(() => {});

      setStatus(t("publishSuccess"), "success");
      await loadMachines();
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
    address,

    // ── Formatted values (for manifest stat/sidebar bindings) ────────
    machineCount,
    isPlayingDisplay,
    selectedMachineName,

    // ── Actions ─────────────────────────────────────────────────────
    selectMachine,
    deselectMachine,
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
