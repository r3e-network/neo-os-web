/**
 * PlayArea.tsx - Wallet Health
 *
 * A foreground-led safety diagnostic workspace: score, balances, checklist,
 * and next actions are visible without decorative backdrops or empty form rows.
 */
import { useMemo, type CSSProperties } from "react";
import {
  Activity,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

const SCANNER_IMAGE = "./wallet-health-scanner.webp";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface ChecklistItem {
  id: string;
  title?: string;
  label?: string;
  desc?: string;
  done: boolean;
  auto?: boolean;
  pending?: boolean;
}

interface HealthStat {
  label: string;
  value: string;
}

const EMPTY_CHECKLIST: ChecklistItem[] = [];
const EMPTY_STATS: HealthStat[] = [];
const EMPTY_RECOMMENDATIONS: string[] = [];

function compactAddress(value: string) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > 24 ? `${text.slice(0, 10)}...${text.slice(-8)}` : text;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const address = str("address");
  const isConnected = bool("isConnected");
  const isConnecting = bool("isConnecting");
  const isRefreshing = bool("isRefreshing");
  const connectionStatus = str("connectionStatus", t(isConnected ? "statusConnected" : "statusDisconnected"));
  const networkLabel = str("networkLabel", "Neo N3");
  const neoDisplay = str("neoDisplay", "-");
  const gasDisplay = str("gasDisplay", "-");
  const safetyScore = num("safetyScore");
  const riskLabel = str("riskLabel", "-");
  const riskClass = str("riskClass", "risk-high");
  const completedCount = num("completedChecklistCount");
  const totalCount = num("totalChecklistCount");
  const rawChecklistItems = val("checklistItems") as ChecklistItem[] | undefined;
  const rawHealthStats = val("healthStats") as HealthStat[] | undefined;
  const rawRecommendations = val("recommendations") as string[] | undefined;
  const checklistItems = useMemo(() => rawChecklistItems ?? EMPTY_CHECKLIST, [rawChecklistItems]);
  const healthStats = useMemo(() => rawHealthStats ?? EMPTY_STATS, [rawHealthStats]);
  const recommendations = useMemo(() => rawRecommendations ?? EMPTY_RECOMMENDATIONS, [rawRecommendations]);

  const riskTone = riskClass.replace(/^risk-/, "") || "high";
  const scoreColor = safetyScore >= 80 ? "var(--mx2-success)" : safetyScore >= 50 ? "var(--mx2-warning)" : "var(--mx2-danger)";
  const circumference = 2 * Math.PI * 52;
  const scoreOffset = circumference * (1 - Math.max(0, Math.min(100, safetyScore)) / 100);
  const progressText = t("checklistProgress", { completed: completedCount, total: totalCount });
  const statusText = isRefreshing
    ? t("diagnosticStatusScanning")
    : isConnected
      ? t("diagnosticStatusReady")
      : t("diagnosticStatusIdle");

  const reportText = useMemo(() => {
    const lines = [
      t("reportTitle"),
      `${t("reportGeneratedAt")}: ${new Date().toISOString()}`,
      `${t("walletAddress")}: ${address || t("notConnected")}`,
      `${t("statNetwork")}: ${networkLabel}`,
      `${t("statScore")}: ${safetyScore}/100`,
      `${t("riskLabel")}: ${riskLabel}`,
      `${t("statNeo")}: ${neoDisplay}`,
      `${t("statGas")}: ${gasDisplay}`,
      "",
      t("reportChecklist"),
      ...checklistItems.map((item) => {
        const title = item.title ?? item.label ?? item.id;
        const stateText = item.done ? t("reportDone") : item.pending ? t("checklistConnectToCheck") : t("reportPending");
        return `- ${title}: ${stateText}`;
      }),
    ];
    if (recommendations.length > 0) {
      lines.push("", t("recommendationsTitle"), ...recommendations.map((item) => `- ${item}`));
    }
    return lines.join("\n");
  }, [address, checklistItems, gasDisplay, neoDisplay, networkLabel, recommendations, riskLabel, safetyScore, t]);

  const visibleChecklist = checklistItems.slice(0, 4);
  const visibleRecommendations = recommendations.slice(0, 3);

  const handlePrimary = () => {
    if (isConnected) {
      void dispatch("copy", reportText, "reportCopied");
      return;
    }
    void dispatch("connectWallet");
  };

  const scene = (
    <div className="health-workspace" data-state={isRefreshing ? "scanning" : isConnected ? "live" : "idle"} data-risk={riskTone}>
      <section className="health-summary-card" aria-label={t("healthSummary")}>
        <div className="health-summary-card__head">
          <span><WalletCards size={16} />{connectionStatus || t("notConnected")}</span>
          <strong>{networkLabel || "Neo N3"}</strong>
        </div>

        <figure className="health-scanner-art">
          <img src={SCANNER_IMAGE} alt={t("healthSummary")} loading="eager" decoding="async" />
          <figcaption>
            <ShieldCheck size={15} />
            <span>{statusText}</span>
          </figcaption>
        </figure>

        <div className="health-gauge" style={{ "--health-score": String(safetyScore) } as CSSProperties}>
          <svg viewBox="0 0 120 120" className="health-gauge__svg" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--mx2-surface-sunken)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={scoreColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={scoreOffset}
              transform="rotate(-90 60 60)"
              className="health-gauge__arc"
            />
          </svg>
          <div className="health-gauge__center">
            <span>{safetyScore}</span>
            <strong>{t("healthSummary")}</strong>
          </div>
        </div>

        <div className="health-balances">
          <div><span>{t("statNeo")}</span><strong>{neoDisplay}</strong></div>
          <div><span>{t("statGas")}</span><strong>{gasDisplay}</strong></div>
        </div>

        <div className="health-risk-pill" data-risk={riskTone}>
          {riskTone === "low" ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
          <span>{riskLabel || "-"}</span>
        </div>

        <p className="health-address-note">
          {address ? compactAddress(address) : t("connectHint")}
        </p>
      </section>

      <section className="health-checklist-card" aria-label={t("sectionChecklist")}>
        <div className="health-checklist-card__head">
          <span><ClipboardCheck size={16} />{t("sectionChecklist")}</span>
          <strong>{progressText}</strong>
        </div>
        {visibleChecklist.length > 0 ? (
          <div className="health-checklist">
            {visibleChecklist.map((item) => {
              const disabled = Boolean(item.auto || item.pending);
              const title = item.title ?? item.label ?? item.id;
              const status = item.done ? t("reportDone") : item.pending ? t("checklistConnectToCheck") : t("reportPending");
              return (
                <button
                  key={item.id}
                  type="button"
                  className="health-check"
                  data-done={item.done ? "true" : undefined}
                  data-pending={item.pending ? "true" : undefined}
                  onClick={() => void dispatch("toggleChecklist", item.id)}
                  disabled={disabled}
                >
                  <span className="health-check__box" aria-hidden="true">
                    {item.done ? <CheckCircle2 size={16} /> : null}
                  </span>
                  <span className="health-check__body">
                    <strong>{title}</strong>
                    {item.desc ? <em>{item.desc}</em> : null}
                  </span>
                  <span className="health-check__status">{status}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="health-empty">{t("noChecklistItems")}</p>
        )}
      </section>

      <section className="health-next-card" aria-label={t("recommendationsTitle")}>
        <div className="health-next-card__head">
          <span><Activity size={16} />{t("recommendationsTitle")}</span>
          <strong>{statusText}</strong>
        </div>
        {visibleRecommendations.length > 0 ? (
          <ul className="health-recommendations">
            {visibleRecommendations.map((item, index) => (
              <li key={`${item}-${index}`}>
                <BadgeCheck size={15} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="health-empty">{t("allSet")}</p>
        )}
      </section>
    </div>
  );

  return (
    <div className="wallet-health-play-area mx2 mx2-cat-tool">
      <PlayStage
        category="tool"
        stage={{
          eyebrow: t("diagnosticStageTitle"),
          title: isConnected ? `${t("healthSummary")} - ${safetyScore}/100` : t("connectToScore"),
          subtitle: t("diagnosticStageCopy"),
          badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {networkLabel || "Neo N3"}</span>,
        }}
        scene={scene}
        score={[
          { label: t("balanceStripTitle"), value: `${neoDisplay} / ${gasDisplay}`, accent: true },
          { label: t("sectionChecklist"), value: `${completedCount}/${totalCount}` },
          { label: t("riskLabel"), value: riskLabel || "-" },
        ]}
        actions={{
          primary: {
            label: isConnected ? (isRefreshing ? t("diagnosticStatusScanning") : t("copyReport")) : (isConnecting ? "..." : t("connectToScore")),
            onClick: handlePrimary,
            disabled: isConnecting,
            loading: isRefreshing || isConnecting,
            icon: isConnected ? <Copy size={17} /> : <WalletCards size={17} />,
          },
          secondary: isConnected ? [
            {
              label: t("refresh"),
              onClick: () => void dispatch("refreshBalances"),
              disabled: isRefreshing,
              icon: <RefreshCw size={16} />,
            },
            ...(address ? [{
              label: t("copyAddress"),
              onClick: () => void dispatch("copy", address, "addressCopied"),
              icon: <Copy size={16} />,
            }] : []),
          ] : undefined,
        }}
        drawerToggleLabel={t("diagnosticReportStep")}
        drawer={{
          title: t("diagnosticReportStep"),
          children: (
            <div className="health-report">
              <section>
                <h4>{t("networkReadiness")}</h4>
                {healthStats.length > 0
                  ? healthStats.map((stat) => <p key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></p>)
                  : <p><span>{t("statNetwork")}</span><strong>{networkLabel || "Neo N3"}</strong></p>}
              </section>
              <section>
                <h4>{t("sectionRecommendations")}</h4>
                {recommendations.length > 0
                  ? recommendations.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)
                  : <p>{t("allSet")}</p>}
              </section>
            </div>
          ),
        }}
      />
    </div>
  );
}
