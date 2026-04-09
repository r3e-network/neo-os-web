/**
 * PlayArea.tsx — React version of the Wallet Health PlayArea.
 */

import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { HealthStat } from "./composables/useWalletHealth";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, str, bool, val } = useStateBindings(state);

  const safetyScore = num("safetyScore");
  const riskLabel = str("riskLabel");
  const riskClass = str("riskClass");
  const riskIcon = str("riskIcon");
  const isConnected = bool("isConnected");
  const isRefreshing = bool("isRefreshing");
  const healthStats = val<HealthStat[]>("healthStats") ?? [];

  const handleAction = (name: string) => dispatch(name);

  return (
    <div className="health-play-area">
      {/* Hero Section */}
      <div className="hero-container">
        <div className="health-gauge-scene" aria-hidden="true">
          <div className="gauge-ring" style={{ "--score": safetyScore } as React.CSSProperties}>
            <span className={`gauge-value ${riskClass}`}>{safetyScore}</span>
          </div>
        </div>
      </div>

      {/* Risk Alerts */}
      {riskLabel && (
        <div className={`risk-alert ${riskClass}`}>
          <span className="risk-icon">{riskIcon}</span>
          <span className="risk-text">{riskLabel}</span>
        </div>
      )}

      {/* Not Connected State */}
      {!isConnected ? (
        <div className="empty-state">
          <NeoCard variant="erobo" className="p-6 text-center">
            <span className="mb-3 block text-sm">{t("walletNotConnected")}</span>
            <NeoButton size="sm" variant="primary" onClick={() => handleAction("connectWallet")}>
              {t("connectWallet")}
            </NeoButton>
          </NeoCard>
        </div>
      ) : (
        /* Health Dashboard */
        <div className="health-stack">
          <div className="stats-grid">
            {healthStats.map((stat) => (
              <div key={stat.label} className="stat-item">
                <span className="stat-label">{stat.label}</span>
                <span className="stat-value">{stat.value}</span>
              </div>
            ))}
          </div>

          <NeoButton
            size="sm"
            variant="secondary"
            disabled={isRefreshing}
            onClick={() => handleAction("refreshBalances")}
          >
            {isRefreshing ? t("loading") : t("refresh")}
          </NeoButton>
        </div>
      )}
    </div>
  );
}
