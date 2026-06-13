import { NeoButton, NeoInput } from "@shared/components-react";
import "./MercActionCards.scss";

export type AmountField = "depositAmount" | "withdrawAmount" | "bidAmount";

interface MercActionCardsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  isBusy: boolean;
  depositAmount: string;
  withdrawAmount: string;
  bidAmount: string;
  userDeposits: number;
  /** v2 contract: the epoch's bidding window has ended — bids are rejected. */
  biddingClosed: boolean;
  /** Minimum first bid in whole GAS (mirrors the contract's MIN_BID). */
  minBid: number;
  onAmountChange: (key: AmountField, value: string) => void;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

function isPositiveAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export default function MercActionCards({
  t,
  isBusy,
  depositAmount,
  withdrawAmount,
  bidAmount,
  userDeposits,
  biddingClosed,
  minBid,
  onAmountChange,
  dispatch,
}: MercActionCardsProps) {
  // Block over-withdrawals at the button so a user gets immediate feedback
  // rather than silently zeroing their deposit. The hook re-validates too.
  const withdrawParsed = Number(withdrawAmount);
  const withdrawOverBalance =
    isPositiveAmount(withdrawAmount) && withdrawParsed > userDeposits;
  return (
    <>
      <div className="gov-merc-action-card">
        <div>
          <span>{t("depositNeo")}</span>
          <p>{t("actionDepositHint")}</p>
        </div>
        <NeoInput
          value={depositAmount}
          type="number"
          min={0}
          suffix="NEO"
          placeholder={t("enterAmount")}
          label={t("depositAmount")}
          onChange={(value) => onAmountChange("depositAmount", value)}
        />
        <NeoButton
          variant="primary"
          loading={isBusy}
          disabled={isBusy || !isPositiveAmount(depositAmount)}
          onClick={() => dispatch("depositNeo")}
        >
          {t("depositNeo")}
        </NeoButton>
      </div>

      <div className="gov-merc-action-card">
        <div>
          <span>{t("withdrawNeo")}</span>
          <p>{t("actionWithdrawHint")}</p>
        </div>
        <NeoInput
          value={withdrawAmount}
          type="number"
          min={0}
          suffix="NEO"
          placeholder={t("enterAmount")}
          label={t("withdrawAmount")}
          onChange={(value) => onAmountChange("withdrawAmount", value)}
        />
        <NeoButton
          variant="secondary"
          loading={isBusy}
          disabled={isBusy || !isPositiveAmount(withdrawAmount) || withdrawOverBalance}
          onClick={() => dispatch("withdrawNeo")}
        >
          {t("withdrawNeo")}
        </NeoButton>
        {withdrawOverBalance ? (
          <p className="gov-merc-field-error">{t("withdrawExceeds")}</p>
        ) : null}
      </div>

      <div className="gov-merc-action-card">
        <div>
          <span>{t("placeBid")}</span>
          <p>{t("actionBidHint", { min: minBid, tokenGas: t("tokenGas") })}</p>
        </div>
        <NeoInput
          value={bidAmount}
          type="number"
          min={minBid}
          suffix="GAS"
          placeholder={String(minBid)}
          label={t("bidAmount")}
          onChange={(value) => onAmountChange("bidAmount", value)}
        />
        <NeoButton
          variant="secondary"
          loading={isBusy}
          disabled={isBusy || biddingClosed || !isPositiveAmount(bidAmount)}
          onClick={() => dispatch("placeBid")}
        >
          {t("placeBid")}
        </NeoButton>
        {biddingClosed ? (
          <p className="gov-merc-field-error">{t("biddingClosedHint")}</p>
        ) : null}
      </div>
    </>
  );
}
