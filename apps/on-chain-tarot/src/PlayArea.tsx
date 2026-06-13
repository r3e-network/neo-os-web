import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { Card } from "./composables/useTarot";
import { TAROT_CARD_BACK } from "./pages/index/components/tarot-data";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const spreadKeys = ["past", "present", "future"] as const;

function cardKeywords(card: Card): string {
  return card.keywords?.slice(0, 3).join(" / ") || card.suitLabel || card.arcana || "";
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, num, str, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const hasDrawn = bool("hasDrawn");
  const allFlipped = bool("allFlipped");
  const readingsCount = num("readingsCount");
  const cardsDrawnCount = num("cardsDrawnCount");
  const question = str("question");
  const readingMode = str("readingMode", "idle");
  const drawn = val<Card[]>("drawn") ?? [];
  const prepaidCredit = num("prepaidCredit");
  const revealCount = drawn.filter((card) => card.flipped).length;
  const oracleReady = readingMode === "oracle";
  const formatGas = (value: number) =>
    `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${t("tokenGas")}`;

  return (
    <div className="tarot-play-area">
      <div className="tarot-shell">
        <section className="tarot-main" aria-label={t("tarotHeroTitle")}>
          <div className="tarot-hero">
            <div className="tarot-hero-copy">
              <div className="tarot-hero-intro">
                <span className="tarot-hero-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M12 2.5l2.6 5.27 5.82.85-4.21 4.1.99 5.8L12 15.77 6.8 18.52l.99-5.8L3.58 8.62l5.82-.85L12 2.5z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div className="tarot-hero-heading">
                  <span className="tarot-hero-eyebrow">{t("oracleRequestTitle")}</span>
                  <h2>{t("tarotHeroTitle")}</h2>
                </div>
              </div>
              <p>{t("tarotHeroSubtitle")}</p>
              <div className="tarot-hero-meta">
                <span>
                  {t("feeLabel")} · <strong>{t("tarotFee")}</strong>
                </span>
                <span>
                  {t("contractRouteLabel")} · <strong>{t("tarotContractRoute")}</strong>
                </span>
                <span>
                  {hasDrawn ? `${revealCount}/3 ${t("revealed")}` : t("requestReady")}
                </span>
              </div>
            </div>
            <div className="tarot-hero-metrics" aria-label={t("readings")}>
              <div>
                <strong>{readingsCount}</strong>
                <span>{t("readings")}</span>
              </div>
              <div>
                <strong>{cardsDrawnCount}</strong>
                <span>{t("cardsDrawnCount")}</span>
              </div>
            </div>
          </div>

          <div className="tarot-workspace">
            <NeoCard variant="erobo" className="tarot-question-panel">
              <div className="tarot-section-heading">
                <span>{t("questionLabel")}</span>
                <strong>{hasDrawn ? t("oracleVerifiedShort") : t("requestReady")}</strong>
              </div>
              <label className="tarot-question-field">
                <span>{t("oraclePromptLabel")}</span>
                <textarea
                  value={question}
                  placeholder={t("questionPlaceholder")}
                  maxLength={200}
                  rows={4}
                  onChange={(event) => { void dispatch("setQuestion", event.currentTarget.value); }}
                />
              </label>
              <div className="tarot-action-row">
                {!hasDrawn ? (
                  <NeoButton variant="primary" loading={isLoading} disabled={isLoading} onClick={() => dispatch("draw")}>
                    {isLoading ? t("drawingCards") : t("drawCards")}
                  </NeoButton>
                ) : (
                  <NeoButton variant="secondary" disabled={isLoading} onClick={() => dispatch("reset")}>
                    {t("drawAgain")}
                  </NeoButton>
                )}
              </div>
            </NeoCard>

            <NeoCard variant="erobo" className="tarot-spread-panel">
              <div className="tarot-section-heading">
                <span>{t("spreadPanelTitle")}</span>
                <strong>{hasDrawn ? (allFlipped ? t("allRevealed") : t("tapToReveal")) : t("awaitingCards")}</strong>
              </div>
              <div className="tarot-reading-grid">
                {spreadKeys.map((spreadKey, index) => {
                  const card = drawn[index];
                  return card ? (
                    <button
                      key={`${card.id}-${index}`}
                      className={`tarot-card-slot${card.flipped ? " tarot-card-slot--flipped" : ""}`}
                      onClick={() => dispatch("flipCard", index)}
                      type="button"
                      aria-label={card.flipped ? card.name : `${t("tapToReveal")} ${t(spreadKey)}`}
                    >
                      <span className="tarot-card-position">{t(spreadKey)}</span>
                      <span className="tarot-card-frame">
                        <span className="tarot-card-face tarot-card-back">
                          <img src={card.backImage || TAROT_CARD_BACK} alt={t("cardBackAlt")} />
                          <span>{t("tapToReveal")}</span>
                        </span>
                        <span className="tarot-card-face tarot-card-front">
                          <img src={card.image} alt={t("cardImageAlt", { name: card.name })} />
                        </span>
                      </span>
                      <span className="tarot-card-caption">
                        <span>{card.flipped ? card.name : t("hiddenCard")}</span>
                        <small>{card.flipped ? cardKeywords(card) : t("oracleSealed")}</small>
                      </span>
                    </button>
                  ) : (
                    <div key={spreadKey} className="tarot-card-slot tarot-card-slot--empty">
                      <span className="tarot-card-position">{t(spreadKey)}</span>
                      <span className="tarot-card-frame">
                        <span className="tarot-card-face tarot-card-back">
                          <img src={TAROT_CARD_BACK} alt={t("cardBackAlt")} />
                        </span>
                      </span>
                      <span className="tarot-card-caption tarot-card-caption--empty">
                        {index === 1 ? (
                          <small>{t("submitQuestionFirst")}</small>
                        ) : (
                          <span aria-hidden="true">—</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </NeoCard>
          </div>

          {oracleReady && (
            <div className="tarot-reading-mode tarot-reading-mode--oracle">
              {t("oracleVerified")}
            </div>
          )}

          {hasDrawn && allFlipped && drawn.length > 0 && (
            <NeoCard variant="erobo" className="tarot-reading-summary">
              <div className="tarot-section-heading">
                <span>{t("readingSummary")}</span>
                <NeoButton variant="secondary" onClick={() => dispatch("copyReading")}>
                  {t("copyReading")}
                </NeoButton>
              </div>
              <div className="tarot-summary-list">
                {drawn.map((card, index) => {
                  const spreadKey = spreadKeys[index] ?? "present";
                  return (
                    <div key={`${card.id}-summary-${index}`} className="tarot-summary-row">
                      <img src={card.image} alt={t("cardImageAlt", { name: card.name })} />
                      <span>
                        <small>{t(spreadKey)}</small>
                        <strong>{card.name}</strong>
                        <em>{card.keywords?.join(" / ")}</em>
                      </span>
                    </div>
                  );
                })}
              </div>
            </NeoCard>
          )}
        </section>

        <aside className="tarot-side" aria-label={t("verificationPanelTitle")}>
          <NeoCard variant="erobo" className="tarot-verification-panel">
            <div className="tarot-section-heading">
              <span>{t("verificationPanelTitle")}</span>
              <strong>{oracleReady ? t("oracleVerifiedShort") : t("oraclePendingShort")}</strong>
            </div>
            <p>{t("verificationPanelCopy")}</p>
          </NeoCard>

          {/* Recovery — unused prepaid draw-credit from a deposit whose draw
              didn't complete. The contract reuses it on the next draw, or the
              player can withdraw it back to the wallet here. */}
          {prepaidCredit > 0 && (
            <NeoCard variant="erobo" className="tarot-recovery-panel">
              <div className="tarot-section-heading">
                <span>{t("prepaidCreditLabel")}</span>
                <strong>{formatGas(prepaidCredit)}</strong>
              </div>
              <p>{t("prepaidCreditHint")}</p>
              <NeoButton
                variant="secondary"
                disabled={isLoading}
                onClick={() => dispatch("withdrawCredit")}
                aria-label={t("withdrawCredit")}
              >
                {t("withdrawCredit")}
              </NeoButton>
            </NeoCard>
          )}
        </aside>
      </div>
    </div>
  );
}
