import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Braces,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Dice5,
  Fingerprint,
  Gamepad2,
  Gift,
  KeyRound,
  PackageCheck,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { useTransientFlag } from "@shared/components-react";
import {
  OpenUiNotice,
  OpenUiPanel,
  OpenUiProvider,
  OpenUiSegmented,
  OpenUiTextArea,
  OpenUiTextField,
  PlayStage,
} from "@shared/components-react/v2";
import {
  VRF_RESPONSE_LIMIT,
  shortValue,
  type VerificationCheckKey,
  type VrfPurpose,
  type VrfRequestDraft,
  type VrfServiceSnapshot,
  type VrfVerificationResult,
} from "./vrf-workbench";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  setStatus?: (message: string, type: "info" | "success" | "warning" | "error") => void;
}

type DrawerMode = "request" | "service" | "verify" | "payload";

interface RequestContext {
  consumer: string;
  reference: string;
  purpose: VrfPurpose;
}

const CHECK_LABELS: Record<VerificationCheckKey, string> = {
  schema: "checkSchema",
  request: "checkRequest",
  method: "checkMethod",
  "network-key": "checkNetworkKey",
  "output-hash": "checkOutputHash",
  signature: "checkSignature",
  attestation: "checkAttestation",
};

function serviceLabelKey(snapshot: VrfServiceSnapshot | null, busy = false): string {
  // Checks are on-demand: before the first user-triggered probe there is no
  // snapshot, and the honest state is "not checked" rather than degraded.
  if (!snapshot) return busy ? "serviceChecking" : "serviceNotChecked";
  if (snapshot.freshness === "stale") return "serviceStale";
  if (snapshot.availability === "network-mismatch") return "serviceMismatch";
  if (snapshot.availability === "degraded") return "serviceDegraded";
  if (snapshot.availability === "unavailable") return "serviceUnavailable";
  return "serviceProtected";
}

function verificationTitleKey(result: VrfVerificationResult | null): string {
  if (!result) return "verificationEmpty";
  if (result.status === "verified") return "verificationVerified";
  if (result.status === "unbound") return "verificationUnbound";
  if (result.status === "blocked") return "verificationBlocked";
  return "verificationInvalid";
}

function verificationReasonKey(result: VrfVerificationResult): string {
  if (result.reason === "service-key-unavailable") return "reasonServiceKey";
  if (result.reason === "response-too-large") return "reasonTooLarge";
  if (result.reason === "invalid-json") return "reasonJson";
  if (result.reason === "invalid-schema") return "reasonSchema";
  if (result.reason === "request-mismatch") return "reasonRequest";
  if (result.reason === "unsupported-method") return "reasonMethod";
  if (result.reason === "signer-mismatch") return "reasonSigner";
  if (result.reason === "hash-mismatch") return "reasonHash";
  if (result.reason === "signature-invalid") return "reasonSignature";
  return "verificationSignedScope";
}

function formatCheckedAt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function PlayArea({ t, state, dispatch, setStatus }: PlayAreaProps) {
  const { bool, str, val } = useStateBindings(state);
  const draft = val<VrfRequestDraft>("draft");
  const snapshot = val<VrfServiceSnapshot>("serviceSnapshot");
  const verification = val<VrfVerificationResult>("verification");
  const actionBusy = bool("actionBusy");
  const actionKind = str("actionKind");
  const serviceBusy = bool("serviceBusy");
  const storageHealthy = val<boolean>("storageHealthy", true) ?? true;
  const draftPersisted = val<boolean>("draftPersisted", Boolean(draft)) ?? Boolean(draft);
  const networkLabel = str("networkLabel");
  const lastStatus = str("lastStatus", t("statusReady"));
  const recoveredResponse = str("responseText");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(draft ? "payload" : "request");
  const [responseText, setResponseText] = useState(recoveredResponse);
  const [context, setContext] = useState<RequestContext>(() => draft?.context ?? {
    consumer: "miniapp-oracle-vrf-console",
    reference: "randomness-session",
    purpose: "game",
  });
  const copiedFlag = useTransientFlag(1_100);
  const payloadText = useMemo(
    () => draft ? JSON.stringify(draft.request, null, 2) : "",
    [draft],
  );
  const serviceTitle = t(serviceLabelKey(snapshot, serviceBusy));
  const serviceNeedsAttention = Boolean(
    snapshot
    && (snapshot.freshness === "stale" || snapshot.availability !== "protected"),
  );
  const verified = verification?.status === "verified";
  const sceneState = verified
    ? "verified"
    : actionKind === "draft"
      ? "building"
      : draft
        ? "draft"
        : "idle";

  const presets: Array<{
    purpose: VrfPurpose;
    label: string;
    hint: string;
    reference: string;
    icon: ReactNode;
  }> = [
    {
      purpose: "game",
      label: t("useCaseGame"),
      hint: t("useCaseGameHint"),
      reference: "game-final-round",
      icon: <Gamepad2 size={18} />,
    },
    {
      purpose: "raffle",
      label: t("useCaseRaffle"),
      hint: t("useCaseRaffleHint"),
      reference: "weekly-raffle",
      icon: <Gift size={18} />,
    },
    {
      purpose: "allocation",
      label: t("useCaseAllocation"),
      hint: t("useCaseAllocationHint"),
      reference: "fair-allocation",
      icon: <Workflow size={18} />,
    },
  ];

  const selectPreset = (purpose: VrfPurpose, reference: string) => {
    setContext((current) => ({ ...current, purpose, reference }));
  };

  const buildDraft = () => {
    copiedFlag.clear();
    setResponseText("");
    void dispatch("buildDraft", context).then(() => setDrawerMode("payload"));
  };

  const clearDraft = () => {
    copiedFlag.clear();
    setResponseText("");
    void dispatch("clearDraft").then(() => setDrawerMode("request"));
  };

  const copyRequest = () => {
    if (!payloadText) return;
    if (!navigator.clipboard) {
      setStatus?.(t("copyUnavailable"), "warning");
      return;
    }
    void navigator.clipboard.writeText(payloadText)
      .then(() => copiedFlag.trigger())
      .catch(() => setStatus?.(t("copyUnavailable"), "warning"));
  };

  const verifyResponse = () => {
    void dispatch("verifyResponse", { responseText });
  };

  const scene = (
    <div className="vrf-workbench" data-state={sceneState}>
      <figure className="vrf-workbench__visual">
        <img src="./oracle-workspace-stage.webp" alt={t("heroAlt")} decoding="async" />
        <figcaption>
          <span>{t("workspaceCaption")}</span>
          <strong>{t("workspaceTitle")}</strong>
        </figcaption>
        <div
          className="vrf-workbench__service-seal"
          data-tone={snapshot?.freshness === "stale" ? "stale" : snapshot?.availability ?? "checking"}
        >
          {serviceNeedsAttention
            ? <ShieldAlert size={17} />
            : <ShieldCheck size={17} />}
          <span>{serviceTitle}</span>
        </div>
      </figure>

      <section className="vrf-path" aria-label={t("pipelineTitle")}>
        <header>
          <span>{t("pipelineTitle")}</span>
          <strong>{lastStatus}</strong>
        </header>
        <ol>
          <li data-state={draft ? "complete" : "current"}>
            <span className="vrf-path__index">{draft ? <Check size={16} /> : "1"}</span>
            <div><strong>{t("stepDraft")}</strong><p>{t("stepDraftCopy")}</p></div>
            <small>{t(draft ? "pipelineComplete" : "pipelinePending")}</small>
          </li>
          <li data-state="external">
            <span className="vrf-path__index"><PackageCheck size={16} /></span>
            <div><strong>{t("stepSubmit")}</strong><p>{t("stepSubmitCopy")}</p></div>
            <small>{t("pipelineExternal")}</small>
          </li>
          <li data-state={verified ? "complete" : draft ? "current" : "pending"}>
            <span className="vrf-path__index">{verified ? <Check size={16} /> : "3"}</span>
            <div><strong>{t("stepVerify")}</strong><p>{t("stepVerifyCopy")}</p></div>
            <small>{t(verified ? "pipelineComplete" : "pipelinePending")}</small>
          </li>
        </ol>
      </section>

      <section className="vrf-result-capsule" data-tone={verification?.status ?? (draft ? "draft" : "idle")}>
        <span className="vrf-result-capsule__icon">
          {verified ? <CheckCircle2 size={23} /> : draft ? <TicketCheck size={23} /> : <Dice5 size={23} />}
        </span>
        <div>
          <span>{t(verificationTitleKey(verification))}</span>
          <strong>
            {verified
              ? shortValue(verification.randomness, 14, 10)
              : draft
                ? shortValue(draft.request.request_id, 14, 9)
                : t("digestPlaceholder")}
          </strong>
        </div>
        <p>{verified ? t("verificationSignedScope") : draft ? t(draftPersisted ? "draftReadyCopy" : "draftLocalOnlyCopy") : t("verificationEmptyCopy")}</p>
      </section>
    </div>
  );

  const requestBoard = (
    <section className="vrf-request-board">
      <header>
        <span>{t("useCaseTitle")}</span>
        <strong>{t("draftTitle")}</strong>
      </header>
      <div className="vrf-purpose-grid">
        {presets.map((preset) => (
          <button
            key={preset.purpose}
            type="button"
            className={context.purpose === preset.purpose ? "is-active" : undefined}
            onClick={() => selectPreset(preset.purpose, preset.reference)}
            disabled={actionBusy}
          >
            <span>{preset.icon}</span>
            <strong>{preset.label}</strong>
            <small>{preset.hint}</small>
          </button>
        ))}
      </div>
      <div className="vrf-request-board__status">
        <span className="vrf-request-board__stamp"><Fingerprint size={16} /></span>
        <div>
          <span>{t("requestId")}</span>
          <strong>{draft ? shortValue(draft.request.request_id, 14, 8) : t("draftNotSubmitted")}</strong>
        </div>
        <small>{draft ? t(draftPersisted ? "draftSaved" : "draftLocalOnly") : t("pipelinePending")}</small>
      </div>
    </section>
  );

  const drawerModes: Array<{ value: DrawerMode; label: string; disabled?: boolean }> = [
    { value: "request", label: t("drawerRequest") },
    { value: "service", label: t("drawerService") },
    { value: "verify", label: t("drawerVerify") },
    { value: "payload", label: t("drawerPayload"), disabled: !draft },
  ];

  const requestPanel = (
    <OpenUiPanel
      className="vrf-drawer__panel"
      icon={<Fingerprint size={18} />}
      title={t("advancedContext")}
      subtitle={t("advancedContextCopy")}
    >
      <div className="vrf-context-grid">
        <OpenUiTextField
          className="vrf-field"
          label={t("consumer")}
          value={context.consumer}
          onChange={(event) => setContext((current) => ({ ...current, consumer: event.target.value }))}
          placeholder={t("consumerPlaceholder")}
          maxLength={72}
          mono
          disabled={actionBusy}
          spellCheck={false}
        />
        <OpenUiTextField
          className="vrf-field"
          label={t("reference")}
          value={context.reference}
          onChange={(event) => setContext((current) => ({ ...current, reference: event.target.value }))}
          placeholder={t("referencePlaceholder")}
          maxLength={96}
          mono
          disabled={actionBusy}
          spellCheck={false}
        />
      </div>
      {(!storageHealthy || (draft && !draftPersisted)) && (
        <OpenUiNotice
          className="vrf-storage-notice"
          icon={<ShieldAlert size={17} />}
          title={t("draftLocalOnly")}
          type="warning"
        >
          {t("storageUnavailableCopy")}
        </OpenUiNotice>
      )}
      {draft && (
        <button className="vrf-inline-action vrf-inline-action--danger" type="button" onClick={clearDraft} disabled={actionBusy}>
          <Trash2 size={15} /> {t("clearDraft")}
        </button>
      )}
    </OpenUiPanel>
  );

  const servicePanel = (
    <OpenUiPanel
      className="vrf-drawer__panel"
      icon={<Activity size={18} />}
      title={t("serviceBoundaryTitle")}
      subtitle={t("serviceBoundaryCopy")}
    >
      {snapshot ? (
        <>
          <dl className="vrf-service-grid">
            <div>
              <dt>{t("serviceRuntime")}</dt>
              <dd data-ok={snapshot.healthReady && snapshot.runtimeOperational}>{t(snapshot.healthReady && snapshot.runtimeOperational ? "serviceReady" : "serviceNotReady")}</dd>
            </div>
            <div>
              <dt>{t("serviceNetwork")}</dt>
              <dd data-ok={snapshot.reportedNetwork === snapshot.network}>{snapshot.reportedNetwork || "—"}</dd>
            </div>
            <div>
              <dt>{t("responseSigner")}</dt>
              <dd data-ok={snapshot.responseSignerPinned}>{t(snapshot.responseSignerPinned ? "servicePinned" : "serviceNotPinned")}</dd>
            </div>
            <div>
              <dt>{t("serviceKey")}</dt>
              <dd data-ok={snapshot.keysMatch}>{t(snapshot.keysMatch ? "serviceBound" : "serviceNotBound")}</dd>
            </div>
            <div>
              <dt>{t("serviceCallback")}</dt>
              <dd data-ok={snapshot.callbackBound}>{t(snapshot.callbackBound ? "serviceBound" : "serviceNotBound")}</dd>
            </div>
            <div>
              <dt>{t("serviceQueue")}</dt>
              <dd>{snapshot.totalRequests == null ? "—" : `${snapshot.totalFulfilled ?? 0} / ${snapshot.totalRequests}`}</dd>
            </div>
            <div>
              <dt>{t("serviceFee")}</dt>
              <dd>{snapshot.requestFeeGas == null ? "—" : `${snapshot.requestFeeGas.toFixed(2)} GAS`}</dd>
            </div>
          </dl>
          <div className="vrf-service-contracts">
            <span><small>{snapshot.oracleContractName || "MorpheusOracle"}</small><strong>{shortValue(snapshot.oracleContract, 12, 8)}</strong></span>
            <span><small>{snapshot.callbackContractName || t("callbackConsumer")}</small><strong>{shortValue(snapshot.callbackConsumer, 12, 8)}</strong></span>
            <span><small>{t("responseSigner")}</small><strong>{shortValue(snapshot.responseSignerKey, 12, 8) || "—"}</strong></span>
            <span><small>{t("fulfillmentVerifier")}</small><strong>{shortValue(snapshot.contractVerifierKey, 12, 8) || "—"}</strong></span>
          </div>
          <OpenUiNotice
            className="vrf-service-notice"
            icon={snapshot.availability === "network-mismatch" ? <ShieldAlert size={17} /> : <KeyRound size={17} />}
            title={serviceTitle}
            type={snapshot.availability === "network-mismatch" || snapshot.availability === "unavailable" ? "warning" : "info"}
          >
            {snapshot.freshness === "stale"
              ? t("serviceCachedAt", { time: formatCheckedAt(snapshot.checkedAt) })
              : `${t("serviceAuthRequired")} ${t("serviceRoleSeparation")} ${!snapshot.workflowAdvertised ? t("serviceWorkflowMissing") : ""} ${t("serviceFreshAt", { time: formatCheckedAt(snapshot.checkedAt) })}`}
          </OpenUiNotice>
        </>
      ) : serviceBusy ? (
        <OpenUiNotice icon={<RefreshCw className="is-spinning" size={17} />} title={t("serviceChecking")}>
          {t("statusCheckingService")}
        </OpenUiNotice>
      ) : (
        <>
          <OpenUiNotice icon={<Activity size={17} />} title={t("serviceNotChecked")}>
            {t("serviceNotCheckedCopy")}
          </OpenUiNotice>
          <button
            className="vrf-inline-action vrf-inline-action--primary"
            type="button"
            onClick={() => void dispatch("refreshService")}
            disabled={serviceBusy}
          >
            <RefreshCw size={16} /> {t("refreshService")}
          </button>
        </>
      )}
    </OpenUiPanel>
  );

  const verifyPanel = (
    <OpenUiPanel
      className="vrf-drawer__panel"
      icon={<ShieldCheck size={18} />}
      title={t("verifyTitle")}
      subtitle={t("verifyCopy")}
    >
      <OpenUiTextArea
        className="vrf-response-field"
        label={t("responseLabel")}
        value={responseText}
        onChange={(event) => setResponseText(event.target.value)}
        placeholder={t("responsePlaceholder")}
        rows={8}
        maxLength={VRF_RESPONSE_LIMIT}
        spellCheck={false}
        disabled={actionKind === "verify"}
      />
      <button
        className="vrf-inline-action vrf-inline-action--primary"
        type="button"
        onClick={verifyResponse}
        disabled={!responseText.trim() || actionBusy}
      >
        {actionKind === "verify" ? <RefreshCw className="is-spinning" size={16} /> : <ShieldCheck size={16} />}
        {t(actionKind === "verify" ? "verifyingResponse" : "verifyResponse")}
      </button>
      {verification ? (
        <div className="vrf-verification" data-state={verification.status}>
          <header>
            <span>{verification.status === "verified" ? <CheckCircle2 size={19} /> : verification.status === "unbound" ? <ShieldAlert size={19} /> : <X size={19} />}</span>
            <div><strong>{t(verificationTitleKey(verification))}</strong><p>{t(verificationReasonKey(verification))}</p></div>
          </header>
          <ul>
            {verification.checks.map((check) => (
              <li key={check.key} data-state={check.status}>
                {check.status === "pass" ? <Check size={14} /> : check.status === "fail" ? <X size={14} /> : <ShieldAlert size={14} />}
                <span>{t(CHECK_LABELS[check.key])}</span>
                <strong>{t(check.status === "pass" ? "checkPass" : check.status === "fail" ? "checkFail" : "checkInfo")}</strong>
              </li>
            ))}
          </ul>
          <p className="vrf-verification__scope">{t("attestationLimited")}</p>
        </div>
      ) : (
        <OpenUiNotice className="vrf-empty" icon={<Dice5 size={17} />} title={t("verificationEmpty")}>
          {t("verificationEmptyCopy")}
        </OpenUiNotice>
      )}
    </OpenUiPanel>
  );

  const payloadPanel = draft ? (
    <OpenUiPanel
      className="vrf-drawer__panel"
      icon={<Braces size={18} />}
      title={t("exactPayloadTitle")}
      subtitle={t("exactPayloadCopy")}
    >
      <dl className="vrf-payload-meta">
        <div><dt>{t("method")}</dt><dd>{draft.method}</dd></div>
        <div><dt>{t("endpoint")}</dt><dd>{draft.endpoint}</dd></div>
        <div><dt>{t("targetChain")}</dt><dd>{draft.request.target_chain}</dd></div>
      </dl>
      <pre className="vrf-payload">{payloadText}</pre>
      <button className="vrf-inline-action" type="button" onClick={copyRequest}>
        {copiedFlag.active ? <CheckCircle2 size={15} /> : <ClipboardCopy size={15} />}
        {t(copiedFlag.active ? "copied" : "copyRequest")}
      </button>
    </OpenUiPanel>
  ) : null;

  const drawer = (
    <div className="vrf-drawer">
      <OpenUiSegmented
        className="vrf-drawer__switcher"
        segmentedClassName="vrf-drawer__switcher-group"
        label={t("panelTitle")}
        value={drawerMode}
        onChange={(value) => setDrawerMode(value as DrawerMode)}
        options={drawerModes.map((mode) => ({ value: mode.value, label: mode.label, disabled: mode.disabled }))}
      />
      {drawerMode === "request" && requestPanel}
      {drawerMode === "service" && servicePanel}
      {drawerMode === "verify" && verifyPanel}
      {drawerMode === "payload" && payloadPanel}
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="oracle-vrf-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("panelEyebrow"),
            title: t("panelTitle"),
            subtitle: t("heroCopy"),
            badges: (
              <>
                <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {networkLabel}</span>
                <span className="mx2-badge" data-tone={serviceNeedsAttention ? "warning" : "default"}>{serviceTitle}</span>
              </>
            ),
          }}
          scene={<div className="vrf-stage-layout">{scene}{requestBoard}</div>}
          score={[
            { label: t("statRequest"), value: draft ? t(draftPersisted ? "draftSaved" : "draftLocalOnly") : t("digestPlaceholder"), accent: true },
            { label: t("statService"), value: serviceTitle },
            { label: t("lastStatus"), value: lastStatus },
          ]}
          actions={{
            primary: {
              label: t("buildDraft"),
              icon: actionKind === "draft" ? <RefreshCw className="is-spinning" size={17} /> : <Sparkles size={17} />,
              onClick: buildDraft,
              loading: actionKind === "draft",
              disabled: actionBusy,
            },
            secondary: [
              {
                label: t("refreshService"),
                icon: <RefreshCw className={serviceBusy ? "is-spinning" : undefined} size={15} />,
                onClick: () => void dispatch("refreshService"),
                disabled: serviceBusy,
              },
              {
                label: copiedFlag.active ? t("copied") : t("copyRequest"),
                icon: copiedFlag.active ? <CheckCircle2 size={15} /> : <ClipboardCopy size={15} />,
                onClick: copyRequest,
                disabled: !draft,
              },
            ],
          }}
          drawerToggleLabel={t("drawerVerify")}
          drawer={{ title: t("panelTitle"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
