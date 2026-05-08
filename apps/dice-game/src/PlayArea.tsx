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

  return (
    <section className="dice-playarea" aria-label={t("rollDice")}>
      <div className="dice-playarea__main">
        <div className="dice-card" aria-live="polite">
          <div className="dice-card__face">{selectedFace}</div>
          <div className="dice-card__label">
            {isSubmitting ? t("pendingTitle") : t("readyTitle")}
          </div>
        </div>

        <div className="dice-summary">
          <p>{isSubmitting ? t("pendingBody") : t("readyBody")}</p>
          <div className="dice-summary__grid">
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

      <div className="dice-face-strip" aria-label={t("selectedFace")}>
        {FACES.map((face) => (
          <div
            key={face}
            className={`dice-face-strip__item${face === selectedFace ? " dice-face-strip__item--active" : ""}`}
          >
            {face}
          </div>
        ))}
      </div>

      <div className="dice-status">
        <span>{lastStatus}</span>
        <strong>
          {stakeAmount} to {payoutPreview}
        </strong>
        {lastTxid && (
          <code>
            {t("lastTx")}: {formatHash(lastTxid, 10, 8)}
          </code>
        )}
      </div>
    </section>
  );
}
