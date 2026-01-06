import React from "react";
import { ArrowLeft, X, Share2, Globe, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { WalletState } from "./types";

export type LaunchDockProps = {
  appName: string;
  appId: string;
  wallet: WalletState;
  networkLatency: number | null;
  onBack: () => void;
  onExit: () => void;
  onShare: () => void;
};

export function LaunchDock({ appName, wallet, networkLatency, onBack, onExit, onShare }: LaunchDockProps) {
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
    <div className="fixed top-0 left-0 right-0 h-14 bg-white dark:bg-black border-b-4 border-black dark:border-white flex items-center px-4 gap-4 z-[9999] shadow-brutal-sm">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-2 border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2 px-3 py-1 bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-white">
          <Globe size={14} className="text-neo" />
          <div className="text-xs font-black uppercase tracking-tighter truncate max-w-[120px] md:max-w-xs">
            {appName}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-900 border-2 border-black dark:border-white">
          <div className={cn("w-2 h-2 rounded-full", walletDotColor)} />
          <span className="text-[10px] font-black font-mono uppercase tracking-widest">{walletDisplay}</span>
        </div>

        <div className="flex items-center gap-2 px-2 py-1 bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-white">
          <Activity size={12} className={cn("font-black", networkStatus.color)} />
          <span className="text-[10px] font-black font-mono uppercase tracking-tighter">
            {networkLatency !== null ? `${networkLatency}ms` : networkStatus.label}
          </span>
        </div>

        <div className="flex items-center gap-2 border-l-2 border-black/20 dark:border-white/20 pl-4">
          <button
            onClick={onShare}
            className="p-2 border-2 border-black dark:border-white bg-brutal-blue text-black hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
          >
            <Share2 size={18} />
          </button>

          <button
            onClick={onExit}
            className="p-2 border-2 border-black dark:border-white bg-brutal-red text-black hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
