import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { HistoryItem } from "./types";
import HistoryTab from "./pages/index/components/HistoryTab";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, str, bool, val } = useStateBindings(state);

  const totalDestroyed = num("totalDestroyed");
  const gasReclaimedDisplay = str("gasReclaimedDisplay", "0");
  const burialFeeDisplay = str("burialFeeDisplay", "0.10 GAS");
  const historyCount = num("historyCount");
  const historyItems = val<HistoryItem[]>("history") ?? [];
  const isDestroying = bool("isDestroying");
  const isLoading = bool("isLoading");
  const showConfirm = bool("showConfirm");
  const showWarningShake = bool("showWarningShake");
  const assetHash = str("assetHash");
  const memoryType = num("memoryType");
  const memoryTypeOptions =
    val<Array<{ value: number; label: string }>>("memoryTypeOptions") ?? [];
  const selectedMemoryTypeLabel =
    memoryTypeOptions.find((option) => option.value === memoryType)?.label ??
    t("memoryType");
  const forgettingId = str("forgettingId");
  const forgetConfirmId = str("forgetConfirmId");
  const forgetFeeDisplay = str("forgetFeeDisplay", "1 GAS");
  const epitaphDraftId = str("epitaphDraftId");
  const epitaphText = str("epitaphText");
  const epitaphSavingId = str("epitaphSavingId");
  const showAllHistory = bool("showAllHistory");
  const historyTruncated = bool("historyTruncated");
  const totalBuried = num("totalDestroyed");
  const composeMode = str("composeMode", "write");
  const memoryText = str("memoryText");
  const isWriteMode = composeMode !== "hash";
  const trimmedAssetHash = assetHash.trim();
  const hashReady = trimmedAssetHash.length >= 12;
  const hashShort = trimmedAssetHash.length > 0 && !hashReady;
  const hashError = hashShort ? t("assetHashTooShort") : "";
  const hashPreview = trimmedAssetHash
    ? trimmedAssetHash.length > 24
      ? `${trimmedAssetHash.slice(0, 12)}...${trimmedAssetHash.slice(-8)}`
      : trimmedAssetHash
    : t("hashPending");
  const readinessTitle = !trimmedAssetHash
    ? t("hashMissing")
    : hashReady
      ? t("hashReady")
      : t("hashTooShort");
  const readinessCopy = !trimmedAssetHash
    ? t("hashMissingCopy")
    : hashReady
      ? t("hashReadyCopy")
      : t("hashTooShortCopy");
  return (
    <div className="graveyard-play-area">
      {/* Hero — purposeful head with icon badge, title, subtitle, stat tiles */}
      <div className="grave-hero">
        <div className="grave-hero-content">
          <div className="grave-hero-lead">
            <picture className="grave-hero-badge" aria-hidden="true">
              <source srcSet="logo.avif" type="image/avif" />
              <source srcSet="logo.webp" type="image/webp" />
              <img src="logo.jpg" alt="" loading="eager" decoding="async" />
            </picture>
            <div className="grave-hero-copy">
              <span className="grave-hero-eyebrow">{t("rip")}</span>
              <h2 className="grave-hero-title">{t("title")}</h2>
              <p className="grave-hero-subtitle">{t("subtitle")}</p>
            </div>
          </div>
          <div className="hero-metrics" aria-label={t("burialReview")}>
            <div className="hero-metric">
              <strong>{totalDestroyed}</strong>
              <em>{t("itemsDestroyed")}</em>
            </div>
            <div className="hero-metric">
              <strong>{gasReclaimedDisplay}</strong>
              <em>{t("gasReclaimedEstimate")}</em>
            </div>
            <div className="hero-metric">
              <strong>{historyCount}</strong>
              <em>{t("records")}</em>
            </div>
          </div>
        </div>
        <picture className="grave-hero-art" aria-hidden="true">
          <source srcSet="logo.avif" type="image/avif" />
          <source srcSet="logo.webp" type="image/webp" />
          <img src="logo.jpg" alt="" loading="eager" decoding="async" />
        </picture>
      </div>

      {/* Main grid — burial chamber + records side by side on wide screens */}
      <div className="grave-grid">
        {/* Destruction Chamber */}
        <NeoCard className="grave-chamber" title={t("destroyAsset")}>
          <div className="destroy-form">
            {/* Compose mode: write the memory (hashed locally) or paste a hash. */}
            <div className="grave-compose-toggle" role="tablist" aria-label={t("destroyAsset")}>
              <button
                type="button"
                role="tab"
                aria-selected={isWriteMode}
                className={`grave-compose-tab${isWriteMode ? " active" : ""}`}
                disabled={isDestroying}
                onClick={() => dispatch("setComposeMode", "write")}
              >
                {t("composeModeWrite")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isWriteMode}
                className={`grave-compose-tab${!isWriteMode ? " active" : ""}`}
                disabled={isDestroying}
                onClick={() => dispatch("setComposeMode", "hash")}
              >
                {t("composeModeHash")}
              </button>
            </div>
            {isWriteMode ? (
              <>
                <NeoInput
                  type="textarea"
                  value={memoryText}
                  label={t("memoryTextLabel")}
                  placeholder={t("memoryTextPlaceholder")}
                  hint={t("memoryTextHint")}
                  onChange={(val) => dispatch("setMemoryText", val)}
                />
                {trimmedAssetHash && (
                  <p className="grave-local-hash" aria-label={t("hashFromMemory")}>
                    <span className="grave-local-hash-label">{t("hashFromMemory")}</span>
                    <code className="grave-local-hash-value">{hashPreview}</code>
                  </p>
                )}
              </>
            ) : (
              <NeoInput
                value={assetHash}
                label={t("assetHash")}
                placeholder={t("assetHashPlaceholder")}
                hint={!hashError ? t("assetHashHint") : ""}
                error={hashError}
                onChange={(val) => state.assetHash?.set(val)}
              />
            )}
            <div className="grave-hash-actions">
              <NeoButton
                variant="secondary"
                size="sm"
                disabled={(!assetHash && !memoryText) || isDestroying}
                onClick={() => {
                  if (isWriteMode) {
                    void dispatch("setMemoryText", "");
                  } else {
                    state.assetHash?.set("");
                  }
                  void dispatch("cancelDestroy");
                }}
              >
                {t("clearHash")}
              </NeoButton>
            </div>
            <div className="memory-type-selector">
              <span className="field-label">{t("memoryTypeLocal")}</span>
              <div className="type-options">
                {memoryTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`type-option${memoryType === option.value ? " active" : ""}`}
                    onClick={() => state.memoryType?.set(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <span className="memory-type-hint">{t("memoryTypeLocalHint")}</span>
            </div>
            {trimmedAssetHash.length > 0 && (
              <section className="grave-review-panel" aria-label={t("burialReview")}>
                <div className="grave-review-header">
                  <span>{t("burialReview")}</span>
                  <strong>{t("burialReviewSubtitle")}</strong>
                </div>
                <div className="grave-review-grid">
                  <div className={`grave-review-tile${hashReady ? " is-ready" : " is-blocked"}`}>
                    <span className="grave-review-tile-head">
                      <i className="grave-review-mark" aria-hidden="true">{hashReady ? "✓" : "⚠"}</i>
                      {t("hashQuality")}
                    </span>
                    <strong>{readinessTitle}</strong>
                    <p>{readinessCopy}</p>
                  </div>
                  <div className="grave-review-tile">
                    <span>{t("hashPreview")}</span>
                    <strong>{hashPreview}</strong>
                    <p>{t("hashPreviewCopy")}</p>
                  </div>
                  <div className="grave-review-tile">
                    <span>{t("walletAction")}</span>
                    <strong>{t("buryWalletIntent")}</strong>
                    <p>{t("walletActionCopy")}</p>
                  </div>
                </div>
                <dl className="grave-fee-row" aria-label={t("transactionPath")}>
                  <div>
                    <dt>{t("selectedTypeLocal")}</dt>
                    <dd>{selectedMemoryTypeLabel}</dd>
                  </div>
                  <div>
                    <dt>{t("burialFee")}</dt>
                    <dd>{burialFeeDisplay}</dd>
                  </div>
                </dl>
                <p className="grave-sunk-fee-note">{t("sunkFeeNote")}</p>
              </section>
            )}
            <div className="grave-warning-note">
              <span className="grave-warning-title">{t("warning")}</span>
              <span className="grave-warning-text">{t("warningText")}</span>
            </div>
            {showConfirm && (
              <div className="grave-confirm-note" role="status">
                <div>
                  <span className="grave-confirm-title">{t("confirmTitle")}</span>
                  <span className="grave-confirm-text">{t("confirmText")}</span>
                </div>
                <NeoButton
                  variant="secondary"
                  size="sm"
                  onClick={() => dispatch("cancelDestroy")}
                  aria-label={t("cancel")}
                >
                  {t("cancel")}
                </NeoButton>
              </div>
            )}
            <NeoButton
              variant="primary"
              size="lg"
              block
              loading={isDestroying}
              disabled={!hashReady || isLoading}
              className={showWarningShake ? "grave-cta-attention" : ""}
              aria-label={showConfirm ? t("confirmDestroy") : t("destroyForever")}
              onClick={() => dispatch(showConfirm ? "executeDestroy" : "initiateDestroy")}
            >
              {isDestroying ? t("destroying") : showConfirm ? t("confirmDestroy") : t("destroyForever")}
            </NeoButton>
          </div>
        </NeoCard>

        {/* History */}
        <NeoCard className="grave-records">
          <HistoryTab
            history={historyItems}
            forgettingId={forgettingId || null}
            forgetConfirmId={forgetConfirmId || null}
            forgetFeeDisplay={forgetFeeDisplay}
            epitaphDraftId={epitaphDraftId || null}
            epitaphText={epitaphText}
            epitaphSavingId={epitaphSavingId || null}
            showAllHistory={showAllHistory}
            historyTruncated={historyTruncated}
            totalBuried={totalBuried}
            isLoading={isLoading}
            onRefresh={() => dispatch("refreshRecords")}
            onRequestForget={(item: HistoryItem) => dispatch("requestForget", item)}
            onCancelForget={() => dispatch("cancelForget")}
            onForget={(item: HistoryItem) => dispatch("forgetMemory", item)}
            onStartEpitaph={(item: HistoryItem) => dispatch("startEpitaph", item)}
            onCancelEpitaph={() => dispatch("cancelEpitaph")}
            onEpitaphTextChange={(value: string) => dispatch("setEpitaphText", value)}
            onSaveEpitaph={(item: HistoryItem) => dispatch("saveEpitaph", item)}
            onToggleShowAll={(value: boolean) => dispatch("setShowAllHistory", value)}
            t={t}
          />
        </NeoCard>
      </div>
    </div>
  );
}
