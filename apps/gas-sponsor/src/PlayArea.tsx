/**
 * gas-sponsor -- refill-station PlayArea with quota-aware GAS requests.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AlertTriangle, Fuel, Gauge, ShieldCheck, TimerReset } from "lucide-react";
import { CoinArt } from "@shared/art";
import { OpenUiProvider, OpenUiSegmented, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

function formatGas(value: string | number | null | undefined, fallback = "0"): string {
  const numeric = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(numeric)) return fallback;
  return numeric.toFixed(numeric >= 1 ? 2 : 4).replace(/\.?0+$/, "");
}

function compactAddress(value: string | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "-";
  return trimmed.length <= 18 ? trimmed : `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`;
}

const QUICK_AMOUNT_FALLBACK = [0.001, 0.005, 0.01, 0.05];
type DrawerMode = "tune" | "quota";

export default function PlayArea({ state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const gasBalance = str("gasBalance", "0");
  const isEligible = bool("isEligible");
  const serviceAvailable = bool("serviceAvailable");
  const fuelLevelPercent = Math.max(0, Math.min(100, num("fuelLevelPercent")));
  const remainingQuota = str("remainingQuota", "0");
  const remainingQuotaDisplay = str("remainingQuotaDisplay", remainingQuota);
  const dailyLimit = str("dailyLimit", "0.1");
  const usedQuota = str("usedQuota", "0");
  const resetTime = str("resetTime");
  const isRequesting = bool("isRequesting");
  const requestAmount = str("requestAmount", "0.01");
  const maxRequestAmount = str("maxRequestAmount", remainingQuota);
  const poolAddress = str("poolAddress");
  const serviceNotice = str("serviceNotice");
  const loading = bool("loading");
  const quickAmounts = val<number[]>("quickAmounts", QUICK_AMOUNT_FALLBACK) ?? QUICK_AMOUNT_FALLBACK;

  const [selectedAmount, setSelectedAmount] = useState(requestAmount || "0.01");
  const [requestPreview, setRequestPreview] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("tune");
  const requestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (requestAmount) setSelectedAmount(requestAmount);
  }, [requestAmount]);

  useEffect(() => () => {
    if (requestTimeout.current) clearTimeout(requestTimeout.current);
  }, []);

  const actionBusy = isRequesting || requestPreview;
  const isHydrating = loading && !actionBusy;
  const busy = actionBusy || loading;
  const selectedNumeric = Number.parseFloat(selectedAmount);
  const remainingNumeric = Number.parseFloat(remainingQuota);
  const requestValid = Number.isFinite(selectedNumeric)
    && selectedNumeric > 0
    && (Number.isFinite(remainingNumeric) ? selectedNumeric <= remainingNumeric : true);
  const canRequest = isEligible && serviceAvailable && requestValid && !busy;
  const gaugeColor = fuelLevelPercent >= 70
    ? "var(--mx2-success)"
    : fuelLevelPercent >= 30
      ? "var(--mx2-warning)"
      : "var(--mx2-danger)";
  const serviceState = !serviceAvailable
    ? "Service unavailable"
    : isEligible
      ? "Eligible"
      : "Above sponsorship threshold";
  const requestFillPercent = Number.isFinite(selectedNumeric) && Number.isFinite(remainingNumeric) && remainingNumeric > 0
    ? Math.max(6, Math.min(100, Math.round((selectedNumeric / remainingNumeric) * 100)))
    : 18;

  const setRequest = (amount: string) => {
    setSelectedAmount(amount);
    state.requestAmount?.set(amount);
  };

  const startRequestPreview = () => {
    if (requestTimeout.current) clearTimeout(requestTimeout.current);
    setRequestPreview(true);
    requestTimeout.current = setTimeout(() => {
      setRequestPreview(false);
      requestTimeout.current = null;
    }, 1100);
  };

  const handleRequest = () => {
    if (!canRequest) return;
    startRequestPreview();
    void dispatch("requestSponsorship", selectedAmount);
  };

  const quickOptions = useMemo(
    () => quickAmounts.map((amount) => formatGas(amount)).filter((amount, index, list) => amount && list.indexOf(amount) === index),
    [quickAmounts],
  );
  const drawerModes = [
    { mode: "tune" as const, label: "Tune request" },
    { mode: "quota" as const, label: "Quota status" },
  ];
  const setDrawerModeSafe = (mode: string) => {
    if (drawerModes.some((item) => item.mode === mode)) setDrawerMode(mode as DrawerMode);
  };

  const scene = (
    <div
      className="sponsor-desk"
      data-state={isHydrating ? "checking" : actionBusy ? "requesting" : canRequest ? "ready" : "idle"}
      style={{ "--sponsor-request-fill": `${requestFillPercent}%` } as CSSProperties}
    >
      <section className="sponsor-station" aria-label="GAS refill station">
        <img className="sponsor-station__art" src="gas-sponsor-refill-station.webp" alt="" aria-hidden="true" />
        <div className="sponsor-station__panel">
          <div className="sponsor-tank__gauge">
            <svg viewBox="0 0 120 120" className="sponsor-tank__svg" aria-hidden="true">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--mx2-surface-sunken)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={gaugeColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 50}
                strokeDashoffset={2 * Math.PI * 50 * (1 - fuelLevelPercent / 100)}
                transform="rotate(-90 60 60)"
                className="sponsor-tank__arc"
              />
            </svg>
            <div className="sponsor-tank__center">
              <CoinArt size={25} variant="gas" />
              <strong>{Math.round(fuelLevelPercent)}%</strong>
            </div>
          </div>
          <div className="sponsor-tank__copy">
            <span><Gauge size={15} /> Tank level</span>
            <strong>{formatGas(gasBalance)} GAS</strong>
            <small>{serviceState}</small>
          </div>
        </div>
      </section>

      <section className="sponsor-console" aria-label="Request amount">
        <div className="sponsor-console__head">
          <span><Fuel size={17} /> Request</span>
          <strong>{formatGas(selectedAmount)} GAS</strong>
        </div>
        <div className="sponsor-fill-meter" aria-hidden="true">
          <span />
        </div>
        <div className="sponsor-console__meta" aria-label="Request summary">
          <span><ShieldCheck size={15} /> Up to {formatGas(maxRequestAmount, remainingQuotaDisplay)} GAS</span>
          <span>{serviceState}</span>
        </div>
        <OpenUiSegmented
          className="sponsor-fuel-cells"
          segmentedClassName="sponsor-fuel-cells__group"
          label="Quick request amounts"
          value={selectedAmount}
          onChange={setRequest}
          disabled={busy}
          options={quickOptions.map((amount) => ({
            value: amount,
            label: (
              <span className="sponsor-fuel-cell" aria-label={amount}>
                <CoinArt size={22} variant="gas" />
                <span>{amount}</span>
                <small>GAS</small>
              </span>
            ),
          }))}
        />
      </section>

      {(serviceNotice || !requestValid) && (
        <div className="sponsor-warning" role="status">
          <AlertTriangle size={15} />
          <span>{serviceNotice || "Choose an amount within the remaining quota."}</span>
        </div>
      )}
    </div>
  );

  const drawer = (
    <div className="sponsor-drawer">
      <OpenUiSegmented
        className="sponsor-drawer-tabs"
        segmentedClassName="sponsor-drawer-tabs__group"
        label="Gas sponsor details"
        value={drawerMode}
        onChange={setDrawerModeSafe}
        options={drawerModes.map((item) => ({
          value: item.mode,
          label: <span className="sponsor-drawer-tab">{item.label}</span>,
        }))}
      />

      <div className="sponsor-drawer__panel" data-mode={drawerMode}>
        {drawerMode === "tune" && (
          <div className="sponsor-tune">
            <OpenUiTextField
              className="sponsor-tune__field"
              label="Exact amount"
              value={selectedAmount}
              onChange={(event) => setRequest(event.target.value)}
              inputMode="decimal"
              disabled={busy}
            />
            <p><ShieldCheck size={15} /> Keep requests within the remaining daily quota before opening the wallet.</p>
          </div>
        )}
        {drawerMode === "quota" && (
          <dl className="sponsor-quota">
            <div><dt>Pool</dt><dd><code>{compactAddress(poolAddress)}</code></dd></div>
            <div><dt>Daily limit</dt><dd>{formatGas(dailyLimit)} GAS</dd></div>
            <div><dt>Used today</dt><dd>{formatGas(usedQuota)} GAS</dd></div>
            <div><dt>Reset</dt><dd><TimerReset size={14} /> {resetTime || "-"}</dd></div>
          </dl>
        )}
      </div>
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="gas-sponsor-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: "Gas Sponsor",
            title: "Gas Sponsorship",
            subtitle: "Request a small, quota-bound GAS top-up for first actions.",
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {serviceState}</span>,
          }}
          scene={scene}
          actions={{
            primary: {
              label: isHydrating ? "Checking" : actionBusy ? "Requesting gas" : "Request Gas",
              icon: <Fuel size={16} />,
              onClick: handleRequest,
              loading: busy,
              disabled: !canRequest,
            },
          }}
          drawerToggleLabel="Details"
          drawer={{ title: "Gas sponsor controls", children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
