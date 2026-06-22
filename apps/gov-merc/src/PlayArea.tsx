import { useEffect, useState } from "react";
import { NeoCard, NeoButton } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { formatNum } from "@shared/utils/format";
import MercHeroStats from "./components/MercHeroStats";
import MercActionCards, { type AmountField } from "./components/MercActionCards";
import MercBidsList from "./components/MercBidsList";
import MercStakerPanel, { type ReclaimableBid } from "./components/MercStakerPanel";
import { epochWindowPhase, EPOCH_DURATION_FALLBACK_MS, MIN_BID } from "./hooks/useGovMerc";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

/** Format the remaining bidding-window time as m:ss. */
function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, str, bool, num } = useStateBindings(state);

  // Ticking clock for the bidding-window countdown / closed state (v2 contract:
  // the first bid of an epoch opens a fixed window; bids after the deadline are
  // rejected and settlement only unlocks once the deadline passes).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const totalPool = val<number>("totalPool", 0) ?? 0;
  const currentEpoch = val<number>("currentEpoch", 0) ?? 0;
  const bids = val<Array<{ address: string; amount: number }>>("bids", []) ?? [];
  const isBusy = bool("isBusy");
  const dataLoading = bool("dataLoading");
  const address = str("address", "");
  const userDepositsDisplay = str("userDepositsDisplay", "0 NEO");
  const userDeposits = val<number>("userDeposits", 0) ?? 0;
  const depositAmount = str("depositAmount");
  const withdrawAmount = str("withdrawAmount");
  const bidAmount = str("bidAmount");
  const bidCount = num("bidCount");
  const canSettle = bool("canSettle");
  const epochDeadline = val<number>("epochDeadline", 0) ?? 0;
  const epochDurationMs =
    val<number>("epochDurationMs", EPOCH_DURATION_FALLBACK_MS) ??
    EPOCH_DURATION_FALLBACK_MS;
  const lastSettlementDisplay = str("lastSettlementDisplay", "");
  const pendingRewards = val<number>("pendingRewards", 0) ?? 0;
  const gasCredit = val<number>("gasCredit", 0) ?? 0;
  const reclaimableBids = val<ReclaimableBid[]>("reclaimableBids", []) ?? [];
  const highestBid = val<number>("highestBid", 0) ?? 0;
  const lastDistributed = val<number>("lastDistributed", 0) ?? 0;

  const setAmountValue = (key: AmountField, value: string) => {
    state[key]?.set(value);
  };

  const isConnected = address.length > 0;
  const shortAddress = isConnected
    ? `${address.slice(0, 8)}...${address.slice(-6)}`
    : t("walletStatusIdle");

  // Bidding-window phase: "unopened" (first bid opens it), "open" (countdown)
  // or "closed" (bids rejected; settlement available once there are bids).
  const windowPhase = epochWindowPhase(epochDeadline, now);
  const biddingClosed = windowPhase === "closed";
  const windowMinutes = Math.max(1, Math.round(epochDurationMs / 60_000));
  const windowLabel =
    windowPhase === "unopened"
      ? t("bidWindowUnopened", { minutes: windowMinutes })
      : windowPhase === "open"
        ? t("bidWindowCountdown", { time: formatCountdown(epochDeadline - now) })
        : t("bidWindowClosed");
  // Settle is available only AFTER the bidding deadline (and with bids).
  const canSettleNow = canSettle && biddingClosed;

  return (
    <div className="gov-merc-shell">
      <section className="gov-merc-main" aria-label={t("govHeroTitle")}>
        <div className="gov-merc-hero">
          <div className="gov-merc-hero-copy">
            <span>{t("marketSignalTitle")}</span>
            <h2>{t("govHeroTitle")}</h2>
            <p>{t("govHeroSubtitle")}</p>
            {/* Lead with the civic meaning: what winning grants, and that the
                title is a signal — not an executed/delegated vote. */}
            <p className="gov-merc-hero-grant">{t("govHeroGrant")}</p>
            <div className="gov-merc-hero-meta">
              <div className="gov-merc-hero-deposits">
                <span>{t("yourDeposits")}</span>
                <strong>{userDepositsDisplay}</strong>
              </div>
              <span
                className={`gov-merc-hero-badge${dataLoading ? " is-loading" : ""}`}
              >
                <span className="gov-merc-hero-dot" aria-hidden="true" />
                {dataLoading ? t("loading") : t("marketReady")}
              </span>
            </div>
          </div>
          <div className="gov-merc-scoreboard">
            <figure className="gov-merc-market-stage">
              <img
                src="./gov-merc-market-stage.jpg"
                alt=""
                loading="eager"
                decoding="async"
                aria-hidden="true"
              />
              <figcaption>
                <span>{t("marketPlateLabel")}</span>
                <strong>{t("marketPlateEpoch", { epoch: currentEpoch })}</strong>
                <em>
                  {t("marketPlateTopBid", {
                    amount: formatNum(highestBid, 2),
                    tokenGas: t("tokenGas"),
                  })}
                </em>
              </figcaption>
              <div className="gov-merc-market-stage__lanes" aria-hidden="true">
                <span>{t("tokenNeo")}</span>
                <span>{t("tokenGas")}</span>
              </div>
            </figure>
            <MercHeroStats
              t={t}
              totalPool={totalPool}
              bidCount={bidCount}
              lastDistributed={lastDistributed}
            />
          </div>
        </div>

        <NeoCard variant="erobo" className="gov-merc-action-panel">
          <div className="gov-merc-section-heading">
            <span>{t("actionsTitle")}</span>
            <strong>{shortAddress}</strong>
          </div>

          {!isConnected ? (
            <div className="gov-merc-connect" role="note">
              <div className="gov-merc-connect-copy">
                <strong>{t("connectTitle")}</strong>
                <p>{t("connectCopy")}</p>
              </div>
              <NeoButton
                variant="primary"
                loading={isBusy}
                disabled={isBusy}
                onClick={() => dispatch("connectWallet")}
              >
                {t("connectAction")}
              </NeoButton>
            </div>
          ) : null}

          {/* Persistent legend so NEO (stake) and GAS (bid) are never conflated
              at the point of action. */}
          <div className="gov-merc-token-legend" aria-label={t("tokenLegendTitle")}>
            <span className="gov-merc-token-legend-title">{t("tokenLegendTitle")}</span>
            <span className="gov-merc-token-chip gov-merc-token-chip--neo">
              {t("tokenLegendNeo")}
            </span>
            <span className="gov-merc-token-chip gov-merc-token-chip--gas">
              {t("tokenLegendGas")}
            </span>
          </div>

          <div className="gov-merc-action-grid">
            <MercActionCards
              t={t}
              isBusy={isBusy}
              depositAmount={depositAmount}
              withdrawAmount={withdrawAmount}
              bidAmount={bidAmount}
              userDeposits={userDeposits}
              biddingClosed={biddingClosed}
              minBid={MIN_BID}
              onAmountChange={setAmountValue}
              dispatch={dispatch}
            />
          </div>
        </NeoCard>

        <div className="gov-merc-flow" aria-label={t("flowTitle")}>
          <div>
            <span>01</span>
            <strong>{t("flowDeposit")}</strong>
            <p>{t("flowDepositCopy")}</p>
          </div>
          <div>
            <span>02</span>
            <strong>{t("flowBid")}</strong>
            <p>{t("flowBidCopy")}</p>
          </div>
          <div>
            <span>03</span>
            <strong>{t("flowInfluence")}</strong>
            <p>{t("flowInfluenceCopy")}</p>
          </div>
        </div>

        {/* Honest disclosure: the winner gets an on-chain "influence title" and
            the staked NEO weights the reward split — the contract does NOT cast
            or delegate a vote, so vote execution happens off-contract. */}
        <div className="gov-merc-influence-note" role="note">
          <strong>{t("influenceUseTitle")}</strong>
          <p>{t("influenceUseCopy")}</p>
        </div>
      </section>

      <aside className="gov-merc-side" aria-label={t("bidLeaderboard")}>
        <NeoCard variant="erobo" className="gov-merc-bid-panel">
          <div className="gov-merc-section-heading">
            <span>{t("bidLeaderboard")}</span>
            <strong>{bidCount}</strong>
          </div>
          <MercBidsList t={t} bids={bids} />
        </NeoCard>

        <NeoCard variant="erobo" className="gov-merc-settle-panel">
          <div className="gov-merc-section-heading">
            <span>{t("settleTitle")}</span>
            <strong>{`#${currentEpoch}`}</strong>
          </div>
          <p>{t("settleCopy")}</p>
          {/* "Current top bid" is shown once, in the hero scoreboard; the settle
              card leads with the bidding-window state + last settlement instead. */}
          <div
            className={`gov-merc-settle-window${biddingClosed ? " is-closed" : ""}`}
            aria-live="polite"
          >
            <span>{t("bidWindowTitle")}</span>
            <strong>{windowLabel}</strong>
          </div>
          <div className="gov-merc-settle-last">
            <span>{t("settleLastLabel")}</span>
            <strong>{lastSettlementDisplay || t("settleNone")}</strong>
          </div>
          <NeoButton
            variant="primary"
            loading={isBusy}
            disabled={isBusy || !canSettleNow}
            onClick={() => dispatch("settleEpoch")}
          >
            {t("settleAction")}
          </NeoButton>
          {!canSettle && !isBusy ? (
            <p className="gov-merc-settle-hint">{t("settleNoBidsHint")}</p>
          ) : null}
          {canSettle && !biddingClosed && !isBusy ? (
            <p className="gov-merc-settle-hint">{t("settleAfterDeadlineHint")}</p>
          ) : null}
        </NeoCard>

        <NeoCard variant="erobo" className="gov-merc-staker-panel">
          <div className="gov-merc-section-heading">
            <span>{t("rewardsTitle")}</span>
            <strong>{shortAddress}</strong>
          </div>
          <MercStakerPanel
            t={t}
            isBusy={isBusy}
            pendingRewards={pendingRewards}
            gasCredit={gasCredit}
            reclaimableBids={reclaimableBids}
            dispatch={dispatch}
          />
        </NeoCard>

        <NeoCard variant="erobo" className="gov-merc-risk-panel">
          {/* Operator/contract detail collapsed by default so the actionable
              settle + leaderboard panels lead the side rail. */}
          <details className="gov-merc-risk-details">
            <summary>
              <span>{t("riskNoteTitle")}</span>
              <span className="gov-merc-risk-summary-label">{t("riskNoteToggle")}</span>
            </summary>
            <div className="gov-merc-risk-body">
              <p>{t("riskNoteCopy")}</p>
              <div className="gov-merc-signal-row">
                <span>{t("settlementWindow")}</span>
                <strong>{t("epochSettlement")}</strong>
              </div>
              <div className="gov-merc-signal-row">
                <span>{t("executionPath")}</span>
                <strong>{t("executionPathCopy")}</strong>
              </div>
            </div>
          </details>
        </NeoCard>
      </aside>
    </div>
  );
}
