/**
 * ChainSelector - Multi-chain selection component
 *
 * - Allows switching between chains for ALL wallet types (updating app state)
 * - Uses Premium Glassmorphism design
 */

import React, { useState } from "react";
import { ChevronDown, Settings } from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";
import type { ChainId, ChainType } from "@/lib/chains/types";
import { getChainRegistry } from "@/lib/chains/registry";
import { useTranslation } from "@/lib/i18n/react";
import { cn } from "@/lib/utils";

interface ChainSelectorProps {
  /** Compact mode for toolbar display */
  compact?: boolean;
  /** Show RPC settings option */
  showSettings?: boolean;
  /** Callback when settings clicked */
  onSettingsClick?: () => void;
  /** Filter chains by type */
  chainTypeFilter?: ChainType;
  /** Limit chain options to these chain IDs */
  allowedChainIds?: ChainId[];
}

export function ChainSelector({
  compact = false,
  showSettings = false,
  onSettingsClick,
  chainTypeFilter,
  allowedChainIds,
}: ChainSelectorProps) {
  const { t } = useTranslation("common");
  const { chainId, switchChain } = useWalletStore();
  const [showMenu, setShowMenu] = useState(false);

  const registry = getChainRegistry();

  // Get current chain info from registry
  const currentChainConfig = registry.getChain(chainId);
  const currentChain = {
    label: currentChainConfig?.name || t("network.unknownChain") || "Unknown Chain",
    icon: currentChainConfig?.icon || "/chains/unknown.svg",
    color: currentChainConfig?.isTestnet ? "bg-yellow-500" : "bg-green-500",
  };

  // Get available chains based on filter
  const availableChains = registry.getActiveChains().filter((chain) => {
    if (allowedChainIds && !allowedChainIds.includes(chain.id)) return false;
    if (!chainTypeFilter) return true;
    return chain.type === chainTypeFilter;
  });

  // Handle chain change
  const handleChainChange = async (newChainId: ChainId) => {
    // We now support switching for all wallet types (store handles state update)
    await switchChain(newChainId);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300",
          "bg-white/70 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10",
          "text-erobo-ink dark:text-white hover:bg-white/90 dark:hover:bg-white/20",
          "hover:shadow-[0_0_15px_rgba(159,157,243,0.3)] group",
          compact && "px-2 py-1",
        )}
      >
        <img src={currentChain.icon} alt="" className="w-4 h-4" />
        <span className="text-xs font-bold uppercase tracking-wide group-hover:text-erobo-purple transition-colors">
          {currentChain.label}
        </span>
        <ChevronDown
          size={12}
          className={cn("transition-transform text-gray-400 group-hover:text-erobo-purple", showMenu && "rotate-180")}
        />
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-white/90 dark:bg-[#0b0c16]/95 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.2)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
          <div className="p-2">
            <div className="text-[10px] font-bold uppercase text-erobo-ink-soft/70 dark:text-gray-500 px-3 py-2 tracking-wider flex items-center gap-2">
              {t("network.selectChain") || "Select Chain"}
              <span className="flex-1 h-px bg-gray-200 dark:bg-white/10"></span>
            </div>

            <div className="space-y-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {availableChains.map((chain) => {
                const isActive = chainId === chain.id;
                const colorClass = chain.isTestnet
                  ? "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]"
                  : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]";

                return (
                  <button
                    key={chain.id}
                    onClick={() => handleChainChange(chain.id)}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-erobo-purple/10 text-erobo-purple"
                        : "hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200",
                    )}
                  >
                    <div className="relative w-5 h-5 flex items-center justify-center">
                      <img src={chain.icon} alt="" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-sm font-bold flex-1">{chain.name}</span>
                    <div className={cn("w-2 h-2 rounded-full", colorClass)} />
                  </button>
                );
              })}
            </div>

            {showSettings && (
              <>
                <div className="border-t border-gray-200 dark:border-white/10 my-2" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onSettingsClick?.();
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-500 dark:text-gray-400 hover:text-erobo-purple dark:hover:text-erobo-purple"
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

// Legacy export for backward compatibility
export const NetworkSelector = ChainSelector;
export default ChainSelector;
