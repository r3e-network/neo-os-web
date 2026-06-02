/**
 * PlayArea.tsx -- GasBox
 *
 * Interactive market console for machines, on-chain prize escrow, and pulls.
 */

import { useState } from "react";
import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
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

const formatCount = (value: number, pendingLabel: string) =>
  value > 0 ? value.toLocaleString() : pendingLabel;

const formatPercent = (value: number, pendingLabel: string) => {
  if (!Number.isFinite(value) || value <= 0) return pendingLabel;
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}%`;
};

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const isPulling = bool("isPulling");
  const isCreating = bool("isCreating");
  const isPlayingDisplay = bool("isPlayingDisplay");
  const machineCount = num("machineCount");
  const userPulls = num("userPulls");
  const totalPulls = num("totalPulls");
  const selectedMachineName = str("selectedMachineName", "");
  const machines = val<Machine[]>("machines") ?? [];
  const selectedMachine = val<Machine>("selectedMachine");
  const pullResult = val<PullResult>("pullResult");

  const [showResult, setShowResult] = useState(false);
  const [leverPulled, setLeverPulled] = useState(false);

  const selectedMachineReady = Boolean(selectedMachine?.active && selectedMachine?.inventoryReady);
  const machineCountDisplay = machineCount > 0 ? machineCount.toLocaleString() : t("gasboxPending");
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
  const prizeFocusOdds = rarestAvailableItem
    ? formatPercent(rarestAvailableItem.displayProbability, t("gasboxPending"))
    : t("gasboxPending");
  const inventoryRatio = selectedMachine
    ? `${availableItems.length}/${Math.max(selectedItems.length, selectedMachine.itemCount)}`
    : t("gasboxPending");
  const pullReadinessTitle = selectedMachineReady
    ? t("gasboxPullReadyTitle")
    : t("gasboxPullBlockedTitle");
  const pullReadinessCopy = selectedMachineReady
    ? t("gasboxPullReadyCopy")
    : selectedMachine?.active === false
      ? t("gasboxPullBlockedInactive")
      : t("gasboxPullBlockedInventory");
  const handleSelectMachine = async (id: string) => {
    await dispatch("selectMachine", id);
  };

  const handlePull = async () => {
    const machineId = selectedMachine?.id;
    if (!machineId) return;
    setLeverPulled(true);
    await dispatch("pull", machineId);
    setShowResult(true);
    setTimeout(() => setLeverPulled(false), 600);
  };

  const dismissResult = () => {
    setShowResult(false);
  };

  const rarityClass = (rarity: string | undefined) => {
    switch (rarity?.toLowerCase()) {
      case "legendary": return "gasbox-rarity--legendary";
      case "epic": return "gasbox-rarity--epic";
      case "rare": return "gasbox-rarity--rare";
      case "uncommon": return "gasbox-rarity--uncommon";
      default: return "gasbox-rarity--common";
    }
  };

  const rarityIcon = (rarity: string | undefined) => {
    switch (rarity?.toLowerCase()) {
      case "legendary": return "L";
      case "epic": return "E";
      case "rare": return "R";
      case "uncommon": return "U";
      default: return "C";
    }
  };

  const machineIcon = (machine?: Machine | null) => {
    if (!machine) return "G";
    if (machine.topPrize) return "P";
    if (machine.inventoryReady) return "G";
    return "N";
  };

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
        <div className="gasbox-hero__badge" aria-hidden="true">G</div>
        <div className="gasbox-hero__copy">
          <span className="gasbox-eyebrow">{t("docSubtitle")}</span>
          <h2>{t("title")}</h2>
          <p>{t("docDescription")}</p>
        </div>
      </section>

      <section className="gasbox-signal-card" aria-label={t("gasboxLiveStatus")}>
        <div className="gasbox-token" aria-hidden="true">G</div>
        <div className="gasbox-signal-card__copy">
          <span>{t("gasboxLiveStatus")}</span>
          <strong>{signalLabel}</strong>
          <p>{t("gasboxEscrowSafetyDesc")}</p>
        </div>
        <div className="gasbox-signal-card__metrics" aria-hidden="false">
          <div className="gasbox-metric">
            <span>{t("machines")}</span>
            <strong>{machineCountDisplay}</strong>
          </div>
          <div className="gasbox-metric">
            <span>{t("yourPulls")}</span>
            <strong>{userPullsDisplay}</strong>
          </div>
          <div className="gasbox-metric">
            <span>{t("totalPulls")}</span>
            <strong>{totalPullsDisplay}</strong>
          </div>
        </div>
      </section>

      <section className="gasbox-machines-card">
        <div className="gasbox-section-header">
          <span>{t("market")}</span>
          <strong>{t("selectMachine")}</strong>
        </div>
        {machines.length === 0 ? (
          <div className="gasbox-market-empty">
            <div className="gasbox-market-empty__copy">
              <span>{t("gasboxMarketEmptyTitle")}</span>
              <strong>{t("gasboxMarketEmptyDesc")}</strong>
              <p>{t("gasboxMarketEmptyHint")}</p>
            </div>
            <div className="gasbox-empty-actions">
              <div className="gasbox-empty-button-row">
                <NeoButton variant="primary" size="md" onClick={() => dispatch("refreshMachines")}>
                  {t("refreshMachines")}
                </NeoButton>
                <NeoButton variant="secondary" size="md" onClick={() => dispatch("openStudio")}>
                  {t("openStudio")}
                </NeoButton>
              </div>
              <div className="gasbox-studio-note">
                <span>{t("studioTitle")}</span>
                <strong>{t("gasboxStudioHint")}</strong>
              </div>
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
                  <div className="gasbox-machine-icon">{machineIcon(machine)}</div>
                  <div className="gasbox-machine-info">
                    <span className="gasbox-machine-name">{machine.name}</span>
                    {machine.description && (
                      <span className="gasbox-machine-desc">{machine.description}</span>
                    )}
                    <span className="gasbox-machine-cost">{machine.price} GAS</span>
                    <div className="gasbox-machine-meta">
                      <span>{machine.itemCount} {t("items")}</span>
                      <span>{machine.plays} {t("plays")}</span>
                    </div>
                  </div>
                </NeoCard>
              );
            })}
          </div>
        )}
      </section>

      {selectedMachine && (
        <NeoCard variant="erobo" className="gasbox-pull-card">
          <div className="gasbox-selected-display">
            <div className="gasbox-selected-header">
              <div className="gasbox-selected-icon">{machineIcon(selectedMachine)}</div>
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

            <div className="gasbox-decision-panel" aria-label={t("gasboxDecisionTitle")}>
              <div className="gasbox-decision-header">
                <div>
                  <span>{t("gasboxDecisionTitle")}</span>
                  <strong>{t("gasboxDecisionSubtitle")}</strong>
                </div>
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

              <div className="gasbox-decision-grid">
                <div className={`gasbox-decision-tile${selectedMachineReady ? " is-ready" : " is-blocked"}`}>
                  <span>{t("gasboxReadinessTitle")}</span>
                  <strong>{pullReadinessTitle}</strong>
                  <p>{pullReadinessCopy}</p>
                </div>
                <div className="gasbox-decision-tile">
                  <span>{t("pullCost")}</span>
                  <strong>{selectedMachine.price} GAS</strong>
                  <p>{t("gasboxWalletIntent")}</p>
                </div>
                <div className={`gasbox-decision-tile${selectedMachine.inventoryReady ? " is-ready" : " is-blocked"}`}>
                  <span>{t("inventoryAndOdds")}</span>
                  <strong>{inventoryRatio} {t("items")}</strong>
                  <p>
                    {selectedMachine.inventoryReady
                      ? t("gasboxInventoryReady")
                      : t("gasboxInventoryActionRequired")}
                  </p>
                </div>
                <div className={`gasbox-decision-tile${availableItems.length > 0 ? " is-ready" : " is-blocked"}`}>
                  <span>{t("gasboxPrizeFocus")}</span>
                  <strong>{prizeFocusLabel}</strong>
                  <p>
                    {t("gasboxPrizeFocusOdds")}: {prizeFocusOdds} | {t("gasboxOddsCoverage")}: {formatPercent(oddsCoverage, t("gasboxPending"))}
                  </p>
                </div>
              </div>

              {unavailableItems.length > 0 && (
                <p className="gasbox-inventory-note">
                  {t("gasboxUnavailableInventory", { count: unavailableItems.length })}
                </p>
              )}
            </div>

            <div className={`gasbox-lever-container${leverPulled ? " gasbox-lever--pulled" : ""}${isPulling ? " gasbox-lever--spinning" : ""}`}>
              <NeoButton
                variant="primary"
                size="lg"
                block
                loading={isPulling}
                disabled={isPulling || !selectedMachineReady}
                className="gasbox-pull-btn"
                onClick={handlePull}
              >
                <div className="gasbox-pull-btn-content">
                  <span className="gasbox-pull-btn-text">
                    {isPulling ? t("pulling") : t("pull")}
                  </span>
                  <span className="gasbox-pull-btn-cost">
                    {selectedMachine.price} GAS
                  </span>
                </div>
              </NeoButton>
            </div>

            {selectedMachine.items && selectedMachine.items.length > 0 && (
              <details className="gasbox-rarity-distribution">
                <summary className="gasbox-rarity-title">{t("rarityDistribution")}</summary>
                <div className="gasbox-rarity-bars">
                  {selectedMachine.items
                    .filter((item: MachineItem) => item.available)
                    .map((item: MachineItem, idx: number) => (
                      <div key={idx} className="gasbox-rarity-bar-row">
                        <span className={`gasbox-rarity-bar-label ${rarityClass(item.rarity)}`}>
                          {rarityIcon(item.rarity)} {item.name || item.rarity}
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
            <span className="gasbox-prompt-icon" aria-hidden="true">G</span>
            <p className="gasbox-prompt-text">
              {t("selectMachinePrompt")}
            </p>
          </div>
        </NeoCard>
      )}

      <NeoCard variant="erobo" className="gasbox-safety-card">
        <div className="gasbox-safety-copy">
          <span>{t("gasboxEscrowSafetyTitle")}</span>
          <strong>{t("feature2Name")}</strong>
          <p>{t("gasboxEscrowSafetyDesc")}</p>
        </div>
        <div className="gasbox-safety-stats">
          <div>
            <span>{t("inventoryAndOdds")}</span>
            <strong>{machines.length > 0 ? t("statusActive") : t("gasboxPending")}</strong>
          </div>
          <div>
            <span>{t("gasboxPlayerRoute")}</span>
            <strong>{selectedMachineReady ? t("readyToPlay") : t("gasboxPending")}</strong>
          </div>
        </div>
      </NeoCard>

      {(showResult || isPlayingDisplay) && pullResult && (
        <div className="gasbox-result-overlay" onClick={dismissResult} role="dialog" aria-modal="true">
          <div className="gasbox-result-content" onClick={(e) => e.stopPropagation()}>
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
            <NeoButton variant="secondary" size="md" onClick={dismissResult}>
              {t("dismiss")}
            </NeoButton>
          </div>
        </div>
      )}
    </div>
  );
}
