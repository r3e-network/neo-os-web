import { NeoButton, NeoCard, NeoInput, NeoSelect } from "@shared/components-react";
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

  const hasPayload = renderedPayload.trim() !== "" && renderedPayload.trim() !== "{}";

  return (
    <div className="automation-play-area">
      {/* Hero — identity + live snapshot + primary actions in one card */}
      <NeoCard className="copilot-hero">
        <div className="copilot-hero__head">
          <div className="copilot-hero__badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
              <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
            </svg>
          </div>
          <div className="copilot-hero__text">
            <h2 className="copilot-hero__title">{t("title") || "Automation Copilot"}</h2>
            <p className="copilot-hero__subtitle">
              {t("subtitle") || "Recipe console for price-triggered Morpheus workflows"}
            </p>
          </div>
          <div className="copilot-hero__stats">
            <div className="copilot-stat">
              <span className="copilot-stat__value">{networkDisplay}</span>
              <span className="copilot-stat__label">{t("network") || "Network"}</span>
            </div>
            <div className="copilot-stat">
              <span className="copilot-stat__value">{asset}</span>
              <span className="copilot-stat__label">{t("asset") || "Asset"}</span>
            </div>
            <div className="copilot-stat">
              <span className="copilot-stat__value">{currentPrice || "--"}</span>
              <span className="copilot-stat__label">{t("currentPrice") || "Price"}</span>
            </div>
          </div>
        </div>

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
      </NeoCard>

      {/* Body — builder on the left, oracle + payload on the right */}
      <div className="copilot-body">
        <NeoCard className="copilot-col" title={t("recipeBuilder") || "Recipe Builder"}>
          <div className="stack">
            <NeoSelect
              value={asset}
              label={t("asset") || "Asset"}
              options={[
                { value: "NEO", label: "NEO" },
                { value: "GAS", label: "GAS" },
                { value: "BTC", label: "BTC" },
              ]}
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

        <div className="copilot-col copilot-col--side">
          <NeoCard title={t("oracleInfo") || "Oracle Info"}>
            <div className="info-grid">
              <div className="info-row">
                <span className="label">{t("oracleHash") || "Oracle Hash"}</span>
                <span className="value mono">{oracleHash || "--"}</span>
              </div>
              <div className="info-row">
                <span className="label">{t("datafeedHash") || "Datafeed Hash"}</span>
                <span className="value mono">{datafeedHash || "--"}</span>
              </div>
            </div>
          </NeoCard>

          <NeoCard title={t("payload") || "Payload"}>
            {hasPayload ? (
              <pre className="json-box">{renderedPayload}</pre>
            ) : (
              <div className="payload-empty">{t("payloadEmpty") || "Fetch a price or build a recipe to preview the payload."}</div>
            )}
          </NeoCard>
        </div>
      </div>
    </div>
  );
}
