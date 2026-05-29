import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { useMultisigUI } from "./composables/useMultisigUI";
import type { HistoryItem } from "./composables/useMultisigHistory";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num } = useStateBindings(state);
  const { statusLabel, shorten, formatDate } = useMultisigUI();
  const [idInput, setIdInput] = useState("");

  const history = (state.history?.get() ?? []) as HistoryItem[];
  const pendingCount = num("pendingCount");
  const completedCount = num("completedCount");
  const totalTxs = num("totalTxs");
  const totalCount = totalTxs || history.length;

  return (
    <div className="multisig-play-area">
      <div className="multisig-shell">
        <section className="multisig-main" aria-label={t("multisigHeroTitle")}>
          <div className="multisig-hero">
            <div className="multisig-hero-copy">
              <span className="multisig-hero-accent" aria-hidden="true" />
              <h2>{t("multisigHeroTitle")}</h2>
              <p>{t("multisigHeroSubtitle")}</p>
            </div>
            <div className="multisig-stat-grid">
              <div>
                <span>{t("multisigPendingMetric")}</span>
                <strong>{pendingCount}</strong>
              </div>
              <div>
                <span>{t("multisigCompletedMetric")}</span>
                <strong>{completedCount}</strong>
              </div>
              <div>
                <span>{t("multisigTotalMetric")}</span>
                <strong>{totalCount}</strong>
              </div>
            </div>
          </div>

          <div className="multisig-workspace">
            <NeoCard variant="erobo" className="multisig-request-panel">
              <div className="multisig-section-heading">
                <span>{t("multisigRequestTitle")}</span>
                <strong>{t("multisigDraftState")}</strong>
              </div>
              <p>{t("multisigRequestCopy")}</p>
              <div className="multisig-quorum-strip" aria-label={t("multisigQuorumTitle")}>
                <div>
                  <span>{t("multisigQuorumTitle")}</span>
                  <strong>2 / 3</strong>
                </div>
                <div>
                  <span>{t("multisigNetworkTitle")}</span>
                  <strong>{t("multisigNetworkValue")}</strong>
                </div>
                <div>
                  <span>{t("multisigBroadcastTitle")}</span>
                  <strong>{t("statusPending")}</strong>
                </div>
              </div>
              <div className="multisig-primary-actions">
                <NeoButton
                  variant="primary"
                  onClick={() => dispatch("navigateToCreate")}
                >
                  {t("createCta")}
                </NeoButton>
              </div>
              <div className="multisig-load-box">
                <NeoInput
                  value={idInput}
                  label={t("loadTitle")}
                  placeholder={t("loadPlaceholder")}
                  onChange={setIdInput}
                />
                <NeoButton
                  variant="secondary"
                  disabled={!idInput.trim()}
                  onClick={() => dispatch("loadTransaction", idInput.trim())}
                >
                  {t("loadButton")}
                </NeoButton>
              </div>
            </NeoCard>

            <NeoCard variant="erobo" className="multisig-activity-panel">
              <div className="multisig-section-heading">
                <span>{t("recentTitle")}</span>
                <strong>{history.length}</strong>
              </div>
              {history.length === 0 ? (
                <div className="multisig-empty-state">
                  <strong>{t("sidebarNoActivity")}</strong>
                  <span>{t("recentEmpty")}</span>
                </div>
              ) : (
                <div className="multisig-history-list">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="multisig-history-card"
                      onClick={() => dispatch("loadTransaction", item.id)}
                    >
                      <span>{shorten(item.scriptHash)}</span>
                      <strong>{statusLabel(item.status)}</strong>
                      <em>{formatDate(item.createdAt)}</em>
                    </button>
                  ))}
                </div>
              )}
            </NeoCard>
          </div>
        </section>

        <aside className="multisig-side" aria-label={t("multisigSignerTitle")}>
          <NeoCard variant="erobo" className="multisig-signer-panel">
            <div className="multisig-section-heading">
              <span>{t("multisigSignerTitle")}</span>
              <strong>{t("multisigWalletReviewed")}</strong>
            </div>
            <p>{t("multisigSignerCopy")}</p>
            <div className="multisig-signal-row">
              <span>{t("reviewSigners")}</span>
              <strong>3</strong>
            </div>
            <div className="multisig-signal-row">
              <span>{t("thresholdLabel")}</span>
              <strong>{t("multisigThreshold")}</strong>
            </div>
            <div className="multisig-signal-row">
              <span>{t("reviewFees")}</span>
              <strong>{t("multisigFeeGuard")}</strong>
            </div>
          </NeoCard>

          <NeoCard variant="erobo" className="multisig-route-panel">
            <div className="multisig-section-heading">
              <span>{t("multisigRouteTitle")}</span>
              <strong>{t("chainMainnet")}</strong>
            </div>
            <p>{t("multisigRouteCopy")}</p>
            <div className="multisig-signal-row">
              <span>{t("buttonCreate")}</span>
              <strong>{t("multisigRouteCreate")}</strong>
            </div>
            <div className="multisig-signal-row">
              <span>{t("buttonSign")}</span>
              <strong>{t("multisigRouteSign")}</strong>
            </div>
            <div className="multisig-signal-row">
              <span>{t("buttonBroadcast")}</span>
              <strong>{t("multisigRouteBroadcast")}</strong>
            </div>
          </NeoCard>
        </aside>
      </div>
    </div>
  );
}
