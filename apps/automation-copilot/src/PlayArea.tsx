/** PlayArea.tsx - Automation Copilot - visual recipe studio */
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import {
  Activity,
  BellRing,
  Bot,
  CheckCircle2,
  Clock3,
  Copy,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Vault,
  WandSparkles,
} from "lucide-react";
import type { AutomationTrigger } from "./automationGateway";
import { isLocalAutomationIntent } from "./automationGateway";
import {
  parseAutomationActionName,
  parseFiveFieldCron,
  parsePositiveTargetPrice,
} from "./composables/useAutomationCopilot";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const automationWorkbenchArt = new URL(
  "../public/automation-workbench.webp",
  import.meta.url,
).href;

const SCHEDULES = {
  hourly: "0 * * * *",
  every6h: "0 */6 * * *",
  daily: "0 9 * * *",
} as const;

const KNOWN_ACTIONS = [
  "auto_repay_self_loan",
  "rebalance_vault",
  "claim_rewards",
] as const;

// Lightweight semantic adapters keep the shared mx2 visual language without
// shipping the full Semi UI runtime into this focused embedded MiniApp.
function OpenUiProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function OpenUiPanel({
  className,
  icon,
  title,
  subtitle,
  children,
}: {
  className?: string;
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  const titleId = useId();
  return (
    <section className={["mx2-open-panel", className].filter(Boolean).join(" ")} role="group" aria-labelledby={titleId}>
      <header className="mx2-open-panel__head">
        {icon ? <span className="mx2-open-panel__icon">{icon}</span> : null}
        <span className="mx2-open-panel__copy">
          <strong id={titleId}>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </span>
      </header>
      <div className="mx2-open-panel__body">{children}</div>
    </section>
  );
}

function OpenUiNotice({
  icon,
  title,
  children,
  type = "info",
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  type?: "info" | "warning" | "error";
}) {
  return (
    <div className="mx2-open-notice copilot-open-notice" data-tone={type} role={type === "error" ? "alert" : "status"}>
      {icon ? <span className="mx2-open-notice__icon">{icon}</span> : null}
      <span className="mx2-open-notice__copy">
        <strong>{title}</strong>
        {children ? <span>{children}</span> : null}
      </span>
    </div>
  );
}

function OpenUiTextField({
  className,
  label,
  hint,
  mono,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
  label: ReactNode;
  hint?: ReactNode;
  mono?: boolean;
}) {
  const generatedId = useId();
  const id = inputProps.id ?? `copilot-field-${generatedId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <label className={["mx2-open-field", mono ? "mx2-open-field--mono" : "", className].filter(Boolean).join(" ")} htmlFor={id}>
      <span className="mx2-open-field__label">{label}</span>
      <span className="copilot-native-input">
        <input {...inputProps} id={id} aria-describedby={hintId} />
      </span>
      {hint ? <span id={hintId} className="mx2-open-field__hint">{hint}</span> : null}
    </label>
  );
}

function OpenUiSegmented({
  className,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  className?: string;
  label: ReactNode;
  value: string;
  options: Array<{ label: ReactNode; value: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const labelId = useId();
  return (
    <div className={["mx2-open-field", "mx2-open-field--segmented", className].filter(Boolean).join(" ")}>
      <span id={labelId} className="mx2-open-field__label">{label}</span>
      <div className="copilot-native-segmented" role="radiogroup" aria-labelledby={labelId}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            data-active={value === option.value ? "true" : undefined}
            onClick={() => onChange(option.value)}
            disabled={disabled}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function humanizeActionName(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function setObservableState(state: ObservableState, key: string, value: unknown) {
  const target = state[key] as { set?: (next: unknown) => void } | undefined;
  target?.set?.(value);
}

function scheduleMode(value: string) {
  if (value === SCHEDULES.hourly) return "hourly";
  if (value === SCHEDULES.every6h) return "every6h";
  if (value === SCHEDULES.daily) return "daily";
  return "custom";
}

function formatTriggerTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function PlayArea({ t, state, dispatch }: P) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const { str, bool, num, val } = useStateBindings(state);
  const asset = str("asset", "NEO");
  const targetPrice = str("targetPrice", "20");
  const currentPrice = str("currentPrice", t("notAvailable"));
  const priceFreshnessState = str("priceFreshnessState", "unloaded").toLowerCase();
  const priceDataTimestamp = num("priceDataTimestamp", 0);
  const schedule = str("schedule", SCHEDULES.every6h);
  const actionName = str("actionName", "auto_repay_self_loan");
  const networkDisplay = str("networkDisplay", "Neo N3");
  const latestTriggerState = str("latestTriggerState", "");
  const latestTriggerMode = str("latestTriggerMode", "draft").toLowerCase();
  const apiStatus = str("apiStatus", "");
  const lastError = str("lastError", "");
  const triggerCount = num("triggerCount", 0);
  const isRegistering = bool("isRegistering");
  const isRefreshing = bool("isRefreshing");
  const isRequesting = bool("isRequesting");
  const triggersLoaded = bool("triggersLoaded");
  const triggers = val<AutomationTrigger[]>("triggers", []) ?? [];
  const latestTrigger = val<AutomationTrigger>("latestTrigger");
  const actionLabel = humanizeActionName(actionName);
  const assetSymbol = asset.trim().toUpperCase();
  const assetVariant = assetSymbol === "GAS" ? "gas" : assetSymbol === "NEO" ? "neo" : "accent";
  const triggerState = latestTriggerMode;
  const selectedScheduleMode = scheduleMode(schedule);
  const targetValid = parsePositiveTargetPrice(targetPrice) !== null;
  const scheduleValid = parseFiveFieldCron(schedule) !== null;
  const actionValid = parseAutomationActionName(actionName) !== null;
  const isBusy = isRegistering || isRefreshing || isRequesting;
  const isHandoff = isLocalAutomationIntent(latestTrigger);
  const hasKnownTriggerState = triggersLoaded || triggerCount > 0;
  const flowStateKey = isRegistering
    ? "flowStateRegistering"
    : isRefreshing || isRequesting
      ? "flowStateRefreshing"
      : /enabled|active|live/.test(triggerState)
        ? "flowStateEnabled"
        : /disabled|paused/.test(triggerState)
          ? "flowStateDisabled"
          : "flowStateDraft";
  const status = apiStatus || t(flowStateKey);
  const hasPrice = currentPrice.trim() && currentPrice !== "N/A" && currentPrice !== t("notAvailable");
  const priceReady = Boolean(hasPrice) && priceFreshnessState === "fresh";
  const priceFreshnessLabel = priceFreshnessState === "fresh"
    ? t("priceFresh")
    : priceFreshnessState === "stale"
      ? t("priceStaleShort")
      : priceFreshnessState === "unknown"
        ? t("priceFreshnessUnknownShort")
        : t("priceNotLoaded");
  const priceUpdatedAt = priceDataTimestamp > 0
    ? formatTriggerTime(new Date(priceDataTimestamp * 1000).toISOString())
    : "—";
  const priceValue = hasPrice ? currentPrice : t("latestPrice");
  const targetValue = targetPrice.trim() ? `$${targetPrice.trim()}` : t("targetPrice");
  const sceneState = isRegistering
    ? "registering"
    : isRefreshing || isRequesting
      ? "syncing"
      : /enabled|active|live/.test(triggerState)
        ? "enabled"
        : "ready";

  const setAsset = (value: string) => {
    if (value === assetSymbol) return;
    setObservableState(state, "asset", value);
    setObservableState(state, "priceFreshnessState", "unloaded");
    setObservableState(state, "lastError", "");
    setObservableState(state, "apiStatus", t("priceRequired"));
  };
  const setTargetPrice = (value: string) => setObservableState(state, "targetPrice", value);
  const setSchedule = (value: string) => setObservableState(state, "schedule", value);
  const setActionName = (value: string) => setObservableState(state, "actionName", value);

  const applyPreset = (preset: "protect" | "rebalance" | "rewards") => {
    if (preset === "protect") {
      setAsset("NEO");
      setTargetPrice("20");
      setSchedule(SCHEDULES.every6h);
      setActionName("auto_repay_self_loan");
      return;
    }
    if (preset === "rebalance") {
      setAsset("NEO");
      setTargetPrice("25");
      setSchedule(SCHEDULES.hourly);
      setActionName("rebalance_vault");
      return;
    }
    setAsset("GAS");
    setTargetPrice("8");
    setSchedule(SCHEDULES.daily);
    setActionName("claim_rewards");
  };

  const selectedPreset = actionName === "auto_repay_self_loan" && assetSymbol === "NEO"
    ? "protect"
    : actionName === "rebalance_vault"
      ? "rebalance"
      : actionName === "claim_rewards" && assetSymbol === "GAS"
        ? "rewards"
        : "custom";

  const scene = (
    <div className="copilot-scene" data-state={sceneState}>
      <div className="copilot-scene__hero">
        <figure className="copilot-scene__art-card">
          <img src={automationWorkbenchArt} alt={t("automationWorkbenchAlt")} draggable={false} />
          <figcaption>
            <WandSparkles size={17} strokeWidth={2.35} aria-hidden="true" />
            <span>{t("automationWorkbenchCaption")}</span>
          </figcaption>
        </figure>

        <div className="copilot-scene__console">
          <div className="copilot-scene__asset-switch" aria-label={t("chooseAsset")}>
            {["NEO", "GAS"].map((symbol) => (
              <button
                key={symbol}
                type="button"
                data-active={assetSymbol === symbol ? "true" : undefined}
                onClick={() => setAsset(symbol)}
                disabled={isBusy}
              >
                <CoinArt size={30} variant={symbol === "GAS" ? "gas" : "neo"} decorative />
                <span>{symbol}</span>
              </button>
            ))}
          </div>

          <div className="copilot-scene__rule-board">
            <div className="copilot-scene__asset">
              <CoinArt size={52} variant={assetVariant} decorative />
              <div>
                <span>{t("watchingAsset")}</span>
                <strong>{assetSymbol || "NEO"}</strong>
                <em>{networkDisplay}</em>
              </div>
            </div>

            <div className="copilot-scene__price-gate" aria-label={t("priceRule")}>
              <div className="copilot-scene__meter">
                <span>{t("currentPrice")}</span>
                <strong>{priceValue}</strong>
                <small data-freshness={priceFreshnessState}>{priceFreshnessLabel}</small>
              </div>
              <div className="copilot-scene__gauge" aria-hidden="true">
                <span className="copilot-scene__gauge-track" />
                <span className="copilot-scene__gauge-pulse" />
                <Gauge size={24} strokeWidth={2.3} />
              </div>
              <div className="copilot-scene__threshold">
                <span>{t("targetPrice")}</span>
                <strong>{targetValue}</strong>
              </div>
            </div>
          </div>

          <div className="copilot-scene__action-card">
            <CheckCircle2 size={22} aria-hidden="true" />
            <div>
              <span>{t("actionPlan")}</span>
              <strong>{actionLabel}</strong>
              <small>{t("recipePreviewLine", { asset: assetSymbol || "NEO", price: targetValue })}</small>
            </div>
          </div>
        </div>
      </div>

      <div className="copilot-scene__preset-deck" aria-label={t("recipePresets")}>
        <button type="button" data-active={selectedPreset === "protect" ? "true" : undefined} onClick={() => applyPreset("protect")} disabled={isBusy}>
          <ShieldCheck size={20} strokeWidth={2.25} aria-hidden="true" />
          <span><strong>{t("presetProtectTitle")}</strong><small>{t("presetProtectHint")}</small></span>
        </button>
        <button type="button" data-active={selectedPreset === "rebalance" ? "true" : undefined} onClick={() => applyPreset("rebalance")} disabled={isBusy}>
          <Vault size={20} strokeWidth={2.25} aria-hidden="true" />
          <span><strong>{t("presetRebalanceTitle")}</strong><small>{t("presetRebalanceHint")}</small></span>
        </button>
        <button type="button" data-active={selectedPreset === "rewards" ? "true" : undefined} onClick={() => applyPreset("rewards")} disabled={isBusy}>
          <Sparkles size={20} strokeWidth={2.25} aria-hidden="true" />
          <span><strong>{t("presetRewardsTitle")}</strong><small>{t("presetRewardsHint")}</small></span>
        </button>
      </div>

      <div className="copilot-scene__flow" aria-label={t("automationRoute")}>
        <div className="copilot-scene__node" data-active={hasPrice ? "true" : undefined}>
          <Activity size={18} aria-hidden="true" />
          <span>{t("routePrice")}</span>
        </div>
        <span className="copilot-scene__connector" aria-hidden="true" />
        <div className="copilot-scene__node" data-active={isRegistering || triggerCount > 0 ? "true" : undefined}>
          <BellRing size={18} aria-hidden="true" />
          <span>{t("routeRegister")}</span>
        </div>
        <span className="copilot-scene__connector" aria-hidden="true" />
        <div className="copilot-scene__node" data-active={/enabled|active|live/.test(triggerState) ? "true" : undefined}>
          <Bot size={18} aria-hidden="true" />
          <span>{t("routeOperate")}</span>
        </div>
      </div>

      <p className="copilot-scene__status" data-error={lastError ? "true" : undefined} aria-live="polite">
        {lastError || status}
      </p>
    </div>
  );

  const drawer = (
    <div className="copilot-drawer">
      <OpenUiPanel
        className="copilot-drawer__panel copilot-drawer__panel--builder"
        icon={<WandSparkles size={18} strokeWidth={2.3} aria-hidden="true" />}
        title={t("recipeStudio")}
        subtitle={t("recipeStudioHint")}
      >
        <div className="copilot-drawer__grid">
          <OpenUiSegmented
            className="copilot-drawer__wide"
            label={t("asset")}
            value={assetSymbol === "GAS" ? "GAS" : "NEO"}
            onChange={setAsset}
            disabled={isBusy}
            options={[
              { label: "NEO", value: "NEO" },
              { label: "GAS", value: "GAS" },
            ]}
          />
          <OpenUiTextField
            label={t("targetPrice")}
            value={targetPrice}
            onChange={(event) => setTargetPrice(event.target.value)}
            inputMode="decimal"
            hint={!targetValid ? t("targetPriceInvalid") : t("targetPriceHint")}
            aria-invalid={!targetValid || undefined}
            disabled={isBusy}
          />
          <OpenUiSegmented
            className="copilot-drawer__wide"
            label={t("scheduleCadence")}
            value={selectedScheduleMode}
            onChange={(value) => {
              if (value === "hourly") setSchedule(SCHEDULES.hourly);
              else if (value === "every6h") setSchedule(SCHEDULES.every6h);
              else if (value === "daily") setSchedule(SCHEDULES.daily);
              else if (selectedScheduleMode !== "custom") setSchedule("15 */4 * * *");
            }}
            disabled={isBusy}
            options={[
              { label: t("schedulePresetHourly"), value: "hourly" },
              { label: t("schedulePresetEvery6h"), value: "every6h" },
              { label: t("schedulePresetDaily"), value: "daily" },
              { label: t("schedulePresetCustom"), value: "custom" },
            ]}
          />
          <OpenUiTextField
            className="copilot-drawer__wide"
            label={t("exactSchedule")}
            value={schedule}
            onChange={(event) => setSchedule(event.target.value)}
            placeholder={t("schedulePlaceholder")}
            hint={!scheduleValid ? t("scheduleInvalid") : t("exactScheduleHint")}
            aria-invalid={!scheduleValid || undefined}
            disabled={isBusy}
            mono
          />
        </div>

        <div className="copilot-action-picker" role="radiogroup" aria-label={t("actionPlan")}>
          {[
            { value: "auto_repay_self_loan", title: t("actionRepaySelfLoan"), hint: t("actionRepaySelfLoanHint"), icon: ShieldCheck },
            { value: "rebalance_vault", title: t("actionRebalanceVault"), hint: t("actionRebalanceVaultHint"), icon: Vault },
            { value: "claim_rewards", title: t("actionClaimRewards"), hint: t("actionClaimRewardsHint"), icon: Sparkles },
          ].map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={actionName === option.value}
                data-active={actionName === option.value ? "true" : undefined}
                onClick={() => setActionName(option.value)}
                disabled={isBusy}
              >
                <Icon size={18} strokeWidth={2.25} aria-hidden="true" />
                <span><strong>{option.title}</strong><small>{option.hint}</small></span>
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={!KNOWN_ACTIONS.includes(actionName as typeof KNOWN_ACTIONS[number])}
            data-active={!KNOWN_ACTIONS.includes(actionName as typeof KNOWN_ACTIONS[number]) ? "true" : undefined}
            onClick={() => setActionName("custom_workflow")}
            disabled={isBusy}
          >
            <Bot size={18} strokeWidth={2.25} aria-hidden="true" />
            <span><strong>{t("actionCustom")}</strong><small>{t("actionCustomHint")}</small></span>
          </button>
        </div>

        {!KNOWN_ACTIONS.includes(actionName as typeof KNOWN_ACTIONS[number]) && (
          <OpenUiTextField
            className="copilot-drawer__custom-action"
            label={t("actionCustomLabel")}
            value={actionName}
            onChange={(event) => setActionName(event.target.value)}
            placeholder={t("actionNamePlaceholder")}
            hint={!actionValid ? t("actionNameInvalid") : t("actionCustomHint")}
            aria-invalid={!actionValid || undefined}
            disabled={isBusy}
            mono
          />
        )}

        <div className="copilot-drawer__builder-actions">
          <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("buildRecipePayload")} disabled={!targetValid || !scheduleValid || !actionValid || isBusy}>
            <WandSparkles size={16} strokeWidth={2.3} aria-hidden="true" /> {t("buildRecipe")}
          </button>
        </div>
      </OpenUiPanel>

      <OpenUiPanel
        className="copilot-drawer__panel copilot-drawer__panel--triggers"
        icon={<Clock3 size={18} strokeWidth={2.3} aria-hidden="true" />}
        title={t("manageTriggers")}
        subtitle={t("manageTriggersHint")}
      >
        <div className="copilot-trigger-toolbar">
          <span>{t("triggerCountValue", { count: hasKnownTriggerState ? triggers.length : "—" })}</span>
          <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("refreshTriggers")} disabled={isBusy}>
            <RefreshCw size={15} strokeWidth={2.3} aria-hidden="true" /> {t("refreshTriggers")}
          </button>
        </div>

        {isHandoff && latestTrigger && (
          <OpenUiNotice icon={<BellRing size={17} strokeWidth={2.3} aria-hidden="true" />} title={t("executorUnavailableTitle")} type="warning">
            <span>{t("executorUnavailableBody")}</span>
            <button type="button" className="copilot-notice-action" onClick={() => void dispatch("copyTriggerRequest")}>
              <Copy size={14} strokeWidth={2.3} aria-hidden="true" /> {t("copyTriggerRequest")}
            </button>
          </OpenUiNotice>
        )}

        {lastError && (
          <OpenUiNotice icon={<Activity size={17} strokeWidth={2.3} aria-hidden="true" />} title={t("automationErrorTitle")} type="error">
            {lastError}
          </OpenUiNotice>
        )}

        {triggers.length > 0 ? (
          <ul className="copilot-trigger-list">
            {triggers.map((trigger) => {
              const active = latestTrigger?.id === trigger.id;
              return (
                <li key={trigger.id} data-active={active ? "true" : undefined}>
                  <button type="button" className="copilot-trigger-list__select" onClick={() => void dispatch("selectTrigger", trigger.id)}>
                    <span className="copilot-trigger-list__state" data-enabled={trigger.enabled ? "true" : undefined} aria-hidden="true" />
                    <span>
                      <strong>{trigger.name}</strong>
                      <small>{t("nextExecutionValue", { time: formatTriggerTime(trigger.next_execution) })}</small>
                    </span>
                    {active && <em>{t("activeTrigger")}</em>}
                  </button>
                  <div className="copilot-trigger-list__actions">
                    {active && (
                      <button type="button" onClick={() => void dispatch("toggleLatestTrigger")} disabled={isBusy || isLocalAutomationIntent(trigger)}>
                        {trigger.enabled ? t("disableTrigger") : t("enableTrigger")}
                      </button>
                    )}
                    <button
                      type="button"
                      data-confirm={deleteConfirmId === trigger.id ? "true" : undefined}
                      onClick={() => {
                        if (deleteConfirmId !== trigger.id) {
                          setDeleteConfirmId(trigger.id);
                          return;
                        }
                        setDeleteConfirmId(null);
                        void dispatch("deleteTrigger", trigger.id);
                      }}
                      disabled={isBusy}
                      aria-label={`${deleteConfirmId === trigger.id ? t("confirmDeleteTrigger") : t("deleteTrigger")} ${trigger.name}`}
                    >
                      <Trash2 size={14} strokeWidth={2.3} aria-hidden="true" /> {deleteConfirmId === trigger.id ? t("confirmDeleteTrigger") : t("deleteTrigger")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="copilot-trigger-list__empty">{triggersLoaded ? t("noTriggers") : t("triggersNotLoaded")}</p>
        )}
      </OpenUiPanel>

      <OpenUiPanel
        className="copilot-drawer__panel copilot-drawer__panel--summary"
        icon={<CheckCircle2 size={18} strokeWidth={2.3} aria-hidden="true" />}
        title={t("recipePreview")}
        subtitle={t("automationGatewayHint")}
      >
        <dl className="copilot-detail-list">
          <div><dt>{t("asset")}</dt><dd>{assetSymbol || "NEO"}</dd></div>
          <div><dt>{t("targetPrice")}</dt><dd>{targetValue}</dd></div>
          <div><dt>{t("feedFreshness")}</dt><dd>{priceFreshnessLabel}</dd></div>
          <div><dt>{t("priceUpdatedAt")}</dt><dd>{priceUpdatedAt}</dd></div>
          <div><dt>{t("schedule")}</dt><dd>{schedule}</dd></div>
          <div><dt>{t("actionPlan")}</dt><dd>{actionLabel}</dd></div>
        </dl>
        <button type="button" className="copilot-summary-copy" onClick={() => void dispatch("copyTriggerRequest")} disabled={!val("triggerRequest")}>
          <Copy size={14} strokeWidth={2.3} aria-hidden="true" /> {t("copyTriggerRequest")}
        </button>
      </OpenUiPanel>
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="automation-copilot-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("automationActions"),
            title: t("priceRule"),
            subtitle: t("subtitle"),
            badges: (
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {latestTriggerState || t("flowStateDraft")}
              </span>
            ),
          }}
          scene={scene}
          score={[
            { label: t("asset"), value: assetSymbol || "NEO", accent: true },
            { label: t("targetPrice"), value: targetValue },
            { label: t("currentPrice"), value: currentPrice },
            { label: t("triggerCount"), value: hasKnownTriggerState ? triggerCount : "—" },
          ]}
          actions={{
            primary: {
              label: priceReady
                ? isRegistering ? t("flowStateRegistering") : t("registerTrigger")
                : isRequesting ? t("flowStateRefreshing") : t("fetchPrice"),
              icon: priceReady
                ? <BellRing size={17} strokeWidth={2.35} aria-hidden="true" />
                : <Activity size={17} strokeWidth={2.35} aria-hidden="true" />,
              onClick: () => void dispatch(priceReady ? "registerTrigger" : "fetchCurrentPrice"),
              loading: priceReady ? isRegistering : isRequesting,
              disabled: priceReady
                ? !targetValid || !scheduleValid || !actionValid || isBusy
                : isBusy,
              hint: !priceReady
                ? hasPrice ? t("priceStale") : t("priceRequired")
                : !targetValid ? t("targetPriceInvalid")
                  : !scheduleValid ? t("scheduleInvalid")
                    : !actionValid ? t("actionNameInvalid")
                      : t("registerTriggerHint"),
            },
            secondary: priceReady ? [
              {
                label: t("refreshPrice"),
                icon: <RefreshCw size={17} strokeWidth={2.35} aria-hidden="true" />,
                onClick: () => void dispatch("fetchCurrentPrice"),
                disabled: isBusy,
              },
            ] : [],
          }}
          drawerToggleLabel={t("automationStudio")}
          drawer={{ title: t("automationStudio"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
