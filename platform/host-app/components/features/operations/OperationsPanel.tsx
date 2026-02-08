"use client";

import React, { useState, useEffect } from "react";
import { useWalletStore } from "../../../lib/wallet/store";
import { useTranslation } from "../../../lib/i18n/react";
import { useTheme } from "../../providers/ThemeProvider";
import { getThemeColors } from "../../styles";
import type { ChainId } from "../../../lib/chains/types";
import { getChainRegistry } from "../../../lib/chains/registry";
import { getChainRpcUrl } from "../../../lib/chain/rpc-client";
import { ConnectButton } from "../wallet";
import { NetworkSelector } from "../wallet/NetworkSelector";
import { ActivityTicker } from "../../ActivityTicker";
import {
  Section,
  InfoRow,
  truncateAddress,
  scriptHashToAddressAsync,
  CHAIN_MASTER_ACCOUNTS,
  CORE_CONTRACTS,
  PLATFORM_SERVICES,
  PERMISSION_TO_SERVICE,
  type ContractInfo,
  type MiniAppPermissions,
  type ThemeColors,
} from "../../layout/RightSidebarPanel";
import type { OnChainActivity } from "../../types";
import type { WalletBalance } from "../../../lib/wallet/adapters/base";

export interface OperationsPanelProps {
  appId: string;
  appName: string;
  chainId: ChainId | null;
  permissions?: MiniAppPermissions;
  contractInfo?: ContractInfo;
  supportedChainIds?: ChainId[];
  networkLatency: number | null;
  activities?: OnChainActivity[];
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function OperationsPanel({
  appId,
  appName: _appName,
  chainId: propChainId,
  permissions,
  contractInfo,
  supportedChainIds,
  networkLatency,
  activities,
}: OperationsPanelProps) {
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
  const masterAccountAddress = CHAIN_MASTER_ACCOUNTS[activeChainId];
  const explorerBase = chainConfig?.explorerUrl || "https://neotube.io";
  const rpcUrl = getChainRpcUrl(activeChainId);

  // Convert Neo script hash to address for display
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

  // Filter platform services based on MiniApp's declared permissions
  const chainServices = PLATFORM_SERVICES[activeChainId] || {};
  const requiredServices = Object.entries(chainServices).filter(([key]) => {
    const permissionKey = Object.entries(PERMISSION_TO_SERVICE).find(([, serviceKey]) => serviceKey === key)?.[0];
    return permissionKey && permissions?.[permissionKey as keyof MiniAppPermissions];
  });

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  return (
    <div
      className="h-full flex flex-col overflow-y-auto"
      style={{ background: themeColors.bg, color: themeColors.text }}
    >
      {/* Connect Wallet */}
      <div className="p-4 border-b" style={{ borderColor: themeColors.border }}>
        <ConnectButton />
        {connected && supportedChainIds && supportedChainIds.length > 0 && (
          <div className="mt-3">
            <NetworkSelector allowedChainIds={supportedChainIds} />
          </div>
        )}
      </div>

      {/* Chain Status */}
      <ChainStatusSection
        activeChainId={activeChainId}
        chainConfig={chainConfig}
        rpcUrl={rpcUrl}
        masterAccountAddress={masterAccountAddress}
        explorerBase={explorerBase}
        networkLatency={networkLatency}
        themeColors={themeColors}
        copiedField={copiedField}
        onCopy={handleCopy}
        t={t}
      />

      {/* Wallet Info */}
      <WalletSection
        connected={connected}
        address={address}
        provider={provider}
        balance={balance}
        explorerBase={explorerBase}
        themeColors={themeColors}
        copiedField={copiedField}
        onCopy={handleCopy}
        t={t}
      />

      {/* Contract Info */}
      <ContractSection
        appId={appId}
        contractInfo={contractInfo}
        contractAddress={contractAddress}
        isNeoChain={isNeoChain}
        explorerBase={explorerBase}
        themeColors={themeColors}
        copiedField={copiedField}
        onCopy={handleCopy}
        t={t}
      />

      {/* Platform Core Contracts */}
      {isNeoChain && CORE_CONTRACTS[activeChainId] && (
        <Section title={t("sidebar.platformContracts")} icon="🏛️" themeColors={themeColors}>
          {Object.entries(CORE_CONTRACTS[activeChainId]!).map(([key, contract]) => (
            <InfoRow
              key={key}
              label={contract.name}
              value={truncateAddress(contract.address)}
              fullValue={contract.address}
              onCopy={() => handleCopy(contract.address, `core-${key}`)}
              copied={copiedField === `core-${key}`}
              link={`${explorerBase}/address/${contract.address}`}
              themeColors={themeColors}
            />
          ))}
        </Section>
      )}

      {/* Required Platform Services */}
      {requiredServices.length > 0 && (
        <Section title={t("sidebar.requiredServices")} icon="🔗" themeColors={themeColors}>
          {requiredServices.map(([key, service]) => (
            <InfoRow
              key={key}
              label={service.name}
              value={truncateAddress(service.address)}
              fullValue={service.address}
              onCopy={() => handleCopy(service.address, key)}
              copied={copiedField === key}
              link={`${explorerBase}/address/${service.address}`}
              themeColors={themeColors}
            />
          ))}
          {contractInfo?.serviceContracts?.map((service, idx) => (
            <InfoRow
              key={`custom-${idx}`}
              label={service.name}
              value={truncateAddress(service.address)}
              fullValue={service.address}
              onCopy={() => handleCopy(service.address, `service-${idx}`)}
              copied={copiedField === `service-${idx}`}
              link={`${explorerBase}/address/${service.address}`}
              themeColors={themeColors}
            />
          ))}
        </Section>
      )}

      {/* Compact Activity Ticker */}
      {activities && activities.length > 0 && (
        <div className="border-b px-4 py-3" style={{ borderColor: themeColors.border }}>
          <ActivityTicker activities={activities} height={120} maxItems={5} scrollSpeed={15} />
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-auto p-4 border-t space-y-2" style={{ borderColor: themeColors.border }}>
        {connected && (
          <a
            href={`${explorerBase}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full"
            style={{ background: `${themeColors.primary}10`, color: themeColors.text }}
          >
            <span>🔍</span>
            <span>{t("sidebar.viewWallet")}</span>
          </a>
        )}
        {contractInfo?.contractAddress && (
          <a
            href={`${explorerBase}/${isNeoChain ? "contract" : "address"}/${contractInfo.contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full"
            style={{ background: `${themeColors.primary}20`, color: themeColors.primary }}
          >
            <span>📜</span>
            <span>{t("sidebar.viewContract")}</span>
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Sub-sections (SRP: each renders one logical block) ── */

function ChainStatusSection({
  activeChainId,
  chainConfig,
  rpcUrl,
  masterAccountAddress,
  explorerBase,
  networkLatency,
  themeColors,
  copiedField,
  onCopy,
  t,
}: {
  activeChainId: ChainId;
  chainConfig: ReturnType<ReturnType<typeof getChainRegistry>["getChain"]>;
  rpcUrl: string;
  masterAccountAddress: string | undefined;
  explorerBase: string;
  networkLatency: number | null;
  themeColors: ThemeColors;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  t: (key: string) => string;
}) {
  return (
    <Section title={t("sidebar.chain") || "Chain"} icon="🌐" themeColors={themeColors}>
      <div className="flex items-center gap-2 mb-2">
        <img src={chainConfig?.icon || "/chains/neo.svg"} alt="" className="w-5 h-5" />
        <span className="font-medium">{chainConfig?.name || activeChainId}</span>
      </div>
      <InfoRow
        label={t("sidebar.chainId") || "Chain ID"}
        value={activeChainId}
        indicator={activeChainId.includes("mainnet") ? "green" : "amber"}
        themeColors={themeColors}
      />
      <InfoRow label={t("sidebar.rpc") || "RPC"} value={rpcUrl.replace("https://", "")} themeColors={themeColors} />
      {networkLatency !== null && <InfoRow label="Latency" value={`${networkLatency}ms`} themeColors={themeColors} />}
      {masterAccountAddress && (
        <InfoRow
          label={t("sidebar.masterAccount")}
          value={truncateAddress(masterAccountAddress)}
          fullValue={masterAccountAddress}
          onCopy={() => onCopy(masterAccountAddress, "platformMasterAccount")}
          copied={copiedField === "platformMasterAccount"}
          link={`${explorerBase}/address/${masterAccountAddress}`}
          themeColors={themeColors}
        />
      )}
    </Section>
  );
}

function WalletSection({
  connected,
  address,
  provider,
  balance,
  explorerBase,
  themeColors,
  copiedField,
  onCopy,
  t,
}: {
  connected: boolean;
  address: string;
  provider: string | null;
  balance: WalletBalance | null;
  explorerBase: string;
  themeColors: ThemeColors;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  t: (key: string) => string;
}) {
  return (
    <Section title={t("sidebar.wallet")} icon="👛" themeColors={themeColors}>
      {connected ? (
        <>
          <InfoRow
            label={t("sidebar.address")}
            value={truncateAddress(address)}
            fullValue={address}
            onCopy={() => onCopy(address, "wallet")}
            copied={copiedField === "wallet"}
            link={`${explorerBase}/address/${address}`}
            themeColors={themeColors}
          />
          <InfoRow label={t("sidebar.provider")} value={provider || "Unknown"} themeColors={themeColors} />
          {balance && (
            <>
              {balance.governance && balance.governanceSymbol && (
                <InfoRow
                  label={t("sidebar.neoBalance")}
                  value={`${balance.governance} ${balance.governanceSymbol}`}
                  themeColors={themeColors}
                />
              )}
              <InfoRow
                label={t("sidebar.gasBalance")}
                value={`${parseFloat(balance.native).toFixed(4)} ${balance.nativeSymbol}`}
                themeColors={themeColors}
              />
            </>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center py-4 text-center gap-2" style={{ color: themeColors.textMuted }}>
          <span className="text-xs font-medium">{t("sidebar.noWallet")}</span>
        </div>
      )}
    </Section>
  );
}

function ContractSection({
  appId,
  contractInfo,
  contractAddress,
  isNeoChain,
  explorerBase,
  themeColors,
  copiedField,
  onCopy,
  t,
}: {
  appId: string;
  contractInfo?: ContractInfo;
  contractAddress: string | null;
  isNeoChain: boolean;
  explorerBase: string;
  themeColors: ThemeColors;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  t: (key: string) => string;
}) {
  return (
    <Section title={t("sidebar.miniappContract")} icon="📜" themeColors={themeColors}>
      <InfoRow label={t("sidebar.appId")} value={appId} themeColors={themeColors} />
      {contractInfo?.contractAddress ? (
        <>
          <InfoRow
            label={t("sidebar.contractAddress")}
            value={
              isNeoChain
                ? truncateAddress(contractAddress || "Loading...")
                : truncateAddress(contractInfo.contractAddress)
            }
            fullValue={isNeoChain ? contractAddress || contractInfo.contractAddress : contractInfo.contractAddress}
            onCopy={() => onCopy((isNeoChain ? contractAddress : contractInfo.contractAddress) || "", "contractAddr")}
            copied={copiedField === "contractAddr"}
            link={`${explorerBase}/${isNeoChain ? "contract" : "address"}/${contractInfo.contractAddress}`}
            themeColors={themeColors}
          />
          {isNeoChain && (
            <InfoRow
              label={t("sidebar.scriptHash")}
              value={truncateAddress(contractInfo.contractAddress)}
              fullValue={contractInfo.contractAddress}
              onCopy={() => onCopy(contractInfo.contractAddress!, "contract")}
              copied={copiedField === "contract"}
              themeColors={themeColors}
              muted
            />
          )}
        </>
      ) : (
        <InfoRow label={t("sidebar.contractAddress")} value={t("sidebar.noContract")} muted themeColors={themeColors} />
      )}
      {contractInfo?.masterKeyAddress && (
        <InfoRow
          label={t("sidebar.masterKey")}
          value={truncateAddress(contractInfo.masterKeyAddress)}
          fullValue={contractInfo.masterKeyAddress}
          onCopy={() => onCopy(contractInfo.masterKeyAddress!, "masterKey")}
          copied={copiedField === "masterKey"}
          link={`${explorerBase}/address/${contractInfo.masterKeyAddress}`}
          themeColors={themeColors}
        />
      )}
    </Section>
  );
}

export default OperationsPanel;
