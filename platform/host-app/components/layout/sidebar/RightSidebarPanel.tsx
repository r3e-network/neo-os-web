"use client";

import React, { useState, useEffect } from "react";
import { useWalletStore } from "../../../lib/wallet/store";
import { useTranslation } from "../../../lib/i18n/react";
import { useTheme } from "../../providers/ThemeProvider";
import { getThemeColors } from "../../styles";
import type { ChainId } from "../../../lib/chains/types";
import { getChainRegistry } from "../../../lib/chains/registry";
import { getChainRpcUrl } from "../../../lib/chains/rpc-functions";
import { scriptHashToAddressAsync, copyToClipboard } from "./utils";
import { ChainStatusSection } from "./ChainStatusSection";
import { WalletSection } from "./WalletSection";
import { ContractSection } from "./ContractSection";
import { PlatformContractsSection } from "./PlatformContractsSection";
import { RequiredServicesSection } from "./RequiredServicesSection";
import { QuickActions } from "./QuickActions";
import type { ContractInfo, MiniAppPermissions } from "./types";

interface RightSidebarPanelProps {
  appId: string;
  appName: string;
  contractInfo?: ContractInfo;
  permissions?: MiniAppPermissions;
  /** Chain ID - null if app has no chain support */
  chainId?: ChainId | null;
}

export function RightSidebarPanel({
  appId,
  appName: _appName,
  contractInfo,
  permissions,
  chainId: propChainId,
}: RightSidebarPanelProps) {
  const { connected, address, provider, balance, chainId: storeChainId } = useWalletStore();
  const { t } = useTranslation("host");
  const { theme } = useTheme();
  const themeColors = getThemeColors(theme);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);

  const activeChainId = propChainId || storeChainId;
  const registry = getChainRegistry();
  const chainConfig = registry.getChain(activeChainId);
  const isNeoChain = chainConfig?.type === "neo-n3" || activeChainId.startsWith("neo-n3");

  useEffect(() => {
    if (!contractInfo?.contractAddress) {
      setContractAddress(null);
      return;
    }
    if (!isNeoChain) {
      setContractAddress(contractInfo.contractAddress);
      return;
    }
    scriptHashToAddressAsync(contractInfo.contractAddress).then(setContractAddress);
  }, [contractInfo?.contractAddress, isNeoChain]);

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const explorerBase = chainConfig?.explorerUrl || "https://neotube.io";
  const rpcUrl = getChainRpcUrl(activeChainId);

  return (
    <div
      className="h-full flex flex-col overflow-y-auto"
      style={{ background: themeColors.bg, color: themeColors.text }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: themeColors.border }}>
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: themeColors.textMuted }}>
          {t("sidebar.title")}
        </h2>
      </div>

      <ChainStatusSection
        activeChainId={activeChainId}
        chainName={chainConfig?.name || activeChainId}
        chainIcon={chainConfig?.icon || "/chains/neo.svg"}
        rpcUrl={rpcUrl}
        explorerBase={explorerBase}
        copiedField={copiedField}
        onCopy={handleCopy}
        themeColors={themeColors}
        t={t}
      />

      <WalletSection
        connected={connected}
        address={address}
        provider={provider}
        balance={balance}
        explorerBase={explorerBase}
        copiedField={copiedField}
        onCopy={handleCopy}
        themeColors={themeColors}
        t={t}
      />

      <ContractSection
        appId={appId}
        contractInfo={contractInfo}
        contractAddress={contractAddress}
        isNeoChain={isNeoChain}
        explorerBase={explorerBase}
        copiedField={copiedField}
        onCopy={handleCopy}
        themeColors={themeColors}
        t={t}
      />

      <PlatformContractsSection
        activeChainId={activeChainId}
        isNeoChain={isNeoChain}
        explorerBase={explorerBase}
        copiedField={copiedField}
        onCopy={handleCopy}
        themeColors={themeColors}
        t={t}
      />

      <RequiredServicesSection
        activeChainId={activeChainId}
        permissions={permissions}
        contractInfo={contractInfo}
        explorerBase={explorerBase}
        copiedField={copiedField}
        onCopy={handleCopy}
        themeColors={themeColors}
        t={t}
      />

      <QuickActions
        address={address}
        contractInfo={contractInfo}
        isNeoChain={isNeoChain}
        explorerBase={explorerBase}
        themeColors={themeColors}
        t={t}
      />
    </div>
  );
}
