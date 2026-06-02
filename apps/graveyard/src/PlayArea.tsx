import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { CategoryIcon } from "@shared/components-react/illustrations";
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
  const reviewChecks = [
    {
      key: "hash",
      label: t("checkHash"),
      done: hashReady,
    },
    {
      key: "type",
      label: t("checkMemoryType"),
      done: memoryType > 0,
    },
    {
      key: "fees",
      label: t("checkFees"),
      done: true,
    },
  ];

  return (
    <div className="graveyard-play-area">
      {/* Hero — purposeful head with icon badge, title, subtitle, stat strip */}
      <div className="grave-hero">
        <div className="grave-hero-lead">
          <span className="grave-hero-badge">
            <CategoryIcon name="identity" size={40} title={t("title")} />
          </span>
          <div className="grave-hero-copy">
            <h2 className="grave-hero-title">{t("title")}</h2>
            <p className="grave-hero-subtitle">{t("subtitle")}</p>
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-value">{totalDestroyed}</span>
            <span className="hero-stat-label">{t("itemsDestroyed")}</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">{gasReclaimedDisplay}</span>
            <span className="hero-stat-label">{t("gasReclaimed")}</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">{historyCount}</span>
            <span className="hero-stat-label">{t("records")}</span>
          </div>
        </div>
      </div>

      {/* Main grid — burial chamber + records side by side on wide screens */}
      <div className="grave-grid">
        {/* Destruction Chamber */}
        <NeoCard className="grave-chamber" title={t("destroyAsset")}>
          <div className="destroy-form">
            <NeoInput
              value={assetHash}
              label={t("assetHash") || "Asset Hash"}
              placeholder={t("assetHashPlaceholder")}
              hint={!hashError ? t("assetHashHint") : ""}
              error={hashError}
              onChange={(val) => state.assetHash?.set(val)}
            />
            <div className="grave-hash-actions">
              <NeoButton
                variant="secondary"
                size="sm"
                disabled={!assetHash || isDestroying}
                onClick={() => {
                  state.assetHash?.set("");
                  void dispatch("cancelDestroy");
                }}
              >
                {t("clearHash")}
              </NeoButton>
            </div>
            <div className="memory-type-selector">
              <span className="field-label">{t("memoryType")}</span>
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
            </div>
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
              <div className="grave-checklist" aria-label={t("burialChecklist")}>
                {reviewChecks.map((check) => (
                  <div key={check.key} className={`grave-check${check.done ? " is-ready" : " is-blocked"}`}>
                    <span aria-hidden="true">{check.done ? "✓" : "⚠"}</span>
                    <strong>{check.label}</strong>
                    <em>{check.done ? t("checkPassed") : t("checkNeedsAction")}</em>
                  </div>
                ))}
              </div>
              <dl className="grave-fee-row" aria-label={t("transactionPath")}>
                <div>
                  <dt>{t("selectedType")}</dt>
                  <dd>{selectedMemoryTypeLabel}</dd>
                </div>
                <div>
                  <dt>{t("burialFee")}</dt>
                  <dd>0.10 GAS</dd>
                </div>
              </dl>
            </section>
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
                  aria-label={t("cancel") || "Cancel"}
                >
                  {t("cancel") || "Cancel"}
                </NeoButton>
              </div>
            )}
            <NeoButton
              variant="danger"
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
            isLoading={isLoading}
            onRefresh={() => dispatch("refreshRecords")}
            onForget={(item: HistoryItem) => dispatch("forgetMemory", item)}
            t={t}
          />
        </NeoCard>
      </div>
    </div>
  );
}
