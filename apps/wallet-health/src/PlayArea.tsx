import type { CSSProperties } from "react";
import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { HealthStat } from "./composables/useWalletHealth";
import type { ChecklistItem } from "./composables/useHealthScore";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, str, bool, val } = useStateBindings(state);

  const address = str("address");
  const isConnected = bool("isConnected");
  const isRefreshing = bool("isRefreshing");
  const connectionStatus = str("connectionStatus");
  const networkLabel = str("networkLabel");
  const neoDisplay = str("neoDisplay", t("notAvailable") || "N/A");
  const gasDisplay = str("gasDisplay", t("notAvailable") || "N/A");
  const safetyScore = num("safetyScore");
  const riskLabel = str("riskLabel");
  const riskClass = str("riskClass");
  const riskIcon = str("riskIcon");
  const healthStats = val<HealthStat[]>("healthStats", []) ?? [];
  const checklistItems = val<ChecklistItem[]>("checklistItems", []) ?? [];
  const recommendations = val<string[]>("recommendations", []) ?? [];
  const completedChecklistCount = num("completedChecklistCount");
  const totalChecklistCount = num("totalChecklistCount");

  const completionText = t("checklistProgress", {
    completed: completedChecklistCount,
    total: totalChecklistCount,
  });
  const scoreStyle = { "--score": safetyScore } as CSSProperties;
  const riskIconLabel = riskIcon ? riskIcon.replace("-", " ") : riskLabel;
  const visibleRecommendations = recommendations.length > 0
    ? recommendations
    : [t("allSet") || "All checks look good"];

  const truncateAddress = (addr: string) => {
    if (!addr || addr.length < 14) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  return (
    <div className="wallet-health-shell">
      <section className="wallet-health-main" aria-label={t("walletHeroTitle")}>
        <div className="wallet-health-hero">
          <div className="wallet-health-hero-copy">
            <div className="wallet-health-hero-intro">
              <span className="wallet-health-hero-badge" aria-hidden="true">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2 4 5v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V5l-8-3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              <div className="wallet-health-hero-heading">
                <span className="wallet-health-kicker">{networkLabel || "Neo N3"}</span>
                <h2>{t("walletHeroTitle")}</h2>
              </div>
            </div>
            <p>{t("walletHeroSubtitle")}</p>
          </div>
          <div className="wallet-health-score-card">
            <div className="wallet-health-score-ring" style={scoreStyle}>
              <span>{safetyScore}</span>
            </div>
            <div>
              <span className="wallet-health-score-label">{t("statScore")}</span>
              <strong>{riskLabel}</strong>
              <small>{completionText}</small>
            </div>
          </div>
        </div>

        <NeoCard variant="erobo" className="wallet-health-balance-strip">
          <div className="wallet-health-section-heading">
            <span>{t("balanceStripTitle")}</span>
            <strong>{isConnected ? truncateAddress(address) : connectionStatus}</strong>
          </div>
          <div className="wallet-health-balance-grid">
            <div>
              <span>{t("statConnection")}</span>
              <strong>{connectionStatus}</strong>
            </div>
            <div>
              <span>NEO</span>
              <strong>{neoDisplay}</strong>
            </div>
            <div>
              <span>GAS</span>
              <strong>{gasDisplay}</strong>
            </div>
          </div>
        </NeoCard>

        <div className="wallet-health-action-grid">
          <NeoButton
            size="md"
            variant="primary"
            disabled={isConnected}
            onClick={() => dispatch("connectWallet")}
          >
            {isConnected ? t("statusConnected") : t("connectWallet")}
          </NeoButton>
          <NeoButton
            size="md"
            variant="secondary"
            disabled={!isConnected || isRefreshing}
            onClick={() => dispatch("refreshBalances")}
          >
            {isRefreshing ? t("loading") : t("refreshBalances")}
          </NeoButton>
        </div>

        <div className="wallet-health-insight-grid">
          {healthStats.slice(0, 3).map((stat) => (
            <div key={stat.label} className="wallet-health-insight">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <aside className="wallet-health-side" aria-label={t("riskInsights")}>
        <NeoCard variant="erobo" className="wallet-health-connect-panel">
          <div className="wallet-health-section-heading">
            <span>{t("networkReadiness")}</span>
            <strong>{networkLabel || "Neo N3"}</strong>
          </div>
          <p>{t("connectHint")}</p>
          <div className={`wallet-health-risk-row ${riskClass}`}>
            <span className="wallet-health-risk-dot" aria-label={riskIconLabel} />
            <div>
              <span>{t("riskInsights")}</span>
              <strong>{riskLabel}</strong>
            </div>
          </div>
        </NeoCard>

        <NeoCard variant="erobo" className="wallet-health-checklist-panel">
          <div className="wallet-health-section-heading">
            <span>{t("sectionChecklist")}</span>
            <strong>{completionText}</strong>
          </div>
          <div className="wallet-health-checklist-list">
            {checklistItems.map((item) => (
              <div key={item.id} className={`wallet-health-checklist-item ${item.done ? "is-done" : ""}`}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                </div>
                {item.auto ? (
                  <span className="wallet-health-auto">{t("autoChecked")}</span>
                ) : (
                  <NeoButton
                    size="sm"
                    variant={item.done ? "success" : "secondary"}
                    onClick={() => dispatch("toggleChecklist", item.id)}
                  >
                    {item.done ? t("markUndo") : t("markDone")}
                  </NeoButton>
                )}
              </div>
            ))}
          </div>
        </NeoCard>

        <NeoCard variant="erobo" className="wallet-health-recommendations-panel">
          <div className="wallet-health-section-heading">
            <span>{t("recommendationsTitle")}</span>
            <strong>{recommendations.length}</strong>
          </div>
          <ul>
            {visibleRecommendations.map((recommendation) => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ul>
        </NeoCard>
      </aside>
    </div>
  );
}
