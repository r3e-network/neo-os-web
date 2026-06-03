import { useMemo, useState, type CSSProperties } from "react";
import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { ChecklistItem } from "./composables/useHealthScore";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type ReportActionState = "idle" | "addressCopied" | "reportCopied" | "reportDownloaded" | "error";

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, str, bool, val } = useStateBindings(state);
  const [reportActionState, setReportActionState] = useState<ReportActionState>("idle");

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
  const healthReport = useMemo(() => {
    const lines = [
      t("reportTitle") || "Wallet Health Report",
      "",
      `${t("statNetwork") || "Network"}: ${networkLabel || "Neo N3"}`,
      `${t("statConnection") || "Connection"}: ${connectionStatus}`,
      `${t("walletAddress") || "Wallet address"}: ${address || t("notConnected") || "Not connected"}`,
      `${t("statNeo") || "NEO Balance"}: ${neoDisplay}`,
      `${t("statGas") || "GAS Balance"}: ${gasDisplay}`,
      `${t("statScore") || "Safety Score"}: ${safetyScore}`,
      `${t("riskInsights") || "Risk insights"}: ${riskLabel}`,
      `${t("sectionChecklist") || "Safety Checklist"}: ${completionText}`,
      "",
      t("reportChecklist") || "Checklist",
    ];

    checklistItems.forEach((item) => {
      lines.push(`${item.done ? "DONE" : "PENDING"}: ${item.title} - ${item.desc}`);
    });

    lines.push("", t("recommendationsTitle") || "Next actions");
    visibleRecommendations.forEach((recommendation) => {
      lines.push(`- ${recommendation}`);
    });
    lines.push("", `${t("reportGeneratedAt") || "Generated at"}: ${new Date().toISOString()}`);

    return lines.join("\n");
  }, [
    address,
    checklistItems,
    completionText,
    connectionStatus,
    gasDisplay,
    neoDisplay,
    networkLabel,
    riskLabel,
    safetyScore,
    t,
    visibleRecommendations,
  ]);
  const truncateAddress = (addr: string) => {
    if (!addr || addr.length < 14) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };
  const reportStatusLabel = {
    idle: t("reportReady") || "Report ready",
    addressCopied: t("addressCopied") || "Address copied",
    reportCopied: t("reportCopied") || "Report copied",
    reportDownloaded: t("reportDownloaded") || "Report downloaded",
    error: t("reportActionError") || "Action failed",
  }[reportActionState];
  const copyText = async (text: string, successState: ReportActionState) => {
    try {
      if (!globalThis.navigator?.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await globalThis.navigator.clipboard.writeText(text);
      setReportActionState(successState);
    } catch (_error) {
      setReportActionState("error");
    }
  };
  const downloadReport = () => {
    try {
      const blob = new Blob([healthReport], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `wallet-health-${address ? address.slice(0, 8) : "report"}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setReportActionState("reportDownloaded");
    } catch (_error) {
      setReportActionState("error");
    }
  };

  return (
    <div className="wallet-health-shell">
      <section className="wallet-health-main" aria-label={t("walletHeroTitle")}>
        <NeoCard variant="erobo" className="wallet-health-hero">
          <div className="wallet-health-score-ring" style={scoreStyle} aria-hidden="true">
            <span>{safetyScore}</span>
          </div>
          <div className="wallet-health-hero-copy">
            <span className="wallet-health-kicker">{networkLabel || "Neo N3"}</span>
            <h2>{t("walletHeroTitle")}</h2>
            <p className="wallet-health-hero-facts">
              <strong className={`wallet-health-risk-chip ${riskClass}`}>
                <span className="wallet-health-risk-dot" aria-label={riskIconLabel} />
                {riskLabel}
              </strong>
              <span className="wallet-health-fact-sep" aria-hidden="true">·</span>
              <span>{completionText}</span>
            </p>
          </div>
        </NeoCard>

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
          <div className="wallet-health-primary-actions">
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
          <p className="wallet-health-connect-hint">{t("connectHint")}</p>
        </NeoCard>
      </section>

      <aside className="wallet-health-side" aria-label={t("riskInsights")}>
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
          <div className="wallet-health-report-actions">
            <NeoButton
              size="sm"
              variant="secondary"
              disabled={!address}
              onClick={() => copyText(address, "addressCopied")}
            >
              {t("copyAddress") || "Copy address"}
            </NeoButton>
            <NeoButton
              size="sm"
              variant="secondary"
              onClick={() => copyText(healthReport, "reportCopied")}
            >
              {t("copyReport") || "Copy report"}
            </NeoButton>
            <NeoButton size="sm" variant="secondary" onClick={downloadReport}>
              {t("downloadReport") || "Download report"}
            </NeoButton>
          </div>
          <span className="wallet-health-report-status" role="status" aria-live="polite">
            {reportStatusLabel}
          </span>
        </NeoCard>
      </aside>
    </div>
  );
}
