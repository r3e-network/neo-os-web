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
  const isConnected = Boolean(walletAddress.trim());
  const canLoad = canLoadListings && isValidMarketHash;
  // The board can only be read once a wallet is attached. Before that, the load
  // button explains the prerequisite ("Connect wallet to load") instead of
  // sitting on a perpetual "Loading…" that never resolves without a session.
  const loadLabel = !isConnected
    ? t("loadNeedsWallet")
    : isLoading
      ? t("loadingListings")
      : t("loadListings");
  return (
    <NeoCard
      variant="erobo"
      title={t("walletAndMarket")}
      className="operation-card"
    >
      <div className="stack market-command__body">
        <div
          className={`market-command__status${isConnected ? " market-command__status--ok" : ""}`}
        >
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
            variant="primary"
            loading={isWalletConnecting}
            disabled={isConnected}
            aria-label={isConnected ? t("walletConnected") : t("connectWallet")}
            onClick={onConnect}
          >
            {isConnected ? t("walletConnected") : t("connectWallet")}
          </NeoButton>
          {/* Keep a meaningful text label at all times — a label-less wide pill
              reads as a broken/stuck control. Disabled until a wallet is
              connected (and during a read) so it stays inert without losing
              meaning. */}
          <NeoButton
            variant="secondary"
            disabled={!isConnected || !canLoad || isLoading}
            aria-label={loadLabel}
            onClick={onLoadListings}
          >
            {loadLabel}
          </NeoButton>
        </div>
      </div>
    </NeoCard>
  );
}
