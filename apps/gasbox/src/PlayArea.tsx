/**
 * PlayArea.tsx -- GasBox
 *
 * Interactive market console for machines, on-chain prize escrow, and pulls.
 */

import { useState } from "react";
import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { ownerMatchesAddress } from "@shared/utils/neo";
import type { Machine, MachineItem } from "./types";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface PullResult {
  item: string;
  name?: string;
  rarity: string;
  description?: string;
  amountDisplay?: string;
  icon?: string;
}

/**
 * Local create-form prize item (string-typed for controlled inputs).
 *
 * There is intentionally no `rarity` here: the contract stores only name +
 * weight + amount, and the displayed tier is derived from each item's weight
 * share on read-back. A creator-chosen rarity would be silently overwritten, so
 * the form shows a live weight-derived tier preview instead of a dead dropdown.
 */
interface StudioItem {
  name: string;
  /** Relative draw weight (positive integer). */
  weight: string;
  /** Prize amount in the machine's prize asset (GAS decimal / NEO integer). */
  amount: string;
}

const PRIZE_ASSET_OPTIONS = ["GAS", "NEO"] as const;
type PrizeAsset = (typeof PRIZE_ASSET_OPTIONS)[number];

const emptyStudioItem = (): StudioItem => ({
  name: "",
  weight: "10",
  amount: "0.1",
});

/**
 * Weight-derived rarity tier — mirrors rarityFromShare() in useGasBox so the
 * Studio preview matches exactly what players see on read-back. share is the
 * item's percent of the machine's total weight.
 */
const rarityFromShare = (share: number): string => {
  if (!Number.isFinite(share) || share <= 0) return "COMMON";
  if (share <= 5) return "LEGENDARY";
  if (share <= 15) return "EPIC";
  if (share <= 35) return "RARE";
  return "COMMON";
};

const formatCount = (value: number, pendingLabel: string) =>
  value > 0 ? value.toLocaleString() : pendingLabel;

const formatPercent = (value: number, pendingLabel: string) => {
  if (!Number.isFinite(value) || value <= 0) return pendingLabel;
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}%`;
};

/**
 * Inline gachapon / blind-box mark — a capsule machine with a dispensed
 * capsule, in the Neo Soft line-icon style (single accent hue via
 * currentColor). Replaces the bare letter-"G" avatars that read as broken
 * image fallbacks.
 */
function GachaMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="3" width="16" height="13" rx="3" />
      <path d="M4 9.5h16" />
      <circle cx="9.5" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
      <rect x="9" y="11.5" width="6" height="2.2" rx="1.1" />
      <path d="M8 16v2.4a1.6 1.6 0 0 0 1.6 1.6h4.8a1.6 1.6 0 0 0 1.6-1.6V16" />
      <circle cx="12" cy="20" r="1.4" />
    </svg>
  );
}

/**
 * Prize capsule mark — a single dispensed capsule with a shine, used for
 * machines that already advertise a top prize. Same currentColor accent so the
 * icon stays on a single hue.
 */
function PrizeMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 11a5 5 0 0 1 10 0v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
      <path d="M7 13h10" />
      <path d="M10 8.5a3 3 0 0 1 2.6-1.4" opacity="0.6" />
      <circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Small rarity gem/star badge. Legendary reads as a star; the lower tiers read
 * as a faceted gem. The tier colour class is applied to the <svg> itself (not a
 * wrapping li/span) so it sets the svg's own `color`, which `fill=currentColor`
 * then resolves — robust against host wrappers that force `li/span { color:
 * inherit }`. Decorative rarity art, off the single interactive accent.
 */
function RarityMark({ rarity, className }: { rarity?: string; className?: string }) {
  const tier = rarity?.toLowerCase();
  const cls = `${rarityClassName(rarity)}${className ? ` ${className}` : ""}`;
  if (tier === "legendary") {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3 9l6.1-.9z" />
      </svg>
    );
  }
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M7 3h10l4 6-9 12L3 9z" opacity="0.92" />
      <path d="M3 9h18" stroke="#ffffff" strokeWidth="1" opacity="0.45" fill="none" />
      <path d="M12 3l-2 6 2 12 2-12z" stroke="#ffffff" strokeWidth="1" opacity="0.35" fill="none" />
    </svg>
  );
}

/**
 * Module-level rarity → tier-colour class (shared by RarityMark and the
 * component's rarityClass). Kept outside the component so the gem helper can use
 * it without prop drilling.
 */
function rarityClassName(rarity: string | undefined): string {
  switch (rarity?.toLowerCase()) {
    case "legendary": return "gasbox-rarity--legendary";
    case "epic": return "gasbox-rarity--epic";
    case "rare": return "gasbox-rarity--rare";
    case "uncommon": return "gasbox-rarity--uncommon";
    default: return "gasbox-rarity--common";
  }
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const isPulling = bool("isPulling");
  const isCreating = bool("isCreating");
  const machineCount = num("machineCount");
  const userPulls = num("userPulls");
  const totalPulls = num("totalPulls");
  const selectedMachineName = str("selectedMachineName", "");
  const machines = val<Machine[]>("machines") ?? [];
  const selectedMachine = val<Machine>("selectedMachine");
  const pullResult = val<PullResult>("pullResult");
  const studioOpen = bool("studioOpen");
  const walletAddress = str("walletAddress", "");
  const hasPlayCredit = bool("hasPlayCredit");
  const formattedPlayCredit = str("formattedPlayCredit", "");
  // Commit/reveal (two-step) state. The pending betId lives in the composable
  // observable (the resume handle the Reveal action settles against); the view
  // only needs the phase + reveal affordance flags.
  const betPhase = str("betPhase", "idle");
  const canReveal = bool("canReveal");
  const isAwaitingReveal = bool("isAwaitingReveal");

  const [showResult, setShowResult] = useState(false);
  const [leverPulled, setLeverPulled] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");

  const [machineName, setMachineName] = useState("");
  const [machinePrice, setMachinePrice] = useState("");
  const [prizeAsset, setPrizeAsset] = useState<PrizeAsset>("GAS");
  const [studioItems, setStudioItems] = useState<StudioItem[]>([
    { name: "", weight: "50", amount: "0.1" },
  ]);
  const [studioError, setStudioError] = useState<string | null>(null);

  const selectedMachineReady = Boolean(selectedMachine?.active && selectedMachine?.inventoryReady);
  // Creator earnings flow: surface Withdraw Revenue only to the machine's
  // creator (connected wallet matches creatorHash) and only when there is
  // accrued, withdrawable revenue. Otherwise the control stays hidden.
  const isSelectedMachineCreator = Boolean(
    selectedMachine &&
      walletAddress &&
      ownerMatchesAddress(selectedMachine.creatorHash, walletAddress),
  );
  const selectedRevenueRaw = selectedMachine?.revenueRaw ?? 0;
  const canWithdrawRevenue = isSelectedMachineCreator && selectedRevenueRaw > 0;
  const machineCountDisplay = machineCount > 0 ? machineCount.toLocaleString() : "—";
  const userPullsDisplay = formatCount(userPulls, "0");
  const totalPullsDisplay = formatCount(totalPulls, "0");
  const signalLabel = isCreating
    ? t("publishing")
    : selectedMachineReady
      ? t("readyToPlay")
      : t("gasboxLiveStatus");
  const selectedItems = selectedMachine?.items ?? [];
  const availableItems = selectedItems.filter((item: MachineItem) => item.available);
  const unavailableItems = selectedItems.filter((item: MachineItem) => !item.available);
  const oddsCoverage = availableItems.reduce(
    (sum: number, item: MachineItem) => sum + item.displayProbability,
    0,
  );
  const rarestAvailableItem = availableItems.reduce<MachineItem | undefined>(
    (candidate, item) => {
      if (!candidate) return item;
      if (item.displayProbability <= 0) return candidate;
      if (candidate.displayProbability <= 0) return item;
      return item.displayProbability < candidate.displayProbability ? item : candidate;
    },
    undefined,
  );
  const prizeFocusLabel =
    selectedMachine?.topPrize ||
    rarestAvailableItem?.name ||
    t("gasboxNoAvailablePrize");
  const inventoryRatio = selectedMachine
    ? `${availableItems.length}/${Math.max(selectedItems.length, selectedMachine.itemCount)}`
    : t("gasboxPending");
  const pullReadinessTitle = selectedMachineReady
    ? t("gasboxPullReadyTitle")
    : t("gasboxPullBlockedTitle");
  const blockedKeyBase =
    selectedMachine?.active === false
      ? "gasboxPullBlockedInactive"
      : "gasboxPullBlockedInventory";
  const pullReadinessCopy = selectedMachineReady
    ? t("gasboxPullReadyCopy")
    : // The creator can re-fund / re-activate inline (controls below); everyone
      // else just sees that the machine isn't currently playable.
      t(isSelectedMachineCreator ? `${blockedKeyBase}Creator` : blockedKeyBase);
  const oddsReadable = oddsCoverage > 0;
  const pullChecklist = [
    { label: t("gasboxChecklistActive"), passed: Boolean(selectedMachine?.active) },
    { label: t("gasboxChecklistInventory"), passed: Boolean(selectedMachine?.inventoryReady) },
    { label: t("gasboxChecklistOdds"), passed: oddsReadable },
  ];
  const handleSelectMachine = async (id: string) => {
    await dispatch("selectMachine", id);
  };

  const handlePull = async () => {
    const machineId = selectedMachine?.id;
    if (!machineId) return;
    setLeverPulled(true);
    // Two-step: commit → wait one block → settle. The dispatch resolves after
    // the whole flow; the result overlay is gated on the settled result, so a
    // committed-but-unrevealed bet shows the pending panel + Reveal button below
    // instead of a (non-existent) result.
    await dispatch("pull", machineId);
    setShowResult(true);
    setTimeout(() => setLeverPulled(false), 600);
  };

  // Reveal-retry: finish a committed bet whose settle timed out. Permissionless
  // and safe to retry — the contract pays exactly once.
  const handleReveal = async () => {
    await dispatch("reveal");
    setShowResult(true);
  };

  const dismissResult = () => {
    setShowResult(false);
    void dispatch("resetResult");
  };

  // Player-facing label for the current commit/reveal phase.
  const pendingPhaseLabel =
    betPhase === "committing"
      ? t("gasboxCommitting")
      : betPhase === "settling"
        ? t("gasboxRevealing")
        : t("gasboxCommitted");

  const handleWithdrawRevenue = async () => {
    const machineId = selectedMachine?.id;
    if (!machineId || !canWithdrawRevenue) return;
    await dispatch("withdrawRevenue", machineId);
  };

  const handleTopUpPool = async () => {
    const machineId = selectedMachine?.id;
    if (!machineId || !(Number(topUpAmount) > 0)) return;
    await dispatch("topUpPool", machineId, topUpAmount.trim());
    setTopUpAmount("");
  };

  const handleToggleActive = async () => {
    const machineId = selectedMachine?.id;
    if (!machineId) return;
    await dispatch("setMachineActive", machineId, !selectedMachine?.active);
  };

  const updateStudioItem = (index: number, patch: Partial<StudioItem>) => {
    setStudioItems((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const addStudioItem = () => {
    setStudioItems((items) => [...items, emptyStudioItem()]);
  };

  const removeStudioItem = (index: number) => {
    setStudioItems((items) =>
      items.length > 1 ? items.filter((_, i) => i !== index) : items,
    );
  };

  const studioTotalWeight = studioItems.reduce(
    (sum, item) => sum + (Number(item.weight) || 0),
    0,
  );

  const resetStudioForm = () => {
    setMachineName("");
    setMachinePrice("");
    setPrizeAsset("GAS");
    setStudioItems([emptyStudioItem()]);
    setStudioError(null);
  };

  const handleCloseStudio = async () => {
    setStudioError(null);
    await dispatch("closeStudio");
  };

  const handlePublishMachine = async () => {
    if (!machineName.trim()) {
      setStudioError(t("createNameRequired"));
      return;
    }
    const validItems = studioItems.filter(
      (item) => item.name.trim().length > 0 && (Number(item.weight) || 0) > 0,
    );
    if (validItems.length === 0) {
      setStudioError(t("createNeedsItem"));
      return;
    }
    setStudioError(null);

    // The publishMachine action is wrapped in notify.guard, which swallows the
    // error and resolves regardless of outcome. Gate the form reset on the
    // action's confirmed-success flag so a failed publish (transient chain /
    // wallet error) keeps the user's input instead of wiping the whole table.
    // dispatch is typed Promise<void> but returns the action payload at runtime.
    const published: unknown = await dispatch("publishMachine", {
      name: machineName.trim(),
      price: machinePrice.trim() || "0",
      prizeAsset,
      items: validItems.map((item) => ({
        name: item.name.trim(),
        weight: item.weight.trim() || "0",
        amount: item.amount.trim() || "0",
      })),
    });
    if (published === true) {
      resetStudioForm();
    }
  };

  const rarityClass = rarityClassName;

  // Real machine iconography (replaces the bare "G"/"P"/"N" letter fallbacks
  // that read as broken image assets): a prize capsule for machines that
  // advertise a top prize, otherwise the gachapon mark. The wrapper carries the
  // single brand-hue badge styling.
  const machineMark = (machine?: Machine | null) =>
    machine?.topPrize ? <PrizeMark /> : <GachaMark />;

  if (isLoading) {
    return (
      <div className="gasbox-play-area">
        <div className="gasbox-loading" role="status" aria-live="polite">
          <div className="gasbox-loading-spinner" />
          <span>{t("loadingMachines")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="gasbox-play-area">
      <section className="gasbox-hero" aria-label={t("title")}>
        <div className="gasbox-hero__main">
          <div className="gasbox-hero__badge" aria-hidden="true">
            <GachaMark />
          </div>
          <div className="gasbox-hero__copy">
            <span className="gasbox-eyebrow">{t("docSubtitle")}</span>
            <h2>{t("title")}</h2>
            <p className="gasbox-hero__status">
              <span className="gasbox-hero__dot" aria-hidden="true" />
              {signalLabel}
            </p>
            <p>{t("gasboxEscrowSafetyDesc")}</p>
          </div>
        </div>
        <div className="gasbox-hero__metrics" aria-label={t("gasboxLiveStatus")}>
          <div className="gasbox-metric">
            <span>{t("machines")}</span>
            <strong>{machineCountDisplay}</strong>
          </div>
          <div className="gasbox-metric">
            <span>{t("yourPulls")}</span>
            <strong>{userPullsDisplay}</strong>
          </div>
          <div className="gasbox-metric" title={t("estPlaysHint")}>
            <span>{t("estPlays")}</span>
            <strong>{totalPullsDisplay}</strong>
          </div>
        </div>
      </section>

      <section className={`gasbox-machines-card${machines.length === 0 ? " gasbox-machines-card--empty" : ""}`}>
        <div className="gasbox-section-header gasbox-section-header--with-action">
          <div className="gasbox-section-header__copy">
            <span>{t("market")}</span>
            <strong>{t("selectMachine")}</strong>
          </div>
          <NeoButton
            variant={studioOpen ? "secondary" : "primary"}
            size="sm"
            onClick={() => dispatch(studioOpen ? "closeStudio" : "openStudio")}
          >
            {studioOpen ? t("studioCloseAction") : t("createMachineAction")}
          </NeoButton>
        </div>
        {machines.length === 0 ? (
          <div className="gasbox-market-empty">
            {/* Game-inviting teaser: a locked sample capsule with hidden odds so
                a first-time visitor sees the play loop (capsule + rarity tiers)
                instead of an admin-flavored empty console. The lock + "?" make
                it honestly inert until a real machine loads. */}
            <div className="gasbox-teaser" aria-hidden="true">
              <div className="gasbox-teaser__capsule">
                <GachaMark className="gasbox-teaser__mark" />
                <span className="gasbox-teaser__lock">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
              </div>
              <ul className="gasbox-teaser__odds">
                {(["legendary", "epic", "rare", "common"] as const).map((tier) => (
                  <li key={tier} className={`gasbox-teaser__tier ${rarityClass(tier)}`}>
                    <RarityMark rarity={tier} className="gasbox-teaser__gem" />
                    <span className="gasbox-teaser__pct">?</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="gasbox-market-empty__copy">
              <span>{t("gasboxMarketEmptyTitle")}</span>
              <strong>{t("gasboxMarketEmptyTeaser")}</strong>
            </div>
            <div className="gasbox-empty-button-row">
              <NeoButton variant="primary" size="md" onClick={() => dispatch("refreshMachines")}>
                {t("refreshMachines")}
              </NeoButton>
            </div>
            <p className="gasbox-empty-creator-line">
              {t("gasboxEmptyForCreators")}{" "}
              <button
                type="button"
                className="gasbox-empty-creator-link"
                onClick={() => dispatch("openStudio")}
              >
                {t("openStudio")}
              </button>
            </p>
          </div>
        ) : (
          <div className="gasbox-machine-grid">
            {machines.map((machine) => {
              const isSelected = selectedMachine?.id === machine.id;
              return (
                <NeoCard
                  key={machine.id}
                  variant="erobo"
                  hoverable
                  className={`gasbox-machine-item${isSelected ? " gasbox-machine-item--selected" : ""}${!machine.active ? " gasbox-machine-item--inactive" : ""}`}
                  onClick={() => handleSelectMachine(machine.id)}
                >
                  <div className="gasbox-machine-icon" aria-hidden="true">{machineMark(machine)}</div>
                  <div className="gasbox-machine-info">
                    <span className="gasbox-machine-name">{machine.name}</span>
                    {machine.description && (
                      <span className="gasbox-machine-desc">{machine.description}</span>
                    )}
                    <span className="gasbox-machine-cost">{machine.price} GAS</span>
                    <div className="gasbox-machine-meta">
                      <span>{machine.itemCount} {t("items")}</span>
                      <span title={t("estPlaysHint")}>{machine.plays} {t("estPlays").toLowerCase()}</span>
                    </div>
                  </div>
                </NeoCard>
              );
            })}
          </div>
        )}
      </section>

      {studioOpen && (
        <NeoCard variant="erobo" className="gasbox-studio-card">
          <div className="gasbox-studio-header">
            <div className="gasbox-studio-header__copy">
              <span>{t("studioTitle")}</span>
              <strong>{t("studioSubtitle")}</strong>
              <p>{t("createPanelHint")}</p>
            </div>
            <NeoButton variant="ghost" size="sm" onClick={handleCloseStudio}>
              {t("backToMarket")}
            </NeoButton>
          </div>

          <div className="gasbox-studio-grid">
            <label className="gasbox-field">
              <span>{t("machineNameLabel")}</span>
              <input
                type="text"
                value={machineName}
                placeholder={t("machineNamePlaceholder")}
                onChange={(e) => setMachineName(e.target.value)}
              />
            </label>
            <label className="gasbox-field">
              <span>{t("pricePerPlayLabel")}</span>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={machinePrice}
                placeholder={t("pricePlaceholder")}
                onChange={(e) => setMachinePrice(e.target.value)}
              />
            </label>
            <label className="gasbox-field gasbox-field--narrow">
              <span>{t("prizeAssetLabel")}</span>
              <select
                value={prizeAsset}
                onChange={(e) => setPrizeAsset(e.target.value as PrizeAsset)}
              >
                {PRIZE_ASSET_OPTIONS.map((asset) => (
                  <option key={asset} value={asset}>
                    {asset}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="gasbox-studio-items">
            <div className="gasbox-studio-items__header">
              <span>{t("inventoryAndOdds")}</span>
              <strong>
                {t("totalWeightLabel")}: {studioTotalWeight}
              </strong>
            </div>
            <p className="gasbox-studio-items__hint">{t("derivedTierExplain")}</p>

            {studioItems.map((item, index) => {
              const itemWeight = Number(item.weight) || 0;
              const share =
                studioTotalWeight > 0 ? (itemWeight / studioTotalWeight) * 100 : 0;
              const derivedRarity = rarityFromShare(share);
              const rarityKey = `rarity${derivedRarity.charAt(0)}${derivedRarity
                .slice(1)
                .toLowerCase()}`;
              return (
              <div key={index} className="gasbox-studio-item">
                <div className="gasbox-studio-item__row">
                  <label className="gasbox-field">
                    <span>{t("itemNamePlaceholder")}</span>
                    <input
                      type="text"
                      value={item.name}
                      placeholder={t("itemNamePlaceholder")}
                      onChange={(e) => updateStudioItem(index, { name: e.target.value })}
                    />
                  </label>
                  <label className="gasbox-field gasbox-field--narrow">
                    <span>{t("weightLabel")}</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.weight}
                      placeholder={t("weightPlaceholder")}
                      onChange={(e) => updateStudioItem(index, { weight: e.target.value })}
                    />
                  </label>
                  <div className="gasbox-field gasbox-field--narrow gasbox-derived-tier">
                    <span>{t("derivedTierLabel")}</span>
                    <strong
                      className={`gasbox-derived-tier__value ${rarityClass(derivedRarity)}`}
                      aria-label={t("derivedTierHint")}
                    >
                      {t(rarityKey) || derivedRarity}
                      {itemWeight > 0 && (
                        <span className="gasbox-derived-tier__share">
                          {" "}
                          {formatPercent(share, "—")}
                        </span>
                      )}
                    </strong>
                  </div>
                </div>
                <div className="gasbox-studio-item__row">
                  <label className="gasbox-field">
                    <span>{t("prizePerWinLabel")} ({prizeAsset})</span>
                    <input
                      type="number"
                      min="0"
                      step={prizeAsset === "NEO" ? "1" : "0.0001"}
                      value={item.amount}
                      placeholder={t("tokenAmountPlaceholder")}
                      onChange={(e) => updateStudioItem(index, { amount: e.target.value })}
                    />
                  </label>
                  <NeoButton
                    variant="ghost"
                    size="sm"
                    disabled={studioItems.length <= 1}
                    onClick={() => removeStudioItem(index)}
                  >
                    {t("removeItem", { index: index + 1 })}
                  </NeoButton>
                </div>
              </div>
              );
            })}

            <NeoButton variant="secondary" size="sm" onClick={addStudioItem}>
              {t("addItem")}
            </NeoButton>
          </div>

          <p className="gasbox-inventory-note">{t("inventoryNote")}</p>

          {studioError && (
            <p className="gasbox-studio-error" role="alert">{studioError}</p>
          )}

          <NeoButton
            variant="primary"
            size="lg"
            block
            loading={isCreating}
            disabled={isCreating}
            onClick={handlePublishMachine}
          >
            {isCreating ? t("publishing") : t("createMachineAction")}
          </NeoButton>
        </NeoCard>
      )}

      {selectedMachine && (
        <NeoCard variant="erobo" className="gasbox-pull-card">
          <div className="gasbox-selected-display">
            <div className="gasbox-selected-header">
              <div className="gasbox-selected-icon" aria-hidden="true">{machineMark(selectedMachine)}</div>
              <div className="gasbox-selected-info">
                <h3 className="gasbox-selected-name">
                  {selectedMachineName || selectedMachine.name}
                </h3>
                {selectedMachine.description && (
                  <p className="gasbox-selected-desc">{selectedMachine.description}</p>
                )}
                <div className="gasbox-selected-tags">
                  {selectedMachine.category && (
                    <span className="gasbox-tag">{selectedMachine.category}</span>
                  )}
                  {selectedMachine.tagsList?.map((tag) => (
                    <span key={tag} className="gasbox-tag">{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className={`gasbox-status-banner${selectedMachineReady ? " is-ready" : " is-blocked"}`} aria-label={t("gasboxReadinessTitle")}>
              <strong>{pullReadinessTitle}</strong>
              <p>{pullReadinessCopy}</p>
            </div>

            <div className={`gasbox-lever-container${leverPulled ? " gasbox-lever--pulled" : ""}${isPulling ? " gasbox-lever--spinning" : ""}`}>
              <NeoButton
                variant="primary"
                size="lg"
                block
                loading={isPulling}
                disabled={isPulling || isAwaitingReveal || !selectedMachineReady}
                className="gasbox-pull-btn"
                onClick={handlePull}
              >
                <div className="gasbox-pull-btn-content">
                  <span className="gasbox-pull-btn-text">
                    {betPhase === "committing"
                      ? t("gasboxCommitting")
                      : betPhase === "settling"
                        ? t("gasboxRevealing")
                        : isPulling
                          ? t("pulling")
                          : t("pull")}
                  </span>
                  <span className="gasbox-pull-btn-cost">
                    {selectedMachine.price} GAS
                  </span>
                </div>
              </NeoButton>
              <div className="gasbox-selected-actions" aria-label={t("gasboxSelectedActions")}>
                <NeoButton
                  variant="secondary"
                  size="sm"
                  disabled={isPulling}
                  onClick={() => dispatch("refreshMachines")}
                >
                  {t("refreshMachines")}
                </NeoButton>
                <NeoButton
                  variant="ghost"
                  size="sm"
                  disabled={isPulling}
                  onClick={() => dispatch("openStudio")}
                >
                  {t("openStudio")}
                </NeoButton>
              </div>
            </div>

            {(isAwaitingReveal || canReveal) && (
              <section
                className="gasbox-pending"
                role="status"
                aria-live="polite"
                aria-label={t("gasboxPendingTitle")}
              >
                <div className="gasbox-pending__head">
                  <span
                    className={`gasbox-pending__spinner${betPhase === "committed" ? " is-waiting" : ""}`}
                    aria-hidden="true"
                  />
                  <div className="gasbox-pending__copy">
                    <strong>{pendingPhaseLabel}</strong>
                    <p>{t("gasboxPendingDesc")}</p>
                  </div>
                </div>
                {/* Reveal-retry: shown once the bet is committed so a timed-out
                    or not-yet-ready settle can be re-fired. Hidden mid-commit. */}
                {canReveal && betPhase !== "committing" && (
                  <div className="gasbox-pending__actions">
                    <NeoButton
                      variant="primary"
                      size="md"
                      loading={betPhase === "settling"}
                      disabled={betPhase === "settling"}
                      onClick={handleReveal}
                    >
                      {t("gasboxRevealAction")}
                    </NeoButton>
                    <span className="gasbox-pending__hint">{t("gasboxRevealHint")}</span>
                  </div>
                )}
              </section>
            )}

            {hasPlayCredit && (
              <div className="gasbox-play-credit" role="status">
                <span className="gasbox-play-credit__label">{t("gasboxPlayCreditLabel")}</span>
                <span className="gasbox-play-credit__value">{formattedPlayCredit}</span>
                <span className="gasbox-play-credit__hint">{t("gasboxPlayCreditHint")}</span>
              </div>
            )}

            {isSelectedMachineCreator && (
              <section
                className="gasbox-creator-revenue"
                aria-label={t("gasboxCreatorEarningsTitle")}
              >
                <div className="gasbox-creator-revenue__copy">
                  <span className="gasbox-eyebrow">{t("gasboxCreatorEarningsTitle")}</span>
                  {/* Revenue accrues from the play price, which is always GAS. */}
                  <strong>{selectedMachine.revenue} GAS</strong>
                  <p>
                    {canWithdrawRevenue
                      ? t("gasboxRevenueAvailable")
                      : t("gasboxRevenueNone")}
                  </p>
                </div>
                <NeoButton
                  variant="primary"
                  size="md"
                  disabled={isPulling || !canWithdrawRevenue}
                  onClick={handleWithdrawRevenue}
                >
                  {t("withdrawRevenue")}
                </NeoButton>
              </section>
            )}

            {isSelectedMachineCreator && (
              <section
                className="gasbox-creator-controls"
                aria-label={t("gasboxMachineControlsTitle")}
              >
                <div className="gasbox-creator-controls__head">
                  <span className="gasbox-eyebrow">{t("gasboxMachineControlsTitle")}</span>
                  <p>{t("gasboxMachineControlsDesc")}</p>
                </div>
                <div className="gasbox-creator-controls__pool">
                  <span>{t("gasboxPoolBalance")}</span>
                  <strong>
                    {selectedMachine.poolBalance} {selectedMachine.prizeAsset} / {selectedMachine.maxPrize} {selectedMachine.prizeAsset}
                  </strong>
                </div>
                <div className="gasbox-creator-controls__row">
                  <label className="gasbox-field">
                    <span>
                      {t("gasboxTopUpLabel", { asset: selectedMachine.prizeAsset ?? "GAS" })}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step={selectedMachine.prizeAsset === "NEO" ? "1" : "0.0001"}
                      value={topUpAmount}
                      placeholder={t("gasboxTopUpPlaceholder")}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                    />
                  </label>
                  <NeoButton
                    variant="secondary"
                    size="md"
                    disabled={isPulling || !(Number(topUpAmount) > 0)}
                    onClick={handleTopUpPool}
                  >
                    {t("gasboxTopUpAction")}
                  </NeoButton>
                </div>
                <NeoButton
                  variant={selectedMachine.active ? "ghost" : "primary"}
                  size="md"
                  block
                  disabled={isPulling}
                  onClick={handleToggleActive}
                >
                  {selectedMachine.active ? t("gasboxDeactivateAction") : t("gasboxActivateAction")}
                </NeoButton>
              </section>
            )}

            <section className="gasbox-decision" aria-label={t("gasboxDecisionTitle")}>
              <div className="gasbox-decision-head">
                <strong>{t("gasboxDecisionTitle")}</strong>
                <span>{t("gasboxDecisionSubtitle")}</span>
              </div>
              <div className="gasbox-decision-strip">
                <div className="gasbox-decision-cell">
                  <span>{t("pullCost")}</span>
                  <strong>{selectedMachine.price} GAS</strong>
                </div>
                <div className="gasbox-decision-cell">
                  <span>{t("inventoryAndOdds")}</span>
                  <strong>{inventoryRatio} {t("items")}</strong>
                  <p className="gasbox-decision-note">
                    {selectedMachine.inventoryReady
                      ? t("gasboxInventoryReady")
                      : t("gasboxInventoryActionRequired")}
                  </p>
                </div>
                <div className="gasbox-decision-cell">
                  <span>{t("gasboxPrizeFocus")}</span>
                  <strong>{prizeFocusLabel}</strong>
                </div>
                <div className="gasbox-decision-cell">
                  <span>{t("gasboxOddsCoverage")}</span>
                  <strong>{formatPercent(oddsCoverage, t("gasboxPending"))}</strong>
                </div>
              </div>

              <ul className="gasbox-checklist" aria-label={t("gasboxPullChecklist")}>
                {pullChecklist.map((check) => (
                  <li
                    key={check.label}
                    className={`gasbox-check${check.passed ? " is-passed" : " is-blocked"}`}
                  >
                    <span className="gasbox-check__label">{check.label}</span>
                    <span className="gasbox-check__status">
                      {check.passed ? t("gasboxCheckPassed") : t("gasboxCheckNeedsAction")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {unavailableItems.length > 0 && (
              <p className="gasbox-inventory-note">
                {t("gasboxUnavailableInventory", { count: unavailableItems.length })}
              </p>
            )}

            {selectedMachine.items && selectedMachine.items.length > 0 && (
              <details className="gasbox-rarity-distribution">
                <summary className="gasbox-rarity-title">{t("rarityDistribution")}</summary>
                <div className="gasbox-rarity-bars">
                  {selectedMachine.items
                    .filter((item: MachineItem) => item.available)
                    .map((item: MachineItem, idx: number) => (
                      <div key={idx} className="gasbox-rarity-bar-row">
                        <span className={`gasbox-rarity-bar-label ${rarityClass(item.rarity)}`}>
                          <RarityMark rarity={item.rarity} className="gasbox-rarity-bar-gem" />
                          <span className="gasbox-rarity-bar-name">{item.name || item.rarity}</span>
                        </span>
                        <div className="gasbox-rarity-bar-track">
                          <div
                            className={`gasbox-rarity-bar-fill ${rarityClass(item.rarity)}`}
                            style={{ width: `${Math.min(item.displayProbability, 100)}%` }}
                          />
                        </div>
                        <span className="gasbox-rarity-bar-pct">
                          {item.displayProbability}%
                        </span>
                      </div>
                    ))}
                </div>
              </details>
            )}
          </div>
        </NeoCard>
      )}

      {!selectedMachine && machines.length > 0 && (
        <NeoCard variant="erobo" className="gasbox-select-prompt">
          <div className="gasbox-prompt-content">
            <span className="gasbox-prompt-icon" aria-hidden="true"><GachaMark /></span>
            <p className="gasbox-prompt-text">
              {t("selectMachinePrompt")}
            </p>
          </div>
        </NeoCard>
      )}

      {showResult && pullResult && (
        <div className="gasbox-result-overlay" onClick={dismissResult} role="dialog" aria-modal="true">
          {/* Win celebration — confetti is purely decorative and only mounts on
              the settled-result edge (showResult && pullResult), so it fires
              exactly once per reveal and never on idle. */}
          <div className="gasbox-confetti" aria-hidden="true">
            {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} className={`gasbox-confetti__bit gasbox-confetti__bit--${i % 7}`} />
            ))}
          </div>
          <div className={`gasbox-result-content ${rarityClass(pullResult.rarity)}`} onClick={(e) => e.stopPropagation()}>
            <span className="gasbox-result-burst" aria-hidden="true">
              <RarityMark rarity={pullResult.rarity} className="gasbox-result-gem" />
            </span>
            <span className="gasbox-result-won">{t("congratulations")}</span>
            <span className={`gasbox-result-rarity ${rarityClass(pullResult.rarity)}`}>
              {pullResult.rarity}
            </span>
            <h2 className="gasbox-result-item">
              {pullResult.name || pullResult.item}
            </h2>
            {pullResult.description && (
              <p className="gasbox-result-desc">{pullResult.description}</p>
            )}
            {pullResult.amountDisplay && (
              <span className="gasbox-result-amount">{pullResult.amountDisplay}</span>
            )}
            <p className="gasbox-result-note">{t("gasboxOnChainPrizeNote")}</p>
            <NeoButton variant="primary" size="md" block onClick={dismissResult}>
              {t("dismiss")}
            </NeoButton>
          </div>
        </div>
      )}
    </div>
  );
}
