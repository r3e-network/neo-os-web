import { NeoButton, NeoInput } from "@shared/components-react";
import "./MercActionCards.scss";

export type AmountField = "depositAmount" | "withdrawAmount" | "bidAmount";
export type MercActionPreview = "connect" | "deposit" | "withdraw" | "bid" | "settle" | null;

interface MercActionCardsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  isBusy: boolean;
  actionPreview: MercActionPreview;
  depositAmount: string;
  withdrawAmount: string;
  bidAmount: string;
  userDeposits: number;
  /** v2 contract: the epoch's bidding window has ended — bids are rejected. */
  biddingClosed: boolean;
  /** Minimum first bid in whole GAS (mirrors the contract's MIN_BID). */
  minBid: number;
  onAmountChange: (key: AmountField, value: string) => void;
  onActionPreview: (action: Exclude<MercActionPreview, "connect" | "settle" | null>) => void;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

function isPositiveAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export default function MercActionCards({
  t,
  isBusy,
  actionPreview,
  depositAmount,
  withdrawAmount,
  bidAmount,
  userDeposits,
  biddingClosed,
  minBid,
  onAmountChange,
  onActionPreview,
  dispatch,
}: MercActionCardsProps) {
  // Block over-withdrawals at the button so a user gets immediate feedback
  // rather than silently zeroing their deposit. The hook re-validates too.
  const withdrawParsed = Number(withdrawAmount);
  const withdrawOverBalance =
    isPositiveAmount(withdrawAmount) && withdrawParsed > userDeposits;
  const depositBusy = isBusy || actionPreview === "deposit";
  const withdrawBusy = isBusy || actionPreview === "withdraw";
  const bidBusy = isBusy || actionPreview === "bid";

  const runAction = (
    action: Exclude<MercActionPreview, "connect" | "settle" | null>,
    name: string,
  ) => {
    onActionPreview(action);
    void dispatch(name);
  };

  return (
    <>
      <div className="gov-merc-action-lane gov-merc-action-lane--earn">
        <div className="gov-merc-action-lane__head">
          <span>{t("earnLaneTitle")}</span>
          <em className="gov-merc-token-tag gov-merc-token-tag--neo">{t("tokenTagStake")}</em>
        </div>
        <p>{t("earnLaneCopy")}</p>
        <div className="gov-merc-balance-strip">
          <span>{t("stakedBalanceLabel")}</span>
          <strong>{userDeposits.toLocaleString()} NEO</strong>
        </div>

        <div
          className={[
            "gov-merc-action-card",
            "gov-merc-action-card--neo",
            "gov-merc-action-card--deposit",
            "gov-merc-action-card--primary",
            depositBusy && "is-routing",
          ].filter(Boolean).join(" ")}
        >
          <div>
            <div className="gov-merc-action-head">
              <span>{t("depositNeo")}</span>
            </div>
            <p>{t("actionDepositHint")}</p>
          </div>
          <div className="gov-merc-action-control">
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
              aria-label={depositBusy ? t("stakingNeo") : t("depositNeo")}
              loading={depositBusy}
              disabled={depositBusy || !isPositiveAmount(depositAmount)}
              onClick={() => runAction("deposit", "depositNeo")}
            >
              {depositBusy ? t("stakingNeo") : t("depositNeo")}
            </NeoButton>
          </div>
          {depositBusy ? (
            <p className="gov-merc-action-status" aria-live="polite">
              {t("stakingNeo")}
            </p>
          ) : null}
        </div>

        <details className="gov-merc-withdraw-drawer">
          <summary>{t("withdrawDrawerTitle")}</summary>
          <div
            className={[
              "gov-merc-action-card",
              "gov-merc-action-card--neo",
              "gov-merc-action-card--withdraw",
              "gov-merc-action-card--secondary",
              withdrawBusy && "is-routing",
            ].filter(Boolean).join(" ")}
          >
            <div>
              <div className="gov-merc-action-head">
                <span>{t("withdrawNeo")}</span>
              </div>
              <p>{t("actionWithdrawHint")}</p>
            </div>
            <div className="gov-merc-action-control">
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
                aria-label={withdrawBusy ? t("unstakingNeo") : t("withdrawNeo")}
                loading={withdrawBusy}
                disabled={withdrawBusy || !isPositiveAmount(withdrawAmount) || withdrawOverBalance}
                onClick={() => runAction("withdraw", "withdrawNeo")}
              >
                {withdrawBusy ? t("unstakingNeo") : t("withdrawNeo")}
              </NeoButton>
            </div>
            {withdrawBusy ? (
              <p className="gov-merc-action-status" aria-live="polite">
                {t("unstakingNeo")}
              </p>
            ) : null}
            {withdrawOverBalance ? (
              <p className="gov-merc-field-error">{t("withdrawExceeds")}</p>
            ) : null}
          </div>
        </details>
      </div>

      <div className="gov-merc-action-lane gov-merc-action-lane--bid">
        <div className="gov-merc-action-lane__head">
          <span>{t("bidLaneTitle")}</span>
          <em className="gov-merc-token-tag gov-merc-token-tag--gas">{t("tokenTagBid")}</em>
        </div>
        <p>{t("bidLaneCopy")}</p>
        <div className="gov-merc-bid-floor">
          <span>{t("minBidLabel")}</span>
          <strong>{minBid} {t("tokenGas")}</strong>
        </div>
        <div
          className={[
            "gov-merc-action-card",
            "gov-merc-action-card--gas",
            "gov-merc-action-card--bid",
            "gov-merc-action-card--primary",
            bidBusy && "is-routing",
          ].filter(Boolean).join(" ")}
        >
          <div>
            <div className="gov-merc-action-head">
              <span>{t("placeBid")}</span>
            </div>
            <p>{t("actionBidHint", { min: minBid, tokenGas: t("tokenGas") })}</p>
          </div>
          <div className="gov-merc-action-control">
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
              variant="primary"
              aria-label={bidBusy ? t("placingBid") : t("placeBid")}
              loading={bidBusy}
              disabled={bidBusy || biddingClosed || !isPositiveAmount(bidAmount)}
              onClick={() => runAction("bid", "placeBid")}
            >
              {bidBusy ? t("placingBid") : t("placeBid")}
            </NeoButton>
          </div>
          {bidBusy ? (
            <p className="gov-merc-action-status" aria-live="polite">
              {t("placingBid")}
            </p>
          ) : null}
        </div>
        {biddingClosed ? (
          <p className="gov-merc-field-error">{t("biddingClosedHint")}</p>
        ) : null}
      </div>
    </>
  );
}
