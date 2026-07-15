import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  CircleAlert,
  FileJson2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Route,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { ObservableState } from "@shared/react/context";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextArea as OpenUiTextArea,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import { inspectOracleSealPayload } from "./seal";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const STAGE_IMAGE = "seal-reference-stage.webp";

const PURPOSES = [
  { value: "oracle-input", labelKey: "purposeInput", hintKey: "purposeInputHint", icon: FileJson2 },
  { value: "callback-secret", labelKey: "purposeCallback", hintKey: "purposeCallbackHint", icon: KeyRound },
  { value: "private-compute", labelKey: "purposeCompute", hintKey: "purposeComputeHint", icon: LockKeyhole },
] as const;

type PurposeValue = (typeof PURPOSES)[number]["value"];
type DrawerMode = "receipt" | "flow" | "source";

function compact(value: string, empty = "—") {
  const text = String(value || "").trim();
  if (!text) return empty;
  return text.length > 34 ? `${text.slice(0, 16)}…${text.slice(-12)}` : text;
}

function formatLocalTime(value: number, empty: string) {
  if (!Number.isFinite(value) || value <= 0) return empty;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function stepState(
  step: "prepare" | "seal" | "receipt",
  phase: string,
  hasPending: boolean,
  pendingMalformed: boolean,
): "idle" | "active" | "complete" | "recovery" {
  if (pendingMalformed) return step === "receipt" ? "recovery" : "idle";
  if (hasPending) return step === "receipt" ? "recovery" : "complete";
  if (phase === "stored") return "complete";
  if (step === "prepare") {
    return ["key", "encrypt", "store"].includes(phase) ? "complete" : "active";
  }
  if (step === "seal") {
    if (["store"].includes(phase)) return "complete";
    return ["key", "encrypt"].includes(phase) ? "active" : "idle";
  }
  return phase === "store" ? "active" : "idle";
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, num, bool } = useStateBindings(state);
  const networkLabel = str("networkLabel");
  const runtimeState = str("runtimeState", "checking");
  const runtimeStateLabel = str("runtimeStateLabel", t("runtimeChecking"));
  const phase = str("phase", "checking");
  const lastStatus = str("lastStatus", t("statusCheckingRuntime"));
  const lastFingerprint = str("lastFingerprint", t("fingerprintEmpty"));
  const lastSecretRef = str("lastSecretRef");
  const lastContract = str("lastContract");
  const lastAlgorithm = str("lastAlgorithm");
  const lastStoredAt = num("lastStoredAt");
  const sealCount = num("sealCount");
  const isBusy = bool("isBusy");
  const storageReady = bool("storageReady");
  const hasPending = bool("hasPending");
  const pendingStored = bool("pendingStored");
  const pendingMalformed = bool("pendingMalformed");
  const pendingFingerprint = str("pendingFingerprint");
  const pendingSecretRef = str("pendingSecretRef");
  const pendingAttempts = num("pendingAttempts");
  const pendingCreatedAt = num("pendingCreatedAt");
  const pendingPurpose = str("pendingPurpose");
  const pendingPublicRoute = str("pendingPublicRoute");
  const keyContract = str("keyContract");

  const [purpose, setPurpose] = useState<PurposeValue>("oracle-input");
  const [publicRoute, setPublicRoute] = useState("");
  const [payload, setPayload] = useState("");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("source");
  const [discardArmed, setDiscardArmed] = useState(false);

  const selectedPurpose = useMemo(
    () => PURPOSES.find((item) => item.value === purpose) ?? PURPOSES[0],
    [purpose],
  );
  const payloadState = useMemo(() => inspectOracleSealPayload(payload), [payload]);
  const payloadStateLabel = payloadState.tooLarge
    ? t("payloadTooLarge")
    : payloadState.valid ? t("payloadValid") : t("payloadInvalid");
  const visibleFingerprint = hasPending ? pendingFingerprint : lastFingerprint;
  const receiptReady = Boolean(lastSecretRef && lastFingerprint !== t("fingerprintEmpty"));
  const primaryDisabled = isBusy || (!hasPending && (!payloadState.valid || runtimeState !== "ready"));

  useEffect(() => {
    if (hasPending || receiptReady) setDrawerMode("receipt");
  }, [hasPending, receiptReady]);

  useEffect(() => {
    if (phase !== "stored") return;
    // Successful storage ends the plaintext draft lifecycle. The durable
    // receipt comes from observable state; source JSON stays out of it.
    setPublicRoute("");
    setPayload("");
  }, [phase]);

  useEffect(() => {
    if (!hasPending) setDiscardArmed(false);
  }, [hasPending]);

  const resetDraft = () => {
    setPurpose("oracle-input");
    setPublicRoute("");
    setPayload("");
    setDrawerMode("source");
  };

  const dispatchSafely = (name: string, ...args: unknown[]) => {
    void dispatch(name, ...args).catch(() => undefined);
  };

  const runPrimary = () => {
    if (pendingMalformed) {
      if (!discardArmed) {
        setDiscardArmed(true);
        setDrawerMode("receipt");
        return;
      }
      dispatchSafely("discardPending");
      return;
    }
    if (hasPending) {
      dispatchSafely("retryPending");
      return;
    }
    dispatchSafely("sealPayload", { purpose, publicRoute: publicRoute.trim(), payload });
  };

  const purposeForDisplay = hasPending
    ? PURPOSES.find((item) => item.value === pendingPurpose) ?? selectedPurpose
    : selectedPurpose;

  const stageLabel = hasPending
    ? pendingMalformed
      ? t("runtimeRecoveryInvalid")
      : pendingStored ? t("stageStored") : t("stageRecovery")
    : isBusy ? t("stageWorking")
      : phase === "stored" ? t("stageStored")
        : payloadState.valid ? t("stageReady") : t("stageIdle");

  const drawerModes: Array<{ id: DrawerMode; label: string; value: string }> = [
    {
      id: "receipt",
      label: t("drawerReceipt"),
      value: pendingMalformed
        ? t("runtimeRecoveryInvalid")
        : pendingStored
          ? compact(pendingSecretRef)
          : hasPending ? t("flowRecovery") : receiptReady ? compact(lastSecretRef) : t("receiptEmpty"),
    },
    { id: "flow", label: t("drawerFlow"), value: runtimeStateLabel },
    { id: "source", label: t("drawerSource"), value: t("payloadSize", { count: payloadState.bytes }) },
  ];

  const setDrawerModeSafe = (value: string) => {
    if (drawerModes.some((item) => item.id === value)) setDrawerMode(value as DrawerMode);
  };

  const flowSteps: Array<{
    id: "prepare" | "seal" | "receipt";
    title: string;
    description: string;
    icon: LucideIcon;
  }> = [
    { id: "prepare", title: t("flowPrepare"), description: t("flowPrepareDesc"), icon: FileJson2 },
    { id: "seal", title: t("flowSeal"), description: t("flowSealDesc"), icon: LockKeyhole },
    {
      id: "receipt",
      title: pendingMalformed
        ? t("pendingMalformedTitle")
        : pendingStored ? t("recoveryStoredTitle") : hasPending ? t("flowRecovery") : t("flowReceipt"),
      description: pendingMalformed
        ? t("pendingMalformedCopy")
        : pendingStored ? t("recoveryStoredCopy") : hasPending ? t("flowRecoveryDesc") : t("flowReceiptDesc"),
      icon: pendingMalformed ? CircleAlert : pendingStored ? PackageCheck : hasPending ? RotateCcw : Archive,
    },
  ];

  const scene = (
    <div className="seal-workspace" data-phase={phase} data-pending={hasPending ? "true" : undefined}>
      <section className="seal-object" aria-label={t("stageTitle")}>
        <div className="seal-object__head">
          <span><PackageCheck size={16} aria-hidden="true" />{t("stageTitle")}</span>
          <strong>{stageLabel}</strong>
        </div>

        <div className="seal-object__body">
          <figure className="seal-object__asset">
            <img src={STAGE_IMAGE} alt="" aria-hidden="true" />
            <figcaption><LockKeyhole size={14} aria-hidden="true" />{t("artworkLabel")}</figcaption>
          </figure>

          <ol className="seal-journey" aria-label={t("flowTitle")}>
            {flowSteps.map((step) => {
              const Icon = step.icon;
              const status = stepState(step.id, phase, hasPending, pendingMalformed);
              return (
                <li
                  key={step.id}
                  data-state={status}
                  aria-current={status === "active" ? "step" : undefined}
                >
                  <span className="seal-journey__icon"><Icon size={17} aria-hidden="true" /></span>
                  <div><strong>{step.title}</strong><small>{step.description}</small></div>
                  {status === "complete" && <CheckCircle2 size={16} aria-label={t("payloadValid")} />}
                  {status === "recovery" && <RotateCcw size={16} aria-hidden="true" />}
                </li>
              );
            })}
          </ol>
        </div>

        {hasPending ? (
          <div className="seal-recovery" role={pendingMalformed ? "alert" : "status"}>
            {pendingMalformed
              ? <CircleAlert size={20} aria-hidden="true" />
              : pendingStored
                ? <PackageCheck size={20} aria-hidden="true" />
                : <RotateCcw size={20} aria-hidden="true" />}
            <div>
              <strong>{t(
                pendingMalformed
                  ? "pendingMalformedTitle"
                  : pendingStored ? "recoveryStoredTitle" : "recoveryTitle",
              )}</strong>
              <p>{t(
                pendingMalformed
                  ? "pendingMalformedCopy"
                  : pendingStored ? "recoveryStoredCopy" : "recoveryCopy",
              )}</p>
            </div>
            {!pendingMalformed && (
              <dl>
                <div><dt>{t(pendingStored ? "receiptSecretRef" : "receiptFingerprint")}</dt><dd>{compact(pendingStored ? pendingSecretRef : pendingFingerprint)}</dd></div>
                <div><dt>{t("recoveryAttempts")}</dt><dd>{pendingAttempts}</dd></div>
              </dl>
            )}
          </div>
        ) : (
          <div className="seal-object__receipt" data-ready={receiptReady ? "true" : undefined}>
            <div><span>{t("receiptFingerprint")}</span><strong>{receiptReady ? compact(lastFingerprint) : t("receiptEmpty")}</strong></div>
            <div><span>{t("receiptSecretRef")}</span><strong>{receiptReady ? compact(lastSecretRef) : t("fingerprintEmpty")}</strong></div>
          </div>
        )}
      </section>

      <section className="seal-draft" aria-label={t("draftTitle")}>
        <div className="seal-draft__head">
          <span>{t("purposeTitle")}</span>
          <strong>{t("draftTitle")}</strong>
          <p>{t("draftCopy")}</p>
        </div>

        <OpenUiSegmented
          className="seal-purpose"
          segmentedClassName="seal-purpose__group"
          label={t("purposeTitle")}
          value={purpose}
          onChange={(value) => setPurpose(value as PurposeValue)}
          options={PURPOSES.map((item) => {
            const Icon = item.icon;
            return {
              value: item.value,
              disabled: hasPending || isBusy,
              label: (
                <span className="seal-purpose-card">
                  <span className="seal-purpose-card__icon"><Icon size={16} aria-hidden="true" /></span>
                  <span>{t(item.labelKey)}</span>
                </span>
              ),
            };
          })}
        />
        <p className="seal-purpose__hint">{t(purposeForDisplay.hintKey)}</p>

        <div className="seal-draft__summary">
          <article>
            <Route size={18} aria-hidden="true" />
            <div><span>{t("publicRoute")}</span><strong>{compact(hasPending ? pendingPublicRoute : publicRoute, t("fingerprintEmpty"))}</strong></div>
          </article>
          <article data-valid={payloadState.valid ? "true" : undefined}>
            {payloadState.valid ? <ShieldCheck size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}
            <div><span>{t("confidentialPayload")}</span><strong>{hasPending ? t("flowRecovery") : payloadStateLabel}</strong></div>
            <small>{t("payloadSize", { count: payloadState.bytes })}</small>
          </article>
          <article data-ready={runtimeState === "ready" && storageReady ? "true" : undefined}>
            <KeyRound size={18} aria-hidden="true" />
            <div><span>{t("statService")}</span><strong>{runtimeStateLabel}</strong></div>
            <small>{compact(keyContract, t("fingerprintEmpty"))}</small>
          </article>
        </div>

        <div className="seal-boundary">
          <Fingerprint size={19} aria-hidden="true" />
          <div><strong>{t("plaintextBoundary")}</strong><p>{t("plaintextBoundaryCopy")}</p></div>
        </div>
      </section>
    </div>
  );

  const receiptPanel = hasPending ? (
    <OpenUiPanel
      className="seal-drawer__panel"
      icon={pendingMalformed
        ? <CircleAlert size={18} aria-hidden="true" />
        : pendingStored
          ? <PackageCheck size={18} aria-hidden="true" />
          : <RotateCcw size={18} aria-hidden="true" />}
      title={t(
        pendingMalformed
          ? "pendingMalformedTitle"
          : pendingStored ? "recoveryStoredTitle" : "recoveryTitle",
      )}
      subtitle={t(
        pendingMalformed
          ? "statusRecoveryInvalid"
          : pendingStored ? "statusCompletionReady" : "statusRecoveryReady",
      )}
    >
      <div className="seal-drawer__recovery">
        <p>{t(
          pendingMalformed
            ? "pendingMalformedCopy"
            : pendingStored ? "recoveryStoredCopy" : "recoveryCopy",
        )}</p>
        {!pendingMalformed && (
          <dl className="seal-drawer__receipt">
            {pendingStored && <div><dt>{t("receiptSecretRef")}</dt><dd><code>{pendingSecretRef}</code></dd></div>}
            <div><dt>{t("receiptFingerprint")}</dt><dd><code>{pendingFingerprint}</code></dd></div>
            <div><dt>{t("purposeTitle")}</dt><dd>{t(purposeForDisplay.labelKey)}</dd></div>
            <div><dt>{t("publicRoute")}</dt><dd>{pendingPublicRoute || t("fingerprintEmpty")}</dd></div>
            <div><dt>{t("recoveryAttempts")}</dt><dd>{pendingAttempts}</dd></div>
            <div><dt>{t("recoveryCreated")}</dt><dd>{formatLocalTime(pendingCreatedAt, t("fingerprintEmpty"))}</dd></div>
          </dl>
        )}
        <button
          type="button"
          className="mx2-btn mx2-btn--ghost seal-discard"
          onClick={() => {
            if (!discardArmed) {
              setDiscardArmed(true);
              return;
            }
            dispatchSafely("discardPending");
          }}
          disabled={isBusy}
        >
          <Trash2 size={15} aria-hidden="true" />
          {t(discardArmed
            ? pendingMalformed ? "confirmClearInvalid" : "confirmDiscard"
            : pendingMalformed ? "clearInvalidAction" : "discardPending")}
        </button>
      </div>
    </OpenUiPanel>
  ) : (
    <OpenUiPanel
      className="seal-drawer__panel"
      icon={<Archive size={18} aria-hidden="true" />}
      title={t("receiptTitle")}
      subtitle={receiptReady ? t("stageStored") : t("receiptEmpty")}
    >
      {receiptReady ? (
        <>
          <dl className="seal-drawer__receipt">
            <div><dt>{t("receiptSecretRef")}</dt><dd><code>{lastSecretRef}</code></dd></div>
            <div><dt>{t("receiptFingerprint")}</dt><dd><code>{lastFingerprint}</code></dd></div>
            <div><dt>{t("receiptContract")}</dt><dd><code>{lastContract}</code></dd></div>
            <div><dt>{t("receiptAlgorithm")}</dt><dd>{lastAlgorithm}</dd></div>
            <div><dt>{t("recoveryCreated")}</dt><dd>{formatLocalTime(lastStoredAt, t("fingerprintEmpty"))}</dd></div>
          </dl>
          <OpenUiNotice
            className="seal-drawer__notice"
            icon={<ShieldCheck size={18} aria-hidden="true" />}
            title={t("receiptBoundary")}
          >
            {t("receiptBoundaryCopy")}
          </OpenUiNotice>
        </>
      ) : (
        <OpenUiNotice
          className="seal-drawer__notice"
          icon={<Archive size={18} aria-hidden="true" />}
          title={t("receiptEmpty")}
        >
          {t("receiptEmptyCopy")}
        </OpenUiNotice>
      )}
    </OpenUiPanel>
  );

  const drawer = (
    <div className="seal-drawer">
      <OpenUiSegmented
        className="seal-drawer__switcher"
        segmentedClassName="seal-drawer__switcher-group"
        label={t("editPayload")}
        value={drawerMode}
        onChange={setDrawerModeSafe}
        options={drawerModes.map((mode) => ({
          value: mode.id,
          label: <span className="seal-drawer-tab"><span>{mode.label}</span><strong>{mode.value}</strong></span>,
        }))}
      />

      {drawerMode === "receipt" && receiptPanel}

      {drawerMode === "flow" && (
        <OpenUiPanel
          className="seal-drawer__panel"
          icon={<Route size={18} aria-hidden="true" />}
          title={t("flowTitle")}
          subtitle={lastStatus}
        >
          <ol className="seal-flow-list">
            {flowSteps.map((step) => (
              <li key={step.id}><strong>{step.title}</strong><span>{step.description}</span></li>
            ))}
            <li><strong>{t("flowRecovery")}</strong><span>{t("flowRecoveryDesc")}</span></li>
          </ol>
          <button
            type="button"
            className="mx2-btn mx2-btn--ghost seal-refresh"
            onClick={() => dispatchSafely("refreshRuntime")}
            disabled={isBusy}
          >
            <RefreshCw size={15} aria-hidden="true" />{t("refreshRuntime")}
          </button>
        </OpenUiPanel>
      )}

      {drawerMode === "source" && (
        <OpenUiPanel
          className="seal-drawer__panel"
          icon={<FileJson2 size={18} aria-hidden="true" />}
          title={t("drawerSource")}
          subtitle={payloadStateLabel}
        >
          <div className="seal-drawer__source">
            <OpenUiTextField
              className="seal-field seal-field--route"
              inputClassName="seal-input seal-input--route"
              label={t("publicRoute")}
              value={publicRoute}
              onChange={(event) => setPublicRoute(event.target.value.slice(0, 160))}
              placeholder={t("publicRoutePlaceholder")}
              hint={t("publicRouteHint")}
              disabled={hasPending || isBusy}
              spellCheck={false}
              mono
            />
            <OpenUiTextArea
              className="seal-field seal-field--payload"
              textareaClassName="seal-input seal-input--payload"
              label={t("confidentialPayload")}
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              placeholder={t("payloadPlaceholder")}
              hint={payloadStateLabel}
              disabled={hasPending || isBusy}
              rows={7}
              spellCheck={false}
            />
            <OpenUiNotice
              className="seal-drawer__notice"
              icon={<LockKeyhole size={18} aria-hidden="true" />}
              title={t("plaintextBoundary")}
            >
              {t("plaintextBoundaryCopy")}
            </OpenUiNotice>
          </div>
        </OpenUiPanel>
      )}
    </div>
  );

  const primaryLabel = pendingMalformed
    ? discardArmed ? t("confirmClearInvalid") : t("clearInvalidAction")
    : hasPending
      ? pendingStored
        ? isBusy ? t("finalizeActionWorking") : t("finalizeAction")
        : isBusy ? t("retryActionWorking") : t("retryAction")
    : isBusy ? t("sealActionWorking") : t("sealAction");
  const primaryHint = pendingMalformed
    ? t("pendingMalformedCopy")
    : hasPending
      ? t(pendingStored ? "recoveryStoredCopy" : "recoveryCopy")
    : !payloadState.valid ? payloadStateLabel
      // A hint under the CTA describes what to do next; nothing has been sealed
      // at this point, so it must not carry the "No new ciphertext was created"
      // seal-outcome line that `statusRuntimeUnavailable` is reserved for.
      : runtimeState !== "ready" ? t("statusRuntimeUnverified") : t("panelDescription");

  return (
    <OpenUiProvider>
      <div className="oracle-seal-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("panelEyebrow"),
            title: t("panelTitle"),
            subtitle: t("heroCopy"),
            badges: <span className="mx2-badge" data-tone={runtimeState === "ready" ? "success" : "accent"}><span className="mx2-badge__dot" />{networkLabel}</span>,
          }}
          scene={scene}
          score={[
            { label: t("statService"), value: runtimeStateLabel, accent: runtimeState === "ready" },
            { label: t("statStored"), value: String(sealCount) },
            { label: t("statFingerprint"), value: compact(visibleFingerprint, t("fingerprintEmpty")) },
          ]}
          actions={{
            primary: {
              label: primaryLabel,
              onClick: runPrimary,
              disabled: primaryDisabled,
              loading: isBusy,
              icon: pendingMalformed
                ? <Trash2 size={17} aria-hidden="true" />
                : pendingStored
                  ? <PackageCheck size={17} aria-hidden="true" />
                  : hasPending ? <RotateCcw size={17} aria-hidden="true" /> : <LockKeyhole size={17} aria-hidden="true" />,
              hint: primaryHint,
            },
            secondary: hasPending ? [] : [
              runtimeState === "ready"
                ? { label: t("resetDraft"), onClick: resetDraft, disabled: isBusy, icon: <Trash2 size={15} aria-hidden="true" /> }
                : { label: t("refreshRuntime"), onClick: () => dispatchSafely("refreshRuntime"), disabled: isBusy, icon: <RefreshCw size={15} aria-hidden="true" /> },
            ],
          }}
          drawerToggleLabel={hasPending ? t("drawerReceipt") : t("editPayload")}
          drawer={{ title: t("editPayload"), children: drawer }}
        />
        <p className="seal-status-line" role="status">
          {pendingMalformed
            ? <CircleAlert size={14} aria-hidden="true" />
            : pendingStored
              ? <PackageCheck size={14} aria-hidden="true" />
              : hasPending ? <RotateCcw size={14} aria-hidden="true" /> : <KeyRound size={14} aria-hidden="true" />}
          {lastStatus}
        </p>
      </div>
    </OpenUiProvider>
  );
}
