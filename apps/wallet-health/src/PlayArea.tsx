/**
 * PlayArea.tsx — Wallet Health
 *
 * Wallet diagnostics dashboard with safety score gauge, risk alerts,
 * balance display, and health stats. Uses all state from main.tsx setup().
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

  // Connection state
  const address = str("address");
  const isConnected = bool("isConnected");
  const isRefreshing = bool("isRefreshing");
  const connectionStatus = str("connectionStatus");
  const networkLabel = str("networkLabel");

  // Balance state
  const neoDisplay = str("neoDisplay", t("notAvailable") || "N/A");
  const gasDisplay = str("gasDisplay", t("notAvailable") || "N/A");

  // Health state
  const safetyScore = num("safetyScore");
  const riskLabel = str("riskLabel");
  const riskClass = str("riskClass");
  const riskIcon = str("riskIcon");
  const healthStats = val<HealthStat[]>("healthStats") ?? [];

  const handleAction = (name: string) => dispatch(name);

  const truncateAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  return (
    <div className="health-play-area">
      {/* Hero Section */}
      <div className="hero-container">
        <div className="health-gauge-scene" aria-hidden="true">
          <div
            className="gauge-ring"
            style={{ "--score": safetyScore } as React.CSSProperties}
          >
            <span className={`gauge-value ${riskClass}`}>{safetyScore}</span>
          </div>
        </div>
        {networkLabel && (
          <span className="network-badge">{networkLabel}</span>
        )}
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
          <NeoCard variant="erobo" className="connect-card">
            <span className="connect-message">
              {t("walletNotConnected") || "Connect your wallet to view health diagnostics."}
            </span>
            {connectionStatus && (
              <span className="connection-status">{connectionStatus}</span>
            )}
            <NeoButton
              size="sm"
              variant="primary"
              onClick={() => handleAction("connectWallet")}
            >
              {t("connectWallet") || "Connect Wallet"}
            </NeoButton>
          </NeoCard>
        </div>
      ) : (
        /* Health Dashboard */
        <div className="health-stack">
          {/* Wallet Info */}
          <NeoCard variant="erobo" className="wallet-info-card">
            <div className="wallet-info">
              <div className="info-row">
                <span className="info-label">{t("address") || "Address"}</span>
                <span className="info-value mono">{truncateAddress(address)}</span>
              </div>
              <div className="balance-row">
                <div className="balance-item">
                  <span className="balance-label">NEO</span>
                  <span className="balance-value">{neoDisplay}</span>
                </div>
                <div className="balance-divider" />
                <div className="balance-item">
                  <span className="balance-label">GAS</span>
                  <span className="balance-value">{gasDisplay}</span>
                </div>
              </div>
            </div>
          </NeoCard>

          {/* Health Stats */}
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
            {isRefreshing
              ? (t("loading") || "Loading...")
              : (t("refresh") || "Refresh")}
          </NeoButton>
        </div>
      )}
    </div>
  );
}
