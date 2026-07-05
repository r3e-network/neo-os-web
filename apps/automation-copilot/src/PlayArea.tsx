/** PlayArea.tsx - Automation Copilot (v2) - Trigger console scene */
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import { Activity, BellRing, Bot, CheckCircle2, Gauge } from "lucide-react";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

function humanizeActionName(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num } = useStateBindings(state);
  const asset = str("asset", "NEO");
  const targetPrice = str("targetPrice", "20");
  const currentPrice = str("currentPrice", "N/A");
  const schedule = str("schedule", "");
  const actionName = str("actionName", "auto_repay_self_loan");
  const networkDisplay = str("networkDisplay", "Neo N3");
  const latestTriggerState = str("latestTriggerState", "Draft");
  const apiStatus = str("apiStatus", "");
  const triggerCount = num("triggerCount", 0);
  const isRegistering = bool("isRegistering");
  const isRefreshing = bool("isRefreshing");
  const isRequesting = bool("isRequesting");
  const actionLabel = humanizeActionName(actionName);
  const assetSymbol = asset.trim().toUpperCase();
  const assetVariant = assetSymbol === "GAS" ? "gas" : assetSymbol === "NEO" ? "neo" : "accent";
  const triggerState = latestTriggerState.toLowerCase();
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
  const hasPrice = currentPrice.trim() && currentPrice !== "N/A";
  const priceValue = hasPrice ? currentPrice : t("latestPrice");
  const targetValue = targetPrice.trim() || t("targetPrice");
  const sceneState = isRegistering
    ? "registering"
    : isRefreshing || isRequesting
      ? "syncing"
      : /enabled|active|live/.test(triggerState)
        ? "enabled"
        : "ready";

  const scene = (
    <div className="copilot-scene" data-state={sceneState}>
      <div className="copilot-scene__rule-board">
        <div className="copilot-scene__asset">
          <CoinArt size={58} variant={assetVariant} decorative />
          <div>
            <span>{t("asset")}</span>
            <strong>{assetSymbol || "NEO"}</strong>
            <em>{networkDisplay}</em>
          </div>
        </div>

        <div className="copilot-scene__price-gate" aria-label={t("priceRule")}>
          <div className="copilot-scene__meter">
            <span>{t("currentPrice")}</span>
            <strong>{priceValue}</strong>
          </div>
          <div className="copilot-scene__threshold">
            <span>{t("targetPrice")}</span>
            <strong>{targetValue}</strong>
          </div>
          <div className="copilot-scene__gauge" aria-hidden="true">
            <span className="copilot-scene__gauge-track" />
            <span className="copilot-scene__gauge-pulse" />
            <Gauge size={26} strokeWidth={2.3} />
          </div>
        </div>
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

      <div className="copilot-scene__action-card">
        <CheckCircle2 size={22} aria-hidden="true" />
        <div>
          <span>{t("actionPlan")}</span>
          <strong>{actionLabel}</strong>
          <small>{t("recipePreviewLine", { asset: assetSymbol || "NEO", price: targetValue })}</small>
        </div>
      </div>

      <p className="copilot-scene__status">{status}</p>
    </div>
  );

  return (
    <div className="automation-copilot-play-area mx2 mx2-cat-tool">
      <PlayStage
        category="tool"
        stage={{
          eyebrow: t("automationActions"),
          title: t("priceRule"),
          subtitle: t("docSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {latestTriggerState}
            </span>
          ),
        }}
        scene={scene}
        score={[
          { label: t("asset"), value: assetSymbol || "NEO", accent: true },
          { label: t("targetPrice"), value: targetPrice || t("targetPrice") },
          { label: t("currentPrice"), value: currentPrice },
          { label: t("triggerCount"), value: triggerCount },
        ]}
        actions={{
          primary: {
            label: isRegistering ? t("flowStateRegistering") : t("registerTrigger"),
            onClick: () => void dispatch("registerTrigger"),
            loading: isRegistering || isRefreshing,
          },
          secondary: [
            { label: t("fetchPrice"), onClick: () => void dispatch("fetchCurrentPrice") },
            { label: t("buildRecipe"), onClick: () => void dispatch("buildRecipePayload") },
          ],
        }}
        drawerToggleLabel={t("recipePreview")}
        drawer={{
          title: t("recipePreview"),
          children: (
            <dl className="copilot-detail-list">
              <div><dt>{t("asset")}</dt><dd>{assetSymbol || "NEO"}</dd></div>
              <div><dt>{t("targetPrice")}</dt><dd>{targetPrice || t("targetPrice")}</dd></div>
              <div><dt>{t("schedule")}</dt><dd>{schedule || t("schedulePresetEvery6h")}</dd></div>
              <div><dt>{t("actionPlan")}</dt><dd>{actionLabel}</dd></div>
            </dl>
          ),
        }}
      />
    </div>
  );
}
