/**
 * PlayArea.tsx -- Gasbox
 *
 * Full UI: stats, machine selector grid, selected machine with pull button,
 * pull result overlay.
 */

import { useState } from "react";
import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface Machine {
  id: string;
  name: string;
  description?: string;
  cost?: number;
  rarity?: string;
}

interface PullResult {
  item: string;
  rarity: string;
  description?: string;
}

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

  const handleSelectMachine = async (id: string) => {
    await dispatch("selectMachine", id);
  };

  const handlePull = async () => {
    const machineId = selectedMachine?.id;
    if (!machineId) return;
    await dispatch("pull", machineId);
    setShowResult(true);
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

  if (isLoading) {
    return (
      <div className="gasbox-play-area">
        <div className="gasbox-loading">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="gasbox-play-area">
      {/* Stats */}
      <div className="gasbox-hero-stats">
        <div className="gasbox-hero-stat">
          <span className="gasbox-hero-stat-value">{machineCount}</span>
          <span className="gasbox-hero-stat-label">{t("totalMachines")}</span>
        </div>
        <div className="gasbox-hero-stat">
          <span className="gasbox-hero-stat-value">{userPulls}</span>
          <span className="gasbox-hero-stat-label">{t("yourPulls")}</span>
        </div>
        <div className="gasbox-hero-stat">
          <span className="gasbox-hero-stat-value">{totalPulls}</span>
          <span className="gasbox-hero-stat-label">{t("totalPulls")}</span>
        </div>
      </div>

      {/* Machine Selector Grid */}
      <NeoCard variant="erobo" className="gasbox-machines-card">
        <h3 className="gasbox-section-title">{t("selectMachine")}</h3>
        {machines.length === 0 ? (
          <div className="gasbox-empty">{t("noMachines")}</div>
        ) : (
          <div className="gasbox-machine-grid">
            {machines.map((machine) => (
              <NeoCard
                key={machine.id}
                variant="erobo"
                hoverable
                className={`gasbox-machine-item${selectedMachine?.id === machine.id ? " gasbox-machine-item--selected" : ""}`}
                onClick={() => handleSelectMachine(machine.id)}
              >
                <div className="gasbox-machine-info">
                  <span className="gasbox-machine-name">{machine.name}</span>
                  {machine.description && (
                    <span className="gasbox-machine-desc">{machine.description}</span>
                  )}
                  {machine.cost != null && (
                    <span className="gasbox-machine-cost">{machine.cost} GAS</span>
                  )}
                </div>
              </NeoCard>
            ))}
          </div>
        )}
      </NeoCard>

      {/* Selected Machine + Pull Action */}
      {selectedMachine && (
        <NeoCard variant="erobo" className="gasbox-pull-card">
          <div className="gasbox-selected-display">
            <div className="gasbox-selected-info">
              <h3 className="gasbox-selected-name">
                {selectedMachineName || selectedMachine.name}
              </h3>
              {selectedMachine.description && (
                <p className="gasbox-selected-desc">{selectedMachine.description}</p>
              )}
              {selectedMachine.rarity && (
                <span className={`gasbox-rarity-badge ${rarityClass(selectedMachine.rarity)}`}>
                  {selectedMachine.rarity}
                </span>
              )}
            </div>
            <NeoButton
              variant="primary"
              size="lg"
              block
              loading={isPulling}
              disabled={isPulling}
              onClick={handlePull}
            >
              {t("pull")}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* Pull Result Overlay */}
      {(showResult || isPlayingDisplay) && pullResult && (
        <div className="gasbox-result-overlay" onClick={dismissResult} role="dialog" aria-modal="true">
          <div className="gasbox-result-content" onClick={(e) => e.stopPropagation()}>
            <div className={`gasbox-result-glow ${rarityClass(pullResult.rarity)}`} />
            <span className={`gasbox-result-rarity ${rarityClass(pullResult.rarity)}`}>
              {pullResult.rarity}
            </span>
            <h2 className="gasbox-result-item">{pullResult.item}</h2>
            {pullResult.description && (
              <p className="gasbox-result-desc">{pullResult.description}</p>
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
