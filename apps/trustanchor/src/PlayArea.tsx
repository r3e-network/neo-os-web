/**
 * PlayArea.tsx — TrustAnchor (v2 scene-driven rebuild)
 *
 * DeFi identity. The staking node IS the scene: concentric node rings (your
 * stake at the core, agent nodes orbiting), rewards flowing in. Stake is the
 * primary write (always dispatches); withdraw/claim/recover + stake-amount input
 * live in a drawer. Real state from useTrustanchor bound throughout.
 */
import { useState, useEffect, useRef } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt, ParticleBurst } from "@shared/art";
import { OpenUiPanel, OpenUiProvider, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

const AMOUNT_PRESETS = ["1", "5", "10", "21"] as const;
type DrawerMode = "amount" | "rewards" | "stats";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

function withoutUnit(value: string, unit: string): string {
  return String(value || "0").replace(new RegExp(`\\s*${unit}\\s*$`, "i"), "").trim() || "0";
}

function normalizeWholeNeoAmount(value: string): string {
  const whole = value.split(/[.,]/)[0] ?? "";
  return whole.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num } = useStateBindings(state);

  const myStakeDisplay = str("myStakeDisplay", "0");
  const pendingRewardsDisplay = str("pendingRewardsDisplay", "0");
  const pendingWithdrawDisplay = str("pendingWithdrawDisplay", "0");
  const totalNeoDisplay = str("totalNeoDisplay", "0");
  const rewardReserveDisplay = str("rewardReserveDisplay", "0");
  const rewardPerNeoDisplay = str("rewardPerNeoDisplay", "—");
  const agentCount = num("agentCount");
  const submitting = bool("submitting");

  const [amount, setAmount] = useState("1");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("amount");
  const [stakePreview, setStakePreview] = useState(false);
  const stakePreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (stakePreviewTimeout.current) clearTimeout(stakePreviewTimeout.current); }, []);
  const busy = submitting || stakePreview;

  const startStakePreview = () => {
    if (stakePreviewTimeout.current) clearTimeout(stakePreviewTimeout.current);
    setStakePreview(true);
    stakePreviewTimeout.current = setTimeout(() => { setStakePreview(false); stakePreviewTimeout.current = null; }, 1200);
  };

  const amountReady = /^[1-9]\d*$/.test(amount.trim());
  const adjustAmount = (delta: number) => {
    const current = Number.parseInt(normalizeWholeNeoAmount(amount), 10);
    setAmount(String(Math.max(1, (Number.isFinite(current) ? current : 1) + delta)));
  };

  const handleStake = () => {
    if (!amountReady || busy) return;
    startStakePreview();
    void dispatch("stakeNeo", { amount: normalizeWholeNeoAmount(amount) });
  };
  const handleWithdraw = () => {
    if (!amountReady || busy) return;
    void dispatch("withdrawNeo", { amount: normalizeWholeNeoAmount(amount) });
  };
  const handleClaim = () => { void dispatch("claimRewards"); };
  const handleRecover = () => { void dispatch("recoverNeoCredit"); };
  const handleRefresh = () => { void dispatch("refreshAnchor"); };

  const myStakeValue = withoutUnit(myStakeDisplay, "NEO");
  const pendingRewardsValue = withoutUnit(pendingRewardsDisplay, "GAS");
  const rewardReserveValue = withoutUnit(rewardReserveDisplay, "GAS");
  const hasStake = Number(myStakeValue) > 0;

  const scene = (
    <div className="tool-scene trust-scene" data-state={busy ? "busy" : hasStake ? "staking" : "idle"}>
      {stakePreview && (
        <div className="trust-scene__burst"><ParticleBurst coins count={8} /></div>
      )}

      <section className="trust-stage-card" aria-label={t("stageAria")}>
        <img className="trust-stage-card__image" src="./trustanchor-stage.webp" alt={t("stageAria")} />
        <div className="trust-stage-card__summary">
          <div className="trust-scene__network">
            <div className={["trust-scene__core", busy ? "is-pulsing" : ""].filter(Boolean).join(" ")}>
              <CoinArt size={26} variant="neo" />
              <strong>{myStakeValue}</strong>
              <span>NEO</span>
            </div>
            <div className="trust-scene__orbit trust-scene__orbit--1" />
            <div className="trust-scene__orbit trust-scene__orbit--2" />
            {agentCount > 0 && Array.from({ length: Math.min(agentCount, 4) }).map((_, i) => (
              <span key={i} className="trust-scene__node" style={{ "--i": i } as React.CSSProperties} />
            ))}
          </div>
          <div className="trust-stage-card__copy">
            <span>{t("contractLiquidityLabel")}</span>
            <strong>{totalNeoDisplay}</strong>
            <small>{t("rewardReserve")}: {rewardReserveDisplay}</small>
          </div>
        </div>
      </section>

      <section className="trust-console" aria-label={t("stakePath")}>
        <header className="trust-console__head">
          <div>
            <span>{t("stakePath")}</span>
            <strong>{hasStake ? t("pendingRewards") : t("routeAwaiting")}</strong>
          </div>
          <em>{agentCount || 0}/21</em>
        </header>

        <div className="trust-console__metrics">
          <span><small>{t("myStake")}</small><strong>{myStakeValue} NEO</strong></span>
          <span><small>{t("pendingRewards")}</small><strong>{pendingRewardsValue} GAS</strong></span>
          <span><small>{t("rewardReserve")}</small><strong>{rewardReserveValue} GAS</strong></span>
        </div>

        <section className="trust-ticket" data-ready={amountReady ? "true" : undefined} aria-label={t("preflightAmount")}>
          <div className="trust-ticket__head">
            <span>{t("preflightAmount")}</span>
            <strong>{amount || "0"} NEO</strong>
          </div>
          <div className="trust-ticket__presets" aria-label={t("stakePresetLabel")}>
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
          <div className="trust-ticket__amount">
            <button type="button" onClick={() => adjustAmount(-1)} disabled={busy || amount === "1"} aria-label="-1 NEO">-</button>
            <output aria-live="polite">{amount || "0"} NEO</output>
            <button type="button" onClick={() => adjustAmount(1)} disabled={busy} aria-label="+1 NEO">+</button>
          </div>
          <small>{amountReady ? t("amountPlanReady") : t("amountPlanBlocked")}</small>
        </section>

        <div className="trust-route">
          <span>{t("preflightRoute")}</span>
          <strong>{t("heroFactAgents")}</strong>
          <small>{t("heroFactVariable")}</small>
        </div>

        <p className="trust-scene__status">
          {busy ? `${t("stakeNeo")}...` : hasStake ? `${t("pendingRewards")}: ${pendingRewardsDisplay}` : t("stageCaption")}
        </p>
      </section>
    </div>
  );

  const score = [
    { label: t("myStake"), value: `${myStakeValue} NEO`, accent: true },
    { label: t("pendingRewards"), value: pendingRewardsDisplay },
    { label: t("rewardPerNeo"), value: rewardPerNeoDisplay },
  ];
  const drawerModes: Array<{ id: DrawerMode; label: string; value: string }> = [
    { id: "amount", label: t("stakeNeo"), value: `${amount || "0"} NEO` },
    { id: "rewards", label: t("pendingRewards"), value: pendingRewardsDisplay },
    { id: "stats", label: t("totalNeoTracked"), value: totalNeoDisplay },
  ];

  const drawer = (
    <OpenUiProvider>
      <div className="trust-drawer">
        <div className="trust-drawer__switcher" role="tablist" aria-label={t("heroTitle")}>
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
            className="trust-drawer__panel trust-drawer__panel--amount"
            icon={<CoinArt size={20} variant="neo" decorative />}
            title={t("preflightAmount")}
            subtitle={amountReady ? t("amountPlanReady") : t("amountPlanBlocked")}
          >
            <div className="trust-drawer__amount-layout">
              <OpenUiTextField
                className="trust-drawer-field trust-drawer-field--amount"
                inputClassName="trust-drawer-input trust-drawer-input--amount"
                label={`${t("stakeNeo")} (NEO)`}
                value={amount}
                onChange={(e) => setAmount(normalizeWholeNeoAmount(e.target.value))}
                placeholder="1"
                inputMode="numeric"
                disabled={busy}
              />
              <div className="trust-drawer__presets" aria-label={t("stakePresetLabel")}>
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
            <div className="trust-drawer__row trust-drawer__row--primary">
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleStake} disabled={busy || !amountReady}>{t("stakeNeo")}</button>
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleWithdraw} disabled={busy || !amountReady}>{t("withdrawNeo")}</button>
            </div>
          </OpenUiPanel>
        )}

        {drawerMode === "rewards" && (
          <OpenUiPanel
            className="trust-drawer__panel trust-drawer__panel--rewards"
            icon={<CoinArt size={20} variant="gas" decorative />}
            title={t("pendingRewards")}
            subtitle={pendingRewardsDisplay}
          >
            <div className="trust-drawer__row">
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleClaim} disabled={busy}>{t("claimRewards")}</button>
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleRecover} disabled={busy}>{t("recoverNeoCredit")}</button>
              <button type="button" className="mx2-btn mx2-btn--ghost trust-drawer__refresh" onClick={handleRefresh} disabled={busy}>{t("refreshAnchor")}</button>
            </div>
          </OpenUiPanel>
        )}

        {drawerMode === "stats" && (
          <OpenUiPanel
            className="trust-drawer__panel trust-drawer__panel--stats"
            icon={<CoinArt size={20} variant="neo" decorative />}
            title={t("totalNeoTracked")}
            subtitle={totalNeoDisplay}
          >
            <div className="trust-drawer__stats">
              <div><span>{t("totalNeoTracked")}</span><strong>{totalNeoDisplay}</strong></div>
              <div><span>{t("rewardReserve")}</span><strong>{rewardReserveDisplay}</strong></div>
              <div><span>{t("pendingWithdraw")}</span><strong>{pendingWithdrawDisplay}</strong></div>
              <div><span>{t("agentTargetCount")}</span><strong>{agentCount}</strong></div>
            </div>
          </OpenUiPanel>
        )}
      </div>
    </OpenUiProvider>
  );

  return (
    <div className="trustanchor-play-area mx2 mx2-cat-defi">
      <PlayStage
        category="defi"
        stage={{ eyebrow: t("heroFactsLabel"), title: t("heroTitle"), subtitle: t("stageCaption") }}
        scene={scene}
        score={score}
        actions={{
          primary: { label: busy ? "..." : t("stakeNeo"), onClick: handleStake, loading: busy, disabled: !amountReady || busy },
        }}
        drawerToggleLabel={t("heroTitle")}
        drawer={{ title: t("heroTitle"), children: drawer }}
      />
    </div>
  );
}
