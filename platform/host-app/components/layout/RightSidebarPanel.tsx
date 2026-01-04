"use client";

import React, { useState } from "react";
import { useWalletStore } from "../../lib/wallet/store";
import { useTranslation } from "../../lib/i18n/react";
import { useTheme } from "../providers/ThemeProvider";
import { getThemeColors } from "../styles";

// Neo N3 Network Configuration (real data from k8s/platform/edge/configmap.yaml)
const NETWORK_CONFIG = {
  testnet: {
    name: "Neo N3 Testnet",
    magic: 894710606,
    rpcUrl: "https://testnet1.neo.coz.io:443",
    explorerUrl: "https://testnet.neotube.io",
    // Platform master account address (GlobalSigner public address)
    masterAccountAddress: "NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ",
  },
  mainnet: {
    name: "Neo N3 Mainnet",
    magic: 860833102,
    rpcUrl: "https://mainnet1.neo.coz.io:443",
    explorerUrl: "https://neotube.io",
    // Platform master account address (GlobalSigner public address)
    masterAccountAddress: "NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ",
  },
};

// Platform Core Contracts (always shown - from k8s/platform/edge/configmap.yaml)
const CORE_CONTRACTS = {
  testnet: {
    ServiceGateway: {
      address: "NX25pqQJSjpeyKBvcdReRtzuXMeEyJkyiy",
      name: "Service Gateway",
      description: "Platform entry point",
    },
    Governance: {
      address: "NeEWK3vcVRWJDebyBCyLx6HSzJZSeYhXAt",
      name: "Governance",
      description: "DAO governance contract",
    },
  },
  mainnet: {
    ServiceGateway: {
      address: "NX25pqQJSjpeyKBvcdReRtzuXMeEyJkyiy",
      name: "Service Gateway",
      description: "Platform entry point",
    },
    Governance: {
      address: "NeEWK3vcVRWJDebyBCyLx6HSzJZSeYhXAt",
      name: "Governance",
      description: "DAO governance contract",
    },
  },
};

// NeoHub Platform Service Contracts (filtered by MiniApp permissions)
const PLATFORM_SERVICES = {
  testnet: {
    PaymentHub: {
      address: "NLyxAiXdbc7pvckLw8aHpEiYb7P7NYHpQq",
      name: "Payment Hub",
      description: "Handles GAS payments",
    },
    AppRegistry: {
      address: "NX25pqQJSjpeyKBvcdReRtzuXMeEyJkyiy",
      name: "App Registry",
      description: "MiniApp registration & permissions",
    },
    RandomnessOracle: {
      address: "NWkXBKnpvQTVy3exMD2dWNDzdtc399eLaD",
      name: "Randomness Oracle",
      description: "Verifiable random numbers",
    },
    PriceFeed: {
      address: "Ndx6Lia3FsF7K1t73F138HXHaKwLYca2yM",
      name: "Price Feed",
      description: "Real-time price oracle",
    },
  },
  mainnet: {
    PaymentHub: {
      address: "NLyxAiXdbc7pvckLw8aHpEiYb7P7NYHpQq",
      name: "Payment Hub",
      description: "Handles GAS payments",
    },
    AppRegistry: {
      address: "NX25pqQJSjpeyKBvcdReRtzuXMeEyJkyiy",
      name: "App Registry",
      description: "MiniApp registration & permissions",
    },
    RandomnessOracle: {
      address: "NWkXBKnpvQTVy3exMD2dWNDzdtc399eLaD",
      name: "Randomness Oracle",
      description: "Verifiable random numbers",
    },
    PriceFeed: {
      address: "Ndx6Lia3FsF7K1t73F138HXHaKwLYca2yM",
      name: "Price Feed",
      description: "Real-time price oracle",
    },
  },
};

interface ServiceContract {
  name: string;
  address: string;
  description?: string;
}

interface ContractInfo {
  contractHash?: string | null;
  masterKeyAddress?: string;
  gasContractAddress?: string;
  serviceContracts?: ServiceContract[];
}

// MiniApp permissions structure
interface MiniAppPermissions {
  payments?: boolean;
  governance?: boolean;
  randomness?: boolean;
  datafeed?: boolean;
  confidential?: boolean;
}

// Map permissions to platform service keys
const PERMISSION_TO_SERVICE: Record<string, keyof typeof PLATFORM_SERVICES.testnet> = {
  payments: "PaymentHub",
  randomness: "RandomnessOracle",
  datafeed: "PriceFeed",
};

interface RightSidebarPanelProps {
  appId: string;
  appName: string;
  contractInfo?: ContractInfo;
  permissions?: MiniAppPermissions;
  network?: "mainnet" | "testnet";
}

function truncateAddress(address: string, start = 6, end = 4): string {
  if (!address || address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function RightSidebarPanel({
  appId,
  appName,
  contractInfo,
  permissions,
  network = "testnet",
}: RightSidebarPanelProps) {
  const { connected, address, provider, balance } = useWalletStore();
  const { t } = useTranslation("host");
  const { theme } = useTheme();
  const themeColors = getThemeColors(theme);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Filter platform services based on MiniApp's declared permissions
  const requiredServices = Object.entries(PLATFORM_SERVICES[network]).filter(([key]) => {
    // Find which permission requires this service
    const permissionKey = Object.entries(PERMISSION_TO_SERVICE).find(([, serviceKey]) => serviceKey === key)?.[0];
    // Show service if MiniApp has declared this permission
    return permissionKey && permissions?.[permissionKey as keyof MiniAppPermissions];
  });

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const networkConfig = NETWORK_CONFIG[network];
  const explorerBase = networkConfig.explorerUrl;

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

      {/* Network Status */}
      <Section title={t("sidebar.network")} icon="🌐" themeColors={themeColors}>
        <InfoRow
          label={t("sidebar.network")}
          value={networkConfig.name}
          indicator={network === "mainnet" ? "green" : "amber"}
          themeColors={themeColors}
        />
        <InfoRow label={t("sidebar.magic")} value={networkConfig.magic.toString()} themeColors={themeColors} />
        <InfoRow
          label={t("sidebar.rpc")}
          value={networkConfig.rpcUrl.replace("https://", "")}
          themeColors={themeColors}
        />
        <InfoRow
          label={t("sidebar.masterAccount")}
          value={truncateAddress(networkConfig.masterAccountAddress, 8, 6)}
          fullValue={networkConfig.masterAccountAddress}
          onCopy={() => handleCopy(networkConfig.masterAccountAddress, "platformMasterAccount")}
          copied={copiedField === "platformMasterAccount"}
          link={`${explorerBase}/address/${networkConfig.masterAccountAddress}`}
          themeColors={themeColors}
        />
      </Section>

      {/* Connected Wallet */}
      <Section title={t("sidebar.wallet")} icon="👛" themeColors={themeColors}>
        {connected ? (
          <>
            <InfoRow
              label={t("sidebar.address")}
              value={truncateAddress(address, 8, 6)}
              fullValue={address}
              onCopy={() => handleCopy(address, "wallet")}
              copied={copiedField === "wallet"}
              link={`${explorerBase}/address/${address}`}
              themeColors={themeColors}
            />
            <InfoRow label={t("sidebar.provider")} value={provider || "Unknown"} themeColors={themeColors} />
            {balance && (
              <>
                <InfoRow label={t("sidebar.neoBalance")} value={`${balance.neo} NEO`} themeColors={themeColors} />
                <InfoRow
                  label={t("sidebar.gasBalance")}
                  value={`${parseFloat(balance.gas).toFixed(4)} GAS`}
                  themeColors={themeColors}
                />
              </>
            )}
          </>
        ) : (
          <div className="text-center py-3 text-sm" style={{ color: themeColors.textMuted }}>
            {t("sidebar.noWallet")}
          </div>
        )}
      </Section>

      {/* MiniApp Contract */}
      <Section title={t("sidebar.miniappContract")} icon="📜" themeColors={themeColors}>
        <InfoRow label={t("sidebar.appId")} value={appId} themeColors={themeColors} />
        {contractInfo?.contractHash ? (
          <InfoRow
            label={t("sidebar.contractHash")}
            value={truncateAddress(contractInfo.contractHash, 10, 8)}
            fullValue={contractInfo.contractHash}
            onCopy={() => handleCopy(contractInfo.contractHash!, "contract")}
            copied={copiedField === "contract"}
            link={`${explorerBase}/contract/${contractInfo.contractHash}`}
            themeColors={themeColors}
          />
        ) : (
          <InfoRow label={t("sidebar.contractHash")} value={t("sidebar.noContract")} muted themeColors={themeColors} />
        )}
        {contractInfo?.masterKeyAddress && (
          <InfoRow
            label={t("sidebar.masterKey")}
            value={truncateAddress(contractInfo.masterKeyAddress, 8, 6)}
            fullValue={contractInfo.masterKeyAddress}
            onCopy={() => handleCopy(contractInfo.masterKeyAddress!, "masterKey")}
            copied={copiedField === "masterKey"}
            link={`${explorerBase}/address/${contractInfo.masterKeyAddress}`}
            themeColors={themeColors}
          />
        )}
      </Section>

      {/* Platform Core Contracts (always shown) */}
      <Section title={t("sidebar.platformContracts")} icon="🏛️" themeColors={themeColors}>
        {Object.entries(CORE_CONTRACTS[network]).map(([key, contract]) => (
          <InfoRow
            key={key}
            label={contract.name}
            value={truncateAddress(contract.address, 10, 8)}
            fullValue={contract.address}
            onCopy={() => handleCopy(contract.address, `core-${key}`)}
            copied={copiedField === `core-${key}`}
            link={`${explorerBase}/contract/${contract.address}`}
            themeColors={themeColors}
          />
        ))}
      </Section>

      {/* Required Platform Services (based on MiniApp permissions) */}
      {requiredServices.length > 0 && (
        <Section title={t("sidebar.requiredServices")} icon="🔗" themeColors={themeColors}>
          {requiredServices.map(([key, service]) => (
            <InfoRow
              key={key}
              label={service.name}
              value={truncateAddress(service.address, 10, 8)}
              fullValue={service.address}
              onCopy={() => handleCopy(service.address, key)}
              copied={copiedField === key}
              link={`${explorerBase}/contract/${service.address}`}
              themeColors={themeColors}
            />
          ))}
          {contractInfo?.serviceContracts?.map((service, idx) => (
            <InfoRow
              key={`custom-${idx}`}
              label={service.name}
              value={truncateAddress(service.address, 10, 8)}
              fullValue={service.address}
              onCopy={() => handleCopy(service.address, `service-${idx}`)}
              copied={copiedField === `service-${idx}`}
              link={`${explorerBase}/contract/${service.address}`}
              themeColors={themeColors}
            />
          ))}
        </Section>
      )}

      {/* Quick Actions */}
      <div className="mt-auto p-4 border-t space-y-2" style={{ borderColor: themeColors.border }}>
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
        {contractInfo?.contractHash && (
          <a
            href={`${explorerBase}/contract/${contractInfo.contractHash}`}
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

// Theme colors type
type ThemeColors = ReturnType<typeof getThemeColors>;

// Section Component
function Section({
  title,
  icon,
  children,
  themeColors,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  themeColors: ThemeColors;
}) {
  return (
    <div className="border-b" style={{ borderColor: themeColors.border }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: `${themeColors.primary}08` }}>
        <span>{icon}</span>
        <span className="text-sm font-medium" style={{ color: themeColors.text }}>
          {title}
        </span>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}

// Info Row Component
function InfoRow({
  label,
  value,
  fullValue,
  onCopy,
  copied,
  link,
  indicator,
  muted,
  themeColors,
}: {
  label: string;
  value: string;
  fullValue?: string;
  onCopy?: () => void;
  copied?: boolean;
  link?: string;
  indicator?: "green" | "amber" | "red";
  muted?: boolean;
  themeColors: ThemeColors;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs shrink-0" style={{ color: themeColors.textMuted }}>
        {label}
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        {indicator && (
          <span
            className={`w-2 h-2 rounded-full ${
              indicator === "green" ? "bg-emerald-500" : indicator === "amber" ? "bg-amber-500" : "bg-red-500"
            }`}
          />
        )}
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono truncate transition-colors"
            style={{ color: muted ? themeColors.textMuted : themeColors.text }}
            title={fullValue || value}
          >
            {value}
          </a>
        ) : (
          <span
            className="text-sm font-mono truncate"
            style={{ color: muted ? themeColors.textMuted : themeColors.text }}
            title={fullValue || value}
          >
            {value}
          </span>
        )}
        {onCopy && (
          <button
            onClick={onCopy}
            className="p-1 rounded transition-colors shrink-0"
            title={copied ? "Copied!" : "Copy"}
          >
            {copied ? (
              <span style={{ color: themeColors.primary }} className="text-xs">
                ✓
              </span>
            ) : (
              <CopyIcon color={themeColors.textMuted} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function CopyIcon({ color }: { color: string }) {
  return (
    <svg className="w-3 h-3" fill="none" stroke={color} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

export default RightSidebarPanel;
