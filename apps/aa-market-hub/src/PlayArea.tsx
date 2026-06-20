import { useEffect, useMemo, useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import {
  getLaunchParam,
  type MiniAppLaunchContext,
} from "@shared/utils/launch-params";
import { Boxes, ChevronDown, ShieldCheck, Store } from "lucide-react";
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
  const isUpdatingPrice = bool("isUpdatingPrice");
  const isCancelling = bool("isCancelling");
  const isBuying = bool("isBuying");
  const isRefunding = bool("isRefunding");
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
  const listingsTruncatedNotice = str("listingsTruncatedNotice");
  const stateMarketHash = str("marketHash");
  const stateAaContractHash = str("aaContractHash");
  const stateAccountIdHash = str("accountIdHash");
  const statePriceGas = str("priceGas");
  const stateListingTitle = str("listingTitle");
  const stateMetadataUri = str("metadataUri");

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
      priceGas: getLaunchParam(launchContext, ["priceGas", "price", "amount"]),
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
  const hasWallet = Boolean(walletAddress.trim());
  const hasMarketHash = Boolean(marketHash.trim());
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
              <Store />
            </span>
            <div className="market-hero__title">
              <span className="market-hero__eyebrow">{t("appName")}</span>
              <h2>{t("marketHeroTitle")}</h2>
              <p>{t("docsSubtitle")}</p>
            </div>
          </div>
          <div
            className="market-hero__metrics"
            aria-label={t("marketMetricsLabel")}
          >
            <div className="market-hero__metric">
              <strong>{listingCountLabel}</strong>
              <span>{t("marketMetricListings")}</span>
            </div>
            <div className="market-hero__metric">
              <strong>{activeCountLabel}</strong>
              <span>{t("marketMetricActive")}</span>
            </div>
          </div>
        </div>
        <div
          className="market-hero__visual"
          role="img"
          aria-label={t("marketHeroVisualAlt")}
        >
          <img
            src="./market-escrow-desk.jpg"
            alt=""
            loading="eager"
            decoding="async"
          />
          <span>
            <ShieldCheck aria-hidden="true" />
            {t("marketHeroVisualBadge")}
          </span>
        </div>
      </section>

      <section className="market-gate">
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
      </section>

      <section className="market-workspace">
        <aside
          className={`market-side-rail${selectedListing ? "" : " market-side-rail--single"}`}
        >
          <div className="market-side-rail__primary">
            <CreateListingCard
              t={t}
              isSubmitting={isSubmitting}
              isMarketReady={isMarketReady}
              walletAddress={walletAddress}
              marketHash={marketHash}
              isWalletConnecting={isWalletConnecting}
              onConnect={() => dispatch("connectWallet")}
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

            {/* The Shell-Only Transfer note belongs under Create Listing in the
                same column. It used to float alone in a wide aux column,
                stranding a tall empty band whenever no listing was selected. */}
            <details className="market-caveat">
              <summary>
                <span>{t("feature2Name")}</span>
                <ChevronDown
                  className="market-disclosure__chevron"
                  aria-hidden="true"
                />
              </summary>
              <p>{t("hubSummary")}</p>
            </details>
          </div>

          {/* The aux column only appears once a listing is selected — until then
              the rail collapses to a single column so Create Listing spans the
              full width instead of leaving an empty right half. */}
          {selectedListing && (
            <div className="market-side-rail__aux">
              <ManageListingCard
                t={t}
                selectedListing={selectedListing}
                isUpdatingPrice={isUpdatingPrice}
                isCancelling={isCancelling}
                isBuying={isBuying}
                isRefunding={isRefunding}
                canManage={canManageSelectedListing}
                canBuy={canBuySelectedListing}
                hasPendingRefund={selectedListingHasPendingRefund}
                walletAddress={walletAddress}
                dispatch={dispatch}
              />
            </div>
          )}
        </aside>

        <div className="market-list-panel">
          <div className="market-section-heading">
            <div>
              <span>{t("marketBoardLabel")}</span>
              <h3>{t("marketBoardTitle")}</h3>
            </div>
          </div>

          {listingsTruncatedNotice && (
            <p className="hint-text market-list-panel__truncated" role="status">
              {listingsTruncatedNotice}
            </p>
          )}

          {!hasMarketHash && (
            <div className="empty-state">
              <span className="empty-state__badge" aria-hidden="true">
                <Store />
              </span>
              <strong>{t("emptyStateTitle")}</strong>
              <span>{t("emptyStateEnterHash")}</span>
            </div>
          )}

          {/* The board read needs a wallet provider. Without a session, rest on
              a "connect to load" state instead of a spinner that never resolves;
              connecting the wallet kicks off the load automatically. The connect
              action itself lives once in the wallet bar above, so this state is
              purely informational and points there rather than repeating the
              primary CTA. */}
          {hasMarketHash && listings.length === 0 && !hasWallet && (
            <div className="empty-state">
              <span className="empty-state__badge" aria-hidden="true">
                <Store />
              </span>
              <strong>{t("emptyStateConnectTitle")}</strong>
              <span>{t("emptyStateConnect")}</span>
            </div>
          )}

          {/* Wallet is connected and the read is in flight — show a loading
              placeholder beneath the "Listings" heading so it is never left
              orphaned above blank space. */}
          {hasMarketHash && listings.length === 0 && hasWallet && isLoading && (
            <div className="empty-state empty-state--loading" aria-busy="true">
              <span className="empty-state__spinner" aria-hidden="true" />
              <strong>{t("emptyStateLoadingTitle")}</strong>
              <span>{t("emptyStateLoading")}</span>
            </div>
          )}

          {hasMarketHash &&
            listings.length === 0 &&
            hasWallet &&
            !isLoading && (
              <div className="empty-state">
                <span className="empty-state__badge" aria-hidden="true">
                  <Boxes />
                </span>
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

          {!selectedListing && listings.length > 0 && (
            <p className="hint-text market-list-panel__hint">
              {t("selectListingHint")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
