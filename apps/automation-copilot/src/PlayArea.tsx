import { NeoButton, NeoInput } from "@shared/components-react";
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
  const isRequesting = bool("isRequesting");
  const renderedPayload = str("renderedPayload", "{}");

  return (
    <div className="automation-play-area">
      {/* Result Panel */}
      <pre className="json-box">{renderedPayload}</pre>

      {/* Operation Panel */}
      <div className="stack">
        <NeoInput value={asset} label={t("asset")} placeholder={t("assetPlaceholder")} onChange={(val) => { if (state.asset) state.asset.set(val); }} />
        <NeoInput value={targetPrice} label={t("targetPrice")} placeholder={t("targetPricePlaceholder")} onChange={(val) => { if (state.targetPrice) state.targetPrice.set(val); }} />
        <NeoInput value={schedule} label={t("schedule")} placeholder={t("schedulePlaceholder")} onChange={(val) => { if (state.schedule) state.schedule.set(val); }} />
        <NeoInput value={actionName} label={t("actionName")} placeholder={t("actionNamePlaceholder")} onChange={(val) => { if (state.actionName) state.actionName.set(val); }} />
        <div className="button-row">
          <NeoButton variant="primary" loading={isRequesting} aria-label={t("fetchPrice")} onClick={() => dispatch("fetchCurrentPrice")}>{t("fetchPrice")}</NeoButton>
          <NeoButton variant="secondary" loading={isRequesting} aria-label={t("previewRecipe")} onClick={() => dispatch("previewRecipePayload")}>{t("previewRecipe")}</NeoButton>
          <NeoButton variant="secondary" loading={isRequesting} aria-label={t("requestRandomness")} onClick={() => dispatch("loadRandomness")}>{t("requestRandomness")}</NeoButton>
          <NeoButton variant="secondary" loading={isRequesting} aria-label={t("fetchOracleKey")} onClick={() => dispatch("fetchOracleKey")}>{t("fetchOracleKey")}</NeoButton>
        </div>
      </div>
    </div>
  );
}
