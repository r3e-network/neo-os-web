import React from "react";
import { ArrowLeft, X, Share2, Globe, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WalletState } from "./types";
import { NetworkSelector } from "./features/wallet/NetworkSelector";
import type { ChainId } from "@/lib/chains/types";

export type CompactHeaderProps = {
  appName: string;
  appId: string;
  wallet: WalletState;
  supportedChainIds?: ChainId[];
  networkLatency: number | null;
  onBack: () => void;
  onExit: () => void;
  onShare: () => void;
};

export function CompactHeader({
  appName,
  wallet,
  supportedChainIds,
  networkLatency,
  onBack,
  onExit,
  onShare,
}: CompactHeaderProps) {
  const getNetworkStatus = () => {
    if (networkLatency === null) return { color: "text-red-500", dot: "bg-red-500", label: "Offline" };
    if (networkLatency < 100) return { color: "text-neo", dot: "bg-neo", label: "Good" };
    if (networkLatency < 500) return { color: "text-yellow-500", dot: "bg-yellow-500", label: "Fair" };
    return { color: "text-red-500", dot: "bg-red-500", label: "Slow" };
  };

  const networkStatus = getNetworkStatus();
  const walletDisplay = wallet.connected ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : "No Wallet";
  const walletDotColor = wallet.connected ? "bg-neo" : "bg-red-500";

  return (
    <div className="h-12 bg-white/70 dark:bg-erobo-bg-dark/90 backdrop-blur-xl border-b border-white/60 dark:border-white/10 flex items-center px-4 gap-4 shadow-sm">
      {/* Left: back + app name */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1.5 text-erobo-ink dark:text-gray-200 hover:bg-erobo-peach/30 dark:hover:bg-white/10 rounded-full transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-white/70 dark:bg-white/5 rounded-full border border-white/60 dark:border-white/10">
          <Globe size={12} className="text-erobo-purple" />
          <div className="text-[11px] font-bold uppercase tracking-wide truncate max-w-[100px] md:max-w-[180px] text-erobo-ink dark:text-gray-100">
            {appName}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      {/* Right: network selector, wallet, latency, share, exit */}
      <div className="flex items-center gap-2 md:gap-3">
        {wallet.connected && <NetworkSelector compact allowedChainIds={supportedChainIds} />}

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white/70 dark:bg-white/5 rounded-full border border-white/60 dark:border-white/10">
          <div className={cn("w-1.5 h-1.5 rounded-full", walletDotColor)} />
          <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-erobo-ink-soft/70 dark:text-gray-300">
            {walletDisplay}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/70 dark:bg-white/5 rounded-full border border-white/60 dark:border-white/10">
          <Activity size={11} className={networkStatus.color} />
          <span className="text-[10px] font-bold font-mono uppercase tracking-wide text-erobo-ink-soft/70 dark:text-gray-300">
            {networkLatency !== null ? `${networkLatency}ms` : networkStatus.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 border-l border-white/60 dark:border-white/10 pl-3">
          <button
            onClick={onShare}
            title="Copy share link"
            className="p-1.5 text-erobo-ink-soft dark:text-gray-300 hover:text-erobo-purple hover:bg-erobo-purple/10 rounded-full transition-all"
          >
            <Share2 size={16} />
          </button>
          <button
            onClick={onExit}
            title="Exit (ESC)"
            className="p-1.5 text-erobo-ink-soft dark:text-gray-300 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
