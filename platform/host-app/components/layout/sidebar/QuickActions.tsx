import React from "react";
import type { ContractInfo, ThemeColors } from "./types";

interface QuickActionsProps {
  address: string;
  contractInfo?: ContractInfo;
  isNeoChain: boolean;
  explorerBase: string;
  themeColors: ThemeColors;
  t: (key: string) => string;
}

export function QuickActions({ address, contractInfo, isNeoChain, explorerBase, themeColors, t }: QuickActionsProps) {
  return (
    <div className="mt-auto p-4 border-t space-y-2" style={{ borderColor: themeColors.border }}>
      <a
        href={`${explorerBase}/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full"
        style={{ background: `${themeColors.primary}10`, color: themeColors.text }}
      >
        <span>&#128269;</span>
        <span>{t("sidebar.viewWallet")}</span>
      </a>
      {contractInfo?.contractAddress && (
        <a
          href={`${explorerBase}/${isNeoChain ? "contract" : "address"}/${contractInfo.contractAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full"
          style={{ background: `${themeColors.primary}20`, color: themeColors.primary }}
        >
          <span>&#128220;</span>
          <span>{t("sidebar.viewContract")}</span>
        </a>
      )}
    </div>
  );
}
