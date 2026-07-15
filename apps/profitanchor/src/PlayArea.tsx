import { useState, type ReactNode } from "react";
import { CoinArt } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import { PhaseValue, resolvePhase } from "@shared/components-react/v2/DataPhase";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import type {
  AnchorBindingStatus,
  AnchorHistoryItem,
  AnchorStatsSnapshot,
  AnchorUserSnapshot,
  PendingAnchorTransaction,
} from "./anchor-runtime";
import "./PlayArea.scss";

const AMOUNT_PRESETS = ["1", "5", "10", "21"] as const;
type DrawerMode = "position" | "rewards" | "activity" | "protocol";

interface Props {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

function wholeNeo(value: string): string {
  const whole = value.split(/[.,]/)[0] ?? "";
  return whole.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
}

function displayInteger(value?: string): string {
  if (value === undefined) return "—";
  try {
    return BigInt(value).toLocaleString();
  } catch {
    return "—";
  }
}

function displayFixed(value: string | undefined, decimals: number, digits = 4): string {
  if (value === undefined) return "—";
  try {
    const amount = BigInt(value);
    const divisor = 10n ** BigInt(decimals);
    const whole = amount / divisor;
    const fraction = (amount % divisor).toString().padStart(decimals, "0").slice(0, digits).replace(/0+$/, "");
    return fraction ? `${whole.toLocaleString()}.${fraction}` : whole.toLocaleString();
  } catch {
    return "—";
  }
}

function shortHash(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value || "—";
}

function historyLabel(action: AnchorHistoryItem["action"]): string {
  return {
    stake: "historyStake",
    withdraw: "historyWithdraw",
    claim: "historyClaim",
    recover: "historyRecover",
  }[action];
}

function bindingCopy(status: AnchorBindingStatus, t: Props["t"]) {
  const keys: Record<AnchorBindingStatus, string> = {
    loading: "bindingLoading",
    ready: "bindingReady",
    "unknown-network": "bindingUnknownNetwork",
    "missing-contract": "bindingMissingContract",
    unregistered: "bindingUnregistered",
    "mode-mismatch": "bindingModeMismatch",
    paused: "bindingPaused",
    "read-unavailable": "bindingReadUnavailable",
  };
  return t(keys[status]);
}

export default function PlayArea({ t, state, dispatch }: Props) {
  const { str, bool, val } = useStateBindings(state);
  const stats = val<AnchorStatsSnapshot>("stats");
  const user = val<AnchorUserSnapshot>("user");
  const pending = val<PendingAnchorTransaction>("pendingTransaction");
  const history = val<AnchorHistoryItem[]>("history", []) ?? [];
  const readStatus = str("readStatus", "read-unavailable") as AnchorBindingStatus;
  const network = str("network");
  const contract = str("contract");
  const actionStatus = str("actionStatus");
  const actionError = str("actionError");
  const readError = str("readError");
  const diagnosticError = str("diagnosticError");
  const storageHealthy = bool("storageHealthy");
  const busy = bool("submitting") || bool("confirmationChecking");
  const walletConnected = Boolean(str("walletAddress"));

  const [amount, setAmount] = useState("1");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("position");
  const amountReady = /^[1-9]\d*$/.test(amount);
  const writable = readStatus === "ready" && !pending && !busy;
  const readable = readStatus === "ready" || readStatus === "paused";
  // `readStatus` starts at "loading" before the first loadAll round, and the
  // `loading` observable covers every later round — together they are this
  // console's settled signal. Without it, "the chain read is still in flight"
  // and "the read finished and there is nothing to show" both collapsed into
  // the same bare em-dash on a cold first paint. Mirrors the sibling
  // TrustAnchor pool, which shares this ABI and its anchor-runtime.
  const reading = readStatus === "loading" || bool("loading");
  const statsPhase = resolvePhase({
    loading: reading,
    settled: !reading,
    hasData: Boolean(stats),
  });
  // `user` is only read once a wallet hash exists, so a settled-empty user is
  // the normal pre-wallet state and earns a connect prompt rather than the
  // pool-scoped "Awaiting network".
  const userPhase = resolvePhase({
    loading: reading,
    settled: !reading,
    hasData: Boolean(user),
  });
  const userPlaceholder = walletConnected
    ? t("valueAwaitingNetwork")
    : t("valueConnectWallet");
  const poolStat = (value: ReactNode, skeletonWidth?: string) => (
    <PhaseValue
      phase={statsPhase}
      placeholder={t("valueAwaitingNetwork")}
      skeletonWidth={skeletonWidth}
    >
      {value}
    </PhaseValue>
  );
  const userStat = (value: ReactNode, skeletonWidth?: string) => (
    <PhaseValue phase={userPhase} placeholder={userPlaceholder} skeletonWidth={skeletonWidth}>
      {value}
    </PhaseValue>
  );
  const stakeDisplay = user ? displayInteger(user.stake) : "";
  const rewardsDisplay = user ? displayFixed(user.pendingRewards, 8, 5) : "";
  const reserveDisplay = stats ? displayFixed(stats.rewardReserve, 8, 4) : "";
  const totalDisplay = stats ? displayInteger(stats.totalStaked) : "";
  const coverageDisplay = stats && BigInt(stats.totalStaked) > 0n
    ? displayFixed((BigInt(stats.rewardReserve) * 100_000_000n / BigInt(stats.totalStaked)).toString(), 8, 5)
    : stats ? "0" : "";

  const run = (name: string, ...args: unknown[]) => {
    void dispatch(name, ...args).catch(() => undefined);
  };
  const adjustAmount = (delta: number) => {
    const current = Number.parseInt(amount, 10);
    setAmount(String(Math.max(1, (Number.isFinite(current) ? current : 1) + delta)));
  };

  const scene = (
    <div className="tool-scene profit-product-scene" data-binding={readStatus}>
      <section className="profit-visual" aria-label={t("stageAria")}>
        <img
          className="profit-visual__image"
          src="./profitanchor-stage.webp"
          alt={t("stageAria")}
          loading="eager"
          decoding="async"
        />
        <div className="profit-visual__plate">
          <span>{t("reserveCoverage")}</span>
          {/* Reserve coverage is a chain fact. Before the read settles we do not
              know it, so printing "— GAS / NEO" across the hero art states a
              void as though it were the measured ratio. */}
          <strong>{poolStat(`${coverageDisplay} GAS / NEO`, "7em")}</strong>
          <small>{t("coverageNotApr")}</small>
        </div>
      </section>

      <section className="profit-command" aria-label={t("stakingWorkspaceLabel") }>
        <header className="profit-command__header">
          <div>
            <span>{t("stakePlan")}</span>
            <strong>{t("chooseStakeAmount")}</strong>
          </div>
          <span className={`profit-binding profit-binding--${readStatus}`}>
            {bindingCopy(readStatus, t)}
          </span>
        </header>

        <div className="profit-position-strip">
          <div><span>{t("myStake")}</span><strong>{userStat(`${stakeDisplay} NEO`, "5em")}</strong></div>
          <div><span>{t("pendingRewards")}</span><strong>{userStat(`${rewardsDisplay} GAS`, "5em")}</strong></div>
        </div>

        <div className="profit-amount-deck" aria-label={t("stakePresetLabel")}>
          {AMOUNT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={amount === preset ? "is-active" : undefined}
              onClick={() => setAmount(preset)}
              disabled={busy || Boolean(pending)}
            >
              <strong>{preset}</strong>
              <span>NEO</span>
            </button>
          ))}
        </div>

        <div className="profit-stepper">
          <button type="button" onClick={() => adjustAmount(-1)} disabled={busy || amount === "1"} aria-label="-1 NEO">−</button>
          <output aria-live="polite"><strong>{amount || "—"}</strong><span>NEO</span></output>
          <button type="button" onClick={() => adjustAmount(1)} disabled={busy} aria-label="+1 NEO">+</button>
        </div>

        <div className="profit-route-note">
          <CoinArt size={34} variant="gas" decorative />
          <div>
            <strong>{t("variableRewardTitle")}</strong>
            <span>{t("variableRewardBody")}</span>
          </div>
        </div>

        {(pending || actionError || readError) && (
          <div className={`profit-inline-status ${actionError || readError ? "is-error" : "is-pending"}`} role="status">
            <strong>{pending ? t("transactionPendingTitle") : t("attentionTitle")}</strong>
            <span>{pending ? t("transactionPendingBody") : actionError || readError}</span>
          </div>
        )}
      </section>
    </div>
  );

  const modes: Array<{ id: DrawerMode; label: string }> = [
    { id: "position", label: t("managePosition") },
    { id: "rewards", label: t("manageRewards") },
    { id: "activity", label: t("activity") },
    { id: "protocol", label: t("protocolDetails") },
  ];

  const drawer = (
    <OpenUiProvider>
      <div className="profit-drawer">
        <div className="profit-drawer__nav" role="tablist" aria-label={t("manageAnchor")}>
          {modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={drawerMode === mode.id}
              className={drawerMode === mode.id ? "is-active" : undefined}
              onClick={() => setDrawerMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {drawerMode === "position" && (
          <OpenUiPanel title={t("managePosition")} subtitle={t("redeemTimingNote")}>
            <div className="profit-drawer__amount-row">
              <OpenUiTextField
                label={t("wholeNeoAmount")}
                value={amount}
                inputMode="numeric"
                onChange={(event) => setAmount(wholeNeo(event.target.value))}
                disabled={busy || Boolean(pending)}
                hint={t("wholeNeoHint")}
              />
              <button
                type="button"
                className="profit-secondary-action"
                onClick={() => run("withdrawNeo", { amount })}
                disabled={!readable || !walletConnected || !user || !amountReady || BigInt(user.stake) < BigInt(amount) || busy || Boolean(pending)}
              >
                {t("withdrawNeo")}
              </button>
            </div>
          </OpenUiPanel>
        )}

        {drawerMode === "rewards" && (
          <OpenUiPanel title={t("manageRewards")} subtitle={t("rewardReserveHint")}>
            <div className="profit-reward-actions">
              <div><span>{t("pendingRewards")}</span><strong>{rewardsDisplay} GAS</strong></div>
              <button
                type="button"
                className="profit-secondary-action"
                onClick={() => run("claimRewards")}
                disabled={!readable || !user || BigInt(user.pendingRewards) <= 0n || busy || Boolean(pending)}
              >
                {t("claimRewards")}
              </button>
            </div>
            {user && BigInt(user.neoCredit) > 0n && (
              <div className="profit-credit-row">
                <span>{t("creditRecoverHint")}</span>
                <button type="button" onClick={() => run("recoverNeoCredit")} disabled={busy || Boolean(pending)}>{t("recoverNeoCredit")}</button>
              </div>
            )}
          </OpenUiPanel>
        )}

        {drawerMode === "activity" && (
          <OpenUiPanel title={t("activity")} subtitle={actionStatus}>
            {pending && (
              <OpenUiNotice title={t("transactionPendingTitle")} type="warning">
                <span>{shortHash(pending.txid)}</span>
                <button type="button" onClick={() => run("recoverPendingAnchor")} disabled={busy}>{t("checkTransaction")}</button>
              </OpenUiNotice>
            )}
            <div className="profit-history">
              {history.length === 0 ? <p>{t("noActivity")}</p> : history.map((item) => (
                <div key={`${item.txid}-${item.at}`}>
                  <span>{t(historyLabel(item.action))}</span>
                  <strong>{item.status === "confirmed" ? t("historyConfirmed") : t("historyNeedsAttention")}</strong>
                  <small>{shortHash(item.txid)}</small>
                </div>
              ))}
            </div>
          </OpenUiPanel>
        )}

        {drawerMode === "protocol" && (
          <OpenUiPanel title={t("protocolDetails")} subtitle={t("protocolSubtitle")}>
            <dl className="profit-protocol-grid">
              <div><dt>{t("networkLabel")}</dt><dd>{network || t("valueAwaitingNetwork")}</dd></div>
              <div><dt>{t("modeLabel")}</dt><dd>{poolStat(stats?.mode, "3em")}</dd></div>
              <div><dt>{t("poolTotal")}</dt><dd>{poolStat(`${totalDisplay} NEO`, "5em")}</dd></div>
              <div><dt>{t("rewardReserve")}</dt><dd>{poolStat(`${reserveDisplay} GAS`, "5em")}</dd></div>
              <div><dt>{t("contractLabel")}</dt><dd>{shortHash(contract)}</dd></div>
              <div><dt>{t("storageLabel")}</dt><dd>{storageHealthy ? t("storageReady") : t("storageBlocked")}</dd></div>
            </dl>
            <p className="profit-protocol-copy">{t("variableRewardDisclosure")}</p>
            {(diagnosticError || actionError) && (
              <details className="profit-diagnostics">
                <summary>{t("diagnostics")}</summary>
                <code>{diagnosticError || actionError}</code>
              </details>
            )}
            <button type="button" className="profit-refresh" onClick={() => run("refreshAnchor")} disabled={busy}>{t("refreshAnchor")}</button>
          </OpenUiPanel>
        )}
      </div>
    </OpenUiProvider>
  );

  return (
    <div className="profitanchor-play-area">
      <PlayStage
        category="defi"
        stage={{
          eyebrow: t("heroFactsLabel"),
          title: t("heroTitle"),
          subtitle: t("heroDescription"),
          badges: (
            <>
              <span>{network || t("networkUnknown")}</span>
              <span>{t("modeBadge", { mode: 2 })}</span>
            </>
          ),
        }}
        scene={scene}
        score={[
          { label: t("myStake"), value: userStat(`${stakeDisplay} NEO`, "4em"), accent: true },
          { label: t("pendingRewards"), value: userStat(`${rewardsDisplay} GAS`, "4em") },
          { label: t("rewardReserve"), value: poolStat(`${reserveDisplay} GAS`, "4em") },
        ]}
        actions={{
          // A visitor with no wallet cannot satisfy `writable` (it needs a settled
          // chain read), so a stake-labelled primary could only ever render dead
          // and grey on first paint — an app that looks broken before it has been
          // asked to do anything. Offer the step that IS available instead, and
          // keep the stake CTA for the state where staking is genuinely possible.
          // Mirrors the SelfLoan console's connect-first primary (3389a4a1d).
          //
          // Pending outranks connect: a durable pending transaction survives a
          // reload with no wallet attached, and that transaction is already on
          // chain. Offering "connect" there would bury the one state the visitor
          // most needs to see, so the pending rail keeps the surface.
          primary: pending
            ? {
                label: t("transactionPendingShort"),
                onClick: () => run("stakeNeo", { amount }),
                disabled: true,
                loading: busy,
              }
            : walletConnected
              ? {
                  label: t("stakeAmount", { amount }),
                  onClick: () => run("stakeNeo", { amount }),
                  disabled: !writable || !amountReady,
                  loading: busy,
                }
              : {
                  label: t("connectWallet"),
                  onClick: () => run("connectWallet"),
                  disabled: busy,
                  loading: busy,
                },
        }}
        drawerToggleLabel={t("manageAnchor")}
        drawer={{ title: t("manageAnchor"), children: drawer }}
      />
    </div>
  );
}
