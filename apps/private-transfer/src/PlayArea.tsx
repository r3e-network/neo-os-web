import { useEffect, useState } from "react";
import {
  Check,
  CircleAlert,
  Database,
  FileLock2,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Wallet,
  WalletCards,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import { isPositiveAssetAmount, isValidNeoAddress, type PrivateTransferAsset } from "./seal";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const STAGE_IMAGE = new URL("../public/private-transfer-stage.webp", import.meta.url).href;
const ASSET_OPTIONS: Array<{ symbol: PrivateTransferAsset; metaKey: string; presets: string[] }> = [
  { symbol: "GAS", metaKey: "assetGasMeta", presets: ["0.1", "1", "5"] },
  { symbol: "NEO", metaKey: "assetNeoMeta", presets: ["1", "5", "10"] },
];

function shortHash(value: string): string {
  const normalized = String(value || "").trim();
  if (!normalized || normalized === "—") return "—";
  if (normalized.length <= 20) return normalized;
  return `${normalized.slice(0, 11)}…${normalized.slice(-7)}`;
}

function coinVariant(asset: PrivateTransferAsset): "gas" | "neo" {
  return asset === "NEO" ? "neo" : "gas";
}

function normalizeAmountInput(value: string): string {
  // Preserve what the user entered so an invalid paste can never be silently
  // reinterpreted as a different financial amount (for example `1e3` -> `13`
  // or `10.5 NEO` -> `10 NEO`). The strict validator owns acceptance.
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 32);
}

type RouteState = "idle" | "active" | "done" | "warning" | "outside";

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, num, bool } = useStateBindings(state);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<PrivateTransferAsset>("GAS");
  const [memo, setMemo] = useState("");
  const [discardArmed, setDiscardArmed] = useState(false);

  const phase = str("phase", "checking");
  const networkState = str("networkState", "checking");
  const oracleState = str("oracleState", "checking");
  const storageState = str("storageState", "unknown");
  const networkLabel = str("networkLabel", t("networkChecking"));
  const oracleContract = str("oracleContract");
  const oracleChecksum = num("oracleChecksum");
  const lastStatus = str("lastStatus", t("statusCheckingRuntime"));
  const lastDigest = str("lastDigest", "—");
  const lastSecretRef = str("lastSecretRef");
  const lastNullifier = str("lastNullifier");
  const isSealing = bool("isSealing");
  const hasPending = bool("hasPending");
  const pendingCommitment = str("pendingCommitment");
  const pendingAsset = str("pendingAsset");
  const pendingAttempts = num("pendingAttempts");
  const requestCount = num("requestCount");
  const lastStoredAt = num("lastStoredAt");

  const recipientReady = isValidNeoAddress(recipient);
  const amountReady = isPositiveAssetAmount(amount, asset);
  const runtimeReady = networkState === "ready" && oracleState === "ready";
  const canSeal = recipientReady && amountReady && runtimeReady && !hasPending && !isSealing;
  const activeAsset = ASSET_OPTIONS.find((option) => option.symbol === asset) ?? ASSET_OPTIONS[0]!;

  useEffect(() => {
    if (!hasPending) {
      setDiscardArmed(false);
      return;
    }
    if (!discardArmed) return;
    const timer = window.setTimeout(() => setDiscardArmed(false), 6_000);
    return () => window.clearTimeout(timer);
  }, [discardArmed, hasPending]);

  useEffect(() => {
    if (lastStoredAt <= 0) return;
    // A secret reference is the success boundary. Clear all private draft
    // fields only after that boundary is confirmed; failed storage keeps the
    // draft available alongside its retryable ciphertext packet.
    setRecipient("");
    setAmount("");
    setMemo("");
  }, [lastStoredAt]);

  const selectAsset = (next: PrivateTransferAsset) => {
    setAsset(next);
    setAmount((current) => normalizeAmountInput(current));
  };

  const runAction = (name: string, ...args: unknown[]) => {
    void dispatch(name, ...args).catch(() => undefined);
  };

  const handleSeal = () => {
    if (!canSeal) return;
    runAction("prepareTransfer", { recipient, amount, asset, memo });
  };

  const routeState = (step: "key" | "package" | "store"): RouteState => {
    if (step === "key") {
      if (phase === "checking" || phase === "key") return "active";
      if (oracleState === "ready") return "done";
      return phase === "blocked" ? "warning" : "idle";
    }
    if (step === "package") {
      if (phase === "package") return "active";
      if (["store", "stored", "recovery"].includes(phase)) return "done";
      return "idle";
    }
    if (phase === "store") return "active";
    if (phase === "stored") return "done";
    if (phase === "recovery" || hasPending) return "warning";
    return "idle";
  };

  const routeSteps: Array<{
    key: string;
    icon: typeof KeyRound;
    title: string;
    body: string;
    state: RouteState;
  }> = [
    { key: "key", icon: KeyRound, title: t("routeKeyTitle"), body: t("routeKeyBody"), state: routeState("key") },
    { key: "package", icon: LockKeyhole, title: t("routeEncryptTitle"), body: t("routeEncryptBody"), state: routeState("package") },
    { key: "store", icon: Database, title: t("routeStoreTitle"), body: t("routeStoreBody"), state: routeState("store") },
    { key: "tee", icon: ShieldCheck, title: t("routeTeeTitle"), body: t("routeTeeBody"), state: "outside" },
  ];

  const serviceTone = (value: string): "ready" | "checking" | "blocked" => {
    if (value === "ready" || value === "stored") return "ready";
    // Pending, not faulted. "awaiting-context" has not reached the lane (no host
    // to reach it through) and "unknown" is the pre-submit storage state — in
    // neither case has anything failed, so neither may render as a red fault.
    if (
      value === "checking"
      || value === "storing"
      || value === "awaiting-context"
      || value === "unknown"
    ) return "checking";
    return "blocked";
  };

  /** Waiting on a host shell is a normal pre-flight state, never an error. */
  const awaitingHost = oracleState === "awaiting-context";

  const scene = (
    <div className="pt-airlock" data-phase={phase}>
      <section className="pt-visual" aria-label={t("heroStageAria")}>
        <figure className="pt-visual__art">
          <img src={STAGE_IMAGE} alt="" aria-hidden="true" loading="eager" decoding="async" />
          <figcaption>
            <LockKeyhole size={16} aria-hidden="true" />
            <span>{t("visualCaption")}</span>
          </figcaption>
        </figure>

        <ol className="pt-route" aria-label={t("routeAria")}>
          {routeSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.key} className="pt-route__step" data-state={step.state}>
                <span className="pt-route__marker">
                  {step.state === "done" ? <Check size={17} aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}
                </span>
                <span className="pt-route__copy">
                  <strong>{step.title}</strong>
                  <small>{step.body}</small>
                </span>
                {index < routeSteps.length - 1 ? <span className="pt-route__line" aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ol>

        <div className="pt-service-strip" aria-label={t("serviceStatusTitle")} aria-live="polite">
          <div data-tone={serviceTone(networkState)}>
            <span className="pt-status-dot" aria-hidden="true" />
            <span><strong>{networkLabel}</strong><small>{t("serviceNetworkDetail")}</small></span>
          </div>
          <div data-tone={serviceTone(oracleState)}>
            <span className="pt-status-dot" aria-hidden="true" />
            <span><strong>{t(oracleState === "ready" ? "serviceOracleReady" : oracleState === "checking" ? "serviceOracleChecking" : awaitingHost ? "serviceOracleAwaiting" : "serviceOracleBlocked")}</strong><small>{oracleContract ? shortHash(oracleContract) : t(awaitingHost ? "serviceOracleAwaitingDetail" : "serviceFreshKeyRequired")}</small></span>
          </div>
          <div data-tone={serviceTone(storageState)}>
            <span className="pt-status-dot" aria-hidden="true" />
            <span><strong>{t(storageState === "stored" ? "serviceStorageStored" : storageState === "storing" ? "serviceStorageWorking" : hasPending ? "serviceStorageRecoverable" : "serviceStorageSubmit")}</strong><small>{t("serviceStorageDetail")}</small></span>
          </div>
        </div>

        {hasPending ? (
          <section className="pt-recovery" aria-labelledby="pt-recovery-title">
            <div className="pt-recovery__icon"><FileLock2 size={26} aria-hidden="true" /></div>
            <div className="pt-recovery__copy">
              <strong id="pt-recovery-title">{t("pendingTitle")}</strong>
              <span>{t("pendingBody", { asset: pendingAsset || asset, attempts: pendingAttempts })}</span>
              <small>{shortHash(pendingCommitment)}</small>
            </div>
            <div className="pt-recovery__actions">
              <button type="button" className="pt-recovery__retry" onClick={() => runAction("retryPending")} disabled={isSealing || !runtimeReady}>
                <RotateCcw size={15} aria-hidden="true" /> {t("pendingRetry")}
              </button>
              <button
                type="button"
                className="pt-recovery__discard"
                data-armed={discardArmed ? "true" : undefined}
                onClick={() => discardArmed ? runAction("discardPending") : setDiscardArmed(true)}
                disabled={isSealing}
                aria-pressed={discardArmed}
              >
                <Trash2 size={15} aria-hidden="true" /> {t(discardArmed ? "pendingDiscardConfirm" : "pendingDiscard")}
              </button>
            </div>
          </section>
        ) : null}
      </section>

      <section className="pt-composer" aria-label={t("composerTitle")}>
        <header className="pt-composer__head">
          <span>{t("composerTitle")}</span>
          <strong>{t("composerLead")}</strong>
          <small>{t("composerSubtitle")}</small>
        </header>

        <fieldset className="pt-asset-switch">
          <legend>{t("formAssetLabel")}</legend>
          <div className="pt-asset-switch__group">
            {ASSET_OPTIONS.map((option) => (
              <label key={option.symbol} className="pt-asset-control" data-checked={asset === option.symbol ? "true" : undefined}>
                <input
                  type="radio"
                  name="private-transfer-asset"
                  value={option.symbol}
                  checked={asset === option.symbol}
                  onChange={() => selectAsset(option.symbol)}
                />
                <span className="pt-asset-option" data-asset={option.symbol.toLowerCase()}>
                  <CoinArt size={30} variant={coinVariant(option.symbol)} decorative />
                  <span><strong>{option.symbol}</strong><small>{t(option.metaKey)}</small></span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="pt-amount-slot" data-ready={amountReady ? "true" : "false"}>
          <CoinArt size={48} variant={coinVariant(asset)} decorative />
          <label className="pt-amount-field">
            <span className="pt-visually-hidden">{t("formAmountLabel")}</span>
            <input
              className="pt-amount-input"
              aria-label={t("formAmountLabel")}
              value={amount}
              onChange={(event) => setAmount(normalizeAmountInput(event.target.value))}
              placeholder={asset === "NEO" ? "1" : "0.00"}
              inputMode={asset === "NEO" ? "numeric" : "decimal"}
              autoComplete="off"
              maxLength={32}
              aria-invalid={amount && !amountReady ? true : undefined}
              aria-describedby="pt-amount-help"
            />
          </label>
          <strong>{asset}</strong>
        </div>
        <div className="pt-amount-meta" id="pt-amount-help">
          <span>{asset === "NEO" ? t("amountHintNeo") : t("amountHintGas")}</span>
          {amount && !amountReady ? <strong role="alert">{t(asset === "NEO" ? "errorInvalidNeoAmount" : "errorInvalidAmount")}</strong> : null}
        </div>

        <fieldset className="pt-amount-presets">
          <legend>{t("presetsLabel")}</legend>
          <div className="pt-amount-presets__group">
            {activeAsset.presets.map((preset) => (
              <label key={`${asset}-${preset}`} data-checked={amount === preset ? "true" : undefined}>
                <input
                  type="radio"
                  name="private-transfer-preset"
                  value={preset}
                  checked={amount === preset}
                  onChange={() => setAmount(preset)}
                />
                <span>{preset}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="pt-recipient-field">
          <span>{t("formRecipientLabel")}</span>
          <input
            className="pt-recipient-input"
            aria-label={t("formRecipientLabel")}
            value={recipient}
            onChange={(event) => setRecipient(event.target.value.trim())}
            placeholder={t("formRecipientPlaceholder")}
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
            aria-invalid={recipient && !recipientReady ? true : undefined}
            aria-describedby="pt-recipient-help"
          />
          <small id="pt-recipient-help" aria-live="polite">{recipient ? t(recipientReady ? "recipientValid" : "errorInvalidAddress") : t("recipientHint")}</small>
        </label>

        <div className="pt-boundary" role="note">
          <ShieldCheck size={18} aria-hidden="true" />
          <span><strong>{t("boundaryTitle")}</strong><small>{t("boundaryBody")}</small></span>
        </div>

        {awaitingHost ? (
          <div className="pt-runtime-block pt-runtime-block--awaiting" role="status">
            <Wallet size={17} aria-hidden="true" />
            <span><strong>{t("statusAwaitingHostTitle")}</strong><small>{t("statusAwaitingHost")}</small></span>
          </div>
        ) : !runtimeReady ? (
          <div className="pt-runtime-block" role="status">
            <CircleAlert size={17} aria-hidden="true" />
            <span><strong>{t("statusRuntimeUnavailable")}</strong><small>{lastStatus}</small></span>
          </div>
        ) : (
          <p className="pt-runtime-ready" role="status"><ShieldCheck size={15} aria-hidden="true" /> {lastStatus}</p>
        )}

        {awaitingHost ? (
          // Pre-host, "Seal" cannot work — but a dead disabled button is not the
          // honest answer. Offer the action that actually moves the visitor
          // forward instead.
          <button
            type="button"
            className="pt-primary-action"
            onClick={() => runAction("connectWallet")}
          >
            <Wallet size={18} aria-hidden="true" />
            <span>{t("connectCta")}</span>
          </button>
        ) : (
          <button
            type="button"
            className="pt-primary-action"
            onClick={handleSeal}
            disabled={!canSeal}
            aria-busy={isSealing || undefined}
            title={hasPending ? t("pendingMustResolve") : !runtimeReady ? t("statusRuntimeUnavailable") : undefined}
          >
            {isSealing ? <span className="mx2-spinner" aria-hidden="true" /> : <LockKeyhole size={18} aria-hidden="true" />}
            <span>{isSealing ? t("sealing") : t("sealCtaShort")}</span>
          </button>
        )}
      </section>
    </div>
  );

  const drawerPanel = (icon: React.ReactNode, title: string, subtitle: string, body: React.ReactNode, extraClass = "") => (
    <section className={`pt-drawer__panel ${extraClass}`.trim()}>
      <header><span>{icon}</span><div><strong>{title}</strong><small>{subtitle}</small></div></header>
      <div className="pt-drawer__panel-body">{body}</div>
    </section>
  );

  const drawer = (
    <div className="pt-drawer">
      {drawerPanel(
        <FileLock2 size={18} aria-hidden="true" />,
        t("formMemoLabel"),
        t("formMemoOptional"),
        <label className="pt-drawer__memo">
          <span className="pt-visually-hidden">{t("formMemoLabel")}</span>
          <input
            aria-label={t("formMemoLabel")}
            value={memo}
            onChange={(event) => setMemo(event.target.value.slice(0, 160))}
            placeholder={t("memoPlaceholder")}
            maxLength={160}
          />
          <small>{t("memoHint")}</small>
        </label>,
        "pt-drawer__panel--memo",
      )}
      {drawerPanel(
        <ShieldCheck size={18} aria-hidden="true" />,
        t("privacyBoundaryTitle"),
        t("privacyBoundarySubtitle"),
        <dl className="pt-drawer__facts">
          <div><dt>{t("privacyPrivateFields")}</dt><dd>{t("privacyPrivateFieldsValue")}</dd></div>
          <div><dt>{t("privacyPublicFields")}</dt><dd>{t("privacyPublicFieldsValue")}</dd></div>
          <div><dt>{t("privacyNotVerified")}</dt><dd>{t("privacyNotVerifiedValue")}</dd></div>
        </dl>,
      )}
      {drawerPanel(
        <KeyRound size={18} aria-hidden="true" />,
        t("cryptoDetailsTitle"),
        "X25519 · HKDF-SHA256 · AES-256-GCM",
        <dl className="pt-drawer__facts">
          <div><dt>{t("statNetwork")}</dt><dd>{networkLabel}</dd></div>
          <div><dt>{t("oracleSourceContract")}</dt><dd>{oracleContract ? shortHash(oracleContract) : t("digestPlaceholder")}</dd></div>
          <div><dt>{t("oracleNefChecksum")}</dt><dd>{oracleChecksum > 0 ? oracleChecksum : t("digestPlaceholder")}</dd></div>
          <div><dt>{t("walletStatus")}</dt><dd><WalletCards size={14} aria-hidden="true" /> {t("walletNotRequested")}</dd></div>
        </dl>,
      )}
      {drawerPanel(
        <Database size={18} aria-hidden="true" />,
        t("latestReceiptTitle"),
        requestCount > 0 ? t("historyCount", { count: requestCount }) : t("historyEmpty"),
        <dl className="pt-drawer__facts">
          <div><dt>{t("resultSecretRef")}</dt><dd>{lastSecretRef ? shortHash(lastSecretRef) : t("digestPlaceholder")}</dd></div>
          <div><dt>{t("resultCommitment")}</dt><dd>{lastDigest ? shortHash(lastDigest) : t("digestPlaceholder")}</dd></div>
          <div><dt>{t("resultNullifier")}</dt><dd>{lastNullifier ? shortHash(lastNullifier) : t("digestPlaceholder")}</dd></div>
        </dl>,
      )}
    </div>
  );

  return (
    <div className="private-transfer-play-area mx2 mx2-cat-defi">
      <PlayStage
        category="defi"
        stage={{
          title: t("heroTitle"),
          subtitle: t("heroBody"),
        }}
        scene={scene}
        actions={{
          secondary: oracleState !== "ready" || networkState !== "ready" ? [{
            label: t("retryRuntime"),
            icon: <RefreshCw size={16} aria-hidden="true" />,
            onClick: () => runAction("refreshRuntime"),
            disabled: isSealing,
          }] : undefined,
        }}
        drawerToggleLabel={t("detailsRecovery")}
        drawer={{ title: t("detailsRecovery"), children: drawer }}
      />
    </div>
  );
}
