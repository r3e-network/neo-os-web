/**
 * NetworkSelector - Network selection for social account users
 *
 * - For social accounts: clickable button to switch between testnet/mainnet
 * - For extension wallets: display-only (network controlled by wallet)
 */

import React, { useState } from "react";
import { Globe, ChevronDown, Settings } from "lucide-react";
import { useWalletStore, NetworkType, DEFAULT_RPC_URLS } from "@/lib/wallet/store";
import { useTranslation } from "@/lib/i18n/react";
import { cn } from "@/lib/utils";

interface NetworkSelectorProps {
  /** Compact mode for toolbar display */
  compact?: boolean;
  /** Show RPC settings option */
  showSettings?: boolean;
  /** Callback when settings clicked */
  onSettingsClick?: () => void;
}

export function NetworkSelector({ compact = false, showSettings = false, onSettingsClick }: NetworkSelectorProps) {
  const { t } = useTranslation("common");
  const { provider, networkConfig, setNetwork } = useWalletStore();
  const [showMenu, setShowMenu] = useState(false);

  const isSocialAccount = provider === "auth0";
  const isExtensionWallet = provider && provider !== "auth0";
  const currentNetwork = networkConfig.network;

  // Network display info
  const networkInfo: Record<NetworkType, { label: string; color: string }> = {
    testnet: {
      label: t("network.testnet") || "Testnet",
      color: "bg-yellow-500",
    },
    mainnet: {
      label: t("network.mainnet") || "Mainnet",
      color: "bg-green-500",
    },
  };

  const current = networkInfo[currentNetwork];

  // For extension wallets: display-only
  if (isExtensionWallet) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 border-2 border-black dark:border-white",
          "bg-gray-100 dark:bg-gray-800 cursor-default",
          compact && "px-2 py-1",
        )}
        title={t("network.controlledByWallet") || "Network controlled by wallet"}
      >
        <div className={cn("w-2 h-2 rounded-full", current.color)} />
        <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">
          {current.label}
        </span>
      </div>
    );
  }

  // For social accounts: clickable selector
  const handleNetworkChange = (network: NetworkType) => {
    setNetwork(network);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 border-2 border-black dark:border-white",
          "bg-white dark:bg-black text-black dark:text-white",
          "shadow-brutal-xs hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]",
          "transition-all cursor-pointer",
          compact && "px-2 py-1",
        )}
      >
        <div className={cn("w-2 h-2 rounded-full", current.color)} />
        <span className="text-xs font-bold uppercase tracking-wide">{current.label}</span>
        <ChevronDown size={12} className={cn("transition-transform", showMenu && "rotate-180")} />
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-black border-2 border-black dark:border-white shadow-brutal-md z-50">
          <div className="p-1">
            <div className="text-[10px] font-bold uppercase text-gray-500 px-2 py-1">
              {t("network.selectNetwork") || "Select Network"}
            </div>

            {(["testnet", "mainnet"] as NetworkType[]).map((network) => {
              const info = networkInfo[network];
              const isActive = currentNetwork === network;

              return (
                <button
                  key={network}
                  onClick={() => handleNetworkChange(network)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-left transition-colors",
                    isActive ? "bg-neo text-black" : "hover:bg-gray-100 dark:hover:bg-gray-800",
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full", info.color)} />
                  <span className="text-sm font-bold uppercase">{info.label}</span>
                  {isActive && <span className="ml-auto text-xs">✓</span>}
                </button>
              );
            })}

            {showSettings && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onSettingsClick?.();
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Settings size={14} />
                  <span className="text-sm font-medium">{t("network.rpcSettings") || "RPC Settings"}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NetworkSelector;
