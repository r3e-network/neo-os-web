import { useState } from "react";
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
  const { str, bool, num, val } = useStateBindings(state);

  const listings = val<MarketListing[]>("listings") ?? [];
  const isLoading = bool("isLoading");
  const isSubmitting = bool("isSubmitting");
  const isWalletConnecting = bool("isWalletConnecting");
  const walletAddress = str("walletAddress");
  const selectedListingId = str("selectedListingId");
  const selectedListing = val<MarketListing>("selectedListing");
  const selectedListingHasPendingRefund = bool(
    "selectedListingHasPendingRefund",
  );
  const canManageSelectedListing = bool("canManageSelectedListing");
  const canBuySelectedListing = bool("canBuySelectedListing");
  const totalListings = num("totalListingsDisplay", listings.length);
  const activeListings = num("activeListingsDisplay", 0);
  const selectedListingDisplay = str(
    "selectedListingDisplay",
    t("notAvailable"),
  );

  const [marketHash, setMarketHash] = useState("");
  const canLoadListings = Boolean(marketHash.trim());
  const isMarketReady = canLoadListings;
  const listingCountLabel = String(totalListings || listings.length);
  const activeCountLabel = String(activeListings);

  return (
    <div className="market-play-area">
      <section className="market-hero">
        <div className="market-hero__copy">
          <h2>{t("marketHeroTitle")}</h2>
          <p>{t("hubSummary")}</p>
          <div
            className="market-hero__metrics"
            aria-label={t("marketMetricsLabel")}
          >
            <div className="market-metric">
              <span>{t("marketMetricListings")}</span>
              <strong>{listingCountLabel}</strong>
            </div>
            <div className="market-metric">
              <span>{t("marketMetricActive")}</span>
              <strong>{activeCountLabel}</strong>
            </div>
            <div className="market-metric">
              <span>{t("selectedListingLabel")}</span>
              <strong>{selectedListingDisplay}</strong>
            </div>
          </div>
        </div>
        <div className="market-command">
          <WalletConnectCard
            t={t}
            marketHash={marketHash}
            walletAddress={walletAddress}
            isWalletConnecting={isWalletConnecting}
            isLoading={isLoading}
            canLoadListings={canLoadListings}
            onMarketHashChange={setMarketHash}
            onConnect={() => dispatch("connectWallet")}
            onLoadListings={() => dispatch("loadListings", marketHash)}
          />
        </div>
      </section>

      <section className="market-steps" aria-label={t("marketStepsLabel")}>
        <div className="market-step">
          <span className="market-step__icon">01</span>
          <strong>{t("marketStepConnect")}</strong>
          <span>{t("marketStepConnectDesc")}</span>
        </div>
        <div className="market-step">
          <span className="market-step__icon">02</span>
          <strong>{t("marketStepLoad")}</strong>
          <span>{t("marketStepLoadDesc")}</span>
        </div>
        <div className="market-step">
          <span className="market-step__icon">03</span>
          <strong>{t("marketStepSettlement")}</strong>
          <span>{t("marketStepSettlementDesc")}</span>
        </div>
      </section>

      <section className="market-workspace">
        <div className="market-list-panel">
          <div className="market-section-heading">
            <div>
              <span>{t("marketBoardLabel")}</span>
              <h3>{t("marketBoardTitle")}</h3>
            </div>
            <strong>{listingCountLabel}</strong>
          </div>

          {!marketHash.trim() && (
            <div className="empty-state">
              <span className="empty-state__badge">AA</span>
              <strong>{t("emptyStateTitle")}</strong>
              <span>{t("emptyStateEnterHash")}</span>
            </div>
          )}

          {marketHash.trim() && listings.length === 0 && !isLoading && (
            <div className="empty-state">
              <span className="empty-state__badge">0</span>
              <strong>{t("emptyStateNoListingsTitle")}</strong>
              <span>{t("emptyStateNoListings")}</span>
            </div>
          )}

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
        </div>

        <aside className="market-side-rail">
          <CreateListingCard
            t={t}
            isSubmitting={isSubmitting}
            isMarketReady={isMarketReady}
            dispatch={dispatch}
          />

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
        </aside>
      </section>
    </div>
  );
}
