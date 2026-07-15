import { useEffect, useRef, useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { formatGas } from "@shared/utils/format";
import { PlayStage } from "@shared/components-react/v2";
import { LazyPhaserGameComponent as PhaserGameComponent } from "@framework/phaser/LazyPhaserGameComponent";
import { ChevronDown, Coins, ExternalLink, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import type { GasLuckyClaim, GasLuckyPool } from "./composables/useGasLuckyPool";
import { GAS_LUCKY_REWARD_PLANS } from "./logic/game-rules";
import { explorerTxUrl } from "./utils/explorer";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

const GAME_CONFIG = { width: 420, height: 580 } as const;
const loadGasLuckyPoolScene = () =>
  import("./scenes/GasLuckyPoolScene").then((module) => module.GasLuckyPoolScene);

function shortValue(value: string, head = 8, tail = 5): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length <= head + tail + 1) return trimmed;
  return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`;
}

function gasLabel(value: bigint | number | string, decimals = 4): string {
  return `${formatGas(value, decimals)} GAS`;
}

function statusLabel(t: PlayAreaProps["t"], status: string): string {
  return t(status || "unknown");
}

export default function PhaserPlayArea({ t, state, dispatch, launchContext }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const previouslyFocused = document.activeElement;
    drawerCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDrawerOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [drawerOpen]);
  // Guest (free / local) play — surfaced from app.mode via main.tsx so the copy
  // drops all GAS-at-stake / pool / reward framing in favour of local points.
  const isGuest = str("appMode", "guest") === "guest";
  const guestUnit = t("guestUnit");
  const guestBest = val<number>("guestBest", 0) ?? 0;
  const guestLast = val<number>("guestLast", 0) ?? 0;
  const guestDraws = val<number>("guestDraws", 0) ?? 0;
  const guestBoard = val<Array<{ user: string; score: number }>>("guestBoard", []) ?? [];
  const a11yPlanIndex = Math.max(
    0,
    Math.min(
      GAS_LUCKY_REWARD_PLANS.length - 1,
      Math.round(val<number>("a11yPlanIndex", 1) ?? 1),
    ),
  );
  const a11yPlanRevision = val<number>("a11yPlanRevision", 0) ?? 0;
  const currentClaimKey = str("currentClaimKey", "");
  const currentPoolId = str("currentPoolId", "");
  const hasClaimContext = !isGuest && Boolean(currentClaimKey || currentPoolId);
  const currentRange = isGuest
    ? t("guestRangeDefault")
    : str("currentRange", "") || t("rewardRangeDefault");
  const currentPool = val<GasLuckyPool | null>("currentPool", null) ?? null;
  const recentPools = val<GasLuckyPool[]>("recentPools", []) ?? [];
  const recentClaims = val<GasLuckyClaim[]>("recentClaims", []) ?? [];
  const gasCredit = val<bigint>("gasCredit", 0n) ?? 0n;
  const poolCount = val<number>("poolCount", 0) ?? 0;
  const claimCount = val<number>("claimCount", 0) ?? 0;
  const activePoolCount = val<number>("activePoolCount", 0) ?? 0;
  const totalRemainingGas = val<number>("totalRemainingGas", 0) ?? 0;
  const currentShareUrl = str("currentShareUrl", "");
  const claimProgress = str("claimProgress", "");
  const claimStatus = str("claimStatus", "");
  const lastClaimAmount = val<bigint>("lastClaimAmount", 0n) ?? 0n;
  const lastClaimLuckPercent = str("lastClaimLuckPercent", "");
  const lastClaimKey = str("lastClaimKey", currentClaimKey);
  const lastRefundAmount = val<bigint>("lastRefundAmount", 0n) ?? 0n;
  const lastRefundPoolId = str("lastRefundPoolId", "");
  const lastFundAmount = val<bigint>("lastFundAmount", 0n) ?? 0n;
  const lastFundPoolId = str("lastFundPoolId", "");
  const lastTxid = str("lastTxid", "");
  const lastSuccessType = str("lastSuccessType", "");
  const lastError = str("lastError", "");
  const isCreating = bool("isCreating");
  const isClaiming = bool("isClaiming");
  const isLoading = bool("isLoading");
  const isRefunding = bool("isRefunding");
  const isFunding = bool("isFunding");
  const isCreditLoading = bool("isCreditLoading");
  const isWithdrawingCredit = bool("isWithdrawingCredit");
  const busy =
    isCreating ||
    isClaiming ||
    isLoading ||
    isRefunding ||
    isFunding ||
    isCreditLoading ||
    isWithdrawingCredit;
  const claimSucceeded = lastSuccessType === "claim" && claimStatus === "paid" && !lastError;
  const createSucceeded = lastSuccessType === "create" && !lastError;
  const fundSucceeded = lastSuccessType === "fund" && !lastError;
  const refundSucceeded = lastSuccessType === "refund" && !lastError;
  const withdrawSucceeded = lastSuccessType === "withdraw" && !lastError;
  const hasRecoverableCredit = gasCredit > 0n;

  // Localized string bundle for the Phaser vault scene. The canvas has no direct
  // locale accessor, so the shell hands the scene a translated bundle through the
  // bridge (new key, existing contract keys untouched) and the scene reads it via
  // this.val("sceneText"). Templates keep {placeholders} the scene interpolates.
  // Mode-aware scene string: guest uses local (points) framing, gamefi keeps the
  // exact vault copy. The frozen scene reads the same bundle keys either way.
  const sx = (guestKey: string, gamefiKey: string): string =>
    isGuest ? t(guestKey) : t(gamefiKey);
  const sceneText: Record<string, string> = {
    tabFund: sx("guestTabDraw", "vaultTabFund"),
    tabClaim: sx("guestTabQuick", "vaultTabClaim"),
    choosePack: sx("guestChooseTier", "vaultChoosePack"),
    packStarter: t("vaultPackStarter"),
    packParty: t("vaultPackParty"),
    packJackpot: t("vaultPackJackpot"),
    gasUnit: sx("guestUnit", "gasUnit"),
    slotsTemplate: sx("guestSlots", "rewardSlotsCount"),
    summaryTemplate: sx("guestPackSummary", "vaultPackSummary"),
    actionPack: sx("guestActionDraw", "vaultActionPack"),
    actionWorking: t("vaultActionWorking"),
    unwrapTitle: sx("guestUnwrapTitle", "vaultUnwrapTitle"),
    actionCheck: t("vaultActionCheck"),
    actionWait: t("vaultActionWait"),
    actionClaim: sx("guestActionDraw", "vaultActionClaim"),
    actionClaiming: t("vaultActionClaiming"),
    actionNoLink: t("vaultActionNoLink"),
    tagline: sx("guestTagline", "vaultTagline"),
    statusIdle: sx("guestStatusIdle", "vaultStatusIdle"),
    readyToUnwrap: t("vaultReadyToUnwrap"),
    openClaimLink: t("vaultOpenClaimLink"),
    rangePending: t("vaultRangePending"),
    poolNumberTemplate: t("vaultPoolNumber"),
    luckTemplate: t("vaultLuckSuffix"),
    latestTxTemplate: t("vaultLatestTx"),
    rangeDefault: sx("guestRangeDefault", "rewardRangeDefault"),
    progWallet: t("claimProgressWallet"),
    progSubmitted: t("claimProgressSubmitted"),
    progSubmitting: t("claimProgressSubmitting"),
    progConfirming: t("claimProgressConfirming"),
    progPaid: t("claimProgressPaid"),
    progFailed: t("claimProgressFailed"),
    actionError: t("vaultActionError"),
  };

  const bridgeState = {
    appMode: isGuest ? "guest" : "gamefi",
    currentClaimKey,
    currentPoolId,
    currentRange,
    claimProgress,
    claimStatus,
    lastClaimAmount,
    lastClaimLuckPercent,
    lastTxid,
    lastSuccessType,
    lastError,
    isCreating,
    isClaiming,
    isLoading,
    guestDraws,
    a11yPlanIndex,
    a11yPlanRevision,
    sceneText,
  };

  const chooseA11yPlan = (index: number): void => {
    void dispatch("selectGuestPlan", { index });
  };

  const drawA11yPlan = (): void => {
    const plan = GAS_LUCKY_REWARD_PLANS[a11yPlanIndex] ?? GAS_LUCKY_REWARD_PLANS[1];
    void dispatch("createPool", {
      totalAmount: plan.amount,
      minClaim: plan.minClaim,
      maxClaim: plan.maxClaim,
      maxClaims: plan.maxClaims,
      expiryHours: plan.expiryHours,
    });
  };

  const pointsLabel = (value: number): string => `${value.toFixed(2)} ${guestUnit}`;
  const scoreItems = isGuest
    ? [
        { label: t("guestBestLabel"), value: guestBest > 0 ? pointsLabel(guestBest) : t("guestNoDrawYet"), accent: guestBest > 0 },
        { label: t("guestLastLabel"), value: guestLast > 0 ? pointsLabel(guestLast) : t("guestNoDrawYet") },
        { label: t("guestDrawsLabel"), value: String(guestDraws) },
      ]
    : hasClaimContext
      ? [
          { label: t("rewardRange"), value: currentRange, accent: true },
          { label: t("claimProgressTitle"), value: claimProgress ? t(`claimProgress${claimProgress[0]?.toUpperCase() ?? ""}${claimProgress.slice(1)}`) : "—" },
          { label: t("claimAmountLabel"), value: lastClaimAmount > 0n ? gasLabel(lastClaimAmount) : "—" },
        ]
      : [
          { label: t("activePools"), value: String(activePoolCount), accent: activePoolCount > 0 },
          { label: t("remainingGas"), value: `${totalRemainingGas.toFixed(2)} GAS` },
          { label: t("claims"), value: String(claimCount) },
          { label: t("gasCredit"), value: gasLabel(gasCredit) },
        ];

  const resultText = claimSucceeded
    ? t("claimCongratsBody", {
        claimKey: shortValue(lastClaimKey || currentClaimKey),
        amount: gasLabel(lastClaimAmount),
      })
    : createSucceeded
      ? t("poolCreated")
      : fundSucceeded
        ? t("fundCongratsBody", { poolId: lastFundPoolId || currentPoolId, amount: gasLabel(lastFundAmount) })
        : refundSucceeded
          ? t("refundCongratsBody", { poolId: lastRefundPoolId || currentPoolId, amount: gasLabel(lastRefundAmount) })
          : withdrawSucceeded
            ? t("gasCreditWithdrawn")
            : "";
  const drawerTitle = isGuest ? t("guestDrawerTitle") : t("drawerTitle");
  const drawerId = "gas-pool-ingame-drawer";
  const drawerContent = isGuest ? (
    <div className="gas-pool-drawer">
      {currentClaimKey && (
        <div className="gas-pool-drawer__notice" data-tone="warning">
          <strong>{t("gameFiMaintenanceShort")}</strong>
          <p>{t("claimLinkPreserved")}</p>
        </div>
      )}
      <div className="gas-pool-drawer__summary">
        <span>
          <small>{t("guestBestLabel")}</small>
          <strong>{guestBest > 0 ? pointsLabel(guestBest) : t("guestNoDrawYet")}</strong>
        </span>
        <span>
          <small>{t("guestLastLabel")}</small>
          <strong>{guestLast > 0 ? pointsLabel(guestLast) : t("guestNoDrawYet")}</strong>
        </span>
        <span>
          <small>{t("guestDrawsLabel")}</small>
          <strong>{guestDraws}</strong>
        </span>
      </div>

      <section className="gas-pool-drawer__section">
        <div className="gas-pool-drawer__section-head">
          <h4>{t("guestBoardTitle")}</h4>
        </div>
        {guestBoard.length > 0 ? (
          <ul className="gas-pool-list gas-pool-list--claims">
            {guestBoard.slice(0, 8).map((row, index) => (
              <li key={`${row.user}-${index}`}>
                <span>#{index + 1}</span>
                <strong>{pointsLabel(row.score)}</strong>
                <small>{shortValue(row.user)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("guestBoardEmpty")}</p>
        )}
      </section>

      <section className="gas-pool-drawer__guide">
        <h4>{t("guestHowTitle")}</h4>
        <p>{t("guestHowBody")}</p>
        <p className="gas-pool-drawer__seed">
          <ShieldCheck size={14} aria-hidden="true" />
          <span>{t("guestSeedNote")}</span>
        </p>
      </section>
    </div>
  ) : (
    <div className="gas-pool-drawer">
      <div className="gas-pool-drawer__summary">
        <span>
          <small>{t("totalPools")}</small>
          <strong>{poolCount}</strong>
        </span>
        <span>
          <small>{t("activePools")}</small>
          <strong>{activePoolCount}</strong>
        </span>
        <span>
          <small>{t("remainingGas")}</small>
          <strong>{totalRemainingGas.toFixed(2)} GAS</strong>
        </span>
        <span>
          <small>{t("claims")}</small>
          <strong>{claimCount}</strong>
        </span>
      </div>

      {(resultText || lastError) && (
        <div className="gas-pool-drawer__notice" data-tone={lastError ? "error" : "success"}>
          <strong>{lastError ? t("claimProgressFailed") : t("claimProgressPaid")}</strong>
          <p>{lastError || resultText}</p>
          {lastClaimLuckPercent && !lastError && (
            <small>{t("luckPercentLabel", { percent: lastClaimLuckPercent })}</small>
          )}
        </div>
      )}

      {(lastTxid || currentPoolId || currentClaimKey) && (
        <section className="gas-pool-drawer__actions" aria-label={t("poolControlsHint")}>
          {lastTxid && lastSuccessType && (
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost"
              onClick={() => window.open(explorerTxUrl(lastTxid, launchContext.network), "_blank", "noopener,noreferrer")}
            >
              <ExternalLink size={16} aria-hidden="true" />
              <span>{t("viewOnExplorer")}</span>
            </button>
          )}
          {currentPoolId && (
            <>
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={() => void dispatch("loadPool", { poolId: currentPoolId })}
                disabled={isLoading}
              >
                <Search size={16} aria-hidden="true" />
                <span>{t("inspectPool")}</span>
              </button>
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={() => void dispatch("topUpPool", { poolId: currentPoolId, amount: "5" })}
                disabled={isFunding}
              >
                <Coins size={16} aria-hidden="true" />
                <span>{t("topUpPool")}</span>
              </button>
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={() => void dispatch("refundPool", { poolId: currentPoolId })}
                disabled={isRefunding}
              >
                <RefreshCw size={16} aria-hidden="true" />
                <span>{t("refundPool")}</span>
              </button>
            </>
          )}
          {currentClaimKey && (
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost"
              onClick={() => void dispatch("checkClaimStatus", { claimKey: currentClaimKey })}
              disabled={isClaiming}
            >
              <Search size={16} aria-hidden="true" />
              <span>{t("inspectClaim")}</span>
            </button>
          )}
        </section>
      )}

      <section className="gas-pool-drawer__section">
        <div className="gas-pool-drawer__section-head">
          <h4>{t("poolOverview")}</h4>
          {currentShareUrl && <span>{t("shareLink")}</span>}
        </div>
        {currentPool ? (
          <div className="gas-pool-current">
            <span>
              <small>{t("poolIdLabel")}</small>
              <strong>#{currentPool.id}</strong>
            </span>
            <span>
              <small>{statusLabel(t, currentPool.status)}</small>
              <strong>{gasLabel(currentPool.remainingAmount)}</strong>
            </span>
            <span>
              <small>{t("claims")}</small>
              <strong>{currentPool.claimedCount}/{currentPool.maxClaims}</strong>
            </span>
            <span>
              <small>{t("bestLuck")}</small>
              <strong>{currentPool.bestLuckAmount > 0n ? gasLabel(currentPool.bestLuckAmount) : "—"}</strong>
            </span>
          </div>
        ) : (
          <p>{currentPoolId ? t("poolControlsHint") : t("distributionPathsTitle")}</p>
        )}
        {currentShareUrl && (
          <button
            type="button"
            className="gas-pool-share"
            onClick={() => void navigator.clipboard?.writeText(currentShareUrl)}
            title={currentShareUrl}
          >
            <span>{shortValue(currentShareUrl, 22, 10)}</span>
            <small>{t("copied")}</small>
          </button>
        )}
      </section>

      <section className="gas-pool-drawer__section">
        <div className="gas-pool-drawer__section-head">
          <h4>{t("activityTab")}</h4>
          <span>{t("perAddressOnce")}</span>
        </div>
        {recentPools.length > 0 ? (
          <ul className="gas-pool-list">
            {recentPools.slice(0, 5).map((pool) => (
              <li key={pool.id}>
                <span>#{pool.id}</span>
                <strong>{gasLabel(pool.remainingAmount)}</strong>
                <small>{statusLabel(t, pool.status)} · {pool.claimedCount}/{pool.maxClaims}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("poolOverview")}</p>
        )}
        {recentClaims.length > 0 && (
          <ul className="gas-pool-list gas-pool-list--claims">
            {recentClaims.slice(0, 5).map((claim) => (
              <li key={claim.id}>
                <span>#{claim.poolId}</span>
                <strong>{gasLabel(claim.amount)}</strong>
                <small>{shortValue(claim.claimer)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="gas-pool-drawer__credit">
        <span>
          <small>{t("gasCreditTitle")}</small>
          <strong>{gasLabel(gasCredit)}</strong>
        </span>
        <div>
          <button
            type="button"
            className="mx2-btn mx2-btn--ghost"
            onClick={() => void dispatch("loadGasCredit")}
            disabled={isCreditLoading}
          >
            {t("checkGasCredit")}
          </button>
          <button
            type="button"
            className="mx2-btn mx2-btn--ghost"
            onClick={() => void dispatch("withdrawGasCredit")}
            disabled={isWithdrawingCredit || !hasRecoverableCredit}
          >
            {t("withdrawGasCredit")}
          </button>
        </div>
      </section>

      <section className="gas-pool-drawer__guide">
        <h4>{t("howItWorks")}</h4>
        <p>{t("docHowItWorks")}</p>
        <h4>{t("safetyModel")}</h4>
        <p>{t("docSafetyModel")}</p>
        <h4>{t("oneGateFlow")}</h4>
        <p>{t("docOneGateFlow")}</p>
        <p className="gas-pool-drawer__seed">
          <ShieldCheck size={14} aria-hidden="true" />
          <span>{t("serverPaysNote")}</span>
        </p>
      </section>
    </div>
  );

  return (
    <div className="gas-pool-playarea mx2 mx2-cat-game" aria-busy={busy || undefined}>
      <PlayStage
        category="game"
        className={hasClaimContext ? "gas-pool-playstage--claim" : "gas-pool-playstage--creator"}
        stage={{
          eyebrow:  isGuest ? t("guestEyebrow") : t("appEyebrow"),
          title:    isGuest ? t("guestTitle") : hasClaimContext ? t("claimPoolTitle") : t("appTitle"),
          subtitle: isGuest ? t("guestSubtitle") : hasClaimContext ? t("claimPoolDescription") : t("appSubtitle"),
          badges: isGuest ? (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {currentClaimKey ? t("claimLinkHeldShort") : t("guestModeBadge")}
            </span>
          ) : (
            <>
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {currentRange}
              </span>
              {hasRecoverableCredit && (
                <span className="mx2-badge">{t("gasCredit")}: {gasLabel(gasCredit)}</span>
              )}
            </>
          ),
        }}
        scene={
          <div className="gas-pool-stage-shell">
            <PhaserGameComponent
              config={GAME_CONFIG}
              loadScene={loadGasLuckyPoolScene}
              state={bridgeState}
              dispatch={dispatch}
              className="gas-pool-phaser-canvas"
              ariaLabel={isGuest ? t("guestCanvasAria") : t("vaultCanvasAria")}
              loadingLabel={t("vaultCanvasLoading")}
              errorLabel={t("vaultActionError")}
              retryLabel={t("retry")}
              continueLabel={t("continue")}
              enableSoundLabel={t("enableGameSound")}
              muteSoundLabel={t("muteGameSound")}
            />

            {isGuest && (
              <div className="gas-pool-a11y-controls" aria-label={t("guestA11yControls")}>
                <fieldset>
                  <legend>{t("guestChooseTier")}</legend>
                  {GAS_LUCKY_REWARD_PLANS.map((plan, index) => (
                    <label key={plan.key}>
                      <input
                        type="radio"
                        name="gas-pool-a11y-plan"
                        checked={a11yPlanIndex === index}
                        onChange={() => chooseA11yPlan(index)}
                      />
                      <span>{t(plan.titleKey)} · {plan.minClaim}-{plan.maxClaim} {guestUnit}</span>
                    </label>
                  ))}
                  <button type="button" onClick={drawA11yPlan}>
                    {t("guestActionDraw")}
                  </button>
                </fieldset>
              </div>
            )}

            <p className="gas-pool-sr-status" aria-live="polite" aria-atomic="true">
              {isGuest && guestLast > 0
                ? t("guestDrawResult", {
                    amount: guestLast.toFixed(2),
                    luck: lastClaimLuckPercent || "—",
                  })
                : lastError || resultText}
            </p>

            <div
              className="gas-pool-stage-hud"
              aria-label={drawerTitle}
              data-metrics={scoreItems.length}
            >
              {scoreItems.map((item) => (
                <div
                  className="gas-pool-stage-hud__metric"
                  data-accent={item.accent ? "true" : undefined}
                  key={`${item.label}-${item.value}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <button
                type="button"
                className="gas-pool-stage-hud__drawer"
                onClick={() => setDrawerOpen((open) => !open)}
                aria-expanded={drawerOpen}
                aria-controls={drawerId}
                ref={drawerTriggerRef}
              >
                <span>{drawerTitle}</span>
                <ChevronDown size={15} data-open={drawerOpen ? "true" : undefined} aria-hidden="true" />
              </button>
            </div>

            {drawerOpen && (
              <section
                id={drawerId}
                className="gas-pool-ingame-drawer"
                role="dialog"
                aria-modal="false"
                aria-labelledby={`${drawerId}-title`}
              >
                <header className="gas-pool-ingame-drawer__head">
                  <h3 id={`${drawerId}-title`}>{drawerTitle}</h3>
                  <button
                    type="button"
                    ref={drawerCloseRef}
                    onClick={() => setDrawerOpen(false)}
                    aria-label={t("closeDrawer")}
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                </header>
                {drawerContent}
              </section>
            )}
          </div>
        }
        actions={{}}
      />
    </div>
  );
}
