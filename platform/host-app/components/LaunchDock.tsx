import React, { useState } from "react";
import { ArrowLeft, X, Share2, Globe, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WalletState } from "./types";
import { NetworkSelector } from "./features/wallet/NetworkSelector";
import { RpcSettingsModal } from "./features/wallet/RpcSettingsModal";
import type { ChainId } from "@/lib/chains/types";

export type LaunchDockProps = {
  appName: string;
  appId: string;
  wallet: WalletState;
  supportedChainIds?: ChainId[];
  networkLatency: number | null;
  onBack: () => void;
  onExit: () => void;
  onShare: () => void;
};

export function LaunchDock({
  appName,
  wallet,
  supportedChainIds,
  networkLatency,
  onBack,
  onExit,
  onShare,
}: LaunchDockProps) {
  const [showRpcSettings, setShowRpcSettings] = useState(false);
  const isSocialAccount = wallet.provider === "auth0";

  const getNetworkStatus = () => {
    if (networkLatency === null) return { color: "text-red-500", dot: "bg-red-500", label: "Offline" };
    if (networkLatency < 100) return { color: "text-neo", dot: "bg-neo", label: "Good" };
    if (networkLatency < 500) return { color: "text-yellow-500", dot: "bg-yellow-500", label: "Fair" };
    return { color: "text-red-500", dot: "bg-red-500", label: "Slow" };
  };

  const networkStatus = getNetworkStatus();
  const walletDisplay = wallet.connected
    ? wallet.provider === "auth0"
      ? "Social"
      : `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : "No Wallet";

  const walletDotColor = wallet.connected ? (wallet.provider === "auth0" ? "bg-blue-500" : "bg-neo") : "bg-red-500";

  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-white/70 dark:bg-[#0b0c16]/90 backdrop-blur-xl border-b border-white/60 dark:border-white/10 flex items-center px-4 gap-4 z-[9999] shadow-sm">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-2 text-erobo-ink dark:text-gray-200 hover:bg-erobo-peach/30 dark:hover:bg-white/10 rounded-full transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2 px-3 py-1 bg-white/70 dark:bg-white/5 rounded-full border border-white/60 dark:border-white/10">
          <Globe size={14} className="text-erobo-purple" />
          <div className="text-xs font-bold uppercase tracking-wide truncate max-w-[120px] md:max-w-xs text-erobo-ink dark:text-gray-100">
            {appName}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 md:gap-4">
        {/* Network Selector - clickable for social accounts, display-only for wallets */}
        {wallet.connected && (
          <NetworkSelector
            compact
            showSettings={isSocialAccount}
            allowedChainIds={supportedChainIds}
            onSettingsClick={() => setShowRpcSettings(true)}
          />
        )}

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/70 dark:bg-white/5 rounded-full border border-white/60 dark:border-white/10">
          <div className={cn("w-1.5 h-1.5 rounded-full", walletDotColor)} />
          <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-erobo-ink-soft/70 dark:text-gray-300">
            {walletDisplay}
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/70 dark:bg-white/5 rounded-full border border-white/60 dark:border-white/10">
          <Activity size={12} className={cn("", networkStatus.color)} />
          <span className="text-[10px] font-bold font-mono uppercase tracking-wide text-erobo-ink-soft/70 dark:text-gray-300">
            {networkLatency !== null ? `${networkLatency}ms` : networkStatus.label}
          </span>
        </div>

        <div className="flex items-center gap-2 border-l border-white/60 dark:border-white/10 pl-4">
          <button
            onClick={onShare}
            title="Copy share link"
            className="p-2 text-erobo-ink-soft dark:text-gray-300 hover:text-erobo-purple hover:bg-erobo-purple/10 rounded-full transition-all"
          >
            <Share2 size={18} />
          </button>

          <button
            onClick={onExit}
            title="Exit (ESC)"
            className="p-2 text-erobo-ink-soft dark:text-gray-300 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* RPC Settings Modal for social accounts */}
      {isSocialAccount && <RpcSettingsModal isOpen={showRpcSettings} onClose={() => setShowRpcSettings(false)} />}
    </div>
  );
}
