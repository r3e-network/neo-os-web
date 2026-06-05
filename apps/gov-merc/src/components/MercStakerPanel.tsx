import { NeoButton } from "@shared/components-react";
import { formatNum } from "@shared/utils/format";
import "./MercStakerPanel.scss";

export interface ReclaimableBid {
  epoch: number;
  amount: number;
}

interface MercStakerPanelProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  isBusy: boolean;
  /** Connected staker's claimable GAS rewards (whole GAS). */
  pendingRewards: number;
  /** Connected wallet's unused GAS bid credit (whole GAS). */
  gasCredit: number;
  /** Losing bids reclaimable from settled epochs. */
  reclaimableBids: ReclaimableBid[];
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

/**
 * Staker-economy affordances the OS app never surfaced:
 *   - CLAIM REWARDS: how stakers actually earn — the GAS auction revenue accrued
 *     pro-rata to their NEO stake (pendingRewards). Always shown so a staker can
 *     see whether they have anything to claim.
 *   - RECLAIM LOSING BID: pull a losing bid back from a settled epoch.
 *   - WITHDRAW UNUSED CREDIT: reclaim prepaid GAS bid credit that was never spent.
 *
 * Amounts are whole GAS (the composable already scaled base units ÷1e8).
 */
export default function MercStakerPanel({
  t,
  isBusy,
  pendingRewards,
  gasCredit,
  reclaimableBids,
  dispatch,
}: MercStakerPanelProps) {
  const hasRewards = pendingRewards > 0;
  const hasCredit = gasCredit > 0;
  const hasReclaimable = reclaimableBids.length > 0;
  const tokenGas = t("tokenGas");

  return (
    <div className="gov-merc-staker">
      <section className="gov-merc-staker-block" aria-label={t("rewardsTitle")}>
        <p className="gov-merc-staker-copy">{t("rewardsCopy")}</p>
        <div className="gov-merc-staker-amount">
          <span>{t("pendingRewards")}</span>
          <strong>{`${formatNum(pendingRewards, 4)} ${tokenGas}`}</strong>
        </div>
        <NeoButton
          variant="primary"
          loading={isBusy}
          disabled={isBusy || !hasRewards}
          onClick={() => dispatch("claimRewards")}
        >
          {t("claimRewards")}
        </NeoButton>
        {!hasRewards && !isBusy ? (
          <p className="gov-merc-staker-hint">{t("rewardsEmptyHint")}</p>
        ) : null}
      </section>

      <section className="gov-merc-staker-block" aria-label={t("reclaimTitle")}>
        <div className="gov-merc-section-heading">
          <span>{t("reclaimTitle")}</span>
          <strong>{`${formatNum(gasCredit, 4)} ${tokenGas}`}</strong>
        </div>
        <p className="gov-merc-staker-copy">{t("reclaimCopy")}</p>

        {hasReclaimable ? (
          <ul className="gov-merc-reclaim-list">
            {reclaimableBids.map((bid) => (
              <li key={bid.epoch} className="gov-merc-reclaim-row">
                <span>
                  {t("reclaimBidAmount", {
                    amount: formatNum(bid.amount, 4),
                    tokenGas,
                    epoch: bid.epoch,
                  })}
                </span>
                <NeoButton
                  variant="secondary"
                  loading={isBusy}
                  disabled={isBusy}
                  onClick={() => dispatch("reclaimBid", bid.epoch)}
                >
                  {t("reclaimBidLabel", { epoch: bid.epoch })}
                </NeoButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="gov-merc-staker-hint">{t("reclaimEmpty")}</p>
        )}

        <div className="gov-merc-staker-credit">
          <span>{t("unusedCredit")}</span>
          <NeoButton
            variant="secondary"
            loading={isBusy}
            disabled={isBusy || !hasCredit}
            onClick={() => dispatch("withdrawCredit")}
          >
            {t("withdrawCredit")}
          </NeoButton>
        </div>
      </section>
    </div>
  );
}
