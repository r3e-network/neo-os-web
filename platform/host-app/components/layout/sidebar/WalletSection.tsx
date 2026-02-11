import React from "react";
import { Section } from "./Section";
import { InfoRow } from "./InfoRow";
import { truncateAddress } from "./utils";
import type { ThemeColors } from "./types";

interface WalletSectionProps {
  connected: boolean;
  address: string;
  provider: string | null;
  balance: {
    governance?: string;
    governanceSymbol?: string;
    native: string;
    nativeSymbol: string;
  } | null;
  explorerBase: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  themeColors: ThemeColors;
  t: (key: string) => string;
}

export function WalletSection({
  connected,
  address,
  provider,
  balance,
  explorerBase,
  copiedField,
  onCopy,
  themeColors,
  t,
}: WalletSectionProps) {
  return (
    <Section title={t("sidebar.wallet")} icon="&#128091;" themeColors={themeColors}>
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
        <div className="flex flex-col items-center py-6 text-center gap-2" style={{ color: themeColors.textMuted }}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl opacity-50"
            style={{ background: `${themeColors.primary}10` }}
          >
            &#128091;
          </div>
          <span className="text-xs font-medium">{t("sidebar.noWallet")}</span>
        </div>
      )}
    </Section>
  );
}
