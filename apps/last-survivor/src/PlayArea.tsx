/**
 * PlayArea.tsx -- Last Survivor (v2 scene-driven rebuild)
 *
 * The arena IS the scene: a bright survival vault with a tap-to-buy countdown
 * relic, animated key stacks, and a settle climax. Buy keys is the primary
 * action; history, how-it-works, prepaid-credit recovery, and the settle/claim
 * flow are tucked into a drawer. Warm game identity, high contrast. Chain logic
 * (useLastSurvivor) is untouched.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Flame, KeyRound, Timer, Trophy } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { ParticleBurst, CoinArt } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const KEY_PRESETS = ["1", "3", "5", "10"];
const ARENA_IMAGE = "last-survivor-arena.webp";
const RELIC_IMAGE = "survivor-scene-art.webp";

type SurvivorSceneStyle = CSSProperties & {
  "--survivor-danger-progress": string;
};

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || "---";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const formattedRound = str("formattedRound", "#0");
  const roundStatusDisplay = str("roundStatusDisplay");
  const countdown = str("countdown", "00:00:00");
  const dangerLevel = str("dangerLevel", "low");
  const dangerLevelText = str("dangerLevelText");
  const dangerProgress = num("dangerProgress");
  const lastBuyer = str("lastBuyer");
  const lastBuyerLabel = str("lastBuyerLabel", "--");
  const viewerAddress = str("viewerAddress");
  const totalPotDisplay = str("totalPotDisplay", "0.00 GAS");
  const userKeys = num("userKeys");
  const totalKeys = num("totalKeysDisplay");
  const userSharePercent = num("userSharePercent");
  const estimatedCost = str("estimatedCost", "0.00");
  const isRoundActive = bool("isRoundActive");
  const shouldPulse = bool("shouldPulse");
  const isBuyingKeys = bool("isBuyingKeys");
  const isSettling = bool("isSettling");
  const roundDataAvailable = bool("roundDataAvailable");
  const needsLifecycleSync = bool("needsLifecycleSync");
  const serviceNotice = str("serviceNotice");
  const prepaidCredit = num("prepaidCredit");
  const keyValidationError = val<string>("keyValidationError");
  const history = val<unknown[]>("history") ?? [];

  const [localKeyCount, setLocalKeyCount] = useState("1");
  const [motionKeyCount, setMotionKeyCount] = useState<string | null>(null);
  const [keyBurst, setKeyBurst] = useState(0);
  const [buyPreview, setBuyPreview] = useState(false);
  const [settlePreview, setSettlePreview] = useState(false);
  const buyPreviewTimeout = useRef<number | null>(null);
  const settlePreviewTimeout = useRef<number | null>(null);
  const resetKeyCountAfterPreview = useRef(false);

  const buyAnimating = isBuyingKeys || buyPreview;
  const settleAnimating = isSettling || settlePreview;
  const liveDanger = isRoundActive && roundDataAvailable && totalKeys > 0;
  const awaitingFirstKey = isRoundActive && roundDataAvailable && totalKeys <= 0;
  const canBuyKeys = roundDataAvailable && isRoundActive && !needsLifecycleSync;
  // The relic clock only counts when a round is genuinely live or freshly
  // ended; otherwise the relic invites instead of showing dead zeros.
  const relicIdle = !liveDanger && !needsLifecycleSync;
  const safeDangerProgress = Math.max(0, Math.min(100, dangerProgress || 0));
  const visualKeyCount = buyAnimating && motionKeyCount ? motionKeyCount : localKeyCount;
  const selectedKeyCountNumber = Number(localKeyCount || "1") || 1;
  const keyLoadPct = Math.min(100, Math.max(8, (selectedKeyCountNumber / 10) * 100));
  const selectedKeyVisualCount = Math.max(1, Math.min(6, Number.parseInt(visualKeyCount || "1", 10) || 1));
  const sceneStyle: SurvivorSceneStyle = {
    "--survivor-danger-progress": `${safeDangerProgress}%`,
  };

  useEffect(
    () => () => {
      if (buyPreviewTimeout.current !== null) window.clearTimeout(buyPreviewTimeout.current);
      if (settlePreviewTimeout.current !== null) window.clearTimeout(settlePreviewTimeout.current);
      resetKeyCountAfterPreview.current = false;
    },
    [],
  );

  const startBuyPreview = (count: string) => {
    if (buyPreviewTimeout.current !== null) window.clearTimeout(buyPreviewTimeout.current);
    setMotionKeyCount(count);
    setBuyPreview(true);
    buyPreviewTimeout.current = window.setTimeout(() => {
      setBuyPreview(false);
      setMotionKeyCount(null);
      buyPreviewTimeout.current = null;
      if (resetKeyCountAfterPreview.current) {
        resetKeyCountAfterPreview.current = false;
        setLocalKeyCount("1");
        void dispatch("setKeyCount", "1");
      }
    }, 1400);
  };
  const startSettlePreview = () => {
    if (settlePreviewTimeout.current !== null) window.clearTimeout(settlePreviewTimeout.current);
    setSettlePreview(true);
    settlePreviewTimeout.current = window.setTimeout(() => {
      setSettlePreview(false);
      settlePreviewTimeout.current = null;
    }, 1500);
  };

  const handleKeyCountChange = (value: string) => {
    if (value !== localKeyCount) setKeyBurst((tick) => tick + 1);
    setLocalKeyCount(value);
    void dispatch("setKeyCount", value);
  };
  const handleBuyKeys = async () => {
    if (!canBuyKeys || buyAnimating) return;
    setKeyBurst((tick) => tick + 1);
    startBuyPreview(localKeyCount || "1");
    await dispatch("buyKeys", localKeyCount);
    if (buyPreviewTimeout.current === null) {
      setLocalKeyCount("1");
      void dispatch("setKeyCount", "1");
    } else {
      resetKeyCountAfterPreview.current = true;
    }
  };
  const handleSettle = async () => {
    if (settleAnimating) return;
    startSettlePreview();
    await dispatch("settleRound");
  };

  const viewerIsWinner =
    Boolean(viewerAddress) &&
    Boolean(lastBuyer) &&
    viewerAddress.toLowerCase() === lastBuyer.toLowerCase();

  const scene = (
    <div
      className="survivor-scene"
      data-state={buyAnimating ? "buying" : settleAnimating ? "settling" : liveDanger ? dangerLevel : needsLifecycleSync ? "ended" : "idle"}
      data-danger={liveDanger ? dangerLevel : "low"}
      style={sceneStyle}
    >
      <img className="survivor-scene__arena-art" src={ARENA_IMAGE} alt="" aria-hidden="true" />
      <span className="survivor-scene__shade" aria-hidden="true" />

      <div className="survivor-scene__hud">
        <div className="survivor-scene__pot">
          <CoinArt size={22} variant="gas" />
          <span>{t("totalPot")}</span>
          <strong>{totalPotDisplay}</strong>
        </div>
        <div
          className="survivor-scene__timer"
          data-danger={liveDanger ? dangerLevel : "low"}
          data-pulse={liveDanger && shouldPulse ? "true" : undefined}
        >
          <Timer size={16} />
          <span>{countdown}</span>
        </div>
      </div>

      <button
        type="button"
        className="survivor-scene__relic"
        onClick={() => void handleBuyKeys()}
        disabled={!canBuyKeys || buyAnimating}
        aria-label={settleAnimating ? t("settlingRound") : buyAnimating ? t("buying") : t("buyKeys")}
      >
        <img className="survivor-scene__relic-art" src={RELIC_IMAGE} alt="" aria-hidden="true" />
        <span className="survivor-scene__relic-scrim" aria-hidden="true" />
        <span className="survivor-scene__danger-track" aria-hidden="true">
          <span className="survivor-scene__danger-fill" />
        </span>
        <span className="survivor-scene__relic-copy" data-idle={relicIdle ? "true" : undefined}>
          <span>
            <Flame size={14} /> {liveDanger ? dangerLevelText : t("safe")}
          </span>
          {relicIdle ? (
            <strong className="survivor-scene__relic-invite">
              {awaitingFirstKey ? t("awaitingFirstKey") : t("roundNotStarted")}
            </strong>
          ) : (
            <strong>{countdown}</strong>
          )}
          <em>{canBuyKeys ? t("buyKeys") : t("refreshToPlay")}</em>
        </span>
      </button>

      <div className="survivor-scene__beats" role="list" aria-label={t("arenaMomentum")}>
        <span role="listitem" data-active={buyAnimating || awaitingFirstKey || totalKeys > 0 ? "true" : undefined}>
          <KeyRound size={14} />
          <em>{t("beatBuyKey")}</em>
        </span>
        <span role="listitem" data-active={liveDanger ? "true" : undefined}>
          <Timer size={14} />
          <em>{t("beatExtendClock")}</em>
        </span>
        <span role="listitem" data-active={needsLifecycleSync || viewerIsWinner ? "true" : undefined}>
          <Trophy size={14} />
          <em>{t("beatLastBuyer")}</em>
        </span>
      </div>

      <div className="survivor-scene__key-stack" aria-hidden="true" key={keyBurst}>
        {Array.from({ length: selectedKeyVisualCount }).map((_, i) => (
          <span key={i} className={`survivor-scene__key-token survivor-scene__key-token--${i}`}>
            <KeyRound size={18} />
          </span>
        ))}
      </div>

      {buyAnimating && (
        <div className="survivor-scene__key-burst" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className={`survivor-scene__key-spark survivor-scene__key-spark--${i} mx2-spark`}>
              <KeyRound size={18} />
            </span>
          ))}
        </div>
      )}

      <div className="survivor-scene__readout">
        {lastBuyer && (
          <div className="survivor-scene__leader">
            <span>{t("currentLeader")}</span>
            <code>{shortAddr(lastBuyerLabel)}</code>
          </div>
        )}
        <div className="survivor-scene__cost">
          <span>{t("yourKeys")}</span>
          <strong>{userKeys} · {userSharePercent > 0 ? `${userSharePercent.toFixed(1)}%` : "—"}</strong>
        </div>
      </div>

      {serviceNotice && <p className="survivor-scene__notice" role="alert">{serviceNotice}</p>}

      {(buyAnimating || settleAnimating) && (
        <span
          className="survivor-scene__tx-announce"
          aria-live="assertive"
          aria-atomic="true"
          style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
        >
          {buyAnimating ? t("buying") : t("settlingRound")}
        </span>
      )}

      <p className="survivor-scene__status" aria-live="polite" aria-atomic="true">
        {buyAnimating
          ? t("buying")
          : settleAnimating
            ? t("settlingRound")
            : awaitingFirstKey
              ? t("awaitingFirstKey")
              : needsLifecycleSync
                ? t("roundEnded")
                : !roundDataAvailable
                  ? t("roundStateRequired")
                  : roundStatusDisplay}
      </p>
    </div>
  );

  const controls = (
    <div className="survivor-controls" aria-label={t("keyChamber")}>
      <div className="survivor-controls__dock">
        <div className="survivor-controls__core">
          <span>{t("keyChamber")}</span>
          <strong>{localKeyCount || "1"} {t((localKeyCount || "1") === "1" ? "keySuffixOne" : "keysSuffix")}</strong>
          <em>{t("nextCost", { amount: estimatedCost })}</em>
        </div>
        <div className="survivor-controls__presets" aria-label={t("keyCapsules")}>
          {KEY_PRESETS.map((preset) => {
            const active = localKeyCount === preset;
            return (
              <button
                key={preset}
                type="button"
                className={["survivor-preset", active ? "survivor-preset--active" : null]
                  .filter(Boolean).join(" ")}
                onClick={() => handleKeyCountChange(preset)}
                disabled={buyAnimating}
                aria-pressed={active ? "true" : "false"}
                aria-label={`${preset} ${t("keysSuffix")}`}
              >
                <span className="survivor-preset__icon" aria-hidden="true">
                  <KeyRound size={15} />
                </span>
                <span>
                  <strong>{preset}</strong>
                  <em>{t(preset === "1" ? "keySuffixOne" : "keysSuffix")}</em>
                </span>
              </button>
            );
          })}
        </div>
        <div className="survivor-controls__stepper" aria-label={t("keyTuner")}>
          <button
            type="button"
            className="survivor-stepper__btn"
            onClick={() => handleKeyCountChange(String(Math.max(1, Number(localKeyCount || "1") - 1)))}
            disabled={buyAnimating}
            aria-label={t("decreaseKeys")}
          >-</button>
          <output className="survivor-stepper__output" aria-live="polite">
            <span className="survivor-stepper__track" aria-hidden="true">
              <span
                className="survivor-stepper__track-fill"
                style={{ width: `${keyLoadPct}%` }}
              />
            </span>
            <strong>{localKeyCount || "1"}</strong>
            <span>{t((localKeyCount || "1") === "1" ? "keySuffixOne" : "keysSuffix")}</span>
          </output>
          <button
            type="button"
            className="survivor-stepper__btn"
            onClick={() => handleKeyCountChange(String(Number(localKeyCount || "1") + 1))}
            disabled={buyAnimating}
            aria-label={t("increaseKeys")}
          >+</button>
        </div>
        <p className="survivor-controls__hint">{t("keyLoadoutHint")}</p>
        {keyValidationError && (
          <p className="survivor-controls__error" role="alert">{keyValidationError}</p>
        )}
      </div>
    </div>
  );

  const stageTitle = buyAnimating
    ? t("buying")
    : needsLifecycleSync
      ? viewerIsWinner ? t("youWon") : t("winnerDeclared")
      : awaitingFirstKey
        ? t("awaitingFirstKey")
        : t("survivalArena");

  return (
    <div className="survivor-play-area mx2 mx2-cat-game">
      <PlayStage
        category="game"
        stage={{
          eyebrow: `${t("round")} ${formattedRound}`,
          title: stageTitle,
          subtitle: t("subtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {roundStatusDisplay}
              </span>
              {viewerIsWinner && <span className="mx2-badge">{t("youWon")}</span>}
            </>
          ),
        }}
        scene={
          <>
            {scene}
            {controls}
          </>
        }
        score={[
          { label: t("totalPot"), value: totalPotDisplay, accent: true },
          { label: t("yourKeys"), value: `${userKeys} · ${userSharePercent > 0 ? `${userSharePercent.toFixed(1)}%` : "—"}` },
          { label: t("totalKeys"), value: String(totalKeys) },
        ]}
        actions={{
          primary: {
            label: buyAnimating ? t("buying") : t("buyKeys"),
            onClick: () => void handleBuyKeys(),
            disabled: buyAnimating || !canBuyKeys,
            loading: buyAnimating,
            hint: t("keyPrice"),
          },
          secondary: [
            ...(needsLifecycleSync
              ? [{ label: t("settleRound"), onClick: () => void handleSettle(), loading: settleAnimating, hint: t("settleRoundHint") }]
              : []),
            ...(prepaidCredit > 0
              ? [{ label: t("withdrawCredit"), onClick: () => void dispatch("withdrawCredit"), hint: t("prepaidCreditLabel") }]
              : []),
          ],
        }}
        drawerToggleLabel={t("recentHistory")}
        drawer={{
          title: t("recentHistory"),
          children: (
            <>
              {history.length > 0 ? (
                <ul className="mx2-history">
                  {history.slice(0, 8).map((row, i) => {
                    const r = row as { round?: number; winner?: string; pot?: number | string };
                    return (
                      <li key={i} className="mx2-history__item">
                        <span className="mx2-history__face">#{r.round ?? i + 1}</span>
                        <span className="mx2-history__stake">{r.winner ? shortAddr(r.winner) : "—"}</span>
                        <span className="mx2-history__result">{r.pot ?? "—"}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>{t("noHistory")}</p>
              )}

              <h4>{t("howItWorks")}</h4>
              <p>{t("ruleDepositDesc")}</p>
              <p>{t("ruleTimerDesc")}</p>
              <p>{t("ruleWinDesc")}</p>

              <h4>{t("prepaidCreditLabel")}</h4>
              <p>{t("prepaidCreditHint")}</p>
              {prepaidCredit > 0 && (
                <button
                  type="button"
                  className="mx2-btn mx2-btn--ghost"
                  onClick={() => void dispatch("withdrawCredit")}
                >
                  {t("withdrawCredit")}
                </button>
              )}
            </>
          ),
        }}
      />

      {(settleAnimating || (needsLifecycleSync && viewerIsWinner)) && (
        <div className="survivor-climax" role="dialog" aria-modal="true" aria-label={viewerIsWinner ? t("youWon") : t("winnerDeclared")}>
          <div className="survivor-climax__card mx2-rise-in">
            {viewerIsWinner && <ParticleBurst coins count={14} />}
            <div className="survivor-climax__medal mx2-float">
              <img src={RELIC_IMAGE} alt="" aria-hidden="true" />
              <Trophy size={34} />
            </div>
            <h3>{viewerIsWinner ? t("youWon") : t("winnerDeclared")}</h3>
            <p className="survivor-climax__pot">{totalPotDisplay}</p>
            {lastBuyer && (
              <p className="survivor-climax__winner">{shortAddr(lastBuyerLabel)}</p>
            )}
            {!viewerIsWinner && (
              <button type="button" className="mx2-btn mx2-btn--primary" onClick={() => void handleSettle()}>
                {settleAnimating ? t("settlingRound") : t("settleRound")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
