import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { formatHash } from "@shared/utils/format";
import "./PlayArea.scss";

const FACES = ["1", "2", "3", "4", "5", "6"];

export default function PlayArea({ t, state }: PlayAreaProps) {
  const { str, bool } = useStateBindings(state);
  const selectedFace = str("selectedFace", "6");
  const stakeAmount = str("stakeAmount", "0.10 GAS");
  const payoutPreview = str("payoutPreview", "0.57 GAS");
  const lastTxid = str("lastTxid");
  const lastStatus = str("lastStatus", t("statusReady"));
  const isSubmitting = bool("isSubmitting", false);
  const history = [
    { face: selectedFace, result: lastStatus, payout: payoutPreview },
    { face: "2", result: t("diceHistoryRefunded"), payout: stakeAmount },
    { face: "4", result: t("diceHistorySettled"), payout: "0 GAS" },
  ];

  return (
    <section className="dice-playarea" aria-label={t("rollDice")}>
      <div className="dice-shell">
        <div className="dice-stage" aria-live="polite">
          <div className="dice-stage__visual">
            <div className="dice-stage__orb" aria-hidden="true" />
            <div className="dice-cube">
              <span>{selectedFace}</span>
            </div>
            <div className="dice-stage__caption">
              <span>{t("diceWalletLabel")}</span>
              <strong>{stakeAmount}</strong>
            </div>
          </div>

          <div className="dice-stage__details">
            <p className="dice-eyebrow">{t("diceHeroTitle")}</p>
            <h2>{isSubmitting ? t("pendingTitle") : t("readyTitle")}</h2>
            <p>{isSubmitting ? t("pendingBody") : t("diceHeroSubtitle")}</p>
            <div className="dice-metric-grid">
              <span>
                {t("oddsLabel")}
                <strong>1 / 6</strong>
              </span>
              <span>
                {t("feeLabel")}
                <strong>5%</strong>
              </span>
              <span>
                {t("rangeLabel")}
                <strong>0.05-20 GAS</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="dice-bet-panel">
          <div className="dice-panel-heading">
            <span>{t("diceStakeDeskTitle")}</span>
            <strong>{t("rollAction")}</strong>
          </div>

          <div className="dice-face-grid" aria-label={t("selectedFace")}>
            {FACES.map((face) => (
              <button
                key={face}
                type="button"
                aria-pressed={face === selectedFace}
                className={`dice-face-grid__item${face === selectedFace ? " dice-face-grid__item--active" : ""}`}
              >
                {face}
              </button>
            ))}
          </div>

          <div className="dice-status-bar">
            <span>{lastStatus}</span>
            <strong>{payoutPreview}</strong>
            {lastTxid && (
              <code>
                {t("lastTx")}: {formatHash(lastTxid, 10, 8)}
              </code>
            )}
          </div>
        </div>

        <div className="dice-route-panel">
          <div className="dice-panel-heading">
            <span>{t("diceVrfRouteTitle")}</span>
            <strong>{t("safetyModel")}</strong>
          </div>
          <p>{t("diceVrfRouteCopy")}</p>
          <div className="dice-route-steps" aria-label={t("howItWorks")}>
            <span>{t("diceCommitStep")}</span>
            <span>{t("diceOracleStep")}</span>
            <span>{t("diceSettleStep")}</span>
          </div>
        </div>

        <div className="dice-history-panel">
          <div className="dice-panel-heading">
            <span>{t("diceHistoryTitle")}</span>
            <strong>{t("dicePayoutLabel")}</strong>
          </div>
          <div className="dice-history-list">
            {history.length === 0 ? (
              <p>{t("diceHistoryEmpty")}</p>
            ) : (
              history.map((item) => (
                <div className="dice-history-row" key={`${item.face}-${item.result}`}>
                  <span>{item.face}</span>
                  <strong>{item.result}</strong>
                  <em>{item.payout}</em>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
