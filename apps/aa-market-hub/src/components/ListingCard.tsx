import { NeoButton, NeoCard } from "@shared/components-react";
import { formatGasFractions, type MarketListing } from "../utils/aa-market";
import "./ListingCard.scss";

interface ListingCardProps {
  listing: MarketListing;
  isSelected: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelect: (listing: MarketListing) => void;
}

export function ListingCard({ listing, isSelected, t, onSelect }: ListingCardProps) {
  const hasPendingPayment = BigInt(listing.myPendingPayment || "0") > 0n;

  return (
    <NeoCard
      variant="erobo"
      className={`listing-card${isSelected ? " listing-card--selected" : ""}`}
    >
      <div className="listing-card__header">
        <div>
          <div className="listing-card__title">
            <span>#{listing.id}</span>
            <span className={`chip chip--${listing.status}`}>{listing.status}</span>
            {listing.isMine && <span className="chip chip--mine">{t("mine")}</span>}
            {hasPendingPayment && <span className="chip chip--pending">{t("pendingRefund")}</span>}
          </div>
          <p className="listing-card__subtitle">{listing.title || t("untitledListing")}</p>
        </div>
        <NeoButton variant="secondary" aria-label={isSelected ? t("selected") : t("selectListing")} onClick={() => onSelect(listing)}>
          {isSelected ? t("selected") : t("selectListing")}
        </NeoButton>
      </div>

      <div className="row"><span className="label">{t("priceLabel")}</span><span className="value">{listing.priceGas} {t("tokenGas")}</span></div>
      <div className="row"><span className="label">{t("aaContractLabel")}</span><span className="value">{listing.aaContractHash}</span></div>
      <div className="row"><span className="label">{t("accountIdLabel")}</span><span className="value">{listing.accountIdHash}</span></div>
      <div className="row"><span className="label">{t("sellerLabel")}</span><span className="value">{listing.seller || t("notAvailable")}</span></div>
      <div className="row"><span className="label">{t("buyerLabel")}</span><span className="value">{listing.buyer || t("notAvailable")}</span></div>
      {listing.metadataUri && (
        <div className="row">
          <span className="label">{t("metadataLabel")}</span>
          <a className="value value--link" href={listing.metadataUri} target="_blank" rel="noopener noreferrer" aria-label={t("viewMetadata")}>{listing.metadataUri}</a>
        </div>
      )}
      {hasPendingPayment && (
        <div className="row">
          <span className="label">{t("myPendingPayment")}</span>
          <span className="value">{formatGasFractions(listing.myPendingPayment)} {t("tokenGas")}</span>
        </div>
      )}
    </NeoCard>
  );
}
