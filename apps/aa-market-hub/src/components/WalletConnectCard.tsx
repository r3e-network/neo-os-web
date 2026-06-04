import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { isHash160OrNeoAddress } from "../utils/validation";

interface WalletConnectCardProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  marketHash: string;
  walletAddress: string;
  isWalletConnecting: boolean;
  isLoading: boolean;
  canLoadListings: boolean;
  onMarketHashChange: (value: string) => void;
  onConnect: () => void;
  onLoadListings: () => void;
}

export function WalletConnectCard({
  t,
  marketHash,
  walletAddress,
  isWalletConnecting,
  isLoading,
  canLoadListings,
  onMarketHashChange,
  onConnect,
  onLoadListings,
}: WalletConnectCardProps) {
  const trimmedMarketHash = marketHash.trim();
  const isValidMarketHash = isHash160OrNeoAddress(trimmedMarketHash);
  const canLoad = canLoadListings && isValidMarketHash;
  return (
    <NeoCard
      variant="erobo"
      title={t("walletAndMarket")}
      className="operation-card"
    >
      <div className="stack market-command__body">
        <div className="market-command__status">
          <span>{t("walletLabel")}</span>
          <strong>{walletAddress || t("notConnected")}</strong>
        </div>
        <NeoInput
          value={marketHash}
          label={t("marketHash")}
          hint={t("marketHashHint")}
          placeholder={t("marketHashPlaceholder")}
          error={
            trimmedMarketHash && !isValidMarketHash ? t("invalidHashInput") : ""
          }
          onChange={onMarketHashChange}
        />
        <div className="market-command__actions">
          <NeoButton
            variant="secondary"
            loading={isWalletConnecting}
            disabled={Boolean(walletAddress.trim())}
            aria-label={
              walletAddress ? t("walletConnected") : t("connectWallet")
            }
            onClick={onConnect}
          >
            {walletAddress ? t("walletConnected") : t("connectWallet")}
          </NeoButton>
          <NeoButton
            variant="primary"
            loading={isLoading}
            disabled={!canLoad}
            aria-label={t("loadListings")}
            onClick={onLoadListings}
          >
            {t("loadListings")}
          </NeoButton>
        </div>
      </div>
    </NeoCard>
  );
}
