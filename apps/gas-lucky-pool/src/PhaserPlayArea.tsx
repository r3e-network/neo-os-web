import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { formatGas } from "@shared/utils/format";
import { PlayStage } from "@shared/components-react/v2";
import { PhaserGameComponent } from "@framework/phaser";
import { Coins, ExternalLink, RefreshCw, Search, ShieldCheck, WalletCards } from "lucide-react";
import { GasLuckyPoolScene } from "./scenes/GasLuckyPoolScene";
import type { GasLuckyClaim, GasLuckyPool } from "./composables/useGasLuckyPool";
import { explorerTxUrl } from "./utils/explorer";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

const GAME_CONFIG = { scene: [GasLuckyPoolScene], width: 420, height: 580 } as const;

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
  // Guest (free / local) play — surfaced from app.mode via main.tsx so the copy
  // drops all GAS-at-stake / pool / reward framing in favour of local points.
  const isGuest = str("appMode", "gamefi") === "guest";
  const guestUnit = t("guestUnit");
  const guestBest = val<number>("guestBest", 0) ?? 0;
  const guestLast = val<number>("guestLast", 0) ?? 0;
  const guestDraws = val<number>("guestDraws", 0) ?? 0;
  const guestBoard = val<Array<{ user: string; score: number }>>("guestBoard", []) ?? [];
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
  const lastClaimPoolId = str("lastClaimPoolId", currentPoolId);
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
    sceneText,
  };

  const primaryAction =
    !isGuest && lastTxid && lastSuccessType
      ? {
          label: t("viewOnExplorer"),
          onClick: () => window.open(explorerTxUrl(lastTxid, launchContext.network), "_blank"),
          icon: <ExternalLink size={18} aria-hidden="true" />,
          hint: t("transactionIdLabel"),
        }
      : undefined;

  // Guest play has no on-chain pool / credit / claim controls — hide them all so
  // the free surface never presents GAS actions.
  const secondaryActions = isGuest ? [] : [
    ...(currentPoolId
      ? [
          {
            label: t("inspectPool"),
            onClick: () => void dispatch("loadPool", { poolId: currentPoolId }),
            disabled: isLoading,
            loading: isLoading,
            icon: <Search size={16} aria-hidden="true" />,
            hint: t("poolControlsHint"),
          },
          {
            label: t("topUpPool"),
            onClick: () => void dispatch("topUpPool", { poolId: currentPoolId, amount: "5" }),
            disabled: isFunding,
            loading: isFunding,
            icon: <Coins size={16} aria-hidden="true" />,
            hint: t("topUpAmount"),
          },
          {
            label: t("refundPool"),
            onClick: () => void dispatch("refundPool", { poolId: currentPoolId }),
            disabled: isRefunding,
            loading: isRefunding,
            icon: <RefreshCw size={16} aria-hidden="true" />,
            hint: t("poolControlsHint"),
          },
        ]
      : []),
    {
      label: t("checkGasCredit"),
      onClick: () => void dispatch("loadGasCredit"),
      disabled: isCreditLoading,
      loading: isCreditLoading,
      icon: <WalletCards size={16} aria-hidden="true" />,
      hint: t("gasCreditDescription"),
    },
    ...(hasRecoverableCredit
      ? [
          {
            label: t("withdrawGasCredit"),
            onClick: () => void dispatch("withdrawGasCredit"),
            disabled: isWithdrawingCredit,
            loading: isWithdrawingCredit,
            icon: <WalletCards size={16} aria-hidden="true" />,
            hint: t("gasCreditDescription"),
          },
        ]
      : []),
    ...(currentClaimKey
      ? [
          {
            label: t("inspectClaim"),
            onClick: () => void dispatch("checkClaimStatus", { claimKey: currentClaimKey }),
            disabled: isClaiming,
            loading: isClaiming,
            icon: <Search size={16} aria-hidden="true" />,
            hint: t("claimProgressTitle"),
          },
        ]
      : []),
  ];

  const pointsLabel = (value: number): string => `${value.toFixed(2)} ${guestUnit}`;
  const score = isGuest
    ? [
        { label: t("guestBestLabel"), value: guestBest > 0 ? pointsLabel(guestBest) : "—", accent: guestBest > 0 },
        { label: t("guestLastLabel"), value: guestLast > 0 ? pointsLabel(guestLast) : "—" },
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
              <span className="mx2-badge__dot" /> {t("guestModeBadge")}
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
          <PhaserGameComponent
            config={GAME_CONFIG}
            state={bridgeState}
            dispatch={dispatch}
            className="gas-pool-phaser-canvas"
            ariaLabel="OneGate GAS vault game"
            loadingLabel="Opening vault"
          />
        }
        score={score}
        actions={{
          primary: primaryAction,
          secondary: secondaryActions.length > 0 ? secondaryActions : undefined,
          secondaryToggleLabel: t("moreActions"),
        }}
        drawerToggleLabel={isGuest ? t("guestDrawerTitle") : t("drawerTitle")}
        drawer={{
          title: isGuest ? t("guestDrawerTitle") : t("drawerTitle"),
          children: isGuest ? (
            <div className="gas-pool-drawer">
              <div className="gas-pool-drawer__summary">
                <span>
                  <small>{t("guestBestLabel")}</small>
                  <strong>{guestBest > 0 ? pointsLabel(guestBest) : "—"}</strong>
                </span>
                <span>
                  <small>{t("guestLastLabel")}</small>
                  <strong>{guestLast > 0 ? pointsLabel(guestLast) : "—"}</strong>
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
          ),
        }}
      />
    </div>
  );
}
