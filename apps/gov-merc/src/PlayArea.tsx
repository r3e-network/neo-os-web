/**
 * PlayArea.tsx -- Gov Merc
 *
 * Governance influence is shown as a live market room: NEO stake routes in from
 * one side, GAS bids from the other, and the epoch core decides the winner. The
 * contract-facing actions stay exactly the same; this file only sharpens the
 * resource-led interaction layer around those actions.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BadgeDollarSign,
  Coins,
  Crown,
  Gavel,
  Landmark,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { formatNum } from "@shared/utils/format";
import { epochWindowPhase, EPOCH_DURATION_FALLBACK_MS, MIN_BID } from "./hooks/useGovMerc";
import { CoinArt, ParticleBurst } from "@shared/art";
import { OpenUiPanel, OpenUiProvider, PlayStage } from "@shared/components-react/v2";
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

type DrawerMode = "bids" | "stake" | "rewards" | "guide";

const DEPOSIT_PRESETS = ["1", "10", "50", "100"];
const MARKET_STAGE_IMAGE = "gov-merc-market-stage.webp";

function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function compactAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

function amountLabel(value: number, digits = 2): string {
  return formatNum(value, digits);
}

function normalizeWholeNeoAmount(value: string): string {
  const whole = value.split(/[.,]/)[0] ?? "";
  return whole.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
}

function isPositiveWholeNeoAmount(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, str, bool, num } = useStateBindings(state);
  const [now, setNow] = useState(() => Date.now());
  const [actionPreview, setActionPreview] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("bids");
  const actionTimeout = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => () => {
    if (actionTimeout.current) window.clearTimeout(actionTimeout.current);
  }, []);

  const totalPool = val<number>("totalPool", 0) ?? 0;
  const currentEpoch = val<number>("currentEpoch", 0) ?? 0;
  const bids = val<Array<{ address: string; amount: number }>>("bids", []) ?? [];
  const isBusy = bool("isBusy");
  const address = str("address", "");
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

  const startActionPreview = (action: string) => {
    if (actionTimeout.current) window.clearTimeout(actionTimeout.current);
    setActionPreview(action);
    actionTimeout.current = window.setTimeout(() => {
      setActionPreview(null);
      actionTimeout.current = null;
    }, 1200);
  };

  const isConnected = address.length > 0;
  const windowPhase = epochWindowPhase(epochDeadline, now);
  const biddingClosed = windowPhase === "closed";
  const windowMinutes = Math.max(1, Math.round(epochDurationMs / 60000));
  const windowLabel = windowPhase === "unopened"
    ? t("bidWindowUnopened", { minutes: windowMinutes })
    : windowPhase === "open"
      ? t("bidWindowCountdown", { time: formatCountdown(epochDeadline - now) })
      : t("bidWindowClosed");
  const canSettleNow = canSettle && biddingClosed;
  const leader = bids[0]?.address ? compactAddress(bids[0].address) : t("emptyBidTitle");
  const drawerModes: Array<{ mode: DrawerMode; label: string; value: string; Icon: LucideIcon }> = [
    { mode: "bids", label: t("bidLeaderboard"), value: String(bidCount || bids.length), Icon: Trophy },
    { mode: "stake", label: t("withdrawDrawerTitle"), value: `${amountLabel(userDeposits, 0)} NEO`, Icon: Wallet },
    { mode: "rewards", label: t("rewardsTitle"), value: `${amountLabel(pendingRewards, 2)} GAS`, Icon: Coins },
    { mode: "guide", label: t("flowTitle"), value: windowPhase, Icon: Landmark },
  ];
  const activeDrawerMode = drawerModes.find((item) => item.mode === drawerMode) ?? drawerModes[0]!;
  const ActiveDrawerIcon = activeDrawerMode.Icon;

  const bidPresets = useMemo(() => {
    const base = Math.max(MIN_BID, highestBid || 0);
    return Array.from(new Set([
      base,
      base + 0.5,
      base + 1,
      base + 5,
    ].map((value) => Number(value.toFixed(2)).toString())));
  }, [highestBid]);

  const setVal = (key: string, value: string) => {
    (state as Record<string, { set: (v: unknown) => void }>)[key]?.set(value);
  };
  const setNeoVal = (key: string, value: string) => {
    setVal(key, normalizeWholeNeoAmount(value));
  };

  const handleConnect = () => {
    startActionPreview("connect");
    void dispatch("connectWallet");
  };
  const handleBid = () => {
    if (!bidAmount.trim() || !isConnected) return;
    startActionPreview("bid");
    void dispatch("placeBid");
  };
  const handleDeposit = () => {
    if (!isPositiveWholeNeoAmount(depositAmount) || !isConnected) return;
    startActionPreview("deposit");
    void dispatch("depositNeo");
  };
  const handleWithdraw = () => {
    if (!isPositiveWholeNeoAmount(withdrawAmount) || !isConnected) return;
    startActionPreview("withdraw");
    void dispatch("withdrawNeo");
  };
  const handleSettle = () => {
    startActionPreview("settle");
    void dispatch("settleEpoch");
  };

  const bidAnimating = isBusy || actionPreview === "bid";
  const depositAnimating = isBusy || actionPreview === "deposit" || actionPreview === "withdraw";
  const routing = actionPreview === "bid" || actionPreview === "deposit" || actionPreview === "settle";

  const scene = (
    <div className="merc-scene" data-state={actionPreview ?? "idle"} data-window={windowPhase}>
      <figure className="merc-stage-art" aria-hidden="true">
        <img src={MARKET_STAGE_IMAGE} alt="" loading="eager" decoding="async" draggable={false} />
      </figure>

      <div className="merc-lane merc-lane--stake" data-active={depositAnimating ? "true" : undefined}>
        <div className="merc-lane__rail" aria-hidden="true" />
        <div className="merc-lane__coin-stack" aria-hidden="true">
          <span><CoinArt size={24} variant="neo" /></span>
          <span><CoinArt size={20} variant="neo" /></span>
          <span><CoinArt size={16} variant="neo" /></span>
        </div>
        <div className="merc-lane__copy">
          <span>{t("earnLaneTitle")}</span>
          <strong>{amountLabel(userDeposits, 0)} NEO</strong>
        </div>
      </div>

      <div className="merc-core">
        <span className="merc-core__halo" aria-hidden="true" />
        <Gavel size={42} />
        <strong>{t("marketPlateEpoch", { epoch: currentEpoch })}</strong>
        <em>{windowLabel}</em>
      </div>

      <div className="merc-lane merc-lane--bid" data-active={bidAnimating ? "true" : undefined}>
        <div className="merc-lane__rail" aria-hidden="true" />
        <div className="merc-lane__coin-stack" aria-hidden="true">
          <span><CoinArt size={24} variant="gas" /></span>
          <span><CoinArt size={20} variant="gas" /></span>
          <span><CoinArt size={16} variant="gas" /></span>
        </div>
        <div className="merc-lane__copy">
          <span>{t("bidLaneTitle")}</span>
          <strong>{amountLabel(highestBid, 2)} GAS</strong>
        </div>
      </div>

      <div className="merc-readout merc-readout--pool">
        <Landmark size={17} />
        <span>{t("totalPool")}</span>
        <strong>{amountLabel(totalPool, 0)} NEO</strong>
      </div>
      <div className="merc-readout merc-readout--bid">
        <Trophy size={17} />
        <span>{t("currentTopBid")}</span>
        <strong>{amountLabel(highestBid, 2)} GAS</strong>
      </div>
      <div className="merc-route">
        <span className="merc-route__node"><Coins size={15} />{t("flowDeposit")}</span>
        <span className="merc-route__beam merc-route__beam--stake" />
        <span className="merc-route__node merc-route__node--core"><Gavel size={15} />{t("flowBid")}</span>
        <span className="merc-route__beam merc-route__beam--bid" />
        <span className="merc-route__node"><Crown size={15} />{leader}</span>
      </div>

      {routing && <ParticleBurst coins count={8} />}
      <p className="merc-scene__status" aria-live="polite">
        {actionPreview === "bid"
          ? t("placingBid")
          : actionPreview === "deposit"
            ? t("stakingNeo")
            : actionPreview === "withdraw"
              ? t("unstakingNeo")
              : actionPreview === "settle"
                ? t("settlingEpoch")
                : t("marketPlateTopBid", { amount: amountLabel(highestBid, 2), tokenGas: "GAS" })}
      </p>
    </div>
  );

  const controls = (
    <div className="merc-controls">
      {!isConnected ? (
        <div className="merc-wallet-card">
          <span className="merc-wallet-card__icon"><Wallet size={20} /></span>
          <div>
            <strong>{t("connectTitle")}</strong>
            <p>{t("connectCopy")}</p>
          </div>
        </div>
      ) : (
        <div className="merc-deal-grid">
          <section className="merc-deal-card merc-deal-card--bid" aria-label={t("placeBid")}>
            <div className="merc-deal-card__head">
              <span><BadgeDollarSign size={18} /></span>
              <div>
                <strong>{t("placeBid")}</strong>
                <em>{t("minBidLabel")}: {MIN_BID} GAS</em>
              </div>
            </div>
            <div className="merc-amount-field">
              <input value={bidAmount} onChange={(e) => setVal("bidAmount", e.target.value)} placeholder={t("bidAmount")} inputMode="decimal" disabled={bidAnimating || biddingClosed} />
              <span>GAS</span>
            </div>
            <div className="merc-preset-row" aria-label={t("currentTopBid")}>
              {bidPresets.map((amount) => (
                <button key={amount} type="button" onClick={() => setVal("bidAmount", amount)} disabled={bidAnimating || biddingClosed} className={bidAmount === amount ? "merc-preset merc-preset--active" : "merc-preset"}>
                  {amount}
                </button>
              ))}
            </div>
            <p className="merc-deal-card__hint">{biddingClosed ? t("biddingClosedHint") : t("actionBidHint", { min: MIN_BID, tokenGas: "GAS" })}</p>
          </section>

          <section className="merc-deal-card merc-deal-card--stake" aria-label={t("depositNeo")}>
            <div className="merc-deal-card__head">
              <span><ArrowDownToLine size={18} /></span>
              <div>
                <strong>{t("depositNeo")}</strong>
                <em>{t("tokenLegendNeo")}</em>
              </div>
            </div>
            <div className="merc-amount-field">
              <input value={depositAmount} onChange={(e) => setNeoVal("depositAmount", e.target.value)} placeholder={t("depositAmount")} inputMode="numeric" disabled={depositAnimating} />
              <span>NEO</span>
            </div>
            <div className="merc-preset-row" aria-label={t("depositNeo")}>
              {DEPOSIT_PRESETS.map((amount) => (
                <button key={amount} type="button" onClick={() => setNeoVal("depositAmount", amount)} disabled={depositAnimating} className={depositAmount === amount ? "merc-preset merc-preset--active" : "merc-preset"}>
                  {amount}
                </button>
              ))}
            </div>
            <button type="button" className="merc-card-action" onClick={handleDeposit} disabled={depositAnimating || !isPositiveWholeNeoAmount(depositAmount)}>
              <ArrowUpRight size={15} />
              {depositAnimating ? t("stakingNeo") : t("depositNeo")}
            </button>
          </section>
        </div>
      )}
    </div>
  );

  const drawerPanels: Record<DrawerMode, ReactNode> = {
    bids: (
      <div className="merc-drawer__panel-body" data-mode="bids">
        <div className="merc-drawer__summary">
          <span>{t("marketPlateTopBid", { amount: amountLabel(highestBid, 2), tokenGas: "GAS" })}</span>
          <strong>{bids.length}</strong>
        </div>
        {bids.length > 0 ? (
          <ul className="mx2-history merc-drawer-list">
            {bids.slice(0, 8).map((bid, i) => (
              <li key={i} className="mx2-history__item merc-drawer-list__item">
                <span className="mx2-history__face">#{i + 1}</span>
                <span className="mx2-history__stake">{compactAddress(bid.address)}</span>
                <span className="mx2-history__result">{amountLabel(bid.amount, 2)} GAS</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="merc-drawer__empty">{t("noBids")}</div>
        )}
      </div>
    ),
    stake: (
      <div className="merc-drawer__panel-body" data-mode="stake">
        <div className="merc-drawer__summary">
          <span>{t("actionDepositHint")}</span>
          <strong>{amountLabel(userDeposits, 0)} NEO</strong>
        </div>
        <div className="merc-drawer-action merc-drawer-action--stake">
          <div className="merc-amount-field merc-amount-field--drawer">
            <input value={withdrawAmount} onChange={(e) => setNeoVal("withdrawAmount", e.target.value)} placeholder={t("withdrawAmount")} inputMode="numeric" disabled={depositAnimating || !isConnected} />
            <span>NEO</span>
          </div>
          <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleWithdraw} disabled={depositAnimating || !isPositiveWholeNeoAmount(withdrawAmount) || !isConnected}>{t("withdrawNeo")}</button>
        </div>
      </div>
    ),
    rewards: (
      <div className="merc-drawer__panel-body" data-mode="rewards">
        <div className="merc-drawer__summary">
          <span>{t("pendingRewards")}</span>
          <strong>{amountLabel(pendingRewards, 4)} GAS</strong>
        </div>
        {lastDistributed > 0 && (
          <div className="merc-drawer__summary">
            <span>{t("flowInfluence")}</span>
            <strong>{amountLabel(lastDistributed, 4)} GAS</strong>
          </div>
        )}
        {pendingRewards > 0 && (
          <button type="button" className="mx2-btn mx2-btn--ghost merc-drawer__wide-action" onClick={() => void dispatch("claimRewards")}>{t("claimRewards")}</button>
        )}
        {reclaimableBids.length > 0 ? (
          <div className="merc-drawer-stack">
            {reclaimableBids.map((bid) => (
              <div key={bid.epoch} className="merc-drawer-row">
                <span>{t("reclaimBidAmount", { epoch: bid.epoch, amount: amountLabel(bid.amount, 2), tokenGas: "GAS" })}</span>
                <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("reclaimBid", bid.epoch)}>{t("reclaimBidLabel", { epoch: bid.epoch })}</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="merc-drawer__empty">{t("reclaimTitle")}: 0</div>
        )}
        {gasCredit > 0 && (
          <div className="merc-drawer-row">
            <span>{t("unusedCredit")}: {amountLabel(gasCredit, 4)} GAS</span>
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("withdrawCredit")}>{t("withdrawCredit")}</button>
          </div>
        )}
      </div>
    ),
    guide: (
      <div className="merc-drawer__panel-body" data-mode="guide">
        <div className="merc-risk-card">
          <Gavel size={18} aria-hidden="true" />
          <span>{t("riskNoteCopy")}</span>
        </div>
        <div className="merc-guide-steps">
          <div><strong>{t("flowDeposit")}</strong><span>{t("flowDepositCopy")}</span></div>
          <div><strong>{t("flowBid")}</strong><span>{t("flowBidCopy")}</span></div>
          <div><strong>{t("flowInfluence")}</strong><span>{t("flowInfluenceCopy")}</span></div>
        </div>
      </div>
    ),
  };

  return (
    <OpenUiProvider>
    <div className="gov-merc-play-area mx2 mx2-cat-defi">
      <PlayStage
        category="defi"
        stage={{
          eyebrow: t("marketSignalTitle"),
          title: t("govHeroTitle"),
          subtitle: t("govHeroSubtitle"),
          badges: (
            <>
              <span className="mx2-badge merc-stage-badge" data-tone="accent"><span className="mx2-badge__dot" /> {t("currentEpoch")} #{currentEpoch}</span>
              <span className="mx2-badge merc-stage-badge">{amountLabel(totalPool, 0)} NEO</span>
            </>
          ),
        }}
        scene={<>{scene}{controls}</>}
        score={[
          { label: t("totalPool"), value: `${amountLabel(totalPool, 0)} NEO`, accent: true },
          { label: t("activeBids"), value: String(bidCount) },
          { label: t("yourDeposits"), value: `${amountLabel(userDeposits, 0)} NEO` },
        ]}
        actions={{
          primary: {
            label: isConnected ? (bidAnimating ? t("placingBid") : t("placeBid")) : (actionPreview === "connect" ? t("connectingWallet") : t("connectAction")),
            onClick: () => void (isConnected ? handleBid() : handleConnect()),
            disabled: isConnected && (bidAnimating || biddingClosed || !bidAmount.trim()),
            loading: bidAnimating || actionPreview === "connect",
          },
          secondary: canSettleNow ? [{ label: t("settleAction"), onClick: () => void handleSettle(), loading: actionPreview === "settle", hint: t("settleCopy") }] : undefined,
        }}
        drawerToggleLabel={t("bidLeaderboard")}
        drawer={{
          title: t("bidLeaderboard"),
          children: (
            <div className="merc-drawer">
              <div className="merc-drawer-tabs" role="tablist" aria-label={t("bidLeaderboard")}>
                {drawerModes.map((item) => {
                  const Icon = item.Icon;
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      role="tab"
                      aria-selected={drawerMode === item.mode}
                      className={drawerMode === item.mode ? "is-active" : undefined}
                      onClick={() => setDrawerMode(item.mode)}
                    >
                      <span className="merc-drawer-tabs__icon"><Icon size={15} /></span>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </button>
                  );
                })}
              </div>
              <OpenUiPanel
                className="merc-drawer__panel"
                icon={<ActiveDrawerIcon size={18} />}
                title={activeDrawerMode.label}
                subtitle={activeDrawerMode.value}
              >
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
