import { useEffect, useMemo, useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import {
  getLaunchParam,
  type MiniAppLaunchContext,
} from "@shared/utils/launch-params";
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
  launchContext: MiniAppLaunchContext;
}

export default function PlayArea({
  t,
  state,
  dispatch,
  launchContext,
}: PlayAreaProps) {
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
  const stateMarketHash = str("marketHash");
  const stateAaContractHash = str("aaContractHash");
  const stateAccountIdHash = str("accountIdHash");
  const statePriceGas = str("priceGas");
  const stateListingTitle = str("listingTitle");
  const stateMetadataUri = str("metadataUri");
  const selectedListingDisplay = str(
    "selectedListingDisplay",
    t("notAvailable"),
  );

  const launchValues = useMemo(
    () => ({
      marketHash: getLaunchParam(launchContext, [
        "marketHash",
        "market",
        "marketContract",
        "marketContractHash",
      ]),
      aaContractHash: getLaunchParam(launchContext, [
        "aaContractHash",
        "aaContract",
        "aaCore",
        "aaCoreHash",
      ]),
      accountIdHash: getLaunchParam(launchContext, [
        "accountIdHash",
        "accountId",
        "account",
      ]),
      priceGas: getLaunchParam(launchContext, [
        "priceGas",
        "price",
        "amount",
      ]),
      listingTitle: getLaunchParam(launchContext, [
        "listingTitle",
        "title",
        "item",
      ]),
      metadataUri: getLaunchParam(launchContext, [
        "metadataUri",
        "metadata",
        "uri",
      ]),
    }),
    [launchContext],
  );
  const resolvedMarketHash = launchValues.marketHash || stateMarketHash;
  const [marketHash, setMarketHash] = useState(resolvedMarketHash);
  const canLoadListings = Boolean(marketHash.trim());
  const isMarketReady = canLoadListings;
  const listingCountLabel = String(totalListings || listings.length);
  const activeCountLabel = String(activeListings);

  useEffect(() => {
    setMarketHash(resolvedMarketHash);
  }, [launchContext.signature, resolvedMarketHash]);

  return (
    <div className="market-play-area">
      <section className="market-hero">
        <div className="market-hero__copy">
          <div className="market-hero__head">
            <span className="market-hero__badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M3 6h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <h2>{t("marketHeroTitle")}</h2>
          </div>
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
            walletAddress={walletAddress}
            marketHash={marketHash}
            initialAaContractHash={
              launchValues.aaContractHash || stateAaContractHash
            }
            initialAccountIdHash={
              launchValues.accountIdHash || stateAccountIdHash
            }
            initialPriceGas={launchValues.priceGas || statePriceGas}
            initialListingTitle={
              launchValues.listingTitle || stateListingTitle
            }
            initialMetadataUri={launchValues.metadataUri || stateMetadataUri}
            initialSignature={launchContext.signature}
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
