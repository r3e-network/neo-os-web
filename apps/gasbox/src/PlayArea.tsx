/**
 * PlayArea.tsx -- Gasbox
 *
 * Fully interactive PlayArea consuming ALL available state:
 *   machines, selectedMachine, isLoading, isPulling, isCreating,
 *   pullResult, userPulls, totalPulls, machineCount,
 *   isPlayingDisplay, selectedMachineName
 *
 * Actions: pull(machineId), createMachine(formData), selectMachine(id)
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

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  // -- All state bindings --
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

  // -- Local UI state --
  const [showResult, setShowResult] = useState(false);
  const [leverPulled, setLeverPulled] = useState(false);

  // -- Handlers --
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
      case "legendary": return "***";
      case "epic": return "**";
      case "rare": return "*";
      case "uncommon": return "+";
      default: return "-";
    }
  };

  const machineIcon = (_machine: Machine) => {
    return "";
  };

  // -- Loading state --
  if (isLoading) {
    return (
      <div className="gasbox-play-area">
        <div className="gasbox-loading">
          <div className="gasbox-loading-spinner" />
          <span>{t("loading") || "Loading machines..."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="gasbox-play-area">
      {/* ── 1. Stats Bar ── */}
      <div className="gasbox-hero-stats">
        <div className="gasbox-hero-stat">
          <span className="gasbox-hero-stat-value">{machineCount}</span>
          <span className="gasbox-hero-stat-label">{t("totalMachines") || "Machines"}</span>
        </div>
        <div className="gasbox-hero-stat">
          <span className="gasbox-hero-stat-value">{userPulls}</span>
          <span className="gasbox-hero-stat-label">{t("yourPulls") || "Your Pulls"}</span>
        </div>
        <div className="gasbox-hero-stat">
          <span className="gasbox-hero-stat-value">{totalPulls}</span>
          <span className="gasbox-hero-stat-label">{t("totalPulls") || "Total Pulls"}</span>
        </div>
      </div>

      {/* ── 2. Machine Selector Grid ── */}
      <NeoCard variant="erobo" className="gasbox-machines-card">
        <h3 className="gasbox-section-title">{t("selectMachine") || "Select a Machine"}</h3>
        {machines.length === 0 ? (
          <div className="gasbox-empty">{t("noMachines") || "No machines available"}</div>
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
                      <span className="gasbox-machine-items-count">
                        {machine.itemCount} {t("items") || "items"}
                      </span>
                      <span className="gasbox-machine-plays-count">
                        {machine.plays} {t("plays") || "plays"}
                      </span>
                    </div>
                  </div>
                </NeoCard>
              );
            })}
          </div>
        )}
      </NeoCard>

      {/* ── 3. Selected Machine Detail + Pull Button ── */}
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

            {/* Machine detail stats */}
            <div className="gasbox-machine-detail-stats">
              <div className="gasbox-detail-stat">
                <span className="gasbox-detail-stat-value">{selectedMachine.price}</span>
                <span className="gasbox-detail-stat-label">{t("pullCost") || "Pull Cost"} (GAS)</span>
              </div>
              <div className="gasbox-detail-stat">
                <span className="gasbox-detail-stat-value">{selectedMachine.itemCount}</span>
                <span className="gasbox-detail-stat-label">{t("totalItems") || "Items"}</span>
              </div>
              <div className="gasbox-detail-stat">
                <span className="gasbox-detail-stat-value">{selectedMachine.plays}</span>
                <span className="gasbox-detail-stat-label">{t("totalPlays") || "Plays"}</span>
              </div>
              <div className="gasbox-detail-stat">
                <span className="gasbox-detail-stat-value">{selectedMachine.revenue}</span>
                <span className="gasbox-detail-stat-label">{t("revenue") || "Revenue"} (GAS)</span>
              </div>
            </div>

            {/* Top prize callout */}
            {selectedMachine.topPrize && (
              <div className="gasbox-top-prize">
                <span className="gasbox-top-prize-label">{t("topPrize") || "Top Prize"}</span>
                <span className="gasbox-top-prize-name">{selectedMachine.topPrize}</span>
              </div>
            )}

            {/* Rarity distribution */}
            {selectedMachine.items && selectedMachine.items.length > 0 && (
              <div className="gasbox-rarity-distribution">
                <h4 className="gasbox-rarity-title">{t("rarityDistribution") || "Drop Rates"}</h4>
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
              </div>
            )}

            {/* Status indicators */}
            <div className="gasbox-machine-status-row">
              {!selectedMachine.active && (
                <span className="gasbox-status-badge gasbox-status-badge--inactive">
                  {t("inactive") || "Inactive"}
                </span>
              )}
              {!selectedMachine.inventoryReady && (
                <span className="gasbox-status-badge gasbox-status-badge--empty">
                  {t("emptyInventory") || "Empty Inventory"}
                </span>
              )}
              {selectedMachine.active && selectedMachine.inventoryReady && (
                <span className="gasbox-status-badge gasbox-status-badge--ready">
                  {t("readyToPlay") || "Ready"}
                </span>
              )}
            </div>

            {/* PULL LEVER / BUTTON */}
            <div className={`gasbox-lever-container${leverPulled ? " gasbox-lever--pulled" : ""}${isPulling ? " gasbox-lever--spinning" : ""}`}>
              <NeoButton
                variant="primary"
                size="lg"
                block
                loading={isPulling}
                disabled={isPulling || !selectedMachine.active || !selectedMachine.inventoryReady}
                className="gasbox-pull-btn"
                onClick={handlePull}
              >
                <div className="gasbox-pull-btn-content">
                  <span className="gasbox-pull-btn-icon" aria-hidden="true">
                    {isPulling ? "..." : ">>"}
                  </span>
                  <span className="gasbox-pull-btn-text">
                    {isPulling
                      ? (t("pulling") || "PULLING...")
                      : (t("pull") || "PULL")}
                  </span>
                  <span className="gasbox-pull-btn-cost">
                    {selectedMachine.price} GAS
                  </span>
                </div>
              </NeoButton>
            </div>
          </div>
        </NeoCard>
      )}

      {/* ── 4. No Machine Selected Prompt ── */}
      {!selectedMachine && machines.length > 0 && (
        <NeoCard variant="erobo" className="gasbox-select-prompt">
          <div className="gasbox-prompt-content">
            <span className="gasbox-prompt-icon" aria-hidden="true">&uarr;</span>
            <p className="gasbox-prompt-text">
              {t("selectMachinePrompt") || "Select a machine above to start pulling!"}
            </p>
          </div>
        </NeoCard>
      )}

      {/* ── 5. Pull Result Overlay ── */}
      {(showResult || isPlayingDisplay) && pullResult && (
        <div className="gasbox-result-overlay" onClick={dismissResult} role="dialog" aria-modal="true">
          <div className="gasbox-result-content" onClick={(e) => e.stopPropagation()}>
            <div className={`gasbox-result-glow ${rarityClass(pullResult.rarity)}`} />
            <span className="gasbox-result-sparkle" aria-hidden="true">
              {rarityIcon(pullResult.rarity)}
            </span>
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
              {t("dismiss") || "Dismiss"}
            </NeoButton>
          </div>
        </div>
      )}
    </div>
  );
}
