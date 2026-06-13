import { NeoButton, NeoInput } from "@shared/components-react";
import type { HistoryItem } from "../../../types";

interface HistoryTabProps {
  history: HistoryItem[];
  forgettingId: string | null;
  /** The row id currently awaiting a forget confirmation (fee shown). */
  forgetConfirmId: string | null;
  /** Live forget fee (e.g. "1 GAS") shown in the confirmation. */
  forgetFeeDisplay: string;
  /** The row id whose epitaph editor is open. */
  epitaphDraftId: string | null;
  /** In-progress epitaph text for the open editor. */
  epitaphText: string;
  /** The row id whose epitaph is currently being saved on-chain. */
  epitaphSavingId: string | null;
  /** True when the full-history window is active. */
  showAllHistory: boolean;
  /** True when more burials exist on-chain than are currently displayed. */
  historyTruncated: boolean;
  /** On-chain burial count for this wallet (for the truncation note). */
  totalBuried: number;
  isLoading: boolean;
  onRefresh: () => void;
  onRequestForget: (item: HistoryItem) => void;
  onCancelForget: () => void;
  onForget: (item: HistoryItem) => void;
  onStartEpitaph: (item: HistoryItem) => void;
  onCancelEpitaph: () => void;
  onEpitaphTextChange: (value: string) => void;
  onSaveEpitaph: (item: HistoryItem) => void;
  onToggleShowAll: (value: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export default function HistoryTab({
  history,
  forgettingId,
  forgetConfirmId,
  forgetFeeDisplay,
  epitaphDraftId,
  epitaphText,
  epitaphSavingId,
  showAllHistory,
  historyTruncated,
  totalBuried,
  isLoading,
  onRefresh,
  onRequestForget,
  onCancelForget,
  onForget,
  onStartEpitaph,
  onCancelEpitaph,
  onEpitaphTextChange,
  onSaveEpitaph,
  onToggleShowAll,
  t,
}: HistoryTabProps) {
  const memoryTypeLabel = (memoryType?: number) => {
    const labels = [
      "",
      t("memoryTypeSecret"),
      t("memoryTypeRegret"),
      t("memoryTypeWish"),
      t("memoryTypeConfession"),
      t("memoryTypeOther"),
    ];
    return labels[memoryType ?? 0] || t("memoryType");
  };

  return (
    <div className="tab-content scrollable">
      <div className="history-header">
        <span className="history-label">{t("recentDestructions")}</span>
        <div className="history-header-actions">
          <span className="history-count">{history.length}</span>
          <NeoButton size="sm" variant="ghost" loading={isLoading} onClick={onRefresh} className="history-refresh-btn">
            <svg className="history-refresh-btn__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            {t("refreshRecords")}
          </NeoButton>
        </div>
      </div>
      {history.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4c-3.3 0-6 2.7-6 6v9h12v-9c0-3.3-2.7-6-6-6Z" />
              <path d="M9.5 10h5M12 10v4" />
            </svg>
          </span>
          <span className="empty-text">{t("noDestructions")}</span>
          <span className="empty-hint">{t("noDestructionsHint")}</span>
        </div>
      ) : (
        <>
          <div className="history-list">
            {history.map((item, index) => {
              const id = String(item.id);
              const isConfirmingForget = forgetConfirmId === id;
              const isForgetting = forgettingId === id;
              const isEditingEpitaph = epitaphDraftId === id;
              const isSavingEpitaph = epitaphSavingId === id;
              return (
                <div key={id} className="history-card">
                  <div className="history-card-main">
                    <span className="history-icon" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <div className="history-info">
                      <span className="history-hash">{item.hash.slice(0, 10)}...{item.hash.slice(-6)}</span>
                      <span className="history-time">{memoryTypeLabel(item.memoryType)} · {item.time}</span>
                      {item.epitaph && (
                        <span className="history-epitaph">
                          <span className="history-epitaph-label">{t("epitaph")}</span>
                          {item.epitaph}
                        </span>
                      )}
                    </div>
                    <div className={`history-badge${item.forgotten ? " forgotten" : ""}`}>
                      <span className="badge-text">{item.forgotten ? t("forgotten") : t("destroyed")}</span>
                    </div>
                  </div>

                  {/* Per-row actions: epitaph (free) + forget (paid, confirmed). */}
                  <div className="history-card-actions">
                    {!item.forgotten && !isEditingEpitaph && (
                      <NeoButton size="sm" variant="ghost" onClick={() => onStartEpitaph(item)}>
                        {item.epitaph ? t("editEpitaph") : t("addEpitaph")}
                      </NeoButton>
                    )}
                    {!item.forgotten && !isConfirmingForget && !isEditingEpitaph && (
                      <NeoButton
                        size="sm"
                        variant="secondary"
                        loading={isForgetting}
                        onClick={() => onRequestForget(item)}
                      >
                        {t("forgetAction")}
                      </NeoButton>
                    )}
                  </div>

                  {/* Inline epitaph editor (free, non-deposit addEpitaph). */}
                  {isEditingEpitaph && (
                    <div className="history-epitaph-editor">
                      <NeoInput
                        value={epitaphText}
                        label={t("epitaph")}
                        placeholder={t("epitaphPlaceholder")}
                        hint={t("epitaphFree")}
                        onChange={onEpitaphTextChange}
                      />
                      <div className="history-epitaph-editor-actions">
                        <NeoButton size="sm" variant="ghost" disabled={isSavingEpitaph} onClick={onCancelEpitaph}>
                          {t("cancel")}
                        </NeoButton>
                        <NeoButton
                          size="sm"
                          variant="primary"
                          loading={isSavingEpitaph}
                          onClick={() => onSaveEpitaph(item)}
                        >
                          {t("epitaphSave")}
                        </NeoButton>
                      </div>
                    </div>
                  )}

                  {/* Forget confirmation — surfaces the paid fee before any GAS moves. */}
                  {isConfirmingForget && (
                    <div className="history-forget-confirm" role="status">
                      <p className="history-forget-fee">{t("forgetConfirmFee", { fee: forgetFeeDisplay })}</p>
                      <p className="history-forget-ritual">{t("forgetRitualNote")}</p>
                      <div className="history-forget-confirm-actions">
                        <NeoButton size="sm" variant="ghost" disabled={isForgetting} onClick={onCancelForget}>
                          {t("cancel")}
                        </NeoButton>
                        <NeoButton
                          size="sm"
                          variant="danger"
                          loading={isForgetting}
                          onClick={() => onForget(item)}
                        >
                          {t("forgetConfirmAction")}
                        </NeoButton>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination: the list caps at the first window; Show all raises it. */}
          {(historyTruncated || showAllHistory) && (
            <div className="history-pagination">
              {historyTruncated && (
                <span className="history-truncated-note">
                  {t("historyTruncatedNote", { shown: history.length, total: totalBuried })}
                </span>
              )}
              <NeoButton
                size="sm"
                variant="ghost"
                loading={isLoading}
                onClick={() => onToggleShowAll(!showAllHistory)}
              >
                {showAllHistory ? t("showFewerRecords") : t("showAllRecords")}
              </NeoButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}
