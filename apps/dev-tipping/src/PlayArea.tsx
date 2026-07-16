import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Code2, HeartHandshake, RefreshCw, Send, Wallet, XCircle } from "lucide-react";
import { CoinArt, ParticleBurst } from "@shared/art";
import { PhaseValue, resolvePhase } from "@shared/components-react/v2/DataPhase";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import type { ObservableState } from "@shared/react/context";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { formatHash } from "@shared/utils/format";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
  loadError?: Error | null;
  retryLoad?: () => Promise<void>;
}

interface Dev {
  id: string | number;
  name?: string;
  role?: string;
  wallet?: string;
  totalTips?: number | string;
  totalTipsBase?: string;
  tipCount?: number;
  balance?: number;
  balanceBase?: string;
}

interface RecentTip {
  id: string;
  tipperName?: string;
  to?: string;
  amount?: string;
}

type DrawerMode = "developers" | "direct" | "developer" | "history";

interface TipReceipt {
  kind: "deposit" | "tip" | "register" | "withdrawTips" | "withdrawCredit";
  txid: string;
  devId?: number;
  recipientName?: string;
  recipientWallet?: string;
  amountBase?: string;
  name?: string;
  network: "mainnet" | "testnet";
  status?: "pending" | "readback" | "confirmed" | "fault" | "credit" | "expired";
}

const TIP_PRESETS = ["0.01", "0.10", "0.50", "1.00"];
const EMPTY_DEVELOPERS: Dev[] = [];
const EMPTY_RECENT_TIPS: RecentTip[] = [];

function isValidTipAmount(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,8})?$/.test(trimmed)) return false;
  const amount = Number(trimmed);
  return Number.isFinite(amount) && amount >= 0.001;
}

function gasDisplay(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} GAS` : "—";
}

function fixed8Display(value: unknown): string {
  try {
    const base = BigInt(String(value ?? ""));
    if (base < 0n) return "—";
    const whole = base / 100_000_000n;
    const fraction = (base % 100_000_000n)
      .toString()
      .padStart(8, "0")
      .replace(/0+$/, "");
    return `${whole}${fraction ? `.${fraction}` : ""} GAS`;
  } catch {
    return "—";
  }
}

export default function PlayArea({ t, state, dispatch, loadError, retryLoad }: P) {
  const { str, bool, num, val } = useStateBindings(state);
  const address = str("address");
  const developers = val<Dev[]>("developers", EMPTY_DEVELOPERS) ?? EMPTY_DEVELOPERS;
  const recentTips = val<RecentTip[]>("recentTips", EMPTY_RECENT_TIPS) ?? EMPTY_RECENT_TIPS;
  // NOT `|| gasDisplay(num("totalDonated"))`: that fallback was dead while the
  // display defaulted to a truthy "—", and reviving it now would assert a
  // fabricated "0 GAS" — "nobody has ever tipped this board" — for a total the
  // app has not read. An unread total is absent, not zero.
  const totalDonatedDisplay = str("totalDonatedDisplay", "");
  const statsSettled = bool("statsSettled");
  // The board's lifetime total is a public read, but it needs a bound network,
  // which a wallet-less visitor has not supplied. Shimmer while the read is in
  // flight; say plainly why it is empty once that question is answered.
  const totalDonatedPhase = resolvePhase({
    loading: !statsSettled,
    settled: statsSettled,
    hasData: Boolean(totalDonatedDisplay),
  });
  const myDeveloperId = num("myDeveloperId");
  const myClaimableBalance = num("myClaimableBalance");
  const myClaimableBalanceDisplay = str("myClaimableBalanceDisplay") || gasDisplay(myClaimableBalance);
  const hasClaimableBalance = bool("hasClaimableBalance") || myClaimableBalance > 0;
  const myCredit = num("myCredit");
  const myCreditDisplay = str("myCreditDisplay") || gasDisplay(myCredit);
  const hasCredit = bool("hasCredit") || myCredit > 0;
  const isLoading = bool("isLoading");
  const isRegistering = bool("isRegistering");
  const isWithdrawing = bool("isWithdrawing");
  const isConnecting = bool("isConnecting");
  const isRecovering = bool("isRecovering");
  const runtimeCompatible = bool("runtimeCompatible");
  const runtimeStatus = str("runtimeStatus");
  const runtimeError = str("runtimeError");
  const registryStatus = str("registryStatus");
  const activityStatus = str("activityStatus");
  const walletReadStatus = str("walletReadStatus");
  const walletReadError = str("walletReadError");
  const gasBalanceDisplay = str("gasBalanceDisplay") || "—";
  const actionNotice = str("actionNotice");
  const pendingTip = val<TipReceipt | null>("pendingOperation", null)
    ?? val<TipReceipt | null>("pendingTip", null);
  const lastReceipt = val<TipReceipt | null>("lastReceipt", null);
  const receipt: TipReceipt | null = pendingTip
    ? {
        ...pendingTip,
        status: lastReceipt?.txid === pendingTip.txid ? lastReceipt.status : "pending",
      }
    : lastReceipt;

  const [selectedDevId, setSelectedDevId] = useState("");
  const [tipAmount, setTipAmount] = useState("0.10");
  const [anonymous, setAnonymous] = useState(true);
  const [devName, setDevName] = useState("");
  const [devRole, setDevRole] = useState("");
  const [sendPulse, setSendPulse] = useState(0);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("developers");

  useEffect(() => {
    if (!selectedDevId && developers[0]) {
      setSelectedDevId(String(developers[0].id));
    }
  }, [developers, selectedDevId]);

  const selectedDeveloper = useMemo(
    () => developers.find((dev) => String(dev.id) === selectedDevId),
    [developers, selectedDevId],
  );
  const featuredDevelopers = developers.slice(0, 3);
  const dataReady = runtimeCompatible
    && (registryStatus === "ready" || registryStatus === "partial")
    && walletReadStatus === "ready";
  const creditActionReady = Boolean(address && runtimeCompatible && walletReadStatus === "ready");
  const canTip = Boolean(address && selectedDevId && isValidTipAmount(tipAmount) && dataReady && !pendingTip);
  const busy = isLoading || isRegistering || isWithdrawing || isConnecting || isRecovering;
  const supporterLabel = address ? formatHash(address, 6) : t("walletNotConnected");
  const recipientLabel = selectedDeveloper?.name || (selectedDevId ? t("defaultDevName", { id: selectedDevId }) : t("tipRecipientPending"));
  const sceneStatus = isRecovering
    ? t("checkingReceipt")
    : isLoading
    ? t("sending")
    : pendingTip
      ? t("receiptPending")
    : !address
      ? t("connectWallet")
      : canTip
        ? t("directTipRoute")
        : t("sendTipBtnIdle");
  const drawerTabs = [
    {
      mode: "developers" as const,
      label: t("developers"),
      meta: `${developers.length} ${t("supportStageDevelopers")}`,
      icon: <Code2 size={15} />,
    },
    {
      mode: "direct" as const,
      label: t("supportTabDirect"),
      meta: selectedDevId ? `#${selectedDevId}` : t("developerIdPlaceholder"),
      icon: <Send size={15} />,
    },
    {
      mode: "developer" as const,
      label: t("supportTabCreator"),
      meta: myDeveloperId > 0 ? `#${myDeveloperId}` : t("registerHintShort"),
      icon: <Wallet size={15} />,
    },
    {
      mode: "history" as const,
      label: t("supportTabHistory"),
      meta: (
        <PhaseValue phase={totalDonatedPhase} placeholder={t("totalDonatedUnread")} skeletonWidth="4.5em">
          {totalDonatedDisplay}
        </PhaseValue>
      ),
      icon: <HeartHandshake size={15} />,
    },
  ];

  const sendTip = async () => {
    if (!canTip || busy) return;
    setSendPulse((tick) => tick + 1);
    await dispatch("sendTip", Number(selectedDevId), tipAmount.trim(), anonymous);
  };

  const registerDeveloper = () => {
    if (!devName.trim() || busy) return;
    void dispatch("registerDeveloper", devName.trim(), devRole.trim());
  };

  const receiptDetail = receipt
    ? receipt.kind === "register"
      ? `${receipt.name || t("developerZone")} · ${receipt.network}`
      : `${receipt.recipientName || t(`operation_${receipt.kind}`)}${receipt.amountBase ? ` · ${fixed8Display(receipt.amountBase)}` : ""} · ${receipt.network}`
    : "";

  const scene = (
    <div className="tip-scene" data-state={isLoading ? "sending" : developers.length ? "active" : "empty"}>
      <figure className="tip-scene__stage-card" aria-label={t("supportBoardStageLabel")}>
        <img className="tip-scene__stage-image" src="./support-board-stage.webp" alt={t("supportBoardStageAlt")} />
        <figcaption className="tip-scene__stage-caption">
          <span>{t("supportStageEyebrow")}</span>
          <strong>{recipientLabel}</strong>
          <small>
            {selectedDeveloper
              ? `${selectedDeveloper.role || t("defaultDevRole")} · #${selectedDeveloper.id} · ${formatHash(selectedDeveloper.wallet || "", 6)}`
              : t("supportDeskCopy")}
          </small>
        </figcaption>
        <div className="tip-scene__route-strip" aria-label={t("tipRouteTitle")}>
          <span><Wallet size={15} /> {supporterLabel}</span>
          <em>{tipAmount || "0"} GAS</em>
          <span><Code2 size={15} /> {recipientLabel}</span>
        </div>
      </figure>

      <section className="tip-scene__desk" aria-label={t("supportDeskTitle")}>
        <header className="tip-scene__desk-head">
          <span>{t("supportDeskTitle")}</span>
          <strong>{tipAmount || "0"} GAS</strong>
        </header>

        <div className="tip-scene__builder-rack" aria-label={t("selectDeveloper")}>
          {featuredDevelopers.length ? (
            featuredDevelopers.map((dev) => {
              const active = String(dev.id) === selectedDevId;
              return (
                <button
                  key={String(dev.id)}
                  type="button"
                  className={active ? "is-active" : ""}
                  onClick={() => setSelectedDevId(String(dev.id))}
                  disabled={busy}
                >
                  <span className="tip-scene__builder-id">#{dev.id}</span>
                  <span className="tip-scene__builder-copy">
                    <strong>{dev.name || t("defaultDevName", { id: String(dev.id) })}</strong>
                    <small>
                      {dev.role || t("defaultDevRole")}
                      {dev.wallet ? ` · ${formatHash(dev.wallet, 5)}` : ""}
                    </small>
                  </span>
                  <em>{dev.totalTipsBase ? fixed8Display(dev.totalTipsBase) : gasDisplay(dev.totalTips)}</em>
                </button>
              );
            })
          ) : (
            <div className="tip-scene__empty-board">
              <strong>{t("supportBoardTitle")}</strong>
              <span>{t("noDevelopersHint")}</span>
            </div>
          )}
        </div>

        <section className="tip-scene__amount-board" aria-label={t("tipPresetLabel")}>
          <div className="tip-scene__wallet-balance" data-status={walletReadStatus || "idle"}>
            <span>{t("walletGasBalance")}</span>
            <strong>{walletReadStatus === "ready" ? gasBalanceDisplay : "—"}</strong>
          </div>
          <div className="tip-scene__amounts" role="radiogroup" aria-label={t("tipPresetLabel")}>
            {TIP_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={tipAmount === preset ? "is-active" : ""}
                aria-checked={tipAmount === preset}
                role="radio"
                onClick={() => setTipAmount(preset)}
                disabled={busy}
              >
                <CoinArt size={30} variant="gas" />
                <strong>{preset}</strong>
              </button>
            ))}
          </div>
          <div className="tip-scene__custom-amount" role="group" aria-label={t("customAmount")}>
            <span>{t("customAmount")}</span>
            <label className="tip-scene__custom-control">
              <input
                value={tipAmount}
                onChange={(event) => {
                  if (/^\d{0,18}(?:\.\d{0,8})?$/.test(event.target.value)) {
                    setTipAmount(event.target.value);
                  }
                }}
                inputMode="decimal"
                maxLength={27}
                disabled={busy}
                aria-label={t("tipAmount")}
              />
              <em>GAS</em>
            </label>
          </div>
        </section>

        <button
          type="button"
          className="tip-toggle tip-scene__visibility"
          data-active={anonymous}
          aria-pressed={anonymous}
          onClick={() => setAnonymous((value) => !value)}
          disabled={busy}
        >
          <HeartHandshake size={18} />
          <span>{anonymous ? t("anonymousOn") : t("anonymousOff")}</span>
        </button>

        {receipt && (
          <section className="tip-receipt" data-status={receipt.status || "pending"} aria-live="polite">
            <span className="tip-receipt__icon" aria-hidden="true">
              {receipt.status === "confirmed" || receipt.status === "credit"
                ? <CheckCircle2 size={19} />
                : receipt.status === "fault"
                  ? <XCircle size={19} />
                  : <RefreshCw size={19} />}
            </span>
            <span className="tip-receipt__copy">
              <strong>{t(`receiptStatus_${receipt.status || "pending"}`)}</strong>
              <small>{receiptDetail}</small>
              <code title={receipt.txid}>{formatHash(receipt.txid, 10)}</code>
            </span>
            {pendingTip && (
              <button type="button" onClick={() => void dispatch("recoverTip")} disabled={busy}>
                <RefreshCw size={14} /> {isRecovering ? t("checkingReceipt") : t("checkReceipt")}
              </button>
            )}
          </section>
        )}

        {(runtimeStatus === "error" || registryStatus === "error" || walletReadStatus === "error" || loadError) && (
          <OpenUiNotice
            className="tip-scene__data-notice"
            icon={<RefreshCw size={17} />}
            title={t("dataNeedsRetry")}
          >
            {runtimeError || walletReadError || loadError?.message || t("registryUnavailable")}
            <button
              type="button"
              className="tip-scene__retry"
              onClick={() => void (retryLoad ? retryLoad() : dispatch("refresh"))}
              disabled={busy}
            >
              <RefreshCw size={14} /> {t("retry")}
            </button>
          </OpenUiNotice>
        )}

        {actionNotice && (
          <p className="tip-scene__action-notice" role="status">{actionNotice}</p>
        )}

        {isLoading && (
          <div className="tip-scene__coin-lane" aria-hidden="true" data-pulse={sendPulse}>
            <span className="tip-scene__lane-line" />
            <CoinArt size={30} variant="gas" className="mx2-fly-coin" />
          </div>
        )}
      </section>

      {isLoading && <ParticleBurst coins count={8} className="tip-scene__burst" />}
      {(isLoading || canTip) && (
        <p className="tip-scene__status" aria-live="polite">
          {sceneStatus}
        </p>
      )}
    </div>
  );

  const drawerPanel = (() => {
    if (drawerMode === "developers") {
      return (
        <OpenUiPanel
          className="tip-drawer__panel tip-drawer__panel--developers"
          icon={<Code2 size={16} />}
          title={t("developers")}
          subtitle={`${developers.length} ${t("supportStageDevelopers")}`}
          titleId="tip-drawer-developers"
        >
          {developers.length ? (
            <div className="tip-builder-list">
              {developers.slice(0, 8).map((dev) => {
                const active = String(dev.id) === selectedDevId;
                return (
                  <button
                    key={String(dev.id)}
                    type="button"
                    className={active ? "is-active" : ""}
                    onClick={() => setSelectedDevId(String(dev.id))}
                    disabled={busy}
                  >
                    <span className="tip-builder-list__id">#{dev.id}</span>
                    <span>
                      <strong>{dev.name || t("defaultDevName", { id: String(dev.id) })}</strong>
                      <small>{dev.role || t("defaultDevRole")}</small>
                    </span>
                    <em>{dev.totalTipsBase ? fixed8Display(dev.totalTipsBase) : gasDisplay(dev.totalTips)}</em>
                  </button>
                );
              })}
            </div>
          ) : (
            <OpenUiNotice className="tip-drawer__notice" icon={<HeartHandshake size={17} />} title={t("supportBoardTitle")}>
              {t("supportBoardHint")}
            </OpenUiNotice>
          )}
        </OpenUiPanel>
      );
    }

    if (drawerMode === "direct") {
      return (
        <OpenUiPanel
          className="tip-drawer__panel tip-drawer__panel--direct"
          icon={<Send size={16} />}
          title={t("directSupportTitle")}
          subtitle={selectedDevId ? t("defaultDevName", { id: selectedDevId }) : t("developerIdPlaceholder")}
          titleId="tip-drawer-direct"
        >
          <OpenUiTextField
            className="tip-drawer-field tip-drawer-field--id"
            inputClassName="tip-drawer-input tip-drawer-input--developer-id"
            label={t("developerIdPlaceholder")}
            value={selectedDevId}
            onChange={(event) => {
              if (/^\d{0,9}$/.test(event.target.value)) setSelectedDevId(event.target.value);
            }}
            inputMode="numeric"
            maxLength={9}
            placeholder="1"
            disabled={busy}
            hint={t("developerIdHelp")}
          />
        </OpenUiPanel>
      );
    }

    if (drawerMode === "developer") {
      return (
        <OpenUiPanel
          className="tip-drawer__panel tip-drawer__panel--developer"
          icon={<Wallet size={16} />}
          title={t("developerZone")}
          subtitle={myDeveloperId > 0 ? `${t("registeredAs")} #${myDeveloperId}` : t("registerHint")}
          titleId="tip-drawer-zone"
        >
          {myDeveloperId > 0 ? (
            <div className="tip-dev-zone">
              <strong>{t("registeredAs")} #{myDeveloperId}</strong>
              <span>{t("claimableBalance")}: {myClaimableBalanceDisplay}</span>
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={() => void dispatch("withdrawTips", myDeveloperId)}
                disabled={!hasClaimableBalance || !dataReady || busy}
              >
                {isWithdrawing ? t("withdrawing") : t("withdrawTipsBtn")}
              </button>
            </div>
          ) : (
            <div className="tip-dev-zone">
              <div className="tip-dev-zone__fields">
                <OpenUiTextField
                  className="tip-drawer-field tip-drawer-field--name"
                  inputClassName="tip-drawer-input tip-drawer-input--dev-name"
                  label={t("devNameLabel")}
                  value={devName}
                  onChange={(event) => setDevName(event.target.value)}
                  placeholder={t("devNamePlaceholder")}
                  maxLength={64}
                  disabled={busy}
                />
                <OpenUiTextField
                  className="tip-drawer-field tip-drawer-field--role"
                  inputClassName="tip-drawer-input tip-drawer-input--dev-role"
                  label={t("devRoleLabel")}
                  value={devRole}
                  onChange={(event) => setDevRole(event.target.value)}
                  placeholder={t("devRolePlaceholder")}
                  maxLength={64}
                  disabled={busy}
                />
              </div>
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={registerDeveloper}
                disabled={!dataReady || !devName.trim() || busy}
              >
                {isRegistering ? t("registering") : t("registerBtn")}
              </button>
            </div>
          )}
          {hasCredit && (
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost"
              onClick={() => void dispatch("withdrawCredit")}
              disabled={!creditActionReady || busy}
            >
              {t("withdrawCredit")} ({myCreditDisplay})
            </button>
          )}
        </OpenUiPanel>
      );
    }

    return (
      <OpenUiPanel
        className="tip-drawer__panel tip-drawer__panel--history"
        icon={<HeartHandshake size={16} />}
        title={t("recentTips")}
        subtitle={totalDonatedDisplay}
        titleId="tip-drawer-recent"
      >
        {activityStatus === "error" ? (
          <OpenUiNotice className="tip-drawer__notice" icon={<RefreshCw size={17} />} title={t("activityUnavailable")} type="warning">
            {t("activityUnavailableHint")}
          </OpenUiNotice>
        ) : recentTips.length ? (
          <ul className="mx2-history">
            {recentTips.slice(0, 8).map((tip) => (
              <li key={tip.id} className="mx2-history__item">
                <span className="mx2-history__face">{tip.tipperName || t("anonymousOn")}</span>
                <span className="mx2-history__stake">{tip.to}</span>
                <span className="mx2-history__result">{tip.amount} GAS</span>
              </li>
            ))}
          </ul>
        ) : (
          <OpenUiNotice className="tip-drawer__notice" icon={<HeartHandshake size={17} />} title={t("noRecentTips")}>
            {t("noRecentTipsHint")}
          </OpenUiNotice>
        )}
      </OpenUiPanel>
    );
  })();

  const drawer = (
    <div className="tip-drawer">
      <div className="tip-drawer__tabs" role="tablist" aria-label={t("supportOptions")}>
        {drawerTabs.map((item) => (
          <button
            key={item.mode}
            type="button"
            role="tab"
            id={`tip-tab-${item.mode}`}
            aria-controls={`tip-panel-${item.mode}`}
            aria-selected={drawerMode === item.mode}
            className={drawerMode === item.mode ? "is-active" : ""}
            onClick={() => setDrawerMode(item.mode)}
          >
            <span className="tip-drawer__tab-icon">{item.icon}</span>
            <strong>{item.label}</strong>
            <small>{item.meta}</small>
          </button>
        ))}
      </div>
      <div
        className="tip-drawer__active"
        data-mode={drawerMode}
        role="tabpanel"
        id={`tip-panel-${drawerMode}`}
        aria-labelledby={`tip-tab-${drawerMode}`}
      >
        {drawerPanel}
      </div>
    </div>
  );

  return (
    <div className="dev-tip-play-area mx2 mx2-cat-social">
      <OpenUiProvider>
        <PlayStage
          category="social"
          stage={{
            eyebrow: t("supportStageEyebrow"),
            title: t("supportStageTitle"),
            subtitle: t("supportStageCopy"),
          }}
          scene={scene}
          actions={{
            primary: pendingTip
              ? {
                  label: isRecovering ? t("checkingReceipt") : t("checkReceipt"),
                  onClick: () => void dispatch("recoverTip"),
                  disabled: busy,
                  loading: isRecovering,
                  icon: <RefreshCw size={17} />,
                }
              : address
              ? {
                  label: isLoading ? t("sending") : t("sendTipBtn"),
                  onClick: () => void sendTip(),
                  disabled: !canTip || busy,
                  loading: isLoading,
                  icon: <Send size={17} />,
                }
              : {
                  label: isConnecting ? t("connecting") : t("connectWallet"),
                  onClick: () => void dispatch("connect"),
                  loading: isConnecting,
                  icon: <Wallet size={17} />,
                },
            secondary: address && myDeveloperId > 0
              ? [{
                  label: t("withdrawTipsBtn"),
                  onClick: () => void dispatch("withdrawTips", myDeveloperId),
                  disabled: !hasClaimableBalance || !dataReady || busy,
                  loading: isWithdrawing,
                }]
              : undefined,
          }}
          drawerToggleLabel={t("supportOptions")}
          drawer={{ title: t("supportOptions"), children: drawer }}
        />
      </OpenUiProvider>
    </div>
  );
}
