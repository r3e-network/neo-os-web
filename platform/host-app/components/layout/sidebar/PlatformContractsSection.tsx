import React from "react";
import { Section } from "./Section";
import { InfoRow } from "./InfoRow";
import { truncateAddress } from "./utils";
import { CORE_CONTRACTS } from "./constants";
import type { ThemeColors } from "./types";
import type { ChainId } from "../../../lib/chains/types";

interface PlatformContractsSectionProps {
  activeChainId: ChainId;
  isNeoChain: boolean;
  explorerBase: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  themeColors: ThemeColors;
  t: (key: string) => string;
}

export function PlatformContractsSection({
  activeChainId,
  isNeoChain,
  explorerBase,
  copiedField,
  onCopy,
  themeColors,
  t,
}: PlatformContractsSectionProps) {
  if (!isNeoChain || !CORE_CONTRACTS[activeChainId]) return null;

  return (
    <Section title={t("sidebar.platformContracts")} icon="&#127963;&#65039;" themeColors={themeColors}>
      {Object.entries(CORE_CONTRACTS[activeChainId]!).map(([key, contract]) => (
        <InfoRow
          key={key}
          label={contract.name}
          value={truncateAddress(contract.address)}
          fullValue={contract.address}
          onCopy={() => onCopy(contract.address, `core-${key}`)}
          copied={copiedField === `core-${key}`}
          link={`${explorerBase}/address/${contract.address}`}
          themeColors={themeColors}
        />
      ))}
    </Section>
  );
}
