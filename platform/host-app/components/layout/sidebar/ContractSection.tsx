import React from "react";
import { Section } from "./Section";
import { InfoRow } from "./InfoRow";
import { truncateAddress } from "./utils";
import type { ContractInfo, ThemeColors } from "./types";

interface ContractSectionProps {
  appId: string;
  contractInfo?: ContractInfo;
  contractAddress: string | null;
  isNeoChain: boolean;
  explorerBase: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  themeColors: ThemeColors;
  t: (key: string) => string;
}

export function ContractSection({
  appId,
  contractInfo,
  contractAddress,
  isNeoChain,
  explorerBase,
  copiedField,
  onCopy,
  themeColors,
  t,
}: ContractSectionProps) {
  return (
    <Section title={t("sidebar.miniappContract")} icon="&#128220;" themeColors={themeColors}>
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
