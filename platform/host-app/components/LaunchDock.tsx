import React from "react";
import { WalletState } from "./types";
import { colors } from "./styles";

export type LaunchDockProps = {
  appName: string;
  appId: string;
  wallet: WalletState;
  networkLatency: number | null;
  onExit: () => void;
  onShare: () => void;
};

export function LaunchDock({ appName, appId, wallet, networkLatency, onExit, onShare }: LaunchDockProps) {
  // Network indicator color based on latency
  const getNetworkStatus = (): { color: string; label: string } => {
    if (networkLatency === null) return { color: "#ef4444", label: "Offline" };
    if (networkLatency < 100) return { color: "#22c55e", label: "Good" };
    if (networkLatency < 500) return { color: "#eab308", label: "Fair" };
    return { color: "#ef4444", label: "Slow" };
  };

  const networkStatus = getNetworkStatus();

  // Wallet display
  const walletDisplay = wallet.connected
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : "Connect Wallet";

  const walletDotColor = wallet.connected ? "#22c55e" : "#ef4444";

  return (
    <div style={dockStyle}>
      {/* Left: App Name */}
      <div style={appNameStyle}>{appName}</div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right section: Wallet, Network, Share, Exit */}
      <div style={rightSectionStyle}>
        {/* Wallet Status */}
        <div style={statusItemStyle}>
          <div style={{ ...dotStyle, background: walletDotColor }} />
          <span style={statusTextStyle}>{walletDisplay}</span>
        </div>

        {/* Network Indicator */}
        <div style={statusItemStyle}>
          <div style={{ ...dotStyle, background: networkStatus.color }} />
          <span style={statusTextStyle}>{networkLatency !== null ? `${networkLatency}ms` : networkStatus.label}</span>
        </div>

        {/* Share Button */}
        <button onClick={onShare} style={iconButtonStyle} title="Copy share link">
          <ShareIcon />
        </button>

        {/* Exit Button */}
        <button onClick={onExit} style={exitButtonStyle} title="Exit (ESC)">
          <ExitIcon />
        </button>
      </div>
    </div>
  );
}

// SVG Icons (inline for simplicity)
function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// Styles
const dockStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  height: 48,
  background: "rgba(10,10,10,0.95)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  padding: "0 16px",
  gap: 16,
  zIndex: 9999,
  borderBottom: `1px solid ${colors.border}`,
};

const appNameStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: colors.text,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 200,
};

const rightSectionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const statusItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const dotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
};

const statusTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: colors.textMuted,
  fontFamily: "monospace",
};

const iconButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: colors.textMuted,
  cursor: "pointer",
  padding: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 6,
  transition: "all 0.2s",
};

const exitButtonStyle: React.CSSProperties = {
  ...iconButtonStyle,
  color: "#ef4444",
};
