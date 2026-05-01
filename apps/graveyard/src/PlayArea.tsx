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
      {/* Stats Bar */}
      <div className="hero-stats">
        <div className="hero-stat">
          <span className="hero-stat-value">{totalDestroyed}</span>
          <span className="hero-stat-label">{t("itemsDestroyed") || "Destroyed"}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{gasReclaimedDisplay}</span>
          <span className="hero-stat-label">{t("gasReclaimed") || "GAS Reclaimed"}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{historyCount}</span>
          <span className="hero-stat-label">{t("historyCount") || "History"}</span>
        </div>
      </div>

      {/* Destruction Chamber */}
      <NeoCard title={t("destructionChamber") || "Destruction Chamber"}>
        <div className="destroy-form">
          <NeoInput
            value={assetHash}
            label={t("assetHash") || "Asset Hash"}
            placeholder={t("assetHashPlaceholder") || "Enter asset hash to destroy"}
            onChange={(val) => state.assetHash?.set(val)}
          />
          <div className="memory-type-selector">
            <span className="field-label">{t("memoryType") || "Memory Type"}</span>
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
          <NeoButton
            variant="danger"
            size="lg"
            block
            loading={isDestroying}
            disabled={!assetHash || isLoading}
            className={showWarningShake ? "shake" : ""}
            aria-label={t("executeDestroy") || "Destroy Memory"}
            onClick={() => dispatch("executeDestroy")}
          >
            {isDestroying ? t("destroying") || "Destroying..." : t("executeDestroy") || "Destroy Memory"}
          </NeoButton>
        </div>
      </NeoCard>

      {/* History */}
      <HistoryTab
        history={historyItems}
        forgettingId={forgettingId || null}
        onForget={(item: unknown) => dispatch("forgetMemory", item)}
        t={t}
      />
    </div>
  );
}
