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

/** Local create-form prize item (string-typed for controlled inputs). */
interface StudioItem {
  name: string;
  probability: string;
  rarity: string;
  assetType: string;
  assetHash: string;
  amount: string;
  tokenId: string;
  stock: string;
}

const RARITY_OPTIONS = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;

const emptyStudioItem = (): StudioItem => ({
  name: "",
  probability: "10",
  rarity: "COMMON",
  assetType: "1",
  assetHash: "",
  amount: "0.1",
  tokenId: "",
  stock: "10",
});

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
  const machineCount = num("machineCount");
  const userPulls = num("userPulls");
  const totalPulls = num("totalPulls");
  const selectedMachineName = str("selectedMachineName", "");
  const machines = val<Machine[]>("machines") ?? [];
  const selectedMachine = val<Machine>("selectedMachine");
  const pullResult = val<PullResult>("pullResult");
  const studioOpen = bool("studioOpen");

  const [showResult, setShowResult] = useState(false);
  const [leverPulled, setLeverPulled] = useState(false);

  const [machineName, setMachineName] = useState("");
  const [machineDescription, setMachineDescription] = useState("");
  const [machineCategory, setMachineCategory] = useState("");
  const [machineTags, setMachineTags] = useState("");
  const [machinePrice, setMachinePrice] = useState("");
  const [studioItems, setStudioItems] = useState<StudioItem[]>([
    { name: "", probability: "50", rarity: "COMMON", assetType: "1", assetHash: "", amount: "0.1", tokenId: "", stock: "10" },
  ]);
  const [studioError, setStudioError] = useState<string | null>(null);

  const selectedMachineReady = Boolean(selectedMachine?.active && selectedMachine?.inventoryReady);
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
  const pullReadinessCopy = selectedMachineReady
    ? t("gasboxPullReadyCopy")
    : selectedMachine?.active === false
      ? t("gasboxPullBlockedInactive")
      : t("gasboxPullBlockedInventory");
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
    await dispatch("pull", machineId);
    setShowResult(true);
    setTimeout(() => setLeverPulled(false), 600);
  };

  const dismissResult = () => {
    setShowResult(false);
    void dispatch("resetResult");
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

  const studioTotalProbability = studioItems.reduce(
    (sum, item) => sum + (Number(item.probability) || 0),
    0,
  );

  const resetStudioForm = () => {
    setMachineName("");
    setMachineDescription("");
    setMachineCategory("");
    setMachineTags("");
    setMachinePrice("");
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
      (item) => item.name.trim().length > 0 && (Number(item.probability) || 0) > 0,
    );
    if (validItems.length === 0) {
      setStudioError(t("createNeedsItem"));
      return;
    }
    setStudioError(null);

    // The publishMachine action is wrapped in notify.guard, which swallows the
    // error and resolves regardless of outcome. Gate the form reset on the
    // action's confirmed-success flag so a failed publish (transient storage /
    // wallet error) keeps the user's input instead of wiping the whole table.
    // dispatch is typed Promise<void> but returns the action payload at runtime.
    const published: unknown = await dispatch("publishMachine", {
      name: machineName.trim(),
      description: machineDescription.trim(),
      category: machineCategory.trim(),
      tags: machineTags.trim(),
      price: machinePrice.trim() || "0",
      items: validItems.map((item) => ({
        name: item.name.trim(),
        probability: Number(item.probability) || 0,
        rarity: item.rarity,
        assetType: item.assetType,
        assetHash: item.assetHash.trim(),
        amount: item.amount.trim() || "0",
        tokenId: item.tokenId.trim(),
        stock: item.stock.trim() || "1",
      })),
    });
    if (published === true) {
      resetStudioForm();
    }
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
        <div className="gasbox-hero__main">
          <div className="gasbox-hero__badge" aria-hidden="true">G</div>
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
          <div className="gasbox-metric">
            <span>{t("totalPulls")}</span>
            <strong>{totalPullsDisplay}</strong>
          </div>
        </div>
      </section>

      <section className="gasbox-machines-card">
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
            <span className="gasbox-market-empty__icon" aria-hidden="true">G</span>
            <div className="gasbox-market-empty__copy">
              <span>{t("gasboxMarketEmptyTitle")}</span>
              <strong>{t("gasboxMarketEmptyDesc")}</strong>
            </div>
            <div className="gasbox-empty-button-row">
              <NeoButton variant="primary" size="md" onClick={() => dispatch("refreshMachines")}>
                {t("refreshMachines")}
              </NeoButton>
              <NeoButton variant="secondary" size="md" onClick={() => dispatch("openStudio")}>
                {t("openStudio")}
              </NeoButton>
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
            <label className="gasbox-field gasbox-field--wide">
              <span>{t("descriptionLabel")}</span>
              <textarea
                rows={2}
                value={machineDescription}
                placeholder={t("descriptionPlaceholder")}
                onChange={(e) => setMachineDescription(e.target.value)}
              />
            </label>
            <label className="gasbox-field">
              <span>{t("categoryLabel")}</span>
              <input
                type="text"
                value={machineCategory}
                placeholder={t("categoryPlaceholder")}
                onChange={(e) => setMachineCategory(e.target.value)}
              />
            </label>
            <label className="gasbox-field">
              <span>{t("tagsLabel")}</span>
              <input
                type="text"
                value={machineTags}
                placeholder={t("tagsPlaceholder")}
                onChange={(e) => setMachineTags(e.target.value)}
              />
            </label>
          </div>

          <div className="gasbox-studio-items">
            <div className="gasbox-studio-items__header">
              <span>{t("inventoryAndOdds")}</span>
              <strong>
                {t("totalProbabilityLabel")}: {studioTotalProbability}
              </strong>
            </div>

            {studioItems.map((item, index) => (
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
                    <span>{t("probPlaceholder")}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.probability}
                      placeholder={t("probPlaceholder")}
                      onChange={(e) => updateStudioItem(index, { probability: e.target.value })}
                    />
                  </label>
                  <label className="gasbox-field gasbox-field--narrow">
                    <span>{t("rarityLabel")}</span>
                    <select
                      value={item.rarity}
                      onChange={(e) => updateStudioItem(index, { rarity: e.target.value })}
                    >
                      {RARITY_OPTIONS.map((rarity) => (
                        <option key={rarity} value={rarity}>
                          {t(`rarity${rarity.charAt(0)}${rarity.slice(1).toLowerCase()}`) || rarity}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="gasbox-studio-item__row">
                  <label className="gasbox-field gasbox-field--narrow">
                    <span>{t("assetTypeLabel")}</span>
                    <select
                      value={item.assetType}
                      onChange={(e) => updateStudioItem(index, { assetType: e.target.value })}
                    >
                      <option value="1">{t("nep17Label")}</option>
                      <option value="2">{t("nep11Label")}</option>
                    </select>
                  </label>
                  {item.assetType === "2" ? (
                    <label className="gasbox-field">
                      <span>{t("tokenIdPlaceholder")}</span>
                      <input
                        type="text"
                        value={item.tokenId}
                        placeholder={t("tokenIdPlaceholder")}
                        onChange={(e) => updateStudioItem(index, { tokenId: e.target.value })}
                      />
                    </label>
                  ) : (
                    <label className="gasbox-field gasbox-field--narrow">
                      <span>{t("prizePerWinLabel")}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={item.amount}
                        placeholder={t("tokenAmountPlaceholder")}
                        onChange={(e) => updateStudioItem(index, { amount: e.target.value })}
                      />
                    </label>
                  )}
                  <label className="gasbox-field gasbox-field--narrow">
                    <span>{t("stockLabelInput")}</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.stock}
                      placeholder={t("stockPlaceholder")}
                      onChange={(e) => updateStudioItem(index, { stock: e.target.value })}
                    />
                  </label>
                  <label className="gasbox-field">
                    <span>{t("tokenContractPlaceholder")}</span>
                    <input
                      type="text"
                      value={item.assetHash}
                      placeholder={t("tokenContractPlaceholder")}
                      onChange={(e) => updateStudioItem(index, { assetHash: e.target.value })}
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
            ))}

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

      {showResult && pullResult && (
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
            <p className="gasbox-result-note">{t("gasboxClientPrizeNote")}</p>
            <NeoButton variant="secondary" size="md" onClick={dismissResult}>
              {t("dismiss")}
            </NeoButton>
          </div>
        </div>
      )}
    </div>
  );
}
