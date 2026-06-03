import { NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import MercHeroStats from "./components/MercHeroStats";
import MercActionCards, { type AmountField } from "./components/MercActionCards";
import MercBidsList from "./components/MercBidsList";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, str, bool, num } = useStateBindings(state);

  const totalPool = val<number>("totalPool", 0) ?? 0;
  const currentEpoch = val<number>("currentEpoch", 0) ?? 0;
  const bids = val<Array<{ address: string; amount: number }>>("bids", []) ?? [];
  const isBusy = bool("isBusy");
  const dataLoading = bool("dataLoading");
  const address = str("address", "");
  const userDepositsDisplay = str("userDepositsDisplay", "0 NEO");
  const depositAmount = str("depositAmount");
  const withdrawAmount = str("withdrawAmount");
  const bidAmount = str("bidAmount");
  const bidCount = num("bidCount");

  const setAmountValue = (key: AmountField, value: string) => {
    state[key]?.set(value);
  };

  const shortAddress = address
    ? `${address.slice(0, 8)}...${address.slice(-6)}`
    : t("walletStatusIdle");

  return (
    <div className="gov-merc-shell">
      <section className="gov-merc-main" aria-label={t("govHeroTitle")}>
        <div className="gov-merc-hero">
          <div className="gov-merc-hero-copy">
            <span>{t("marketSignalTitle")}</span>
            <h2>{t("govHeroTitle")}</h2>
            <p>{t("govHeroSubtitle")}</p>
            <div className="gov-merc-hero-meta">
              <span>
                {t("yourDeposits")}: <strong>{userDepositsDisplay}</strong>
              </span>
              <span className="gov-merc-hero-dot" aria-hidden="true" />
              <span>{dataLoading ? t("loading") : t("marketReady")}</span>
            </div>
          </div>
          <div className="gov-merc-scoreboard">
            <MercHeroStats
              t={t}
              totalPool={totalPool}
              bidCount={bidCount}
              currentEpoch={currentEpoch}
            />
          </div>
        </div>

        <NeoCard variant="erobo" className="gov-merc-action-panel">
          <div className="gov-merc-section-heading">
            <span>{t("poolStats")}</span>
            <strong>{shortAddress}</strong>
          </div>
          <div className="gov-merc-action-grid">
            <MercActionCards
              t={t}
              isBusy={isBusy}
              depositAmount={depositAmount}
              withdrawAmount={withdrawAmount}
              bidAmount={bidAmount}
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
      </section>

      <aside className="gov-merc-side" aria-label={t("bidLeaderboard")}>
        <NeoCard variant="erobo" className="gov-merc-bid-panel">
          <div className="gov-merc-section-heading">
            <span>{t("bidLeaderboard")}</span>
            <strong>{bidCount}</strong>
          </div>
          <MercBidsList t={t} bids={bids} />
        </NeoCard>

        <NeoCard variant="erobo" className="gov-merc-risk-panel">
          <div className="gov-merc-section-heading">
            <span>{t("riskNoteTitle")}</span>
            <strong>{shortAddress}</strong>
          </div>
          <p>{t("riskNoteCopy")}</p>
          <div className="gov-merc-signal-row">
            <span>{t("settlementWindow")}</span>
            <strong>{t("epochSettlement")}</strong>
          </div>
          <div className="gov-merc-signal-row">
            <span>{t("executionPath")}</span>
            <strong>{t("executionPathCopy")}</strong>
          </div>
        </NeoCard>
      </aside>
    </div>
  );
}
