import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { ParticleBurst } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import { Rocket, Shuffle, Trash2, Undo2 } from "lucide-react";
import {
  DIFFICULTY_RULES,
  MAX_UNDOS,
  formatClock,
  gasDisplay,
  rewardPctAfterUndos,
  ruleOf,
} from "./logic/game-rules";
import { ALL_SYMBOLS, symbolAsset, symbolLabel } from "./logic/sheep-engine";
import type { CardView } from "./logic/session-view";
import type { LeaderEntry, SolveRow } from "./main";
import "./PlayArea.scss";

const SUBMIT_BUFFER_MS = 15_000;
const MIN_SOLVE_BUFFER_MS = 10_000;
const MATCH_ANIM_MS = 600;
const EMPTY_CARDS: CardView[] = [];
const SHEEP_ART = {
  mascot: "./art/mascot-sheep.webp",
  meadow: "./art/meadow-table.webp",
  tray: "./art/slot-tray.webp",
  badges: ["./art/badge-easy.webp", "./art/badge-medium.webp", "./art/badge-hard.webp"],
} as const;
const LOBBY_PREVIEW_SYMBOLS = [0, 8, 6, 1, 4, 11, 2] as const;

function shortHash(value: string, head = 10, tail = 6): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function difficultyLabelKey(key: string): "easyLabel" | "mediumLabel" | "hardLabel" {
  if (key === "medium") return "mediumLabel";
  if (key === "hard") return "hardLabel";
  return "easyLabel";
}

function difficultyDescKey(key: string): "easyDesc" | "mediumDesc" | "hardDesc" {
  if (key === "medium") return "mediumDesc";
  if (key === "hard") return "hardDesc";
  return "easyDesc";
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const creditGas = val<number>("credit", 0) ?? 0;
  const poolFree = val<number>("poolFree", 0) ?? 0;
  const activeGameId = str("activeGameId", "0");
  const gameStatus = str("gameStatus", "idle");
  const gameDifficulty = val<number>("gameDifficulty", 0) ?? 0;
  const commitmentHex = str("commitment", "");
  const pileCards = val<CardView[]>("pileCards", EMPTY_CARDS) ?? EMPTY_CARDS;
  const slotCards = val<CardView[]>("slotCards", EMPTY_CARDS) ?? EMPTY_CARDS;
  const isMatching = bool("isMatching");
  const isGameOver = bool("isGameOver");
  const shuffleLeft = val<number>("shuffleLeft", 1) ?? 1;
  const remove3Left = val<number>("remove3Left", 1) ?? 1;
  const isPicking = bool("isPicking");
  const dealtAt = val<number>("dealtAt", 0) ?? 0;
  const deadline = val<number>("deadline", 0) ?? 0;
  const undosUsed = val<number>("undosUsed", 0) ?? 0;
  const lastPayout = str("lastPayout", "");
  const leaderboard = val<LeaderEntry[]>("leaderboard", []) ?? [];
  const myRank = val<number>("myRank", 0) ?? 0;
  const myTotalWon = val<number>("myTotalWon", 0) ?? 0;
  const myHistory = val<SolveRow[]>("myHistory", []) ?? [];
  const isStarting = bool("isStarting");
  const isDealing = bool("isDealing");
  const isSubmitting = bool("isSubmitting");
  const isUndoing = bool("isUndoing");
  const lastStatus = str("lastStatus", t("statusReady"));

  const [pickedDifficulty, setPickedDifficulty] = useState(0);
  const [undoArmed, setUndoArmed] = useState(false);
  const undoArmTimer = useRef<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [matchedSlots, setMatchedSlots] = useState<number[]>([]);
  // Immediate local pick cue, released on a timer so a card never sticks in its
  // action state while the pick streams to the TEE session.
  const [pickPreview, setPickPreview] = useState<number | null>(null);
  const pickPreviewTimer = useRef<number | null>(null);
  const pilesRef = useRef<HTMLDivElement>(null);

  const startPickPreview = useCallback((cardId: number) => {
    if (pickPreviewTimer.current !== null) {
      window.clearTimeout(pickPreviewTimer.current);
    }
    setPickPreview(cardId);
    pickPreviewTimer.current = window.setTimeout(() => {
      setPickPreview(null);
      pickPreviewTimer.current = null;
    }, 400);
  }, []);

  useEffect(
    () => () => {
      if (pickPreviewTimer.current !== null) window.clearTimeout(pickPreviewTimer.current);
    },
    [],
  );

  // 1s clock while a dealt run is live
  useEffect(() => {
    if (gameStatus !== "dealt") return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [gameStatus]);

  const rule = ruleOf(
    gameStatus === "dealt" || gameStatus === "committed" ? gameDifficulty : pickedDifficulty,
  );

  // Reset undo arm on game state change
  useEffect(() => {
    setUndoArmed(false);
  }, [gameStatus, activeGameId]);

  // Auto-disarm the undo confirm after 4s so a stale armed state can't confirm
  // a reward penalty minutes later by accident (mirrors the pickPreview timer).
  useEffect(() => {
    if (undoArmTimer.current !== null) {
      window.clearTimeout(undoArmTimer.current);
      undoArmTimer.current = null;
    }
    if (!undoArmed) return undefined;
    undoArmTimer.current = window.setTimeout(() => {
      setUndoArmed(false);
      undoArmTimer.current = null;
    }, 4000);
    return () => {
      if (undoArmTimer.current !== null) {
        window.clearTimeout(undoArmTimer.current);
        undoArmTimer.current = null;
      }
    };
  }, [undoArmed]);

  // Trigger match animation when matching happens
  useEffect(() => {
    if (isMatching) {
      const ids = slotCards.map((c) => c.id);
      setMatchedSlots(ids);
      const timer = setTimeout(() => {
        setMatchedSlots([]);
      }, MATCH_ANIM_MS);
      return () => clearTimeout(timer);
    }
  }, [isMatching, slotCards]);

  const remainingMs = deadline > 0 ? deadline - nowMs : 0;
  const elapsedMs = dealtAt > 0 ? nowMs - dealtAt : 0;
  const minSolveReached = dealtAt > 0 && elapsedMs >= rule.minSolveMs + MIN_SOLVE_BUFFER_MS;
  const timeUp = gameStatus === "dealt" && deadline > 0 && remainingMs <= 0;
  const submitWindowClosed =
    gameStatus === "dealt" && deadline > 0 && remainingMs <= SUBMIT_BUFFER_MS;
  const timePct =
    deadline > 0 && dealtAt > 0
      ? Math.max(0, Math.min(100, (remainingMs / (deadline - dealtAt)) * 100))
      : 0;

  const busy = isStarting || isDealing || isSubmitting || isUndoing || isPicking;
  const selectedRewardGas = Number(gasDisplay(rule.rewardFixed8));
  const rewardPoolReady = poolFree >= selectedRewardGas;
  const undosLeft = MAX_UNDOS - undosUsed;
  const currentRewardPct = rewardPctAfterUndos(undosUsed);
  const projectedPayout = (Number(gasDisplay(rule.rewardFixed8)) * currentRewardPct) / 100;

  // Split pile cards by layer for visual stacking
  const layer0Cards = useMemo(() => pileCards.filter((c) => c.layer === 0), [pileCards]);
  const layer1Cards = useMemo(() => pileCards.filter((c) => c.layer === 1), [pileCards]);
  const layer2Cards = useMemo(() => pileCards.filter((c) => c.layer === 2), [pileCards]);

  const handlePickCard = useCallback(
    (card: CardView) => {
      if (!card.exposed || card.picked || busy || isPicking || isGameOver) return;
      if (slotCards.length >= 7) return;
      if (gameStatus !== "dealt" || timeUp) return;
      startPickPreview(card.id);
      void dispatch("pickCard", { cardId: card.id });
    },
    [busy, isPicking, isGameOver, slotCards.length, gameStatus, timeUp, startPickPreview, dispatch],
  );

  const confirmUndo = async () => {
    if (slotCards.length === 0 || undosLeft <= 0 || busy) return;
    if (!undoArmed) {
      setUndoArmed(true);
      return;
    }
    setUndoArmed(false);
    try {
      await dispatch("useUndo", {});
    } catch {
      /* store surfaced the error toast */
    }
  };

  const handleShuffle = async () => {
    if (shuffleLeft <= 0 || slotCards.length === 0 || busy) return;
    await dispatch("useShuffle", {});
  };

  const handleRemove3 = async () => {
    if (remove3Left <= 0 || slotCards.length < 3 || busy) return;
    await dispatch("useRemove3", {});
  };

  const handleSubmit = async () => {
    if (busy) return;
    if (gameStatus === "dealt") {
      if (isGameOver || !minSolveReached || submitWindowClosed || timeUp) return;
      await dispatch("submitRun", {});
      return;
    }
    if (gameStatus === "idle" || gameStatus === "solved" || gameStatus === "expired") {
      if (!rewardPoolReady) return;
      await dispatch("startGame", { difficulty: pickedDifficulty });
    }
  };

  // Count cards remaining in pile (not picked)
  const cardsRemaining = pileCards.filter((c) => !c.picked).length;

  const difficultyPicker = (
    <div className="sheep-lobby">
      {lastPayout && gameStatus === "solved" && (
        <div className="sheep-lobby__result" data-state="won">
          <ParticleBurst coins count={12} />
          <strong>{t("solvedBanner", { payout: lastPayout })}</strong>
          <span>{t("solvedBannerHint")}</span>
        </div>
      )}
      {gameStatus === "expired" && (
        <div className="sheep-lobby__result" data-state="expired">
          <strong>{t("expiredBanner")}</strong>
          <span>{t("expiredBannerHint")}</span>
        </div>
      )}
      <div className="sheep-lobby__playground" aria-label={t("playingTitle")}>
        <img
          className="sheep-lobby__meadow"
          src={SHEEP_ART.meadow}
          alt=""
          decoding="async"
          draggable={false}
        />
        <img
          className="sheep-lobby__mascot"
          src={SHEEP_ART.mascot}
          alt=""
          decoding="async"
          draggable={false}
        />
        <div className="sheep-lobby__tile-pile" aria-hidden="true">
          {LOBBY_PREVIEW_SYMBOLS.slice(0, 5).map((symbol, index) => (
            <img
              key={`${symbol}-${index}`}
              src={symbolAsset(symbol)}
              alt=""
              decoding="async"
              draggable={false}
              style={
                {
                  "--tile-x": `${index * 22}px`,
                  "--tile-y": `${index % 2 === 0 ? 0 : 18}px`,
                  "--tile-rotate": `${(index - 2) * 4}deg`,
                  "--tile-delay": `${index * 120}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className="sheep-lobby__slot-preview" aria-hidden="true">
          <img src={SHEEP_ART.tray} alt="" decoding="async" draggable={false} />
          <div>
            {LOBBY_PREVIEW_SYMBOLS.map((symbol, index) => (
              <span key={`${symbol}-${index}`}>
                {index < 4 && (
                  <img
                    src={symbolAsset(symbol)}
                    alt=""
                    decoding="async"
                    draggable={false}
                  />
                )}
              </span>
            ))}
          </div>
        </div>
        <div className="sheep-lobby__brief">
          <span>{t("routeEyebrow")}</span>
          <strong>{t(difficultyLabelKey(rule.key))}</strong>
          <p>{t(difficultyDescKey(rule.key))}</p>
          <div className="sheep-lobby__ribbon" aria-label={t("routeSummary")}>
            <span>{t("winAmount", { amount: gasDisplay(rule.rewardFixed8) })}</span>
            <span>{t("entryAmount", { amount: gasDisplay(rule.entryFixed8) })}</span>
            <span>{t("timeAmount", { minutes: Math.round(rule.limitMs / 60000) })}</span>
          </div>
        </div>
      </div>
      <div className="sheep-lobby__cards" role="radiogroup" aria-label={t("difficultyTitle")}>
        {DIFFICULTY_RULES.map((entry) => {
          const active = entry.difficulty === pickedDifficulty;
          return (
            <button
              key={entry.key}
              type="button"
              role="radio"
              aria-checked={active}
              className={["sheep-route-card", active ? "sheep-route-card--active" : null]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setPickedDifficulty(entry.difficulty)}
              disabled={busy}
            >
              <img
                className="sheep-route-card__icon"
                src={SHEEP_ART.badges[entry.difficulty]}
                alt=""
                decoding="async"
                draggable={false}
              />
              <span className="sheep-route-card__name">{t(difficultyLabelKey(entry.key))}</span>
              <span className="sheep-route-card__reward">
                {t("winAmount", { amount: gasDisplay(entry.rewardFixed8) })}
              </span>
            </button>
          );
        })}
      </div>
      <p className="sheep-lobby__pool" data-ready={rewardPoolReady ? "true" : "false"}>
        {t("poolLine", { pool: poolFree.toFixed(2) })}
        {creditGas > 0 ? ` · ${t("creditLine", { credit: creditGas.toFixed(2) })}` : ""}
        {!rewardPoolReady ? ` · ${t("statusPoolLow")}` : ""}
      </p>
    </div>
  );

  const dealingStage = (
    <div className="sheep-shuffle" role="status" aria-label={t("statusShuffling")}>
      <div className="sheep-shuffle__cards" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <img
            key={i}
            src={symbolAsset(i % ALL_SYMBOLS.length)}
            alt=""
            decoding="async"
            draggable={false}
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>
      <p>{t("shufflingCopy")}</p>
      {!isDealing && (
        <button
          type="button"
          className="mx2-btn mx2-btn--ghost"
          onClick={() => void dispatch("retryDeal", {})}
        >
          {t("checkDealAgain")}
        </button>
      )}
    </div>
  );

  const renderCard = (card: CardView, onClick?: () => void) => {
    const isExposed = card.exposed && !card.picked;
    const wasJustPicked = pickPreview === card.id;
    const isMatchingNow = matchedSlots.includes(card.id);
    return (
      <button
        key={card.id}
        type="button"
        className={[
          "sheep-card",
          isExposed ? "sheep-card--exposed" : "sheep-card--blocked",
          card.picked ? "sheep-card--picked" : "",
          wasJustPicked ? "sheep-card--pick-anim" : "",
          isMatchingNow ? "sheep-card--match-anim" : "",
          `sheep-card--layer-${card.layer}`,
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onClick}
        disabled={!isExposed || busy || isPicking || isGameOver}
        aria-label={isExposed ? symbolLabel(card.symbol) : t("pileLabel")}
        style={{ "--card-color": `var(--sheep-color-${card.symbol})` } as React.CSSProperties}
      >
        {isExposed && (
          <span className="sheep-card__face">
            <img
              className="sheep-card__art"
              src={symbolAsset(card.symbol)}
              alt=""
              decoding="async"
              draggable={false}
            />
          </span>
        )}
      </button>
    );
  };

  const pileStage = (
    <div className="sheep-pile-area">
      <div className="sheep-pile" ref={pilesRef}>
        <img
          className="sheep-pile__table-art"
          src={SHEEP_ART.meadow}
          alt=""
          decoding="async"
          draggable={false}
        />
        {/* Layer 2 (bottom) — rendered first so it's behind */}
        <div className="sheep-pile__layer sheep-pile__layer--2">
          {layer2Cards.map((card) => renderCard(card, () => handlePickCard(card)))}
        </div>
        {/* Layer 1 (middle) */}
        <div className="sheep-pile__layer sheep-pile__layer--1">
          {layer1Cards.map((card) => renderCard(card, () => handlePickCard(card)))}
        </div>
        {/* Layer 0 (top) — rendered last so it's in front */}
        <div className="sheep-pile__layer sheep-pile__layer--0">
          {layer0Cards.map((card) => renderCard(card, () => handlePickCard(card)))}
        </div>
      </div>
      <p className="sheep-pile__count">
        {t("cardsLeft", { count: cardsRemaining })}
      </p>
    </div>
  );

  const slotBarStage = (
    <div className="sheep-slots" data-matching={isMatching ? "true" : undefined}>
      <img
        className="sheep-slots__tray-art"
        src={SHEEP_ART.tray}
        alt=""
        decoding="async"
        draggable={false}
      />
      <div className="sheep-slots__bar" role="list" aria-label={t("slotBarLabel", { used: slotCards.length, cap: 7 })}>
        {Array.from({ length: 7 }, (_, i) => {
          const card = slotCards[i];
          return (
            <div
              key={i}
              className={[
                "sheep-slot",
                card ? "sheep-slot--filled" : "sheep-slot--empty",
                card && matchedSlots.includes(card.id) ? "sheep-slot--match" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              role="listitem"
            >
              {card && (
                <img
                  className="sheep-slot__art"
                  src={symbolAsset(card.symbol)}
                  alt=""
                  decoding="async"
                  draggable={false}
                />
              )}
            </div>
          );
        })}
      </div>
      {isGameOver && (
        <p className="sheep-slots__full" role="alert">
          {t("slotsFull")}
        </p>
      )}
    </div>
  );

  const boardStage = (
    <div className="sheep-table">
      <div className="sheep-timer" data-low={remainingMs < 60_000 ? "true" : undefined}>
        <span className="sheep-timer__clock">{formatClock(remainingMs)}</span>
        <span className="sheep-timer__track" aria-hidden="true">
          <i style={{ width: `${timePct}%` }} />
        </span>
        <span className="sheep-timer__reward">
          {t("rewardNow", { amount: projectedPayout.toFixed(2), pct: currentRewardPct })}
        </span>
      </div>
      {pileStage}
      {slotBarStage}
      <div className="sheep-tools" role="toolbar" aria-label="Game tools">
        <button
          type="button"
          className={[
            "sheep-tool",
            undoArmed ? "sheep-tool--armed" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => void confirmUndo()}
          disabled={busy || undosLeft <= 0 || slotCards.length === 0}
          title={t("undoHint")}
        >
          <Undo2 size={16} aria-hidden="true" />
          <span>
            {undoArmed
              ? t("undoConfirm", { pct: rewardPctAfterUndos(undosUsed + 1) })
              : t("undoAction", { left: undosLeft })}
          </span>
        </button>
        <button
          type="button"
          className="sheep-tool"
          onClick={() => void handleShuffle()}
          disabled={busy || shuffleLeft <= 0 || slotCards.length === 0}
          title={t("shuffleHint")}
        >
          <Shuffle size={16} aria-hidden="true" />
          <span>{t("shuffleAction", { left: shuffleLeft })}</span>
        </button>
        <button
          type="button"
          className="sheep-tool"
          onClick={() => void handleRemove3()}
          disabled={busy || remove3Left <= 0 || slotCards.length < 3}
          title={t("remove3Hint")}
        >
          <Trash2 size={16} aria-hidden="true" />
          <span>{t("remove3Action", { left: remove3Left })}</span>
        </button>
      </div>
      {isGameOver && (
        <p className="sheep-hint sheep-hint--expired" role="alert">
          {t("gameOverBanner")}
        </p>
      )}
      {!minSolveReached && !isGameOver && (
        <p className="sheep-hint" role="status">
          {t("minSolveHint", { clock: formatClock(rule.minSolveMs + MIN_SOLVE_BUFFER_MS - elapsedMs) })}
        </p>
      )}
      {submitWindowClosed && !timeUp && (
        <p className="sheep-hint sheep-hint--expired" role="alert">
          {t("deadlineBufferHint")}
        </p>
      )}
      {timeUp && (
        <p className="sheep-hint sheep-hint--expired" role="alert">
          {t("timeUpHint")}
        </p>
      )}
    </div>
  );

  // Determine scene data-state
  const showingDealing = isStarting || isDealing || gameStatus === "committed";

  const sceneState = (() => {
    if (isSubmitting) return "submitting";
    if (showingDealing) return "dealing";
    if (gameStatus === "dealt") {
      if (isMatching) return "matching";
      if (isGameOver) return "gameover";
      return "playing";
    }
    if (gameStatus === "solved") return "won";
    return "idle";
  })();

  const scene = (
    <div className="sheep-scene" data-state={sceneState}>
      <span className="sheep-scene__felt" aria-hidden="true" />
      <img className="sheep-scene__mascot" src={SHEEP_ART.mascot} alt="" draggable={false} />
      {showingDealing || (gameStatus === "dealt" && pileCards.length === 0)
        ? dealingStage
        : gameStatus === "dealt" && pileCards.length > 0
          ? boardStage
          : difficultyPicker}
      <p className="sheep-scene__status" aria-live="polite">
        {lastStatus}
      </p>
    </div>
  );

  const primaryAction =
    gameStatus === "dealt"
      ? {
          label: timeUp ? t("timeUpAction") : isGameOver ? t("gameOverBanner") : t("submitAction"),
          onClick: () => void handleSubmit(),
          disabled: busy || isGameOver || !minSolveReached || submitWindowClosed,
          loading: isSubmitting,
          icon: <Rocket size={18} aria-hidden="true" />,
          hint: isGameOver
            ? t("gameOverBannerHint")
            : t("submitHint"),
        }
      : gameStatus === "committed"
        ? {
            label: t("statusShuffling"),
            onClick: () => void dispatch("retryDeal", {}),
            disabled: isDealing,
            loading: isDealing,
            hint: t("shufflingCopy"),
          }
        : {
            label: t("startAction"),
            onClick: () => void handleSubmit(),
            disabled: busy || !rewardPoolReady,
            loading: isStarting,
            icon: <Rocket size={18} aria-hidden="true" />,
            hint: rewardPoolReady
              ? t("startHint", { amount: gasDisplay(rule.entryFixed8) })
              : t("statusPoolLow"),
          };

  // Undo / Shuffle / Remove-3 live only in the in-scene .sheep-tools toolbar
  // next to the slots they act on — no duplicate copies in the action rail.
  const secondaryActions = [
    ...(timeUp || isGameOver || (gameStatus === "committed" && !isDealing)
      ? [
          {
            label: t("releaseAction"),
            onClick: () => void dispatch("expireGame", {}),
            hint: t("releaseHint"),
          },
        ]
      : []),
    ...(creditGas > 0 && gameStatus !== "dealt"
      ? [
          {
            label: t("withdrawAction", { amount: creditGas.toFixed(2) }),
            onClick: () => void dispatch("withdrawWinnings", {}),
            hint: t("withdrawHint"),
          },
        ]
      : []),
  ];

  return (
    <div
      className="sheep-playarea mx2 mx2-cat-game"
      aria-busy={busy || undefined}
    >
      <PlayStage
        category="game"
        stage={{
          eyebrow: t("appEyebrow"),
          title:
            gameStatus === "dealt"
              ? t("playingTitle")
              : showingDealing
                ? t("statusShuffling")
                : gameStatus === "solved"
                  ? t("statusWonTitle")
                  : t("lobbyTitle"),
          subtitle: gameStatus === "dealt" ? t("appSubtitle") : undefined,
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {t("networkBadge")}
              </span>
              {myRank > 0 && (
                <span className="mx2-badge">{t("rankBadge", { rank: myRank })}</span>
              )}
            </>
          ),
        }}
        scene={scene}
        score={gameStatus === "idle" ? undefined : [
          {
            label: t("scoreReward"),
            value: `${projectedPayout.toFixed(2)} GAS`,
            accent: true,
          },
          {
            label: t("scoreTime"),
            value: gameStatus === "dealt" ? formatClock(remainingMs) : formatClock(rule.limitMs),
          },
          { label: t("scoreUndos"), value: `${undosLeft}/${MAX_UNDOS}` },
          {
            label: t("scoreCards"),
            value: gameStatus === "dealt" ? String(cardsRemaining) : "-",
          },
          { label: t("scoreWon"), value: `${myTotalWon.toFixed(2)} GAS` },
        ]}
        actions={{
          primary: primaryAction,
          secondary: secondaryActions.length > 0 ? secondaryActions : undefined,
        }}
        drawerToggleLabel={t("drawerTitle")}
        drawer={{
          title: t("drawerTitle"),
          children: (
            <>
              <div className="sheep-drawer__head">
                <img src="./logo.webp" alt="" width={40} height={40} draggable={false} />
                <p>{t("leaderboardIntro")}</p>
              </div>
              <h4>{t("leaderboardTitle")}</h4>
              {leaderboard.length > 0 ? (
                <ol className="sheep-ranks">
                  {leaderboard.slice(0, 10).map((entry) => (
                    <li
                      key={entry.address}
                      className="sheep-ranks__row"
                      data-me={entry.isUser ? "true" : undefined}
                    >
                      <span className="sheep-ranks__rank">#{entry.rank}</span>
                      <span className="sheep-ranks__addr">{shortHash(entry.address)}</span>
                      <span className="sheep-ranks__solves">
                        {t("solvesCount", { count: entry.solves })}
                      </span>
                      <span className="sheep-ranks__won">{entry.totalWon.toFixed(2)} GAS</span>
                      {entry.isUser && <span className="sheep-ranks__me">{t("youTag")}</span>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>{t("leaderboardEmpty")}</p>
              )}
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={() => void dispatch("refreshLeaderboard", {})}
              >
                {t("refreshRanks")}
              </button>
              <h4>{t("historyTitle")}</h4>
              {myHistory.length > 0 ? (
                <ul className="mx2-history">
                  {myHistory.map((row) => (
                    <li key={row.gameId} className="mx2-history__item" data-outcome="won">
                      <img
                        className="sheep-history__badge"
                        src={SHEEP_ART.badges[row.difficulty] ?? SHEEP_ART.badges[0]}
                        alt=""
                        width={36}
                        height={36}
                        draggable={false}
                      />
                      <span className="mx2-history__stake">{formatClock(row.elapsedMs)}</span>
                      <span className="mx2-history__result">
                        {t("historyUndos", { undos: row.undos })}
                      </span>
                      <span className="mx2-history__stake">{row.payout}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t("historyEmpty")}</p>
              )}
              <h4>{t("rulesTitle")}</h4>
              <p>{t("rulesCopy")}</p>
              <h4>{t("fairnessTitle")}</h4>
              <p>{t("fairnessCopy")}</p>
              {commitmentHex && (
                <p className="sheep-drawer__seed">
                  {t("commitmentLine", {
                    commitment: shortHash(commitmentHex, 12, 8),
                    gameId: activeGameId,
                  })}
                </p>
              )}
            </>
          ),
        }}
      />
    </div>
  );
}
