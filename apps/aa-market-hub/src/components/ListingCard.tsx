import { NeoButton, NeoCard } from "@shared/components-react";
import { CheckCircle2, MousePointer2 } from "lucide-react";
import { formatGasFractions, type MarketListing } from "../utils/aa-market";
import "./ListingCard.scss";

interface ListingCardProps {
  listing: MarketListing;
  isSelected: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelect: (listing: MarketListing) => void;
}

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

const STATUS_KEY: Record<string, string> = {
  active: "statusActive",
  sold: "statusSold",
  cancelled: "statusCancelled",
};

/** Localized listing status; falls back to the unknown label. */
export function statusLabel(status: string, t: Translate): string {
  return t(STATUS_KEY[status] ?? "statusUnknown");
}

/**
 * Render a contract timestamp (unix seconds, as a decimal string) as a localized
 * relative time. Returns "" for missing/zero timestamps so callers can omit the
 * line entirely.
 */
export function relativeTime(secondsValue: string, t: Translate): string {
  const seconds = Number(secondsValue || "0");
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const deltaSeconds = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  if (deltaSeconds < 60) return t("timeJustNow");
  if (deltaSeconds < 3600) {
    return t("timeMinutesAgo", { count: Math.floor(deltaSeconds / 60) });
  }
  if (deltaSeconds < 86400) {
    return t("timeHoursAgo", { count: Math.floor(deltaSeconds / 3600) });
  }
  return t("timeDaysAgo", { count: Math.floor(deltaSeconds / 86400) });
}

export function ListingCard({
  listing,
  isSelected,
  t,
  onSelect,
}: ListingCardProps) {
  const hasPendingPayment = BigInt(listing.myPendingPayment || "0") > 0n;
  // Prefer the most recent timestamp; show "updated" when it differs from the
  // listing creation time, otherwise "listed".
  const updatedRel = relativeTime(listing.updatedAt, t);
  const listedRel = relativeTime(listing.createdAt, t);
  const showUpdated =
    Boolean(updatedRel) && listing.updatedAt !== listing.createdAt;
  const freshness = showUpdated
    ? t("updatedAgo", { time: updatedRel })
    : listedRel
      ? t("listedAgo", { time: listedRel })
      : "";

  return (
    <NeoCard
      variant="erobo"
      className={`listing-card${isSelected ? " listing-card--selected" : ""}`}
    >
      <div className="listing-card__header">
        <div className="listing-card__identity">
          <span className="listing-card__avatar">AA</span>
          <div>
            <div className="listing-card__title">
              <span>#{listing.id}</span>
              <span className={`chip chip--${listing.status}`}>
                {statusLabel(listing.status, t)}
              </span>
              {listing.isMine && (
                <span className="chip chip--mine">{t("mine")}</span>
              )}
              {hasPendingPayment && (
                <span className="chip chip--pending">{t("pendingRefund")}</span>
              )}
            </div>
            <p className="listing-card__subtitle">
              {listing.title || t("untitledListing")}
            </p>
            {freshness && (
              <p className="listing-card__freshness">{freshness}</p>
            )}
          </div>
        </div>
        <div className="listing-card__price">
          <strong>{listing.priceGas}</strong>
          <span>{t("tokenGas")}</span>
        </div>
      </div>

      <div className="listing-card__details">
        <div className="row">
          <span className="label">{t("aaContractLabel")}</span>
          <span className="value">{listing.aaContractHash}</span>
        </div>
        <div className="row">
          <span className="label">{t("accountIdLabel")}</span>
          <span className="value">{listing.accountIdHash}</span>
        </div>
        <div className="row">
          <span className="label">{t("sellerLabel")}</span>
          <span className="value">{listing.seller || t("notAvailable")}</span>
        </div>
        <div className="row">
          <span className="label">{t("buyerLabel")}</span>
          <span className="value">{listing.buyer || t("notAvailable")}</span>
        </div>
      </div>
      {listing.metadataUri && (
        <div className="row">
          <span className="label">{t("metadataLabel")}</span>
          <a
            className="value value--link"
            href={listing.metadataUri}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("viewMetadata")}
          >
            {listing.metadataUri}
          </a>
        </div>
      )}
      {hasPendingPayment && (
        <div className="row">
          <span className="label">{t("myPendingPayment")}</span>
          <span className="value">
            {formatGasFractions(listing.myPendingPayment)} {t("tokenGas")}
          </span>
        </div>
      )}
      <NeoButton
        variant={isSelected ? "primary" : "secondary"}
        aria-label={isSelected ? t("selected") : t("selectListing")}
        onClick={() => onSelect(listing)}
      >
        {isSelected ? (
          <CheckCircle2 aria-hidden="true" />
        ) : (
          <MousePointer2 aria-hidden="true" />
        )}
        {isSelected ? t("selected") : t("selectListing")}
      </NeoButton>
    </NeoCard>
  );
}
