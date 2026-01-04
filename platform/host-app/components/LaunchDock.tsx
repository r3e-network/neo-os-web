import { ArrowLeft, X, Share2, Globe, Wallet, Activity } from "lucide-react";
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

export function LaunchDock({ appName, appId, wallet, networkLatency, onBack, onExit, onShare }: LaunchDockProps) {
  // Network indicator color based on latency
  const getNetworkStatus = () => {
    if (networkLatency === null) return { color: "text-red-500", dot: "bg-red-500", label: "Offline" };
    if (networkLatency < 100) return { color: "text-neo", dot: "bg-neo", label: "Good" };
    if (networkLatency < 500) return { color: "text-yellow-500", dot: "bg-yellow-500", label: "Fair" };
    return { color: "text-red-500", dot: "bg-red-500", label: "Slow" };
  };

  const networkStatus = getNetworkStatus();

  // Wallet display
  const walletDisplay = wallet.connected
    ? wallet.provider === "auth0"
      ? "Social Account"
      : `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : "Connect Wallet";

  const walletDotColor = wallet.connected ? (wallet.provider === "auth0" ? "bg-blue-500" : "bg-neo") : "bg-red-500";

  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-black/60 backdrop-blur-xl border-b border-white/5 flex items-center px-4 gap-4 z-[9999] shadow-2xl">
      {/* Left: Back Button + App Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 mr-1 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-all transition-colors active:scale-95"
          title="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-neo/60" />
          <div className="text-sm font-bold text-white tracking-tight truncate max-w-[120px] md:max-w-xs">{appName}</div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section: Wallet, Network, Share, Exit */}
      <div className="flex items-center gap-2 md:gap-6">
        {/* Wallet Status */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 transition-colors pointer-events-none">
          <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", walletDotColor)} />
          <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">{walletDisplay}</span>
        </div>

        {/* Network Indicator */}
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg">
          <Activity size={12} className={cn("opacity-60", networkStatus.color)} />
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-tighter">
            {networkLatency !== null ? `${networkLatency}ms` : networkStatus.label}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 border-l border-white/10 pl-2 md:pl-6 ml-1 md:ml-0">
          <button
            onClick={onShare}
            className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-90"
            title="Copy share link"
          >
            <Share2 size={18} />
          </button>

          <button
            onClick={onExit}
            className="p-2 rounded-xl text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-90"
            title="Exit (ESC)"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

