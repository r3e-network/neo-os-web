import { Bot, CheckCircle2, Copy, ListChecks, Power, RefreshCw } from "lucide-react";
import { NeoButton, NeoInput, NeoSelect } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { isLocalAutomationIntent, type AutomationTrigger } from "./automationGateway";
import "./PlayArea.scss";

function shortId(value: string) {
  if (!value || value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export default function PlayArea({ t, state, dispatch, services }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const asset = str("asset", "NEO");
  const targetPrice = str("targetPrice", "20");
  const schedule = str("schedule", "0 */6 * * *");
  const actionName = str("actionName", "auto_repay_self_loan");
  const currentPrice = str("currentPrice");
  const renderedPayload = str("renderedPayload", "{}");
  const renderedTriggerRequest = str("renderedTriggerRequest", "{}");
  const isRequesting = bool("isRequesting");
  const isRegistering = bool("isRegistering");
  const isRefreshing = bool("isRefreshing");
  const oracleHash = str("oracleHash");
  const networkDisplay = str("networkDisplay", "mainnet");
  const datafeedHash = str("datafeedHash");
  const latestTriggerId = str("latestTriggerId");
  const latestTriggerState = str("latestTriggerState");
  const apiStatus = str("apiStatus");
  const lastError = str("lastError");
  const triggerCount = num("triggerCount");
  const latestTrigger = val<AutomationTrigger>("latestTrigger");

  const hasPayload = renderedPayload.trim() !== "" && renderedPayload.trim() !== "{}";
  const hasTriggerRequest =
    renderedTriggerRequest.trim() !== "" && renderedTriggerRequest.trim() !== "{}";
  const handoffOnly = isLocalAutomationIntent(latestTrigger);
  const canToggle = Boolean(latestTrigger?.id) && !handoffOnly;
  const hasTrigger = Boolean(latestTrigger?.id);
  const isEnabled = Boolean(latestTrigger?.enabled);
  const statusTone = !hasTrigger ? "neutral" : isEnabled ? "ok" : "off";
  const statusLabel = !hasTrigger
    ? latestTriggerState || apiStatus || (t("apiIdle") || "Ready")
    : isEnabled
      ? (t("enabled") || "Enabled")
      : (t("disabled") || "Disabled");

  const naLabel = t("notAvailable");
  const hasPrice = Boolean(currentPrice) && currentPrice !== naLabel;
  const nextExecution = latestTrigger?.next_execution;
  const hasNextExecution = Boolean(nextExecution) && nextExecution !== naLabel;
  const hasDetails = hasPayload || hasTriggerRequest;

  async function copyCurrentPayload() {
    const text = hasPayload ? renderedPayload : renderedTriggerRequest;
    if (!text.trim() || !services.clipboard) return;
    await services.clipboard.copy(text, "copied");
  }

  return (
    <div className="automation-play-area">
      <section className="automation-hero" aria-labelledby="automation-title">
        <div className="automation-hero__copy">
          <span className="automation-hero__icon" aria-hidden="true">
            <Bot size={22} />
          </span>
          <div>
            <h2 id="automation-title">{t("title") || "Automation Copilot"}</h2>
            <p>{t("subtitle") || "Create and manage price-triggered Morpheus automation triggers."}</p>
            <div className="automation-hero__facts">
              <span className="automation-hero__fact">
                <span className="automation-hero__fact-label">{t("currentPrice") || "Current Price"}</span>
                <strong>{hasPrice ? currentPrice : "--"}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className={`automation-status-badge automation-status-badge--${statusTone}`}>
          <span className="automation-status-badge__dot" aria-hidden="true" />
          <span>{statusLabel}</span>
        </div>
      </section>

      <section className="automation-workspace">
        <form
          className="automation-panel automation-panel--builder"
          aria-label={t("recipeBuilder") || "Recipe Builder"}
          onSubmit={(event) => {
            event.preventDefault();
            void dispatch("registerTrigger");
          }}
        >
          <div className="automation-panel__head">
            <span className="automation-panel__title">{t("recipeBuilder") || "Recipe Builder"}</span>
          </div>

          <div className="automation-fields">
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
              label={t("schedule") || "Schedule"}
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

          {lastError ? (
            <div className="automation-panel__alert" role="alert">
              {lastError}
            </div>
          ) : null}

          <div className="automation-actions automation-actions--primary">
            <NeoButton variant="primary" loading={isRegistering} onClick={() => dispatch("registerTrigger")}>
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>{t("registerTrigger") || "Register Trigger"}</span>
            </NeoButton>
          </div>

          <div className="automation-actions automation-actions--secondary">
            <NeoButton variant="ghost" size="sm" loading={isRequesting} onClick={() => dispatch("fetchCurrentPrice")}>
              <RefreshCw size={15} aria-hidden="true" />
              <span>{t("fetchPrice") || "Fetch Price"}</span>
            </NeoButton>
            <NeoButton variant="ghost" size="sm" onClick={() => dispatch("buildRecipePayload")}>
              <ListChecks size={15} aria-hidden="true" />
              <span>{t("buildRecipe") || "Build Recipe"}</span>
            </NeoButton>
          </div>

          <div className="automation-panel__hint">
            {t("automationGatewayHint") ||
              "Registration is sent through the host automation gateway. Gateway fallbacks are labeled as handoff intents, not successful triggers."}
          </div>
        </form>

        <div className="automation-panel automation-panel--status">
          <div className="automation-panel__head automation-panel__head--row">
            <span className="automation-panel__title">
              {t("triggerStatus") || "Trigger Status"}
              {triggerCount > 0 ? (
                <span className="automation-panel__count">{triggerCount}</span>
              ) : null}
            </span>
            <NeoButton variant="ghost" size="sm" loading={isRefreshing} onClick={() => dispatch("refreshTriggers")}>
              <RefreshCw size={15} aria-hidden="true" />
              <span>{t("refreshTriggers") || "Refresh"}</span>
            </NeoButton>
          </div>

          {hasTrigger ? (
            <>
              <div className="automation-trigger-card">
                <div>
                  <span>{t("latestTriggerId") || "Latest Trigger"}</span>
                  <strong>{latestTriggerId ? shortId(latestTriggerId) : "--"}</strong>
                </div>
                <div>
                  <span>{t("nextExecution") || "Next Execution"}</span>
                  <strong>{hasNextExecution ? nextExecution : "--"}</strong>
                </div>
              </div>

              <div className="automation-actions automation-actions--compact">
                <NeoButton
                  variant="secondary"
                  disabled={!canToggle}
                  loading={isRegistering}
                  onClick={() => dispatch("toggleLatestTrigger")}
                >
                  <Power size={17} aria-hidden="true" />
                  <span>{latestTrigger?.enabled ? t("disableTrigger") : t("enableTrigger")}</span>
                </NeoButton>
                <NeoButton
                  variant="ghost"
                  disabled={!hasPayload && !hasTriggerRequest}
                  onClick={copyCurrentPayload}
                >
                  <Copy size={17} aria-hidden="true" />
                  <span>{t("copyPayload") || "Copy Payload"}</span>
                </NeoButton>
              </div>

              {handoffOnly ? (
                <div className="automation-panel__note">
                  {t("verifyBeforeOperate") || "Verify a gateway trigger before enabling or disabling it."}
                </div>
              ) : null}
            </>
          ) : (
            <div className="automation-empty automation-empty--inline">
              {t("noTriggerSelected") || "Register or refresh a trigger to see its status."}
            </div>
          )}
        </div>
      </section>

      {hasDetails || datafeedHash || oracleHash ? (
        <details className="automation-details">
          <summary className="automation-details__summary">
            <span>{t("payload") || "Payload"}</span>
            <span className="automation-details__hint">{t("detailsLabel") || "Details"}</span>
          </summary>
          <div className="automation-details__body">
            <div className="automation-details__config">
              <div>
                <span>{t("network") || "Network"}</span>
                <strong>{networkDisplay}</strong>
              </div>
              <div>
                <span>{t("datafeedHash") || "Datafeed Hash"}</span>
                <strong>{shortId(datafeedHash || "--")}</strong>
              </div>
              <div>
                <span>{t("oracleHash") || "Oracle Hash"}</span>
                <strong>{shortId(oracleHash || "--")}</strong>
              </div>
            </div>
            {hasDetails ? (
              <div className="automation-details__grid">
                <div className="automation-details__block">
                  <span className="automation-details__label">
                    {t("payload") || "Payload"}
                    {" · "}
                    {hasPayload ? t("latestResult") : t("payloadEmpty")}
                  </span>
                  {hasPayload ? (
                    <pre className="automation-json">{renderedPayload}</pre>
                  ) : (
                    <div className="automation-empty">{t("payloadEmpty") || "Fetch a price or build a recipe first."}</div>
                  )}
                </div>
                {hasTriggerRequest ? (
                  <div className="automation-details__block">
                    <span className="automation-details__label">{t("triggerStatus") || "Trigger Status"}</span>
                    <pre className="automation-json">{renderedTriggerRequest}</pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
