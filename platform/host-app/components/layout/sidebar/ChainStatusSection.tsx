import React from "react";
import { Section } from "./Section";
import { InfoRow } from "./InfoRow";
import { truncateAddress } from "./utils";
import { CHAIN_MASTER_ACCOUNTS } from "./constants";
import type { ThemeColors } from "./types";
import type { ChainId } from "../../../lib/chains/types";

interface ChainStatusSectionProps {
  activeChainId: ChainId;
  chainName: string;
  chainIcon: string;
  rpcUrl: string;
  explorerBase: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  themeColors: ThemeColors;
  t: (key: string) => string;
}

export function ChainStatusSection({
  activeChainId,
  chainName,
  chainIcon,
  rpcUrl,
  explorerBase,
  copiedField,
  onCopy,
  themeColors,
  t,
}: ChainStatusSectionProps) {
  const masterAccountAddress = CHAIN_MASTER_ACCOUNTS[activeChainId];

  return (
    <Section title={t("sidebar.chain") || "Chain"} icon="&#127760;" themeColors={themeColors}>
      <div className="flex items-center gap-2 mb-2">
        <img src={chainIcon} alt="" className="w-5 h-5" />
        <span className="font-medium">{chainName}</span>
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
          onCopy={() => onCopy(masterAccountAddress, "platformMasterAccount")}
          copied={copiedField === "platformMasterAccount"}
          link={`${explorerBase}/address/${masterAccountAddress}`}
          themeColors={themeColors}
        />
      )}
    </Section>
  );
}
