import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
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
  const gasReclaimed = num("gasReclaimed");
  const gasReclaimedDisplay = str("gasReclaimedDisplay", "0");
  const historyCount = num("historyCount");
  const historyItems = val<unknown[]>("history") ?? [];
  const isDestroying = bool("isDestroying");
  const isLoading = bool("isLoading");
  const showConfirm = bool("showConfirm");
  const showWarningShake = bool("showWarningShake");
  const assetHash = str("assetHash");
  const memoryType = num("memoryType");
  const memoryTypeOptions =
    val<Array<{ value: number; label: string }>>("memoryTypeOptions") ?? [];
  const forgettingId = str("forgettingId");

  return (
    <div className="graveyard-play-area">
      {/* Hero — purposeful head with icon badge, title, subtitle, stat strip */}
      <div className="grave-hero">
        <div className="grave-hero-lead">
          <span className="grave-hero-badge" aria-hidden="true">{"⚰️"}</span>
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
              onChange={(val) => state.assetHash?.set(val)}
            />
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
            <div className="grave-warning-note">
              <span className="grave-warning-title">{t("warning")}</span>
              <span className="grave-warning-text">{t("warningText")}</span>
            </div>
            <NeoButton
              variant="danger"
              size="lg"
              block
              loading={isDestroying}
              disabled={!assetHash || isLoading}
              className={showWarningShake ? "shake" : ""}
              aria-label={t("destroyForever")}
              onClick={() => dispatch("executeDestroy")}
            >
              {isDestroying ? t("destroying") : t("destroyForever")}
            </NeoButton>
          </div>
        </NeoCard>

        {/* History */}
        <NeoCard className="grave-records">
          <HistoryTab
            history={historyItems}
            forgettingId={forgettingId || null}
            onForget={(item: unknown) => dispatch("forgetMemory", item)}
            t={t}
          />
        </NeoCard>
      </div>
    </div>
  );
}
