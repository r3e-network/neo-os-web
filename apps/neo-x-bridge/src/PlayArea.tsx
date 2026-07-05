/** PlayArea.tsx - Neo X Bridge (v2) - Bridge portal scene */
import { type ReactNode, useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import { ArrowRight, CheckCircle2, PackageCheck, RadioTower, ShieldCheck } from "lucide-react";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

interface BridgeTimelineStep {
  label?: string;
  labelKey?: string;
  detail?: string;
  detailKey?: string;
  detailParams?: Record<string, string>;
  state?: "done" | "active" | "waiting";
}

type BridgeMode = "asset" | "message" | "track";
type DrawerMode = "summary" | "timeline" | "resources";

function compact(value: string): string {
  const v = String(value || "").trim();
  if (!v || v === "-") return "-";
  return v.length > 18 ? `${v.slice(0, 8)}...${v.slice(-6)}` : v;
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, num, val } = useStateBindings(state);
  const [bridgeMode, setBridgeMode] = useState<BridgeMode>("asset");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("summary");
  const networkLabel = str("networkLabel", "Neo N3 / Neo X");
  const endpointLabel = str("endpointLabel", "AxLabs / BaneLabs");
  const bridgeEnvironment = str("bridgeEnvironment", "mainnet");
  const bridgeAppUrl = str("bridgeAppUrl", "");
  const lastStatus = str("lastStatus", t("statusReady"));
  const lastRoute = str("lastRoute", "Neo N3 -> Neo X");
  const lastKind = str("lastKind", "asset");
  const lastDigest = str("lastDigest", t("notAvailable"));
  const timeline = val<BridgeTimelineStep[]>("timeline", []) ?? [];
  const requestCount = num("requestCount", 0);
  const prepared = requestCount > 0;
  const visibleKind = bridgeMode === "message" ? "message" : lastKind;
  const isMessage = visibleKind === "message";
  const routeParts = lastRoute.split("->").map((part) => part.trim()).filter(Boolean);
  const sourceChain = routeParts[0] || "Neo N3";
  const targetChain = routeParts[1] || "Neo X";
  const visibleTimeline = timeline.slice(0, 3);
  const activeTimeline = visibleTimeline.find((step) => step.state === "active") ?? visibleTimeline.find((step) => step.state === "waiting") ?? visibleTimeline[0];
  const activeStepLabel = activeTimeline
    ? t(activeTimeline.labelKey || activeTimeline.label || "")
    : lastStatus;
  const activeStepDetail = activeTimeline
    ? t(activeTimeline.detailKey || activeTimeline.detail || "", activeTimeline.detailParams)
    : endpointLabel;
  const modeOptions: Array<{
    mode: BridgeMode;
    label: string;
    copy: string;
    actionLabel: string;
    icon: ReactNode;
  }> = [
    {
      mode: "asset",
      label: t("assetBridge"),
      copy: t("opAssetDesc"),
      actionLabel: t("opAssetAction"),
      icon: <PackageCheck size={16} aria-hidden="true" />,
    },
    {
      mode: "message",
      label: t("messageBridge"),
      copy: t("opMessageDesc"),
      actionLabel: t("opMessageAction"),
      icon: <RadioTower size={16} aria-hidden="true" />,
    },
    {
      mode: "track",
      label: t("opTrackTitle"),
      copy: t("opTrackDesc"),
      actionLabel: t("opTrackAction"),
      icon: <ShieldCheck size={16} aria-hidden="true" />,
    },
  ];
  const activeMode = modeOptions.find((option) => option.mode === bridgeMode) ?? modeOptions[0];
  const primaryAction = () => {
    if (bridgeMode === "message") {
      void dispatch("prepareMessageBridge");
      return;
    }
    if (bridgeMode === "track") {
      void dispatch("trackBridgeOperation");
      return;
    }
    void dispatch("prepareAssetBridge");
  };

  const drawerPanels: Record<DrawerMode, ReactNode> = {
    summary: (
      <dl className="bridge-detail-list">
        <div><dt>{t("statNetwork")}</dt><dd>{networkLabel}</dd></div>
        <div><dt>{t("bridgeEnvironmentLabel")}</dt><dd>{bridgeEnvironment}</dd></div>
        <div><dt>{t("lastRoute")}</dt><dd>{lastRoute}</dd></div>
        <div><dt>{t("lastStatus")}</dt><dd>{lastStatus}</dd></div>
        <div><dt>{t("statDigest")}</dt><dd>{lastDigest}</dd></div>
      </dl>
    ),
    timeline: (
      <ol className="bridge-drawer-timeline">
        {visibleTimeline.map((step, index) => (
          <li key={`${step.labelKey || step.label || index}-drawer-${index}`} data-state={step.state || "waiting"}>
            <span>{index + 1}</span>
            <div>
              <strong>{t(step.labelKey || step.label || "")}</strong>
              <small>{t(step.detailKey || step.detail || "", step.detailParams)}</small>
            </div>
          </li>
        ))}
      </ol>
    ),
    resources: (
      <dl className="bridge-detail-list">
        <div><dt>{t("statEndpoint")}</dt><dd>{endpointLabel}</dd></div>
        <div><dt>{t("resOfficialBridge")}</dt><dd>{bridgeAppUrl ? <a href={bridgeAppUrl} target="_blank" rel="noreferrer">{bridgeAppUrl}</a> : t("notAvailable")}</dd></div>
        <div><dt>{t("statRequests")}</dt><dd>{requestCount}</dd></div>
      </dl>
    ),
  };

  const scene = (
    <div className="bridge-scene" data-kind={visibleKind} data-prepared={prepared ? "true" : "false"}>
      <div className="bridge-scene__mode-tabs" role="tablist" aria-label={t("tabConsole")}>
        {modeOptions.map((option) => (
          <button
            key={option.mode}
            type="button"
            role="tab"
            aria-selected={bridgeMode === option.mode}
            className={bridgeMode === option.mode ? "is-active" : undefined}
            onClick={() => setBridgeMode(option.mode)}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      <div className="bridge-scene__route" aria-label={lastRoute}>
        <div className="bridge-scene__chain bridge-scene__chain--neo">
          <CoinArt size={46} variant="neo" decorative />
          <span>{sourceChain}</span>
        </div>
        <div className="bridge-scene__bridge" aria-hidden="true">
          <div className="bridge-scene__rail" />
          <div className="bridge-scene__packet">
            {isMessage ? <RadioTower size={24} strokeWidth={2.3} /> : <CoinArt size={34} variant="gas" decorative />}
          </div>
          <span className="bridge-scene__checkpoint bridge-scene__checkpoint--source" />
          <span className="bridge-scene__checkpoint bridge-scene__checkpoint--middle" />
          <span className="bridge-scene__checkpoint bridge-scene__checkpoint--target" />
        </div>
        <div className="bridge-scene__chain bridge-scene__chain--x">
          <strong>X</strong>
          <span>{targetChain}</span>
        </div>
      </div>

      <div className="bridge-scene__intent">
        <div className="bridge-scene__intent-main">
          <span>{activeMode.label}</span>
          <strong>{activeMode.actionLabel}</strong>
          <small>{prepared ? compact(lastDigest) : activeMode.copy}</small>
        </div>
        <div className="bridge-scene__intent-icon" aria-hidden="true">
          {prepared ? <CheckCircle2 size={28} strokeWidth={2.4} /> : <PackageCheck size={28} strokeWidth={2.4} />}
        </div>
      </div>

      {visibleTimeline.length > 0 && (
        <ol className="bridge-scene__timeline" aria-label={t("opTrackTitle")}>
          {visibleTimeline.map((step, index) => (
            <li key={`${step.labelKey || step.label || index}-${index}`} data-state={step.state || "waiting"}>
              <span>{index + 1}</span>
              <strong>{t(step.labelKey || step.label || "")}</strong>
            </li>
          ))}
        </ol>
      )}

      <div className="bridge-scene__handoff">
        <div>
          <span>{t("lastRoute")}</span>
          <strong>{lastRoute}</strong>
        </div>
        <ArrowRight size={16} aria-hidden="true" />
        <div>
          <span>{activeStepLabel}</span>
          <strong>{activeStepDetail}</strong>
        </div>
      </div>

      <p className="bridge-scene__status">{lastStatus}</p>
    </div>
  );

  return (
    <div className="neo-x-bridge-play-area mx2 mx2-cat-tool">
      <PlayStage
        category="tool"
        stage={{
          eyebrow: "Neo X Bridge",
          title: "Cross-chain bridge",
          subtitle: endpointLabel,
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {networkLabel}
            </span>
          ),
        }}
        scene={scene}
        actions={{
          primary: { label: activeMode.actionLabel, onClick: primaryAction },
        }}
        drawerToggleLabel="Details"
        drawer={{
          title: "Bridge details",
          children: (
            <div className="bridge-drawer">
              <div className="bridge-drawer-tabs" role="tablist" aria-label="Bridge details">
                {[
                  { mode: "summary" as const, label: t("outputTitle") },
                  { mode: "timeline" as const, label: t("statusCardTitle") },
                  { mode: "resources" as const, label: t("resourcesAria") },
                ].map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    role="tab"
                    aria-selected={drawerMode === item.mode}
                    className={drawerMode === item.mode ? "is-active" : undefined}
                    onClick={() => setDrawerMode(item.mode)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="bridge-drawer__panel" data-mode={drawerMode}>
                {drawerPanels[drawerMode]}
              </div>
            </div>
          ),
        }}
      />
    </div>
  );
}
