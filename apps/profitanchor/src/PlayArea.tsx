/**
 * PlayArea.tsx — ProfitAnchor (v2 scene-driven rebuild)
 *
 * DeFi identity (deep-blue + gold). The staking vault IS the scene: a gauge that
 * fills with your staked NEO, rewards accruing as coins, effective rate shown.
 * Stake is the primary write (always dispatches); withdraw/claim/recover + the
 * stake-amount input live in a drawer. Real state from useProfitanchor bound.
 */
import { useState, useEffect, useRef } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt, ParticleBurst } from "@shared/art";
import { OpenUiPanel, OpenUiProvider, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const AMOUNT_PRESETS = ["1", "5", "10", "21"] as const;
const STAGE_ART = "profitanchor-stage.webp";
type DrawerMode = "amount" | "rewards" | "stats";

function wholeNeoAmount(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

function normalizeWholeNeoAmount(value: string): string {
  const whole = value.split(/[.,]/)[0] ?? "";
  return whole.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
}

function withoutUnit(value: string, unit: string): string {
  return String(value || "0").replace(new RegExp(`\\s*${unit}\\s*$`, "i"), "").trim() || "0";
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num } = useStateBindings(state);

  const myStakeDisplay = str("myStakeDisplay", "0");
  const pendingRewardsDisplay = str("pendingRewardsDisplay", "0");
  const pendingWithdrawDisplay = str("pendingWithdrawDisplay", "0");
  const totalNeoDisplay = str("totalNeoDisplay", "0");
  const rewardReserveDisplay = str("rewardReserveDisplay", "0");
  const effectiveRateDisplay = str("effectiveRateDisplay", "—");
  const agentCount = num("agentCount");
  const submitting = bool("submitting");

  const [amount, setAmount] = useState("1");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("amount");
  const [stakePreview, setStakePreview] = useState(false);
  const stakePreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (stakePreviewTimeout.current) clearTimeout(stakePreviewTimeout.current); }, []);
  const startStakePreview = () => {
    if (stakePreviewTimeout.current) clearTimeout(stakePreviewTimeout.current);
    setStakePreview(true);
    stakePreviewTimeout.current = setTimeout(() => { setStakePreview(false); stakePreviewTimeout.current = null; }, 1200);
  };

  const amountReady = wholeNeoAmount(amount);
  const adjustAmount = (delta: number) => {
    const current = Number.parseInt(normalizeWholeNeoAmount(amount), 10);
    setAmount(String(Math.max(1, (Number.isFinite(current) ? current : 1) + delta)));
  };
  const handleStake = () => {
    if (!amountReady || submitting || stakePreview) return;
    startStakePreview();
    void dispatch("stakeNeo", { amount: normalizeWholeNeoAmount(amount).trim() });
  };
  const handleWithdraw = () => {
    if (!amountReady || submitting || stakePreview) return;
    void dispatch("withdrawNeo", { amount: normalizeWholeNeoAmount(amount).trim() });
  };
  const handleClaim = () => { void dispatch("claimRewards"); };
  const handleRecover = () => { void dispatch("recoverNeoCredit"); };
  const handleRefresh = () => { void dispatch("refreshAnchor"); };

  const busy = submitting || stakePreview;
  const myStakeValue = withoutUnit(myStakeDisplay, "NEO");
  const pendingRewardsValue = withoutUnit(pendingRewardsDisplay, "GAS");
  const rewardReserveValue = withoutUnit(rewardReserveDisplay, "GAS");
  const hasStake = Number(myStakeValue) > 0;
  // Gauge: your stake as a share of the reward reserve (capped for display).
  const stakeNum = Number(myStakeValue) || 0;
  const reserveNum = Number(rewardReserveValue) || 1;
  const gaugePct = Math.min(100, Math.round((stakeNum / reserveNum) * 100));

  const scene = (
    <div className="tool-scene anchor-scene" data-state={busy ? "busy" : hasStake ? "staking" : "idle"}>
      {stakePreview && (
        <div className="anchor-scene__burst"><ParticleBurst coins count={8} /></div>
      )}
      <section className="anchor-vault-card" aria-label={t("stageAria")}>
        <img className="anchor-vault-card__image" src={STAGE_ART} alt="" aria-hidden="true" loading="eager" decoding="async" />
        <div className="anchor-vault-card__overlay">
          <div className="anchor-scene__gauge">
            <svg viewBox="0 0 120 120" className="anchor-scene__gauge-svg" aria-hidden="true">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--mx2-surface-sunken)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="var(--mx2-accent)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 50}
                strokeDashoffset={2 * Math.PI * 50 * (1 - gaugePct / 100)}
                transform="rotate(-90 60 60)"
                className="anchor-scene__gauge-arc"
              />
            </svg>
            <div className="anchor-scene__gauge-center">
              <CoinArt size={24} variant="neo" />
              <strong>{myStakeValue}</strong>
              <span>NEO</span>
            </div>
          </div>
          <div className="anchor-vault-card__copy">
            <span>{t("contractLiquidityLabel")}</span>
            <strong>{totalNeoDisplay}</strong>
            <small>{t("rewardReserve")}: {rewardReserveDisplay}</small>
          </div>
        </div>
      </section>

      <section className="anchor-console" aria-label={t("stakingWorkspaceLabel")}>
        <header className="anchor-console__head">
          <div>
            <span>{t("stakePath")}</span>
            <strong>{hasStake ? t("pendingRewards") : t("routeAwaiting")}</strong>
          </div>
          <em>{effectiveRateDisplay}</em>
        </header>

        <div className="anchor-console__metrics">
          <span><small>{t("myStake")}</small><strong>{myStakeValue} NEO</strong></span>
          <span><small>{t("pendingRewards")}</small><strong>{pendingRewardsValue} GAS</strong></span>
          <span><small>{t("rewardReserve")}</small><strong>{rewardReserveValue} GAS</strong></span>
        </div>

        <section className="anchor-ticket" data-ready={amountReady ? "true" : undefined} aria-label={t("amountPlan")}>
          <div className="anchor-ticket__head">
            <span>{t("preflightAmount")}</span>
            <strong>{amount || "0"} NEO</strong>
          </div>
          <div className="anchor-ticket__presets" aria-label={t("stakePresetLabel")}>
            {AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={amount === preset ? "is-active" : undefined}
                onClick={() => setAmount(preset)}
                disabled={busy}
              >
                {preset} NEO
              </button>
            ))}
          </div>
          <div className="anchor-ticket__stepper">
            <button type="button" onClick={() => adjustAmount(-1)} disabled={busy || amount === "1"} aria-label="-1 NEO">-</button>
            <output aria-live="polite">{amount || "0"} NEO</output>
            <button type="button" onClick={() => adjustAmount(1)} disabled={busy} aria-label="+1 NEO">+</button>
          </div>
          <small>{amountReady ? t("amountPlanReady") : t("amountPlanBlocked")}</small>
        </section>

        <div className="anchor-route">
          <span>{t("preflightRoute")}</span>
          <strong>{t("stakePathTitle")}</strong>
          <small>{t("stakePathCopy")}</small>
        </div>

        <p className="anchor-scene__status">
          {busy ? `${t("stakeNeo")}…` : hasStake ? `${t("pendingRewards")}: ${pendingRewardsDisplay}` : t("stageCaption")}
        </p>
      </section>
    </div>
  );

  const score = [
    { label: t("myStake"), value: `${myStakeValue} NEO`, accent: true },
    { label: t("pendingRewards"), value: `${pendingRewardsValue} GAS` },
    { label: t("effectiveRate"), value: effectiveRateDisplay },
  ];
  const drawerModes: Array<{ id: DrawerMode; label: string; value: string }> = [
    { id: "amount", label: t("stakeNeo"), value: `${amount || "0"} NEO` },
    { id: "rewards", label: t("pendingRewards"), value: `${pendingRewardsValue} GAS` },
    { id: "stats", label: t("totalNeoTracked"), value: totalNeoDisplay },
  ];

  const drawer = (
    <OpenUiProvider>
      <div className="anchor-drawer">
        <div className="anchor-drawer__switcher" role="tablist" aria-label={t("heroTitle")}>
          {drawerModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={drawerMode === mode.id}
              className={drawerMode === mode.id ? "is-active" : undefined}
              onClick={() => setDrawerMode(mode.id)}
            >
              <span>{mode.label}</span>
              <strong>{mode.value}</strong>
            </button>
          ))}
        </div>

        {drawerMode === "amount" && (
          <OpenUiPanel
            className="anchor-drawer__panel anchor-drawer__panel--amount"
            icon={<CoinArt size={20} variant="neo" decorative />}
            title={t("amountPlan")}
            subtitle={amountReady ? t("amountPlanReady") : t("amountPlanBlocked")}
          >
            <div className="anchor-drawer__amount-layout">
              <OpenUiTextField
                className="anchor-drawer-field anchor-drawer-field--amount"
                inputClassName="anchor-drawer-input anchor-drawer-input--amount"
                label={`${t("stakeNeo")} (NEO)`}
                value={amount}
                onChange={(e) => setAmount(normalizeWholeNeoAmount(e.target.value))}
                placeholder="1"
                inputMode="numeric"
                disabled={busy}
              />
              <div className="anchor-drawer__presets" aria-label={t("stakePresetLabel")}>
                {AMOUNT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={amount === preset ? "is-active" : undefined}
                    onClick={() => setAmount(preset)}
                    disabled={busy}
                  >
                    {preset} NEO
                  </button>
                ))}
              </div>
            </div>
            <div className="anchor-drawer__row anchor-drawer__row--primary">
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleStake} disabled={busy || !amountReady}>{t("stakeNeo")}</button>
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleWithdraw} disabled={busy || !amountReady}>{t("withdrawNeo")}</button>
            </div>
          </OpenUiPanel>
        )}

        {drawerMode === "rewards" && (
          <OpenUiPanel
            className="anchor-drawer__panel anchor-drawer__panel--rewards"
            icon={<CoinArt size={20} variant="gas" decorative />}
            title={t("pendingRewards")}
            subtitle={pendingRewardsDisplay}
          >
            <div className="anchor-drawer__row">
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleClaim} disabled={busy}>{t("claimRewards")}</button>
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleRecover} disabled={busy}>{t("recoverNeoCredit")}</button>
              <button type="button" className="mx2-btn mx2-btn--ghost anchor-drawer__refresh" onClick={handleRefresh} disabled={busy}>{t("refreshAnchor")}</button>
            </div>
          </OpenUiPanel>
        )}

        {drawerMode === "stats" && (
          <OpenUiPanel
            className="anchor-drawer__panel anchor-drawer__panel--stats"
            icon={<CoinArt size={20} variant="neo" decorative />}
            title={t("totalNeoTracked")}
            subtitle={totalNeoDisplay}
          >
            <div className="anchor-drawer__stats">
              <div><span>{t("totalNeoTracked")}</span><strong>{totalNeoDisplay}</strong></div>
              <div><span>{t("rewardReserve")}</span><strong>{rewardReserveDisplay}</strong></div>
              <div><span>{t("pendingWithdraw") || "Pending Withdraw"}</span><strong>{pendingWithdrawDisplay}</strong></div>
              <div><span>{t("agentTargetCount")}</span><strong>{agentCount}</strong></div>
            </div>
          </OpenUiPanel>
        )}
      </div>
    </OpenUiProvider>
  );

  return (
    <div className="profitanchor-play-area mx2 mx2-cat-defi">
      <PlayStage
        category="defi"
        stage={{ eyebrow: t("heroFactsLabel"), title: t("heroTitle"), subtitle: t("stageCaption") }}
        scene={scene}
        score={score}
        actions={{
          primary: { label: busy ? "…" : t("stakeNeo"), onClick: handleStake, loading: busy, disabled: busy || !amountReady },
        }}
        drawerToggleLabel={t("heroTitle")}
        drawer={{ title: t("heroTitle"), children: drawer }}
      />
    </div>
  );
}
