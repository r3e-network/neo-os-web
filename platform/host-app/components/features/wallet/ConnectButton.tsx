import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, User } from "lucide-react";
import { useWalletStore, walletOptions, WalletProvider } from "@/lib/wallet/store";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useTranslation } from "@/lib/i18n/react";

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
    const gasBalance = balance?.gas ? parseFloat(balance.gas) : 0;
    const displayBalance = gasBalance > 0 ? gasBalance.toFixed(4) : "0.0000";
    const isSocial = provider === "auth0";

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-white dark:bg-black px-4 py-2 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className={`h-2 w-2 rounded-full ${isSocial ? "bg-blue-500" : "bg-[#00E599]"}`} />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">{displayBalance} GAS</span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
            title="Refresh balance"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
        {!isSocial && (
          <Button variant="ghost" size="sm" onClick={disconnect} className="text-gray-700 dark:text-gray-300">
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
        className={`${isSocialAuthActive
            ? "bg-gray-400 cursor-not-allowed border-2 border-transparent"
            : "bg-[#00E599] text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          } font-bold px-6 py-2 transition-all rounded-none uppercase tracking-wide`}
      >
        {loading ? t("wallet.connecting") : isSocialAuthActive ? t("wallet.socialLinked") : t("wallet.connect")}
      </Button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 shadow-xl z-50">
          <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1 mb-1">{t("wallet.selectWallet")}</div>
          {walletOptions.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => handleConnect(wallet.id)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <img
                src={wallet.icon}
                alt={wallet.name}
                className="w-6 h-6 rounded"
                onError={(e) => {
                  e.currentTarget.src = "/wallet-default.svg";
                }}
              />
              <span className="font-medium text-gray-800 dark:text-gray-200">{wallet.name}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={clearError} className="mt-2 text-xs text-red-500 underline">
            {t("actions.dismiss")}
          </button>
        </div>
      )}
    </div>
  );
}
