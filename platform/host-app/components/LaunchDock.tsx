import React from "react";
import { WalletState } from "./types";

export type LaunchDockProps = {
  appName: string;
  appId: string;
  wallet: WalletState;
  networkLatency: number | null;
  runtimeLabel?: string;
  onExit: () => void;
  onShare: () => void;
};

export function LaunchDock({
  appName,
  appId,
  wallet,
  networkLatency,
  runtimeLabel = "Focused Launch View",
  onExit,
  onShare,
}: LaunchDockProps) {
  // Network indicator color based on latency
  const getNetworkStatus = (): { bg: string; label: string } => {
    if (networkLatency === null) return { bg: "bg-red-500", label: "Offline" };
    if (networkLatency < 100) return { bg: "bg-emerald-500", label: "Good" };
    if (networkLatency < 500) return { bg: "bg-amber-500", label: "Fair" };
    return { bg: "bg-red-500", label: "Slow" };
  };

  const networkStatus = getNetworkStatus();

  const addr = wallet?.address || "";
  const walletDisplay =
    wallet?.connected && addr.length >= 10
      ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
      : "Connect Wallet";

  const walletDotBg = wallet.connected ? "bg-emerald-500" : "bg-red-500";

  return (
    <div className="fixed top-0 inset-x-0 h-12 bg-[rgba(10,10,10,0.95)] backdrop-blur-sm flex items-center px-4 gap-4 z-50 border-b border-white/[0.08]">
      {/* Left: App Name */}
      <div className="min-w-0 max-w-[320px]">
        <div
          className="truncate max-w-[320px] text-base font-semibold text-gray-100"
          title={appName}
        >
          {appName}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold uppercase text-gray-400">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] text-gray-300">
            Runtime Mode
          </span>
          <span className="text-gray-400">{runtimeLabel}</span>
          <span
            className="hidden truncate text-gray-500 md:inline"
            title={appId}
          >
            {appId}
          </span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section: Wallet, Network, Share, Exit */}
      <div className="flex items-center gap-4">
        {/* Wallet Status */}
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${walletDotBg}`}
            aria-hidden="true"
          />
          <span className="sr-only">
            Wallet status: {wallet.connected ? "connected" : "disconnected"}
          </span>
          <span className="text-sm text-gray-500 font-mono">
            {walletDisplay}
          </span>
        </div>

        {/* Network Indicator */}
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${networkStatus.bg}`}
            aria-hidden="true"
          />
          <span className="sr-only">Network status: {networkStatus.label}</span>
          <span className="text-sm text-gray-500 font-mono">
            {networkLatency !== null
              ? `${networkLatency}ms`
              : networkStatus.label}
          </span>
        </div>

        {/* Share Button */}
        <button
          type="button"
          onClick={onShare}
          className="bg-transparent border-none text-gray-400 cursor-pointer p-2 flex items-center justify-center rounded-md transition-all hover:text-gray-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          title="Copy share link"
          aria-label="Copy share link"
        >
          <ShareIcon />
        </button>

        {/* Exit Button */}
        <button
          type="button"
          onClick={onExit}
          className="bg-transparent border-none text-red-500 cursor-pointer p-2 flex items-center justify-center rounded-md transition-all hover:text-red-400 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
          title="Exit (ESC)"
          aria-label="Exit"
        >
          <ExitIcon />
        </button>
      </div>
    </div>
  );
}

// SVG Icons (inline for simplicity)
function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
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
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
