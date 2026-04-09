import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";

interface WalletConnectCardProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  marketHash: string;
  walletAddress: string;
  isWalletConnecting: boolean;
  isLoading: boolean;
  onMarketHashChange: (value: string) => void;
  onConnect: () => void;
  onLoadListings: () => void;
}

export function WalletConnectCard({ t, marketHash, walletAddress, isWalletConnecting, isLoading, onMarketHashChange, onConnect, onLoadListings }: WalletConnectCardProps) {
  return (
    <NeoCard variant="erobo" title={t("walletAndMarket")} className="operation-card">
      <div className="stack">
        <NeoInput value={marketHash} label={t("marketHash")} placeholder={t("marketHashPlaceholder")} onChange={onMarketHashChange} />
        <NeoButton variant="secondary" loading={isWalletConnecting} aria-label={walletAddress ? t("walletConnected") : t("connectWallet")} onClick={onConnect}>
          {walletAddress ? t("walletConnected") : t("connectWallet")}
        </NeoButton>
        <NeoButton variant="primary" loading={isLoading} aria-label={t("loadListings")} onClick={onLoadListings}>
          {t("loadListings")}
        </NeoButton>
      </div>
    </NeoCard>
  );
}
