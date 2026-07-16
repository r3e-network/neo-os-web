import { useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BadgeDollarSign,
  CheckCircle2,
  Clock3,
  Coins,
  Crown,
  Gavel,
  History,
  Landmark,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { CoinArt } from "@shared/art";
import type { Observable } from "@shared/react/context";
import { useNowMs } from "@shared/react/hooks/useNowMs";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import {
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import { PhaseValue, resolvePhase, type DataPhase } from "@shared/components-react/v2/DataPhase";
import { gasToBaseUnits } from "@shared/utils/amounts";
import { formatNum } from "@shared/utils/format";
import { epochWindowPhase, EPOCH_DURATION_FALLBACK_MS, MIN_BID } from "./hooks/useGovMerc";
import type { PendingGovMercOperation } from "./gov-merc-production";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface ReclaimableBid {
  epoch: number;
  amount: number;
}

type ActionMode = "bid" | "stake";
type DrawerMode = "market" | "wallet" | "recovery" | "guide";

const STAKE_PRESETS = ["1", "10", "50"];
const MARKET_STAGE_IMAGE = "gov-merc-market-stage.webp";

function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function compact(value: string): string {
  return value.length > 18 ? `${value.slice(0, 9)}…${value.slice(-6)}` : value;
}

function positiveWholeNeo(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

function positiveGas(value: string): boolean {
  return gasToBaseUnits(value) > 0n;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, str, bool, num } = useStateBindings(state);
  const now = useNowMs(1_000);
  const [actionMode, setActionMode] = useState<ActionMode>("bid");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("market");
  const [connecting, setConnecting] = useState(false);

  const totalPool = val<number>("totalPool", 0) ?? 0;
  const currentEpoch = val<number>("currentEpoch", 0) ?? 0;
  const bids = val<Array<{ address: string; amount: number }>>("bids", []) ?? [];
  const address = str("address");
  const userDeposits = val<number>("userDeposits", 0) ?? 0;
  const depositAmount = str("depositAmount");
  const withdrawAmount = str("withdrawAmount");
  const bidAmount = str("bidAmount");
  const bidCount = num("bidCount");
  const canSettle = bool("canSettle");
  const epochDeadline = val<number>("epochDeadline", 0) ?? 0;
  const epochDurationMs = val<number>("epochDurationMs", EPOCH_DURATION_FALLBACK_MS) ?? EPOCH_DURATION_FALLBACK_MS;
  const pendingRewards = val<number>("pendingRewards", 0) ?? 0;
  const gasCredit = val<number>("gasCredit", 0) ?? 0;
  const reclaimableBids = val<ReclaimableBid[]>("reclaimableBids", []) ?? [];
  const highestBid = val<number>("highestBid", 0) ?? 0;
  const lastDistributed = val<number>("lastDistributed", 0) ?? 0;
  const pendingOperation = val<PendingGovMercOperation | null>("pendingOperation", null);
  const pendingTxid = str("pendingTxid");
  const transactionStatus = str("transactionStatus", "idle");
  const activeAction = str("activeAction");
  const readError = str("readError");

  const isBusy = bool("isBusy");
  const isRecovering = bool("isRecovering");
  const marketAvailable = bool("marketAvailable");
  const windowAvailable = bool("windowAvailable");
  const highestBidAvailable = bool("highestBidAvailable");
  const walletAvailable = bool("walletAvailable");
  const bidsAvailable = bool("bidsAvailable");
  const settlementAvailable = bool("settlementAvailable");
  const reclaimableAvailable = bool("reclaimableAvailable");
  const storageHealthy = bool("storageHealthy");

  const isConnected = Boolean(address);

  // ── Honest read phases ───────────────────────────────────────────────────
  // A visitor who has just opened the desk has no wallet and no chain data yet.
  // That is the expected first paint, so each reading renders as a skeleton
  // while its read is in flight and as inviting zero-state copy once the read
  // settles empty — never a wall of "Unavailable", never an error banner.
  const dataLoading = bool("dataLoading");
  const loaded = bool("loaded");
  const phaseOf = (hasData: boolean): DataPhase =>
    resolvePhase({ loading: dataLoading, settled: loaded, hasData });
  const marketPhase = phaseOf(marketAvailable);
  // Wallet-scoped readings are honest about *why* they are empty: connecting a
  // wallet is the visitor's next step, not a fault of the desk.
  const walletPhase = phaseOf(walletAvailable);
  const walletPlaceholder = isConnected ? t("valueAwaitingNetwork") : t("valueConnectWallet");

  const windowPhase = windowAvailable ? epochWindowPhase(epochDeadline, now) : null;
  const biddingClosed = windowPhase === "closed";
  const windowMinutes = Math.max(1, Math.round(epochDurationMs / 60_000));
  const windowLabel = !windowAvailable
    ? t("valueAwaitingNetwork")
    : windowPhase === "unopened"
      ? t("bidWindowUnopened", { minutes: windowMinutes })
      : windowPhase === "open"
        ? t("bidWindowCountdown", { time: formatCountdown(epochDeadline - now) })
        : t("bidWindowClosed");

  const bidPresets = useMemo(() => {
    const base = Math.max(MIN_BID, highestBidAvailable ? highestBid : MIN_BID);
    return [base, base + 1, base + 5].map((amount) => Number(amount.toFixed(2)).toString());
  }, [highestBid, highestBidAvailable]);

  const setVal = (key: string, value: string) => {
    (state as Record<string, { set?: (next: unknown) => void }>)[key]?.set?.(value);
  };

  const primaryKind = pendingOperation
    ? "recover"
    : !isConnected
      ? "connect"
      : canSettle && biddingClosed
        ? "settle"
        : actionMode;
  const primaryLabel = connecting
    ? t("connectingWallet")
    : activeAction
    ? t({
        connect: "connectingWallet",
        bid: "placingBid",
        stake: "stakingNeo",
        deposit: "stakingNeo",
        settle: "settlingEpoch",
        recover: "checkingTransaction",
      }[activeAction] ?? "transactionPending")
    : primaryKind === "recover"
      ? t("checkTransaction")
      : primaryKind === "connect"
        ? t("connectAction")
        : primaryKind === "settle"
          ? t("settleAction")
          : primaryKind === "stake"
            ? t("depositNeo")
            : t("placeBid");

  const primaryDisabled = primaryKind === "recover"
    ? isRecovering
    : primaryKind === "connect"
      ? isBusy || connecting
      : !storageHealthy || isBusy || !marketAvailable ||
        (primaryKind === "stake" ? !positiveWholeNeo(depositAmount) :
          primaryKind === "bid" ? (!windowAvailable || biddingClosed || !positiveGas(bidAmount)) : !canSettle);

  const runPrimary = () => {
    if (primaryKind === "recover") return void dispatch("recoverPendingOperation");
    if (primaryKind === "connect") {
      setConnecting(true);
      void dispatch("connectWallet").finally(() => setConnecting(false));
      return;
    }
    if (primaryKind === "settle") return void dispatch("settleEpoch");
    if (primaryKind === "stake") return void dispatch("depositNeo");
    return void dispatch("placeBid");
  };

  /** One reading rendered across all three honest phases. */
  const value = (
    available: boolean,
    amount: number,
    digits: number,
    token: string,
    placeholder = t("valueAwaitingNetwork"),
  ) => (
    <PhaseValue phase={phaseOf(available)} placeholder={placeholder} skeletonWidth="4.5em">
      {`${formatNum(amount, digits)} ${token}`}
    </PhaseValue>
  );

  const sceneStatus = pendingOperation
    ? t("transactionPendingCopy", { txid: compact(pendingTxid) })
    : transactionStatus === "credit-held"
      ? t("creditHeldReady")
      : readError || (!storageHealthy ? t("recoveryStorageUnavailable") :
        highestBidAvailable
          ? t("marketPlateTopBid", { amount: formatNum(highestBid, 2), tokenGas: "GAS" })
          // Before the first bid read lands there is no top bid to quote. Invite
          // the visitor in instead of quoting an "Unavailable" price.
          : t("marketPlateNoBidYet"));

  const scene = (
    <div className="merc-workspace" data-active={connecting ? "connect" : activeAction || (pendingOperation ? "pending" : "idle")}>
      <figure className="merc-market-visual">
        <img
          src={MARKET_STAGE_IMAGE}
          alt={t("marketArtAlt")}
          loading="eager"
          decoding="async"
          draggable={false}
        />
        <figcaption className="merc-market-overlay">
          <div className="merc-round-card">
            <span>
              <Clock3 size={16} />{" "}
              <PhaseValue phase={marketPhase} placeholder={t("valueAwaitingNetwork")} skeletonWidth="5em">
                {t("marketPlateEpoch", { epoch: currentEpoch })}
              </PhaseValue>
            </span>
            <strong>
              <PhaseValue phase={marketPhase} placeholder={t("epochOpensOnNetwork")} skeletonWidth="7em">
                {windowLabel}
              </PhaseValue>
            </strong>
          </div>
          <div className="merc-market-tape">
            <div>
              <CoinArt size={30} variant="neo" />
              <span>{t("totalPool")}</span>
              <strong>{value(marketAvailable, totalPool, 0, "NEO")}</strong>
            </div>
            <div>
              <CoinArt size={30} variant="gas" />
              <span>{t("currentTopBid")}</span>
              <strong>{value(highestBidAvailable, highestBid, 2, "GAS")}</strong>
            </div>
            <div>
              <Trophy size={25} />
              <span>{t("bidLeaderboard")}</span>
              <strong>
                <PhaseValue phase={phaseOf(bidsAvailable)} placeholder={t("valueAwaitingNetwork")} skeletonWidth="2.5em">
                  {String(bidCount || bids.length)}
                </PhaseValue>
              </strong>
            </div>
          </div>
        </figcaption>
      </figure>

      <section className="merc-command" aria-labelledby="merc-command-title">
        <div className="merc-command__heading">
          <div>
            <span>{t("yourNextMove")}</span>
            <strong id="merc-command-title">{biddingClosed && canSettle ? t("settleAction") : t("chooseRole")}</strong>
          </div>
          <span className="merc-wallet-pill"><Wallet size={15} /> {isConnected ? compact(address) : t("walletStatusIdle")}</span>
        </div>

        {!pendingOperation && isConnected && !(biddingClosed && canSettle) && (
          <>
            <OpenUiSegmented
              className="merc-role-switch"
              label={t("chooseRole")}
              value={actionMode}
              onChange={(next) => setActionMode(next as ActionMode)}
              options={[
                { value: "bid", label: <><BadgeDollarSign size={15} /> {t("bidRole")}</> },
                { value: "stake", label: <><Landmark size={15} /> {t("stakeRole")}</> },
              ]}
            />
            {actionMode === "bid" ? (
              <div className="merc-ticket">
                <OpenUiTextField
                  label={t("bidAmount")}
                  value={bidAmount}
                  onChange={(event) => setVal("bidAmount", event.target.value)}
                  inputMode="decimal"
                  placeholder={t("amountPlaceholderGas")}
                  disabled={isBusy || biddingClosed}
                  hint={biddingClosed ? t("biddingClosedHint") : t("actionBidCompact", { min: MIN_BID })}
                />
                <div className="merc-presets" aria-label={t("suggestedAmounts")}>
                  {bidPresets.map((amount) => (
                    <button type="button" key={amount} onClick={() => setVal("bidAmount", amount)} disabled={isBusy || biddingClosed} aria-pressed={bidAmount === amount}>
                      {amount} GAS
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="merc-ticket">
                <OpenUiTextField
                  label={t("depositAmount")}
                  value={depositAmount}
                  onChange={(event) => setVal("depositAmount", event.target.value)}
                  inputMode="numeric"
                  placeholder={t("amountPlaceholderNeo")}
                  disabled={isBusy}
                  hint={t("actionStakeCompact")}
                />
                <div className="merc-presets" aria-label={t("suggestedAmounts")}>
                  {STAKE_PRESETS.map((amount) => (
                    <button type="button" key={amount} onClick={() => setVal("depositAmount", amount)} disabled={isBusy} aria-pressed={depositAmount === amount}>
                      {amount} NEO
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!isConnected && !pendingOperation && (
          <div className="merc-onboarding"><Wallet size={24} /><div><strong>{t("connectTitle")}</strong><span>{t("connectCompactCopy")}</span></div></div>
        )}
        {biddingClosed && canSettle && !pendingOperation && (
          <div className="merc-onboarding"><Gavel size={24} /><div><strong>{t("settleReadyTitle")}</strong><span>{t("settleCopy")}</span></div></div>
        )}
        {pendingOperation && (
          <div className="merc-onboarding merc-onboarding--pending"><History size={24} /><div><strong>{t("transactionPending")}</strong><span>{t("transactionPendingCopy", { txid: compact(pendingTxid) })}</span></div></div>
        )}
        <p className="merc-command__status" role={readError ? "alert" : "status"}>
          {readError || !storageHealthy ? <AlertCircle size={16} /> : transactionStatus === "confirmed" ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
          <span>{sceneStatus}</span>
        </p>
      </section>
    </div>
  );

  // `value` is a ReactNode, not a string: an unresolved reading renders as a
  // skeleton or zero-state element rather than placeholder text.
  const drawerModes: Array<{ mode: DrawerMode; label: string; Icon: LucideIcon; value: ReactNode }> = [
    { mode: "market", label: t("marketDrawer"), Icon: Trophy, value: bidsAvailable ? String(bids.length) : "" },
    { mode: "wallet", label: t("walletDrawer"), Icon: Wallet, value: value(walletAvailable, userDeposits, 0, "NEO") },
    { mode: "recovery", label: t("recoveryDrawer"), Icon: History, value: pendingOperation ? t("pendingShort") : t("clearShort") },
    { mode: "guide", label: t("flowTitle"), Icon: Landmark, value: t("threeSteps") },
  ];
  const activeDrawer = drawerModes.find((entry) => entry.mode === drawerMode) ?? drawerModes[0]!;
  const ActiveDrawerIcon = activeDrawer.Icon;

  const drawerPanels: Record<DrawerMode, ReactNode> = {
    market: !bidsAvailable ? (
      <div className="merc-empty"><AlertCircle size={20} /><span>{t("bidsUnavailable")}</span></div>
    ) : bids.length ? (
      <ol className="merc-bid-list">
        {bids.slice(0, 8).map((bid, index) => (
          <li key={`${bid.address}-${index}`}>
            <span>#{index + 1}</span>
            <strong>{compact(bid.address)}</strong>
            <em>{formatNum(bid.amount, 2)} GAS</em>
          </li>
        ))}
      </ol>
    ) : (
      <div className="merc-empty"><Trophy size={20} /><span>{t("noBids")}</span></div>
    ),
    wallet: (
      <div className="merc-wallet-panel">
        <div className="merc-balance-grid">
          <div><CoinArt size={27} variant="neo" /><span>{t("yourDeposits")}</span><strong>{value(walletAvailable, userDeposits, 0, "NEO")}</strong></div>
          <div><CoinArt size={27} variant="gas" /><span>{t("pendingRewards")}</span><strong>{value(walletAvailable, pendingRewards, 4, "GAS")}</strong></div>
          <div><Coins size={23} /><span>{t("unusedCredit")}</span><strong>{value(walletAvailable, gasCredit, 4, "GAS")}</strong></div>
          <div><Crown size={23} /><span>{t("lastDistributed")}</span><strong>
            <PhaseValue phase={phaseOf(settlementAvailable)} placeholder={t("valueAwaitingNetwork")} skeletonWidth="5em">
              {`${formatNum(lastDistributed, 4)} GAS`}
            </PhaseValue>
          </strong></div>
        </div>
        <div className="merc-secondary-action">
          <OpenUiTextField
            label={t("withdrawAmount")}
            value={withdrawAmount}
            onChange={(event) => setVal("withdrawAmount", event.target.value)}
            inputMode="numeric"
            placeholder={t("amountPlaceholderNeo")}
            disabled={!isConnected || !storageHealthy || isBusy || Boolean(pendingOperation)}
          />
          <button type="button" onClick={() => void dispatch("withdrawNeo")} disabled={!isConnected || !storageHealthy || isBusy || Boolean(pendingOperation) || !positiveWholeNeo(withdrawAmount)}>
            <ArrowUpRight size={15} /> {t("withdrawNeo")}
          </button>
        </div>
        <div className="merc-compact-actions">
          <button type="button" onClick={() => void dispatch("claimRewards")} disabled={!storageHealthy || !walletAvailable || pendingRewards <= 0 || isBusy || Boolean(pendingOperation)}>{t("claimRewards")}</button>
          <button type="button" onClick={() => void dispatch("withdrawCredit")} disabled={!storageHealthy || !walletAvailable || gasCredit <= 0 || isBusy || Boolean(pendingOperation)}>{t("withdrawCredit")}</button>
        </div>
        {!reclaimableAvailable ? (
          <div className="merc-empty"><AlertCircle size={18} /><span>{t("reclaimUnavailable")}</span></div>
        ) : reclaimableBids.length ? (
          <div className="merc-reclaims">
            {reclaimableBids.map((bid) => (
              <button type="button" key={bid.epoch} onClick={() => void dispatch("reclaimBid", bid.epoch)} disabled={!storageHealthy || isBusy || Boolean(pendingOperation)}>
                <span>{t("reclaimBidLabel", { epoch: bid.epoch })}</span><strong>{formatNum(bid.amount, 2)} GAS</strong>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    ),
    recovery: (
      <div className="merc-recovery-panel">
        <div className={storageHealthy ? "merc-recovery-state" : "merc-recovery-state is-warning"}>
          {storageHealthy ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
          <div><strong>{storageHealthy ? t("recoveryReady") : t("recoveryUnavailableTitle")}</strong><span>{storageHealthy ? t("recoveryReadyCopy") : t("recoveryStorageUnavailable")}</span></div>
        </div>
        {pendingOperation ? (
          <div className="merc-pending-record">
            <div><span>{t("pendingOperationLabel")}</span><strong>{t(`operation_${pendingOperation.kind}`)}</strong></div>
            <div><span>{t("pendingStageLabel")}</span><strong>{t(`stage_${pendingOperation.stage}`)}</strong></div>
            <code title={pendingTxid}>{pendingTxid}</code>
            <button type="button" onClick={() => void dispatch("recoverPendingOperation")} disabled={isRecovering}>
              <RefreshCw size={15} /> {isRecovering ? t("checkingTransaction") : t("checkTransaction")}
            </button>
          </div>
        ) : (
          <div className="merc-empty"><CheckCircle2 size={20} /><span>{t("noPendingTransaction")}</span></div>
        )}
      </div>
    ),
    guide: (
      <div className="merc-guide">
        <div><span>1</span><div><strong>{t("flowDeposit")}</strong><p>{t("flowDepositCopy")}</p></div></div>
        <div><span>2</span><div><strong>{t("flowBid")}</strong><p>{t("flowBidCopy")}</p></div></div>
        <div><span>3</span><div><strong>{t("flowInfluence")}</strong><p>{t("flowInfluenceCopy")}</p></div></div>
      </div>
    ),
  };

  return (
    <OpenUiProvider>
      <div className="gov-merc-play-area mx2 mx2-cat-governance">
        <PlayStage
          category="governance"
          stage={{
            eyebrow: t("marketSignalTitle"),
            title: t("govHeroTitle"),
            subtitle: t("govHeroSubtitle"),
            badges: (
              <>
                <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" />{" "}
                  <PhaseValue phase={marketPhase} placeholder={t("epochAwaitNetworkShort")} skeletonWidth="4.5em">
                    {t("marketPlateEpoch", { epoch: currentEpoch })}
                  </PhaseValue>
                </span>
                <span className="mx2-badge">{windowLabel}</span>
              </>
            ),
          }}
          scene={scene}
          score={[
            { label: t("totalPool"), value: value(marketAvailable, totalPool, 0, "NEO"), accent: true },
            { label: t("currentTopBid"), value: value(highestBidAvailable, highestBid, 2, "GAS") },
            { label: t("yourDeposits"), value: value(walletAvailable, userDeposits, 0, "NEO", walletPlaceholder) },
          ]}
          actions={{
            primary: {
              label: primaryLabel,
              onClick: runPrimary,
              disabled: primaryDisabled,
              loading: isBusy || connecting,
              hint: pendingOperation
                ? t("recoveryDoesNotResubmit")
                : primaryKind === "bid"
                  ? t("reviewBidHint")
                  : primaryKind === "stake"
                    ? t("reviewStakeHint")
                    : primaryKind === "settle"
                      ? t("settleAfterDeadlineHint")
                      : t("connectCompactCopy"),
            },
          }}
          drawerToggleLabel={t("details")}
          drawer={{
            title: t("details"),
            children: (
              <div className="merc-drawer">
                <div className="merc-drawer-tabs" role="tablist" aria-label={t("details")}>
                  {drawerModes.map(({ mode, label, Icon, value: tabValue }) => (
                    <button type="button" key={mode} role="tab" aria-selected={drawerMode === mode} className={drawerMode === mode ? "is-active" : undefined} onClick={() => setDrawerMode(mode)}>
                      <Icon size={15} /><span>{label}</span><strong>{tabValue}</strong>
                    </button>
                  ))}
                </div>
                <OpenUiPanel className="merc-drawer-panel" icon={<ActiveDrawerIcon size={18} />} title={activeDrawer.label} subtitle={activeDrawer.value}>
                  {drawerPanels[drawerMode]}
                </OpenUiPanel>
              </div>
            ),
          }}
        />
      </div>
    </OpenUiProvider>
  );
}
