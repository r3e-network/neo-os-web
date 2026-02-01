"use client";

import React, { useState, useEffect } from "react";
import { useWalletStore } from "../../lib/wallet/store";
import { useTranslation } from "../../lib/i18n/react";
import { useTheme } from "../providers/ThemeProvider";
import { getThemeColors } from "../styles";
import type { ChainId } from "../../lib/chains/types";
import { getChainRegistry } from "../../lib/chains/registry";
import { getChainRpcUrl } from "../../lib/chain/rpc-client";

// Platform master accounts (Neo N3 only)
const CHAIN_MASTER_ACCOUNTS: Partial<Record<ChainId, string>> = {
  "neo-n3-mainnet": "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK",
  "neo-n3-testnet": "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK",
};

// Platform Core Contracts by chain (Neo N3 only)
const CORE_CONTRACTS: Partial<
  Record<
    ChainId,
    Record<
      string,
      {
        address: string;
        name: string;
        description: string;
      }
    >
  >
> = {
  "neo-n3-testnet": {
    ServiceGateway: {
      address: "NTWh6auSz3nvBZSbXHbZz4ShwPhmpkC5Ad",
      name: "Service Gateway",
      description: "Platform entry point",
    },
    Governance: {
      address: "NLRGStjsRpN3bk71KNoKe74fNxUT72gfpe",
      name: "Governance",
      description: "DAO governance contract",
    },
  },
  "neo-n3-mainnet": {
    ServiceGateway: {
      address: "NfaEbVnKnUQSd4MhNXz9pY4Uire7EiZtai",
      name: "Service Gateway",
      description: "Platform entry point",
    },
    Governance: {
      address: "NMhpz6kT77SKaYwNHrkTv8QXpoPuSd3VJn",
      name: "Governance",
      description: "DAO governance contract",
    },
  },
};

// Platform Service Contracts by chain (Neo N3 only)
const PLATFORM_SERVICES: Partial<
  Record<
    ChainId,
    Record<
      string,
      {
        address: string;
        name: string;
        description: string;
      }
    >
  >
> = {
  "neo-n3-testnet": {
    PaymentHub: {
      address: "NZLGNdQUa5jQ2VC1r3MGoJFGm3BW8Kv81q",
      name: "Payment Hub",
      description: "Handles GAS payments",
    },
    RandomnessOracle: {
      address: "NR9urKR3FZqAfvowx2fyWjtWHBpqLqrEPP",
      name: "Randomness Oracle",
      description: "Verifiable random numbers",
    },
    PriceFeed: {
      address: "NTdJ7XHZtYXSRXnWGxV6TcyxiSRCcjP4X1",
      name: "Price Feed",
      description: "Real-time price oracle",
    },
  },
  "neo-n3-mainnet": {
    PaymentHub: {
      address: "NaqDPjXnYsm8W5V3xXuDUZe5W1HRLsMsx2",
      name: "Payment Hub",
      description: "Handles GAS payments",
    },
    RandomnessOracle: {
      address: "NPJXDzwaU8UDct7247oq3YhLxJKkJsmhaa",
      name: "Randomness Oracle",
      description: "Verifiable random numbers",
    },
    PriceFeed: {
      address: "NPW7dXnqBUoQ3aoxg86wMsKbgt8VD2HhWQ",
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
  contractAddress?: string | null;
  masterKeyAddress?: string;
  gasContractAddress?: string;
  serviceContracts?: ServiceContract[];
}

// MiniApp permissions structure
interface MiniAppPermissions {
  payments?: boolean;
  governance?: boolean;
  rng?: boolean;
  datafeed?: boolean;
  confidential?: boolean;
  automation?: boolean;
}

// Map permissions to platform service keys
const PERMISSION_TO_SERVICE: Record<string, string> = {
  payments: "PaymentHub",
  rng: "RandomnessOracle",
  datafeed: "PriceFeed",
};

interface RightSidebarPanelProps {
  appId: string;
  appName: string;
  contractInfo?: ContractInfo;
  permissions?: MiniAppPermissions;
  /** Chain ID - null if app has no chain support */
  chainId?: ChainId | null;
}

function truncateAddress(address: string, start = 6, end = 4): string {
  if (!address || address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

// Base58 alphabet for Neo
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// Known script hash to address mappings (pre-computed for common contracts)
const KNOWN_ADDRESSES: Record<string, string> = {
  // Add known contract addresses here as needed
};

// Convert script hash (0x...) to Neo N3 address using proper Base58Check
async function scriptHashToAddressAsync(scriptHash: string): Promise<string> {
  try {
    // Check known addresses first
    const normalized = scriptHash.toLowerCase();
    if (KNOWN_ADDRESSES[normalized]) return KNOWN_ADDRESSES[normalized];

    // Remove 0x prefix if present
    const hash = scriptHash.startsWith("0x") ? scriptHash.slice(2) : scriptHash;
    if (hash.length !== 40) return scriptHash; // Invalid hash length

    // Reverse byte order (little-endian to big-endian)
    const reversed = hash.match(/.{2}/g)?.reverse().join("") || hash;

    // Add Neo N3 address version byte (0x35 = 53)
    const withVersion = "35" + reversed;

    // Convert hex to bytes
    const bytes: number[] = [];
    for (let i = 0; i < withVersion.length; i += 2) {
      bytes.push(parseInt(withVersion.substr(i, 2), 16));
    }

    // Double SHA256 for checksum using Web Crypto API
    const data = new Uint8Array(bytes);
    const hash1 = await crypto.subtle.digest("SHA-256", data);
    const hash2 = await crypto.subtle.digest("SHA-256", hash1);
    const checksumBytes = Array.from(new Uint8Array(hash2)).slice(0, 4);

    // Append checksum
    const dataWithChecksum = [...bytes, ...checksumBytes];

    // Base58 encode
    let num = BigInt(0);
    for (const byte of dataWithChecksum) {
      num = num * BigInt(256) + BigInt(byte);
    }

    let encoded = "";
    while (num > 0) {
      const remainder = Number(num % BigInt(58));
      encoded = BASE58_ALPHABET[remainder] + encoded;
      num = num / BigInt(58);
    }

    // Add leading '1's for leading zero bytes
    for (const byte of dataWithChecksum) {
      if (byte === 0) encoded = "1" + encoded;
      else break;
    }

    return encoded || scriptHash;
  } catch {
    return scriptHash;
  }
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

  // Use prop chainId or fall back to store chainId
  const activeChainId = propChainId || storeChainId;
  const registry = getChainRegistry();
  const chainConfig = registry.getChain(activeChainId);
  const isNeoChain = chainConfig?.type === "neo-n3" || activeChainId.startsWith("neo-n3");
  const masterAccountAddress = CHAIN_MASTER_ACCOUNTS[activeChainId];

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

  // Filter platform services based on MiniApp's declared permissions (Neo N3 only)
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

      {/* Chain Status */}
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
        {masterAccountAddress && (
          <InfoRow
            label={t("sidebar.masterAccount")}
            value={truncateAddress(masterAccountAddress)}
            fullValue={masterAccountAddress}
            onCopy={() => handleCopy(masterAccountAddress, "platformMasterAccount")}
            copied={copiedField === "platformMasterAccount"}
            link={`${explorerBase}/address/${masterAccountAddress}`}
            themeColors={themeColors}
          />
        )}
      </Section>

      {/* Connected Wallet */}
      <Section title={t("sidebar.wallet")} icon="👛" themeColors={themeColors}>
        {connected ? (
          <>
            <InfoRow
              label={t("sidebar.address")}
              value={truncateAddress(address)}
              fullValue={address}
              onCopy={() => handleCopy(address, "wallet")}
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
          <div className="flex flex-col items-center py-6 text-center gap-2" style={{ color: themeColors.textMuted }}>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl opacity-50"
              style={{ background: `${themeColors.primary}10` }}
            >
              👛
            </div>
            <span className="text-xs font-medium">{t("sidebar.noWallet")}</span>
          </div>
        )}
      </Section>

      {/* MiniApp Contract */}
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
              onCopy={() =>
                handleCopy((isNeoChain ? contractAddress : contractInfo.contractAddress) || "", "contractAddr")
              }
              copied={copiedField === "contractAddr"}
              link={`${explorerBase}/${isNeoChain ? "contract" : "address"}/${contractInfo.contractAddress}`}
              themeColors={themeColors}
            />
            {isNeoChain && (
              <InfoRow
                label={t("sidebar.scriptHash")}
                value={truncateAddress(contractInfo.contractAddress)}
                fullValue={contractInfo.contractAddress}
                onCopy={() => handleCopy(contractInfo.contractAddress!, "contract")}
                copied={copiedField === "contract"}
                themeColors={themeColors}
                muted
              />
            )}
          </>
        ) : (
          <InfoRow
            label={t("sidebar.contractAddress")}
            value={t("sidebar.noContract")}
            muted
            themeColors={themeColors}
          />
        )}
        {contractInfo?.masterKeyAddress && (
          <InfoRow
            label={t("sidebar.masterKey")}
            value={truncateAddress(contractInfo.masterKeyAddress)}
            fullValue={contractInfo.masterKeyAddress}
            onCopy={() => handleCopy(contractInfo.masterKeyAddress!, "masterKey")}
            copied={copiedField === "masterKey"}
            link={`${explorerBase}/address/${contractInfo.masterKeyAddress}`}
            themeColors={themeColors}
          />
        )}
      </Section>

      {/* Platform Core Contracts (Neo N3 only) */}
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

      {/* Required Platform Services (based on MiniApp permissions) */}
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
            className={`w-2 h-2 rounded-full ${indicator === "green" ? "bg-emerald-500" : indicator === "amber" ? "bg-amber-500" : "bg-red-500"
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
