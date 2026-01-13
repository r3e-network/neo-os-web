import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, User, ChevronDown } from "lucide-react";
import { useWalletStore, walletOptions, WalletProvider } from "@/lib/wallet/store";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useTranslation } from "@/lib/i18n/react";
import { cn } from "@/lib/utils";
import { NetworkSelector } from "./NetworkSelector";

export function ConnectButton() {
  const { t } = useTranslation("common");
  const { connected, address, balance, loading, error, connect, disconnect, refreshBalance, clearError, provider } =
    useWalletStore();
  const { user } = useUser();
  const [showMenu, setShowMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleConnect = async (provider: WalletProvider) => {
    setShowMenu(false);
    await connect(provider);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    console.log("[ConnectButton] Manually refreshing balance...");
    await refreshBalance();
    setRefreshing(false);
  };

  if (connected) {
    const nativeBalance = balance?.native ? parseFloat(balance.native) : 0;
    const displayBalance = nativeBalance > 0 ? nativeBalance.toFixed(4) : "0.0000";
    const nativeSymbol = balance?.nativeSymbol || "GAS";
    const isSocial = provider === "auth0";

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-3 bg-white dark:bg-white/10 px-4 py-2 border border-gray-200 dark:border-white/10 rounded-full shadow-sm hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300 group">
          <div
            className={`h-2 w-2 rounded-full ${isSocial ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" : "bg-neo shadow-[0_0_8px_rgba(0,229,153,0.6)]"}`}
          />
          <span className="text-sm font-bold text-gray-900 dark:text-white font-mono tracking-tight">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          <div className="h-4 w-px bg-gray-200 dark:bg-white/20" />
          <span className="text-xs text-gray-600 dark:text-gray-300 font-medium tabular-nums">
            {displayBalance} {nativeSymbol}
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors ml-1"
            title="Refresh balance"
          >
            <RefreshCw size={12} className={`text-gray-500 dark:text-gray-400 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
        <NetworkSelector compact />
        {!isSocial && (
          <Button
            variant="ghost"
            size="sm"
            onClick={disconnect}
            className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-full px-4"
          >
            {t("wallet.disconnect")}
          </Button>
        )}
      </div>
    );
  }

  const isSocialAuthActive = !!user;

  return (
    <div className="relative">
      <Button
        onClick={() => !isSocialAuthActive && setShowMenu(!showMenu)}
        disabled={loading || isSocialAuthActive}
        className={cn(
          "font-bold px-6 py-2 transition-all rounded-xl uppercase tracking-wide duration-300",
          isSocialAuthActive
            ? "bg-gray-100 dark:bg-white/10 text-gray-400 border border-transparent cursor-not-allowed"
            : "bg-neo hover:bg-neo-dark text-black border border-neo-dark/20 shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0",
        )}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin" /> {t("wallet.connecting")}
          </span>
        ) : isSocialAuthActive ? (
          <span className="flex items-center gap-2">
            <User size={16} /> {t("wallet.socialLinked")}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {t("wallet.connect")}{" "}
            <ChevronDown size={14} className={`transition-transform duration-200 ${showMenu ? "rotate-180" : ""}`} />
          </span>
        )}
      </Button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-[#111]/90 backdrop-blur-xl p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
          <div className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 px-3 py-2 tracking-wider flex items-center gap-2">
            <span className="flex-1 h-px bg-gray-200 dark:bg-white/10"></span>
            {t("wallet.selectWallet")}
            <span className="flex-1 h-px bg-gray-200 dark:bg-white/10"></span>
          </div>
          <div className="space-y-1">
            {walletOptions.map((wallet) => (
              <button
                key={wallet.id}
                onClick={() => handleConnect(wallet.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/10 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 p-1.5 flex items-center justify-center border border-gray-200 dark:border-white/5 group-hover:border-gray-300 dark:group-hover:border-white/20 transition-colors">
                  <img
                    src={wallet.icon}
                    alt={wallet.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src = "/wallet-default.svg";
                    }}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900 dark:text-white group-hover:text-neo transition-colors">
                    {wallet.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Connect to {wallet.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-900/90 backdrop-blur-md p-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 z-40">
          <div className="flex gap-3">
            <div className="mt-0.5 text-red-500">
              <div className="w-2 h-2 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-red-600 dark:text-red-200 font-bold leading-tight">{error}</p>
              <button
                onClick={clearError}
                className="mt-2 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-100 font-bold uppercase tracking-wide"
              >
                {t("actions.dismiss")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
