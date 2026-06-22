/**
 * PlayArea.tsx -- GasBox
 *
 * Interactive market console for machines, on-chain prize escrow, and pulls.
 */

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Coins,
  Gem,
  Gift,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  type LucideIcon,
} from "lucide-react";
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
const PRIZE_ASSET_META: Record<PrizeAsset, { icon: LucideIcon; hintKey: string }> = {
  GAS: { icon: Coins, hintKey: "prizeAssetGasHint" },
  NEO: { icon: Gem, hintKey: "prizeAssetNeoHint" },
};

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
 * Gachapon / blind-box mark from the shared icon library. Replaces bare
 * letter avatars without introducing handcrafted SVG art.
 */
function GachaMark({ className }: { className?: string }) {
  return <Bot className={className} aria-hidden="true" strokeWidth={1.8} />;
}

/**
 * Prize mark from the shared icon library, used for machines that already
 * advertise a top prize.
 */
function PrizeMark({ className }: { className?: string }) {
  return <Gift className={className} aria-hidden="true" strokeWidth={1.8} />;
}

/**
 * Small rarity gem/star badge. Legendary reads as a star; the lower tiers read
 * as a gem. The tier colour class is applied directly to the icon so it stays
 * robust against host wrappers that force `li/span { color: inherit }`.
 */
function RarityMark({ rarity, className }: { rarity?: string; className?: string }) {
  const tier = rarity?.toLowerCase();
  const cls = `${rarityClassName(rarity)}${className ? ` ${className}` : ""}`;
  const Icon = tier === "legendary" ? Star : Gem;
  if (tier === "legendary") {
    return (
      <Icon
        className={cls}
        width="14"
        height="14"
        fill="currentColor"
        aria-hidden="true"
        strokeWidth={1.8}
      />
    );
  }
  return (
    <Icon
      className={cls}
      width="14"
      height="14"
      aria-hidden="true"
      strokeWidth={2}
    />
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
  const [pullPreview, setPullPreview] = useState(false);
  const pullPreviewTimeout = useRef<number | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("");

  const [machineName, setMachineName] = useState("");
  const [machinePrice, setMachinePrice] = useState("");
  const [prizeAsset, setPrizeAsset] = useState<PrizeAsset>("GAS");
  const [studioItems, setStudioItems] = useState<StudioItem[]>([
    { name: "", weight: "50", amount: "0.1" },
  ]);
  const [studioError, setStudioError] = useState<string | null>(null);

  const selectedMachineReady = Boolean(selectedMachine?.active && selectedMachine?.inventoryReady);
  const pullAnimating =
    isPulling ||
    leverPulled ||
    pullPreview ||
    betPhase === "committing" ||
    betPhase === "settling";
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
  const prizeFocusOddsLabel = rarestAvailableItem
    ? formatPercent(rarestAvailableItem.displayProbability, t("gasboxPending"))
    : t("gasboxPending");
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
  const reelItems =
    (availableItems.length > 0 ? availableItems : selectedItems).slice(0, 6);
  const reelTrackItems =
    reelItems.length > 0 ? [...reelItems, ...reelItems, ...reelItems] : [];
  const pullChecklist = [
    { label: t("gasboxChecklistActive"), passed: Boolean(selectedMachine?.active) },
    { label: t("gasboxChecklistInventory"), passed: Boolean(selectedMachine?.inventoryReady) },
    { label: t("gasboxChecklistOdds"), passed: oddsReadable },
  ];
  const handleSelectMachine = async (id: string) => {
    await dispatch("selectMachine", id);
  };

  useEffect(
    () => () => {
      if (pullPreviewTimeout.current !== null) {
        window.clearTimeout(pullPreviewTimeout.current);
      }
    },
    [],
  );

  const startPullPreview = () => {
    if (pullPreviewTimeout.current !== null) {
      window.clearTimeout(pullPreviewTimeout.current);
    }
    setPullPreview(true);
    pullPreviewTimeout.current = window.setTimeout(() => {
      setPullPreview(false);
      pullPreviewTimeout.current = null;
    }, 1400);
  };

  const handlePull = async () => {
    const machineId = selectedMachine?.id;
    if (!machineId) return;
    startPullPreview();
    setLeverPulled(true);
    // Two-step: commit → wait one block → settle. The dispatch resolves after
    // the whole flow; the result overlay is gated on the settled result, so a
    // committed-but-unrevealed bet shows the pending panel + Reveal button below
    // instead of a (non-existent) result.
    try {
      await dispatch("pull", machineId);
      setShowResult(true);
    } finally {
      setTimeout(() => setLeverPulled(false), 600);
    }
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
  const studioMachineLabel = machineName.trim() || t("studioPreviewMachineName");
  const studioPriceLabel = machinePrice.trim()
    ? `${machinePrice.trim()} GAS`
    : t("studioPreviewPriceUnset");

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
        <div className="gasbox-hero__copy">
          <span className="gasbox-eyebrow">{t("docSubtitle")}</span>
          <h2>{t("gasboxHeroTitle")}</h2>
          <p className="gasbox-hero__status">
            <span className="gasbox-hero__dot" aria-hidden="true" />
            {signalLabel}
          </p>
          <p>{t("gasboxHeroCopy")}</p>
          <div className="gasbox-hero__pills" aria-label={t("gasboxHeroProofs")}>
            <span>
              <ShieldCheck aria-hidden="true" />
              {t("gasboxHeroEscrow")}
            </span>
            <span>
              <Sparkles aria-hidden="true" />
              {t("gasboxHeroReveal")}
            </span>
            <span>
              <Trophy aria-hidden="true" />
              {t("gasboxHeroPrize")}
            </span>
          </div>
        </div>
        <picture className="gasbox-hero__art" aria-hidden="true">
          <source srcSet="banner.avif" type="image/avif" />
          <source srcSet="banner.webp" type="image/webp" />
          <img src="banner.jpg" alt="" loading="eager" decoding="async" />
        </picture>
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
            <Sparkles aria-hidden="true" />
            {studioOpen ? t("studioCloseAction") : t("createMachineAction")}
          </NeoButton>
        </div>
        {machines.length === 0 ? (
          <div className="gasbox-market-empty">
            <div className="gasbox-empty-stage" aria-hidden="true">
              <picture className="gasbox-empty-stage__machine">
                <source srcSet="logo.avif" type="image/avif" />
                <source srcSet="logo.webp" type="image/webp" />
                <img src="logo.jpg" alt="" loading="lazy" decoding="async" />
              </picture>
              <span className="gasbox-empty-stage__lock">
                <LockKeyhole aria-hidden="true" />
              </span>
              <div className="gasbox-empty-stage__caption">
                <span>{t("gasboxEmptyStageLabel")}</span>
                <strong>{t("gasboxEmptyStageHint")}</strong>
              </div>
              <ul className="gasbox-empty-stage__odds">
                {(["legendary", "epic", "rare", "common"] as const).map((tier) => (
                  <li key={tier} className={`gasbox-empty-stage__tier ${rarityClass(tier)}`}>
                    <RarityMark rarity={tier} className="gasbox-empty-stage__gem" />
                    <span>{t(`rarity${tier.charAt(0).toUpperCase()}${tier.slice(1)}`)}</span>
                    <strong>?</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div className="gasbox-market-empty__content">
              <div className="gasbox-market-empty__copy">
                <span>{t("gasboxMarketEmptyTitle")}</span>
                <strong>{t("gasboxMarketEmptyTeaser")}</strong>
              </div>
              <ol className="gasbox-empty-route" aria-label={t("gasboxPlayerRoute")}>
                <li>{t("gasboxEmptyRouteRefresh")}</li>
                <li>{t("gasboxEmptyRoutePick")}</li>
                <li>{t("gasboxEmptyRouteReveal")}</li>
              </ol>
              <div className="gasbox-empty-button-row">
                <NeoButton variant="primary" size="md" onClick={() => dispatch("refreshMachines")}>
                  <RefreshCw aria-hidden="true" />
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
                  <div className="gasbox-machine-window">
                    <div className="gasbox-machine-icon" aria-hidden="true">{machineMark(machine)}</div>
                    <span className={`gasbox-machine-state${machine.active && machine.inventoryReady ? " is-live" : ""}`}>
                      {machine.active && machine.inventoryReady
                        ? t("gasboxMachineLive")
                        : t("gasboxMachineNeedsFunding")}
                    </span>
                  </div>
                  <div className="gasbox-machine-info">
                    <span className="gasbox-machine-name">{machine.name}</span>
                    {machine.description && (
                      <span className="gasbox-machine-desc">{machine.description}</span>
                    )}
                    <div className="gasbox-machine-meta">
                      <span>{machine.itemCount} {t("items")}</span>
                      <span>{machine.topPrize || t("gasboxNoAvailablePrize")}</span>
                    </div>
                    <div className="gasbox-machine-foot">
                      <span className="gasbox-machine-cost">{machine.price} GAS</span>
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

          <div className="gasbox-studio-summary" aria-label={t("gasboxStudioSummary")}>
            <span>
              <Gift aria-hidden="true" />
              {t("gasboxStudioPrizeCount", { count: studioItems.length })}
            </span>
            <span>
              <Coins aria-hidden="true" />
              {t("totalWeightLabel")}: {studioTotalWeight}
            </span>
            <span>
              <ShieldCheck aria-hidden="true" />
              {t("gasboxStudioSafety")}
            </span>
          </div>

          <div className="gasbox-studio-blueprint" aria-label={t("studioBlueprintLabel")}>
            <figure className="gasbox-studio-machine-preview">
              <picture aria-hidden="true">
                <source srcSet="logo.avif" type="image/avif" />
                <source srcSet="logo.webp" type="image/webp" />
                <img src="logo.jpg" alt="" loading="lazy" decoding="async" />
              </picture>
              <figcaption>
                <span>{t("studioBlueprintLabel")}</span>
                <strong>{studioMachineLabel}</strong>
                <small>{studioPriceLabel}</small>
              </figcaption>
            </figure>
            <div className="gasbox-studio-blueprint__console">
              <p>{t("studioPreviewHint")}</p>
              <div className="gasbox-studio-blueprint__stats">
                <span>
                  <Gem aria-hidden="true" />
                  <small>{t("studioBlueprintAsset")}</small>
                  <strong>{prizeAsset}</strong>
                </span>
                <span>
                  <Gift aria-hidden="true" />
                  <small>{t("studioBlueprintPrizes")}</small>
                  <strong>{studioItems.length}</strong>
                </span>
                <span>
                  <Coins aria-hidden="true" />
                  <small>{t("studioBlueprintWeight")}</small>
                  <strong>{studioTotalWeight}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="gasbox-studio-cabinet">
            <div className="gasbox-cabinet-card gasbox-cabinet-card--identity">
              <div className="gasbox-cabinet-card__head">
                <span aria-hidden="true">
                  <GachaMark />
                </span>
                <div>
                  <small>{t("studioBlueprintLabel")}</small>
                  <strong>{studioMachineLabel}</strong>
                </div>
              </div>
              <div className="gasbox-cabinet-controls">
                <label className="gasbox-field gasbox-field--plaque">
                  <span>{t("machineNameLabel")}</span>
                  <input
                    type="text"
                    value={machineName}
                    placeholder={t("machineNamePlaceholder")}
                    onChange={(e) => setMachineName(e.target.value)}
                  />
                </label>
                <label className="gasbox-field gasbox-field--price">
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
              </div>
            </div>

            <div className="gasbox-cabinet-card gasbox-cabinet-card--asset">
              <div className="gasbox-cabinet-card__head">
                <span aria-hidden="true">
                  <Gem />
                </span>
                <div>
                  <small>{t("prizeAssetLabel")}</small>
                  <strong>{prizeAsset}</strong>
                </div>
              </div>
              <div
                className="gasbox-asset-choice-list"
                role="radiogroup"
                aria-label={t("prizeAssetLabel")}
              >
                {PRIZE_ASSET_OPTIONS.map((asset) => (
                  <button
                    key={asset}
                    type="button"
                    className={`gasbox-asset-choice${prizeAsset === asset ? " is-selected" : ""}`}
                    role="radio"
                    aria-checked={prizeAsset === asset}
                    onClick={() => setPrizeAsset(asset)}
                  >
                    <span className="gasbox-asset-choice__icon" aria-hidden="true">
                      {(() => {
                        const Icon = PRIZE_ASSET_META[asset].icon;
                        return <Icon />;
                      })()}
                    </span>
                    <span className="gasbox-asset-choice__copy">
                      <strong>{asset}</strong>
                      <span>{t(PRIZE_ASSET_META[asset].hintKey)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
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
                <div className="gasbox-studio-item__header">
                  <span
                    className={`gasbox-studio-item__capsule ${rarityClass(derivedRarity)}`}
                    aria-hidden="true"
                  >
                    <RarityMark rarity={derivedRarity} />
                  </span>
                  <span className="gasbox-studio-item__title">
                    <small>{t("studioCapsuleLabel", { index: index + 1 })}</small>
                    <strong>
                      {item.name.trim() || t("studioCapsuleFallback")}
                    </strong>
                  </span>
                  <span className="gasbox-derived-tier gasbox-studio-item__tier">
                    <small>{t("derivedTierLabel")}</small>
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
                  </span>
                </div>
                <div className="gasbox-capsule-editor">
                  <label className="gasbox-field gasbox-capsule-name-field">
                    <span>{t("itemNamePlaceholder")}</span>
                    <input
                      type="text"
                      value={item.name}
                      placeholder={t("itemNamePlaceholder")}
                      onChange={(e) => updateStudioItem(index, { name: e.target.value })}
                    />
                  </label>
                  <div className="gasbox-capsule-dials">
                    <label className="gasbox-field gasbox-capsule-dial">
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
                    <label className="gasbox-field gasbox-capsule-dial">
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
                  </div>
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
              <Gift aria-hidden="true" />
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
            <div className="gasbox-pull-stage">
              <figure className={`gasbox-stage-art${pullAnimating ? " gasbox-stage-art--pulling" : ""}`}>
                <picture aria-hidden="true">
                  <source srcSet="logo.avif" type="image/avif" />
                  <source srcSet="logo.webp" type="image/webp" />
                  <img src="logo.jpg" alt="" loading="lazy" decoding="async" />
                </picture>
                <div
                  className={`gasbox-stage-art__slot${pullAnimating ? " is-active" : ""}${selectedMachineReady ? " is-ready" : " is-locked"}`}
                  aria-hidden="true"
                >
                  <span className="gasbox-stage-art__slot-light" />
                  <span className="gasbox-stage-art__slot-capsule">
                    <Ticket />
                  </span>
                </div>
                {pullAnimating && (
                  <div className="gasbox-stage-art__capsules" aria-hidden="true">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <picture
                        key={index}
                        className={`gasbox-stage-art__capsule gasbox-stage-art__capsule--${index + 1}`}
                      >
                        <source srcSet="logo.avif" type="image/avif" />
                        <source srcSet="logo.webp" type="image/webp" />
                        <img src="logo.jpg" alt="" loading="lazy" decoding="async" />
                      </picture>
                    ))}
                  </div>
                )}
                <figcaption>
                  <span>{t("gasboxPrizeFocus")}</span>
                  <strong>{prizeFocusLabel}</strong>
                  <small>{t("gasboxPrizeFocusOdds")}: {prizeFocusOddsLabel}</small>
                </figcaption>
              </figure>

              <div className="gasbox-play-console">
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

                <div className="gasbox-pull-intent" aria-label={t("gasboxPullIntent")}>
                  <span>
                    <Coins aria-hidden="true" />
                    {selectedMachine.price} GAS
                  </span>
                  <span>
                    <ShieldCheck aria-hidden="true" />
                    {t("gasboxIntentEscrow")}
                  </span>
                  <span>
                    <Sparkles aria-hidden="true" />
                    {t("gasboxIntentReveal")}
                  </span>
                </div>

                <div
                  className={`gasbox-prize-reel${pullAnimating ? " gasbox-prize-reel--active" : ""}${selectedMachineReady ? " gasbox-prize-reel--ready" : " gasbox-prize-reel--locked"}`}
                  aria-label={t("gasboxReelTitle")}
                  aria-live={pullAnimating ? "polite" : "off"}
                >
                  <div className="gasbox-reel-head">
                    <span>
                      <Sparkles aria-hidden="true" />
                      {t("gasboxReelTitle")}
                    </span>
                    <strong>{pullAnimating ? pendingPhaseLabel : t("gasboxReelHint")}</strong>
                  </div>
                  <div className="gasbox-reel-window">
                    <div className="gasbox-reel-marker" aria-hidden="true">
                      <Ticket />
                    </div>
                    {reelTrackItems.length > 0 ? (
                      <div className="gasbox-reel-strip">
                        {reelTrackItems.map((item, index) => (
                          <span
                            key={`${item.name || item.rarity}-${index}`}
                            className={`gasbox-reel-card ${rarityClass(item.rarity)}${item.name === prizeFocusLabel ? " is-focus" : ""}`}
                          >
                            <RarityMark rarity={item.rarity} className="gasbox-reel-card__gem" />
                            <span className="gasbox-reel-card__copy">
                              <strong>{item.name || item.rarity}</strong>
                              <small>
                                {formatPercent(item.displayProbability, t("gasboxPending"))}
                              </small>
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="gasbox-reel-empty">
                        {t("gasboxReelEmpty")}
                      </div>
                    )}
                  </div>
                </div>

                <div className={`gasbox-lever-container${leverPulled ? " gasbox-lever--pulled" : ""}${isPulling ? " gasbox-lever--spinning" : ""}`}>
                  <div
                    className={`gasbox-control-deck${pullAnimating ? " gasbox-control-deck--active" : ""}${selectedMachineReady ? " gasbox-control-deck--ready" : " gasbox-control-deck--locked"}`}
                  >
                    <div
                      className={`gasbox-cabinet-lever${pullAnimating ? " is-active" : ""}${selectedMachineReady ? " is-ready" : " is-locked"}`}
                      aria-hidden="true"
                    >
                      <span className="gasbox-cabinet-lever__lights">
                        <span />
                        <span />
                        <span />
                      </span>
                      <span className="gasbox-cabinet-lever__slot" />
                      <span className="gasbox-cabinet-lever__handle" />
                    </div>
                    <div className="gasbox-pull-command">
                      <NeoButton
                        variant="primary"
                        size="lg"
                        block
                        loading={isPulling}
                        disabled={isPulling || isAwaitingReveal || !selectedMachineReady}
                        className={`gasbox-pull-btn${pullAnimating ? " gasbox-pull-btn--active" : ""}`}
                        onClick={handlePull}
                      >
                        <div className="gasbox-pull-btn-content">
                          <Ticket aria-hidden="true" />
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
                          <RefreshCw aria-hidden="true" />
                          {t("refreshMachines")}
                        </NeoButton>
                        <NeoButton
                          variant="ghost"
                          size="sm"
                          disabled={isPulling}
                          onClick={() => dispatch("openStudio")}
                        >
                          <Sparkles aria-hidden="true" />
                          {t("openStudio")}
                        </NeoButton>
                      </div>
                    </div>
                  </div>
                </div>
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
            <div className="gasbox-result-theater" aria-hidden="true">
              <picture className="gasbox-result-theater__machine">
                <source srcSet="logo.avif" type="image/avif" />
                <source srcSet="logo.webp" type="image/webp" />
                <img src="logo.jpg" alt="" loading="lazy" decoding="async" />
              </picture>
              <span className="gasbox-result-theater__beam" />
              <span className={`gasbox-result-theater__capsule ${rarityClass(pullResult.rarity)}`}>
                <RarityMark rarity={pullResult.rarity} className="gasbox-result-theater__gem" />
              </span>
            </div>
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
