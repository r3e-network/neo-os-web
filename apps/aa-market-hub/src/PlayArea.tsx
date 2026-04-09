import { useState } from "react";
import { NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MarketListing } from "./utils/aa-market";
import { ListingCard } from "./components/ListingCard";
import { WalletConnectCard } from "./components/WalletConnectCard";
import { CreateListingCard } from "./components/CreateListingCard";
import { ManageListingCard } from "./components/ManageListingCard";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  // State bindings
  const listings = val<MarketListing[]>("listings") ?? [];
  const isLoading = bool("isLoading");
  const isSubmitting = bool("isSubmitting");
  const isWalletConnecting = bool("isWalletConnecting");
  const walletAddress = str("walletAddress");
  const selectedListingId = str("selectedListingId");
  const selectedListing = val<MarketListing>("selectedListing");
  const selectedListingHasPendingRefund = bool("selectedListingHasPendingRefund");
  const canCreateListing = bool("canCreateListing");
  const canManageSelectedListing = bool("canManageSelectedListing");
  const canBuySelectedListing = bool("canBuySelectedListing");

  // Local form state
  const [marketHash, setMarketHash] = useState("");

  return (
    <div className="market-play-area">
      {/* Summary */}
      <NeoCard variant="erobo" className="mb-6">
        <p className="summary">{t("hubSummary")}</p>
      </NeoCard>

      {!marketHash.trim() && (
        <div className="empty-state">
          {t("emptyStateEnterHash")}
        </div>
      )}

      {marketHash.trim() && listings.length === 0 && !isLoading && (
        <div className="empty-state">
          {t("emptyStateNoListings")}
        </div>
      )}

      {/* Listing Cards */}
      <div className="listings">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            isSelected={listing.id === selectedListingId}
            t={t}
            onSelect={(l) => dispatch("selectListing", l.id)}
          />
        ))}
      </div>

      {/* Wallet & Market */}
      <WalletConnectCard
        t={t}
        marketHash={marketHash}
        walletAddress={walletAddress}
        isWalletConnecting={isWalletConnecting}
        isLoading={isLoading}
        onMarketHashChange={setMarketHash}
        onConnect={() => dispatch("connectWallet")}
        onLoadListings={() => dispatch("loadListings", marketHash)}
      />

      {/* Create Listing */}
      <CreateListingCard
        t={t}
        isSubmitting={isSubmitting}
        canCreateListing={canCreateListing}
        dispatch={dispatch}
      />

      {/* Manage Listing */}
      <ManageListingCard
        t={t}
        selectedListing={selectedListing}
        isSubmitting={isSubmitting}
        canManage={canManageSelectedListing}
        canBuy={canBuySelectedListing}
        hasPendingRefund={selectedListingHasPendingRefund}
        walletAddress={walletAddress}
        dispatch={dispatch}
      />
    </div>
  );
}
