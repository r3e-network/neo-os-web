import {
  Activity,
  ArrowRight,
  Bell,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  ListChecks,
  Power,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { NeoButton, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { isLocalAutomationIntent, type AutomationTrigger } from "./automationGateway";
import "./PlayArea.scss";

function shortId(value: string) {
  if (!value || value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function actionIcon(value: string) {
  switch (value) {
    case "auto_repay_self_loan":
      return <ShieldCheck size={19} aria-hidden="true" />;
    case "rebalance_vault":
      return <RefreshCw size={19} aria-hidden="true" />;
    case "claim_rewards":
      return <Sparkles size={19} aria-hidden="true" />;
    case "notify_webhook":
      return <Bell size={19} aria-hidden="true" />;
    default:
      return <Zap size={19} aria-hidden="true" />;
  }
}

/**
 * Supported automation.upkeep action names, surfaced as a discoverable select so
 * a first-time user does not silently target a nonexistent action. The sentinel
 * "__custom__" reveals a free-text field for advanced/unlisted actions.
 */
const ACTION_PRESETS = [
  { value: "auto_repay_self_loan", labelKey: "actionRepaySelfLoan", hintKey: "actionRepaySelfLoanHint" },
  { value: "rebalance_vault", labelKey: "actionRebalanceVault", hintKey: "actionRebalanceVaultHint" },
  { value: "claim_rewards", labelKey: "actionClaimRewards", hintKey: "actionClaimRewardsHint" },
  { value: "notify_webhook", labelKey: "actionNotifyWebhook", hintKey: "actionNotifyWebhookHint" },
] as const;
const CUSTOM_ACTION = "__custom__";

const SCHEDULE_PRESETS = [
  { value: "0 * * * *", labelKey: "schedulePresetHourly" },
  { value: "0 */6 * * *", labelKey: "schedulePresetEvery6h" },
  { value: "0 0 * * *", labelKey: "schedulePresetDaily" },
] as const;

const ASSET_OPTIONS = [
  { value: "NEO", hintKey: "assetNeoHint" },
  { value: "GAS", hintKey: "assetGasHint" },
  { value: "BTC", hintKey: "assetBtcHint" },
] as const;

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
  const triggers = val<AutomationTrigger[]>("triggers", []) ?? [];

  // Action vocabulary: a known preset drives the select; an unlisted action name
  // flips the select to "Custom" and reveals the free-text field.
  const isPresetAction = ACTION_PRESETS.some((preset) => preset.value === actionName);
  const [customActionMode, setCustomActionMode] = useState(false);
  const actionSelectValue = !isPresetAction || customActionMode ? CUSTOM_ACTION : actionName;
  const selectedScheduleLabel =
    t(SCHEDULE_PRESETS.find((preset) => preset.value === schedule)?.labelKey ?? "schedulePresetCustom");
  const selectedActionLabel =
    actionSelectValue === CUSTOM_ACTION
      ? actionName || t("actionCustom")
      : t(ACTION_PRESETS.find((preset) => preset.value === actionName)?.labelKey ?? "actionRepaySelfLoan");

  const hasPayload = renderedPayload.trim() !== "" && renderedPayload.trim() !== "{}";
  const hasTriggerRequest =
    renderedTriggerRequest.trim() !== "" && renderedTriggerRequest.trim() !== "{}";
  const handoffOnly = isLocalAutomationIntent(latestTrigger);
  const canToggle = Boolean(latestTrigger?.id) && !handoffOnly;
  const hasTrigger = Boolean(latestTrigger?.id);
  const isEnabled = Boolean(latestTrigger?.enabled);
  const statusTone = !hasTrigger ? "neutral" : isEnabled ? "ok" : "off";
  const statusLabel = !hasTrigger
    ? latestTriggerState || apiStatus || t("apiIdle")
    : isEnabled
      ? t("enabled")
      : t("disabled");

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
      <section className={`automation-hero automation-hero--${statusTone}`} aria-labelledby="automation-title">
        <div className="automation-hero__content">
          <div className="automation-hero__copy">
            <span className="automation-hero__icon" aria-hidden="true">
              <Bot size={22} />
            </span>
            <div>
              <span className="automation-hero__eyebrow">{t("automationRoute")}</span>
              <h2 id="automation-title">{t("title")}</h2>
              <p>{t("subtitle")}</p>
            </div>
          </div>

          <div className="automation-hero__facts">
            <span className="automation-hero__fact">
              <span className="automation-hero__fact-label">{t("currentPrice")}</span>
              <strong>{hasPrice ? currentPrice : "—"}</strong>
              {hasPrice ? (
                <small className="automation-hero__fact-caption">{t("priceFreshnessCaption")}</small>
              ) : null}
            </span>
            <span className={`automation-hero__fact automation-hero__fact--status automation-hero__fact--${statusTone}`}>
              <span className="automation-hero__fact-label">{t("triggerStatus")}</span>
              <strong>
                <span className="automation-status-badge__dot" aria-hidden="true" />
                {statusLabel}
              </strong>
            </span>
          </div>
        </div>

        <figure className="automation-hero__visual">
          <img src="./automation-workbench.jpg" alt="" loading="eager" decoding="sync" />
          <figcaption>
            <span>{t("recipeModeValue")}</span>
            <strong>{selectedActionLabel}</strong>
          </figcaption>
        </figure>
      </section>

      <section className="automation-flow-board" aria-label={t("recipePreview")}>
        <div className="automation-flow-board__track" aria-hidden="true">
          <span />
          <span className="automation-flow-board__pulse automation-flow-board__pulse--one" />
          <span className="automation-flow-board__pulse automation-flow-board__pulse--two" />
        </div>
        <div className="automation-flow-node automation-flow-node--feed">
          <span className="automation-flow-node__icon"><Activity size={18} aria-hidden="true" /></span>
          <div>
            <span>{t("currentPrice")}</span>
            <strong>{hasPrice ? currentPrice : t("targetPricePlaceholder")}</strong>
          </div>
        </div>
        <ArrowRight className="automation-flow-board__arrow" size={18} aria-hidden="true" />
        <div className="automation-flow-node automation-flow-node--schedule">
          <span className="automation-flow-node__icon"><CalendarClock size={18} aria-hidden="true" /></span>
          <div>
            <span>{t("scheduleCadence")}</span>
            <strong>{selectedScheduleLabel}</strong>
          </div>
        </div>
        <ArrowRight className="automation-flow-board__arrow" size={18} aria-hidden="true" />
        <div className="automation-flow-node automation-flow-node--action">
          <span className="automation-flow-node__icon">{actionIcon(actionName)}</span>
          <div>
            <span>{t("actionPlan")}</span>
            <strong>{selectedActionLabel}</strong>
          </div>
        </div>
        <ArrowRight className="automation-flow-board__arrow" size={18} aria-hidden="true" />
        <div className={`automation-flow-node automation-flow-node--status automation-flow-node--${statusTone}`}>
          <span className="automation-flow-node__icon"><Power size={18} aria-hidden="true" /></span>
          <div>
            <span>{t("triggerStatus")}</span>
            <strong>{statusLabel}</strong>
          </div>
        </div>
      </section>

      <section className="automation-workspace">
        <form
          className="automation-panel automation-panel--builder"
          aria-label={t("recipeBuilder")}
          onSubmit={(event) => {
            event.preventDefault();
            void dispatch("registerTrigger");
          }}
        >
          <div className="automation-panel__head">
            <span className="automation-panel__title">{t("recipeBuilder")}</span>
          </div>

          <div className="automation-recipe-composer">
            <section className="automation-recipe-preview" aria-label={t("recipePreview")}>
              <div className="automation-recipe-preview__body">
                <span>{t("recipeModeValue")}</span>
                <strong>{t("recipePreviewLine", { asset, price: targetPrice || t("targetPricePlaceholder") })}</strong>
                <div className="automation-recipe-preview__steps">
                  <span><Target size={13} aria-hidden="true" />{asset} / {targetPrice || t("targetPricePlaceholder")}</span>
                  <span><Clock3 size={13} aria-hidden="true" />{selectedScheduleLabel}</span>
                  <span><Zap size={13} aria-hidden="true" />{selectedActionLabel}</span>
                </div>
              </div>
            </section>

            <section className="automation-composer-section" aria-label={t("asset")}>
              <span className="automation-composer-label">{t("asset")}</span>
              <div className="automation-asset-grid" role="radiogroup" aria-label={t("asset")}>
                {ASSET_OPTIONS.map((option) => {
                  const active = asset === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`automation-asset-card${active ? " is-selected" : ""}`}
                      onClick={() => { if (state.asset) state.asset.set(option.value); }}
                    >
                      <span className="automation-asset-card__orb" aria-hidden="true">
                        {option.value.slice(0, 1)}
                      </span>
                      <strong>{option.value}</strong>
                      <span>{t(option.hintKey)}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="automation-price-rule" aria-label={t("priceRule")}>
              <div className="automation-price-rule__copy">
                <span className="automation-composer-label">{t("priceRule")}</span>
                <strong>{t("priceRuleLine", { asset })}</strong>
              </div>
              <label className="automation-threshold-control">
                <span>{t("targetPrice")}</span>
                <span className="automation-threshold-control__input">
                  <input
                    value={targetPrice}
                    type="number"
                    min={0}
                    inputMode="decimal"
                    placeholder={t("targetPricePlaceholder")}
                    onChange={(event) => { if (state.targetPrice) state.targetPrice.set(event.currentTarget.value); }}
                  />
                  <b>{asset}</b>
                </span>
              </label>
            </section>

            <section className="automation-composer-section" aria-label={t("schedule")}>
              <span className="automation-composer-label">{t("scheduleCadence")}</span>
              <div className="automation-schedule-presets" role="radiogroup" aria-label={t("schedule")}>
                {SCHEDULE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    role="radio"
                    aria-checked={schedule === preset.value}
                    aria-label={t(preset.labelKey)}
                    className={`automation-preset${schedule === preset.value ? " automation-preset--active" : ""}`}
                    onClick={() => { if (state.schedule) state.schedule.set(preset.value); }}
                  >
                    <Clock3 size={14} aria-hidden="true" />
                    {t(preset.labelKey)}
                  </button>
                ))}
              </div>
              <details className="automation-advanced-field">
                <summary>
                  <span>{t("schedulePresetCustom")}</span>
                  <ChevronDown size={15} aria-hidden="true" />
                </summary>
                <div className="automation-schedule-field">
                  <NeoInput
                    value={schedule}
                    label={t("schedule")}
                    placeholder={t("schedulePlaceholder")}
                    onChange={(val) => { if (state.schedule) state.schedule.set(val); }}
                  />
                </div>
              </details>
            </section>

            <section className="automation-composer-section" aria-label={t("actionName")}>
              <span className="automation-composer-label">{t("actionPlan")}</span>
              <div className="automation-action-grid" role="radiogroup" aria-label={t("actionName")}>
                {ACTION_PRESETS.map((preset) => {
                  const active = actionSelectValue !== CUSTOM_ACTION && actionName === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={t(preset.labelKey)}
                      className={`automation-action-card${active ? " is-selected" : ""}`}
                      onClick={() => {
                        setCustomActionMode(false);
                        if (state.actionName) state.actionName.set(preset.value);
                      }}
                    >
                      <span className="automation-action-card__icon" aria-hidden="true">
                        {actionIcon(preset.value)}
                      </span>
                      <strong>{t(preset.labelKey)}</strong>
                      <span>{t(preset.hintKey)}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  role="radio"
                  aria-checked={actionSelectValue === CUSTOM_ACTION}
                  aria-label={t("actionCustom")}
                  className={`automation-action-card${actionSelectValue === CUSTOM_ACTION ? " is-selected" : ""}`}
                  onClick={() => setCustomActionMode(true)}
                >
                  <span className="automation-action-card__icon" aria-hidden="true">
                    <Zap size={19} />
                  </span>
                  <strong>{t("actionCustom")}</strong>
                  <span>{t("actionCustomHint")}</span>
                </button>
              </div>
              {actionSelectValue === CUSTOM_ACTION && (
                <NeoInput
                  value={actionName}
                  label={t("actionCustomLabel")}
                  placeholder={t("actionNamePlaceholder")}
                  onChange={(val) => { if (state.actionName) state.actionName.set(val); }}
                />
              )}
            </section>
          </div>

          {lastError ? (
            <div className="automation-panel__alert" role="alert">
              {lastError}
            </div>
          ) : null}

          <div className="automation-actions automation-actions--primary">
            <NeoButton variant="primary" loading={isRegistering} onClick={() => dispatch("registerTrigger")}>
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>{t("registerTrigger")}</span>
            </NeoButton>
          </div>

          <div className="automation-actions automation-actions--secondary">
            <NeoButton variant="secondary" size="sm" loading={isRequesting} onClick={() => dispatch("fetchCurrentPrice")}>
              <RefreshCw size={15} aria-hidden="true" />
              <span>{t("fetchPrice")}</span>
            </NeoButton>
            <NeoButton variant="secondary" size="sm" loading={isRequesting} onClick={() => dispatch("buildRecipePayload")}>
              <ListChecks size={15} aria-hidden="true" />
              <span>{t("buildRecipe")}</span>
            </NeoButton>
          </div>

          <div className="automation-panel__hint automation-panel__hint--info">
            {t("automationGatewayHint")}
          </div>
          <div className="automation-panel__hint">
            {t("executionCostHint")}
          </div>
        </form>

        <div className="automation-panel automation-panel--status">
          <div className="automation-panel__head automation-panel__head--row">
            <span className="automation-panel__title">
              {t("triggerStatus")}
              {triggerCount > 0 ? (
                <span className="automation-panel__count">{triggerCount}</span>
              ) : null}
            </span>
            <NeoButton variant="ghost" size="sm" loading={isRefreshing} onClick={() => dispatch("refreshTriggers")}>
              <RefreshCw size={15} aria-hidden="true" />
              <span>{t("refreshTriggers")}</span>
            </NeoButton>
          </div>

          {hasTrigger ? (
            <>
              <div className="automation-trigger-card">
                <div>
                  <span>{t("latestTriggerId")}</span>
                  <strong>{latestTriggerId ? shortId(latestTriggerId) : "—"}</strong>
                </div>
                <div>
                  <span>{t("nextExecution")}</span>
                  {/* A handoff-only intent has no keeper, so it has no real
                      scheduled run — say so instead of showing a next-execution
                      time that implies the automation will fire. */}
                  <strong>
                    {handoffOnly
                      ? t("nextExecutionNotScheduled")
                      : hasNextExecution
                        ? nextExecution
                        : "—"}
                  </strong>
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
                  <span>{t("copyPayload")}</span>
                </NeoButton>
              </div>

              {handoffOnly ? (
                <>
                  <div className="automation-panel__alert automation-panel__alert--warn" role="alert">
                    <strong>{t("executorUnavailableTitle")}</strong>
                    <span>{t("executorUnavailableBody")}</span>
                  </div>
                  <div className="automation-panel__note">
                    {t("verifyBeforeOperate")}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <>
              <div className="automation-empty automation-empty--status">
                <span className="automation-empty__icon" aria-hidden="true">
                  <Power size={20} />
                </span>
                <p>{t("noTriggerSelected")}</p>
              </div>

              <div className="automation-route">
                <span className="automation-route__label">{t("automationRoute")}</span>
                <ol className="automation-route__steps">
                  <li><span aria-hidden="true">1</span>{t("routePrice")}</li>
                  <li><span aria-hidden="true">2</span>{t("routeRegister")}</li>
                  <li><span aria-hidden="true">3</span>{t("routeOperate")}</li>
                </ol>
              </div>
            </>
          )}

          {/* Manage all triggers — select to operate, delete to remove. The
              edge layer exposes delete/update/executions; only the latest used
              to be operable, leaving older triggers invisible. */}
          {triggers.length > 0 && (
            <div className="automation-trigger-list" aria-label={t("manageTriggers")}>
              <span className="automation-trigger-list__title">{t("manageTriggers")}</span>
              {triggers.map((trigger) => {
                const isActive = trigger.id === latestTrigger?.id;
                return (
                  <div
                    key={trigger.id}
                    className={`automation-trigger-row${isActive ? " automation-trigger-row--active" : ""}`}
                  >
                    <button
                      type="button"
                      className="automation-trigger-row__main"
                      aria-pressed={isActive}
                      onClick={() => dispatch("selectTrigger", trigger.id)}
                    >
                      <span className="automation-trigger-row__name">{trigger.name || shortId(trigger.id)}</span>
                      <span className="automation-trigger-row__meta">
                        <span className={`automation-trigger-row__state automation-trigger-row__state--${trigger.enabled ? "on" : "off"}`}>
                          {trigger.enabled ? t("enabled") : t("disabled")}
                        </span>
                        {isActive && (
                          <span className="automation-trigger-row__active">{t("activeTrigger")}</span>
                        )}
                      </span>
                    </button>
                    <NeoButton
                      variant="ghost"
                      size="sm"
                      loading={isRegistering && isActive}
                      aria-label={`${t("deleteTrigger")} ${trigger.name || trigger.id}`}
                      onClick={() => dispatch("deleteTrigger", trigger.id)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </NeoButton>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {hasDetails || datafeedHash || oracleHash ? (
        <details className="automation-details" open>
          <summary className="automation-details__summary">
            <span>{t("payload")}</span>
            <span className="automation-details__hint">
              {t("detailsLabel")}
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </summary>
          <div className="automation-details__body">
            <div className="automation-details__config">
              <div>
                <span>{t("network")}</span>
                <strong>{networkDisplay}</strong>
              </div>
              <div>
                <span>{t("datafeedHash")}</span>
                <strong>{datafeedHash ? shortId(datafeedHash) : "—"}</strong>
              </div>
              <div>
                <span>{t("oracleHash")}</span>
                <strong>{oracleHash ? shortId(oracleHash) : "—"}</strong>
              </div>
            </div>
            {hasDetails ? (
              <div className="automation-details__grid">
                <div className="automation-details__block">
                  <span className="automation-details__label">
                    {t("payload")}
                    {" · "}
                    {hasPayload ? t("latestResult") : t("payloadEmpty")}
                  </span>
                  {hasPayload ? (
                    <pre className="automation-json">{renderedPayload}</pre>
                  ) : (
                    <div className="automation-empty">{t("payloadEmpty")}</div>
                  )}
                </div>
                {hasTriggerRequest ? (
                  <div className="automation-details__block">
                    <span className="automation-details__label">{t("triggerStatus")}</span>
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
