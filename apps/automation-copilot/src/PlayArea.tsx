import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool } = useStateBindings(state);

  const asset = str("asset", "NEO");
  const targetPrice = str("targetPrice", "20");
  const schedule = str("schedule", "0 */6 * * *");
  const actionName = str("actionName", "auto_repay_self_loan");
  const currentPrice = str("currentPrice");
  const renderedPayload = str("renderedPayload", "{}");
  const isRequesting = bool("isRequesting");
  const oracleHash = str("oracleHash");
  const networkDisplay = str("networkDisplay", "N3 TestNet");
  const datafeedHash = str("datafeedHash");

  return (
    <div className="automation-play-area">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-chip-label">{t("network") || "Network"}</span>
          <span className="stat-chip-value">{networkDisplay}</span>
        </div>
        {currentPrice && (
          <div className="stat-chip">
            <span className="stat-chip-label">{t("currentPrice") || "Price"}</span>
            <span className="stat-chip-value">${currentPrice}</span>
          </div>
        )}
      </div>

      {/* Oracle Info */}
      <NeoCard title={t("oracleInfo") || "Oracle Info"}>
        <div className="info-grid">
          {oracleHash && (
            <div className="info-row">
              <span className="label">{t("oracleHash") || "Oracle Hash"}</span>
              <span className="value mono">{oracleHash}</span>
            </div>
          )}
          {datafeedHash && (
            <div className="info-row">
              <span className="label">{t("datafeedHash") || "Datafeed Hash"}</span>
              <span className="value mono">{datafeedHash}</span>
            </div>
          )}
        </div>
      </NeoCard>

      {/* Recipe Builder */}
      <NeoCard title={t("recipeBuilder") || "Recipe Builder"}>
        <div className="stack">
          <NeoInput
            value={asset}
            label={t("asset") || "Asset"}
            placeholder={t("assetPlaceholder") || "NEO, GAS, etc."}
            onChange={(val) => { if (state.asset) state.asset.set(val); }}
          />
          <NeoInput
            value={targetPrice}
            label={t("targetPrice") || "Target Price"}
            placeholder={t("targetPricePlaceholder") || "20"}
            onChange={(val) => { if (state.targetPrice) state.targetPrice.set(val); }}
          />
          <NeoInput
            value={schedule}
            label={t("schedule") || "Schedule (cron)"}
            placeholder={t("schedulePlaceholder") || "0 */6 * * *"}
            onChange={(val) => { if (state.schedule) state.schedule.set(val); }}
          />
          <NeoInput
            value={actionName}
            label={t("actionName") || "Action Name"}
            placeholder={t("actionNamePlaceholder") || "auto_repay_self_loan"}
            onChange={(val) => { if (state.actionName) state.actionName.set(val); }}
          />
        </div>
      </NeoCard>

      {/* Actions */}
      <div className="button-row">
        <NeoButton
          variant="primary"
          loading={isRequesting}
          aria-label={t("fetchPrice") || "Fetch Price"}
          onClick={() => dispatch("fetchCurrentPrice")}
        >
          {t("fetchPrice") || "Fetch Price"}
        </NeoButton>
        <NeoButton
          variant="secondary"
          loading={isRequesting}
          aria-label={t("buildRecipe") || "Build Recipe"}
          onClick={() => dispatch("buildRecipePayload")}
        >
          {t("buildRecipe") || "Build Recipe"}
        </NeoButton>
      </div>

      {/* Result Display */}
      <NeoCard title={t("payload") || "Payload"}>
        <pre className="json-box">{renderedPayload}</pre>
      </NeoCard>
    </div>
  );
}
