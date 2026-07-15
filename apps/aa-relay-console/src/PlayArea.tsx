import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { ObservableState } from "@shared/react/context";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { CoinArt } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextArea as OpenUiTextArea,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import {
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  RadioTower,
  RotateCcw,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { resolveNeoNetwork } from "@shared/constants/rpc";
import { PhaseValue, resolvePhase } from "@shared/components-react/v2/DataPhase";
import { draftFingerprint, parseRelayDraft } from "./relay-job";
import "./PlayArea.scss";

interface P {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type DrawerMode = "request" | "package" | "receipt";

const RELAY_STATION_ART = "aa-relay-station.webp";

/**
 * Middle-elide a long identifier. Returns "" — never an em-dash — for an empty
 * value: "the visitor has not typed this yet" is a phase for <PhaseValue> to
 * render as zero-state copy, not a character this helper should invent. Every
 * caller passes the result through `resolvePhase({ hasData: Boolean(...) })`.
 */
function compact(value: string, head = 8, tail = 6): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.length <= head + tail + 1 ? raw : `${raw.slice(0, head)}…${raw.slice(-tail)}`;
}

/**
 * Draft-derived values have no read in flight: the console parses whatever is
 * currently in the local textareas. So a draft field is always "settled" — it
 * is either filled ("ready") or waiting on the visitor ("unavailable"). Passing
 * `loading: false` here is a statement of fact, not a shortcut: rendering a
 * shimmer for a field that is simply blank would be a lie about pending I/O.
 */
function draftPhase(value: string) {
  return resolvePhase({ loading: false, settled: true, hasData: Boolean(value) });
}

function stateCopy(t: P["t"], value: string): string {
  if (value === "review-ready") return t("reviewReady");
  if (value === "needs-authorization") return t("reviewNeedsAuthorization");
  if (value === "needs-chain-preview") return t("reviewNeedsPreview");
  if (value === "blocked") return t("reviewBlocked");
  return t("reviewDraft");
}

function outcomeCopy(t: P["t"], value: string): string {
  if (value === "confirmed") return t("chainConfirmed");
  if (value === "fault") return t("chainFault");
  if (value === "mismatch") return t("chainMismatch");
  if (value === "unreachable") return t("chainUnreachable");
  if (value === "pending") return t("chainPending");
  if (value === "accepted") return t("receiptAccepted");
  return t("chainNotTracked");
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool } = useStateBindings(state);
  const sourceAa = str("aaAddressInput");
  const sourceDapp = str("dappIdInput");
  const sourcePayload = str("payloadInput");
  const reviewPackageJson = str("reviewPackageJson");
  const reviewJobId = str("reviewJobId");
  const reviewDigest = str("reviewDigest");
  const reviewReadiness = str("reviewReadiness");
  const previewState = str("previewState");
  const targetDisplay = str("targetDisplay");
  const methodDisplay = str("methodDisplay");
  const preparedFingerprint = str("preparedFingerprint");
  const sponsorState = str("sponsorState");
  const sponsorSummary = str("sponsorSummary");
  const relayReceiptJson = str("relayReceiptJson");
  const receiptStatus = str("receiptStatus");
  const txidDisplay = str("txidDisplay");
  const chainStatus = str("chainStatus");
  const chainReason = str("chainReason");
  const confirmationsDisplay = str("confirmationsDisplay");
  const aaCoreDisplay = str("aaCoreDisplay");
  const paymasterDisplay = str("paymasterDisplay");
  const networkDisplay = str("networkDisplay");
  const runtimeMode = str("runtimeMode");
  const hasReview = bool("hasReview");
  const hasReceipt = bool("hasReceipt");
  const hasTrackableReceipt = bool("hasTrackableReceipt");
  const isPreparing = bool("isPreparing");
  const isCheckingSponsorship = bool("isCheckingSponsorship");
  const isTracking = bool("isTracking");

  const [draftAa, setDraftAa] = useState(sourceAa);
  const [draftDapp, setDraftDapp] = useState(sourceDapp);
  const [draftPayload, setDraftPayload] = useState(sourcePayload);
  const [receiptDraft, setReceiptDraft] = useState("");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("request");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) return;
    setDraftAa(sourceAa);
    setDraftDapp(sourceDapp);
    setDraftPayload(sourcePayload);
  }, [dirty, sourceAa, sourceDapp, sourcePayload]);

  const fingerprint = draftFingerprint(draftAa, draftDapp, draftPayload);
  const reviewStale = hasReview && preparedFingerprint !== fingerprint;
  const busy = isPreparing || isCheckingSponsorship || isTracking;
  const validation = useMemo(() => {
    try {
      const parsed = parseRelayDraft({
        network: resolveNeoNetwork(networkDisplay),
        aaCore: aaCoreDisplay,
        paymaster: paymasterDisplay,
        aaAddress: draftAa,
        dappId: draftDapp,
        payloadJson: draftPayload,
      });
      return { valid: true, message: t("requestLocallyValid"), parsed };
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : t("requestInvalid"),
        parsed: null,
      };
    }
  }, [aaCoreDisplay, draftAa, draftDapp, draftPayload, networkDisplay, paymasterDisplay, t]);

  // "Nothing entered yet" is the honest first-run state of this console: the
  // request summary reads a local draft, so before the visitor types there is no
  // data to show and nothing has failed. Keep it distinct from "typed something
  // that does not parse", which is the only case that earns a warning.
  //
  // Only the account and dApp id count as visitor input. `payloadJson` seeds
  // itself from `getDefaultRelayPayload(network)` (useAARelayConsole.ts:69), so
  // it is never empty and testing it here would make this flag dead — the draft
  // would read as "touched" on a form the visitor has not looked at yet.
  const pristineDraft = !draftAa.trim() && !draftDapp.trim();
  const aaAccountValue = compact(validation.parsed?.accountId || draftAa);
  const targetValue = compact(validation.parsed?.targetContract || targetDisplay);
  const methodValue = validation.parsed?.targetMethod || methodDisplay || "";

  const canUseReview = hasReview && !reviewStale;
  const primaryTracks = canUseReview && hasTrackableReceipt;
  const primaryLabel = primaryTracks
    ? isTracking ? t("trackingReceipt") : t("trackReceipt")
    : isPreparing ? t("preparingReview") : hasReview ? t("refreshReview") : t("prepareReview");
  const primaryDisabled = busy || (!primaryTracks && !validation.valid);

  const handlePrepare = () => {
    if (!validation.valid || busy) return;
    void dispatch("prepareReview", draftAa, draftDapp, draftPayload);
  };
  const handlePrimary = () => {
    if (primaryTracks) void dispatch("trackReceipt");
    else handlePrepare();
  };
  const handleSponsor = () => {
    if (!canUseReview || busy) return;
    void dispatch("checkSponsor", draftAa, draftDapp, draftPayload);
  };
  const handleImport = () => {
    if (!canUseReview || !receiptDraft.trim() || busy) return;
    void dispatch("importReceipt", receiptDraft);
  };
  const handleClear = () => {
    void dispatch("clearRelayJob");
    setReceiptDraft("");
    setDirty(true);
  };
  const selectDrawer = (value: string) => {
    if (["request", "package", "receipt"].includes(value)) setDrawerMode(value as DrawerMode);
  };
  const edit = (setter: (value: string) => void) => (value: string) => {
    setDirty(true);
    setter(value);
  };

  const lifecycle = [
    {
      key: "prepare",
      icon: FileCheck2,
      label: t("stepPrepare"),
      detail: reviewStale ? t("stepPrepareStale") : stateCopy(t, reviewReadiness),
      active: canUseReview,
      locked: false,
    },
    {
      key: "submit",
      icon: LockKeyhole,
      label: t("stepSubmit"),
      detail: t("stepSubmitExternal"),
      active: hasReceipt,
      locked: !hasReceipt,
    },
    {
      key: "receipt",
      icon: RadioTower,
      label: t("stepReceipt"),
      detail: hasReceipt ? (txidDisplay ? compact(txidDisplay) : receiptStatus) : t("stepReceiptWaiting"),
      active: hasReceipt,
      locked: false,
    },
    {
      key: "track",
      icon: chainStatus === "confirmed" ? CheckCircle2 : SearchCheck,
      label: t("stepTrack"),
      detail: outcomeCopy(t, chainStatus),
      active: ["confirmed", "fault", "mismatch", "unreachable", "pending"].includes(chainStatus),
      locked: !hasTrackableReceipt,
    },
  ];

  const scene = (
    <div className="aa-relay-scene" data-busy={busy ? "true" : undefined}>
      <figure className="aa-relay-scene__art">
        <img src={RELAY_STATION_ART} alt={t("relayHeroVisualAlt")} loading="eager" decoding="async" />
        <figcaption>
          <span>{t("relayDeskEyebrow")}</span>
          <strong>{t("relayDeskTitle")}</strong>
          <small>{t("relayDeskCopy")}</small>
        </figcaption>
        <span className="aa-relay-scene__mode"><ShieldCheck size={14} />{runtimeMode || "review-only"}</span>
      </figure>

      <div className="aa-relay-scene__workspace">
        <section className="aa-relay-scene__route" aria-label={t("requestSummary") }>
          <div className="aa-relay-scene__route-head">
            <span className="aa-relay-scene__route-icon"><ClipboardCheck size={21} /></span>
            <div><span>{t("requestSummary")}</span><strong>{validation.parsed?.targetMethod || t("requestWaiting")}</strong></div>
            {busy ? <LoaderCircle className="aa-relay-scene__spinner" size={18} /> : <ShieldCheck size={18} />}
          </div>
          <dl>
            <div>
              <dt>{t("aaAccount")}</dt>
              <dd>
                <PhaseValue phase={draftPhase(aaAccountValue)} placeholder={t("aaAccountIdle")}>
                  {aaAccountValue}
                </PhaseValue>
              </dd>
            </div>
            <div>
              <dt>{t("targetContract")}</dt>
              <dd>
                <PhaseValue phase={draftPhase(targetValue)} placeholder={t("targetContractIdle")}>
                  {targetValue}
                </PhaseValue>
              </dd>
            </div>
            <div>
              <dt>{t("targetMethod")}</dt>
              <dd>
                <PhaseValue phase={draftPhase(methodValue)} placeholder={t("targetMethodIdle")}>
                  {methodValue}
                </PhaseValue>
              </dd>
            </div>
            <div>
              <dt>{t("network")}</dt>
              <dd>
                <PhaseValue phase={draftPhase(networkDisplay)} placeholder={t("networkIdle")}>
                  {networkDisplay}
                </PhaseValue>
              </dd>
            </div>
          </dl>
          {/*
            A pristine draft is not an invalid one. `parseRelayDraft` throws on an
            empty form exactly as it does on a malformed one, so this line used to
            greet every first-time visitor with the amber "Request needs attention."
            before they had typed a character. Warning tone is reserved for a draft
            the visitor has actually started; an untouched form gets a neutral
            invitation instead.
          */}
          <p data-valid={validation.valid ? "true" : undefined} data-idle={pristineDraft ? "true" : undefined}>
            {pristineDraft
              ? t("requestPristine")
              : reviewStale
                ? t("reviewStale")
                : validation.valid
                  ? validation.message
                  : t("requestInvalid")}
          </p>
        </section>

        <section className="aa-relay-scene__lifecycle" aria-label={t("relayLifecycle") }>
          <header>
            <CoinArt size={36} variant="gas" decorative />
            <div><span>{t("relayLifecycle")}</span><strong>{t("lifecycleTitle")}</strong></div>
          </header>
          <div className="aa-relay-scene__steps">
            {lifecycle.map(({ key, icon: Icon, label, detail, active, locked }) => (
              <article key={key} data-active={active ? "true" : undefined} data-locked={locked ? "true" : undefined}>
                <span><Icon size={18} /></span>
                <div><strong>{label}</strong><small>{detail}</small></div>
              </article>
            ))}
          </div>
        </section>

        <aside className="aa-relay-scene__status" data-state={chainStatus}>
          <span>{t("currentState")}</span>
          <strong>{hasReceipt ? outcomeCopy(t, chainStatus) : stateCopy(t, reviewReadiness)}</strong>
          <p>{chainReason || t("runtimeBoundaryCopy")}</p>
          <dl>
            {/*
              Unlike the draft tiles above, this one DOES have a read in flight:
              `isPreparing` covers the round trip that mints the job id, so a
              shimmer there is truthful. Outside that window an absent job id
              just means the review has not been prepared yet.
            */}
            <div>
              <dt>{t("jobId")}</dt>
              <dd>
                <PhaseValue
                  phase={resolvePhase({
                    loading: isPreparing,
                    settled: !isPreparing,
                    hasData: Boolean(reviewJobId),
                  })}
                  placeholder={t("jobIdIdle")}
                  skeletonWidth="6em"
                >
                  {reviewJobId}
                </PhaseValue>
              </dd>
            </div>
            <div><dt>{t("confirmations")}</dt><dd>{confirmationsDisplay || "0"}</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );

  const requestPanel = (
    <OpenUiPanel
      className="aa-relay-drawer__panel"
      icon={<FileCheck2 size={18} aria-hidden="true" />}
      title={t("requestBuilder")}
      subtitle={t("requestBuilderCopy")}
    >
      <div className="aa-relay-drawer__grid">
        <OpenUiTextField
          className="aa-relay-drawer__field"
          label={t("aaAccount")}
          value={draftAa}
          onChange={(event) => edit(setDraftAa)(event.target.value)}
          placeholder={t("aaAccountPlaceholder")}
          hint={t("aaAccountHint")}
          mono
          spellCheck={false}
        />
        <OpenUiTextField
          className="aa-relay-drawer__field"
          label={t("dappId")}
          value={draftDapp}
          onChange={(event) => edit(setDraftDapp)(event.target.value)}
          placeholder={t("dappIdPlaceholder")}
          hint={t("dappIdHint")}
          mono
          spellCheck={false}
        />
      </div>
      <OpenUiTextArea
        className="aa-relay-drawer__field aa-relay-drawer__payload"
        label={t("advancedCallData")}
        value={draftPayload}
        onChange={(event) => edit(setDraftPayload)(event.target.value)}
        placeholder={t("payloadJsonPlaceholder")}
        hint={t("advancedCallDataHint")}
        rows={10}
        spellCheck={false}
      />
      <OpenUiNotice
        className="aa-relay-drawer__notice"
        icon={validation.valid ? <ShieldCheck size={18} /> : <FileCheck2 size={18} />}
        title={validation.valid ? t("requestLocallyValid") : t("requestNeedsWork")}
        type={validation.valid ? "info" : "warning"}
      >
        {validation.message}
      </OpenUiNotice>
    </OpenUiPanel>
  );

  const packagePanel = (
    <OpenUiPanel
      className="aa-relay-drawer__panel"
      icon={<ShieldCheck size={18} aria-hidden="true" />}
      title={t("reviewPackage")}
      subtitle={t("reviewPackageCopy")}
    >
      {hasReview ? (
        <>
          <dl className="aa-relay-drawer__facts">
            <div><dt>{t("jobId")}</dt><dd>{reviewJobId}</dd></div>
            <div><dt>{t("previewState")}</dt><dd>{previewState}</dd></div>
            <div><dt>{t("packageDigest")}</dt><dd>{compact(reviewDigest, 12, 8)}</dd></div>
            <div><dt>{t("sponsorStatus")}</dt><dd title={sponsorSummary}>{sponsorState}</dd></div>
          </dl>
          <textarea className="aa-relay-drawer__readonly" value={reviewPackageJson} readOnly aria-label={t("reviewPackageJson")} />
          <OpenUiNotice
            className="aa-relay-drawer__notice"
            icon={<LockKeyhole size={18} />}
            title={t("authorizedSubmitRequired")}
            type="warning"
          >
            {t("runtimeBoundaryCopy")}
          </OpenUiNotice>
        </>
      ) : (
        <OpenUiNotice icon={<FileCheck2 size={18} />} title={t("reviewDraft")} type="info">
          {t("reviewPackageEmpty")}
        </OpenUiNotice>
      )}
    </OpenUiPanel>
  );

  const receiptPanel = (
    <OpenUiPanel
      className="aa-relay-drawer__panel"
      icon={<SearchCheck size={18} aria-hidden="true" />}
      title={t("receiptRecovery")}
      subtitle={t("receiptRecoveryCopy")}
    >
      <OpenUiTextArea
        className="aa-relay-drawer__field aa-relay-drawer__receipt"
        label={t("receiptJson")}
        value={receiptDraft}
        onChange={(event) => setReceiptDraft(event.target.value)}
        placeholder={t("receiptJsonPlaceholder")}
        hint={t("receiptJsonHint")}
        rows={6}
        spellCheck={false}
      />
      <div className="aa-relay-drawer__actions">
        <button className="mx2-btn mx2-btn--primary" type="button" onClick={handleImport} disabled={!canUseReview || !receiptDraft.trim() || busy}>
          {t("importReceipt")}
        </button>
        <button className="mx2-btn mx2-btn--ghost" type="button" onClick={handleClear} disabled={!hasReview || busy}>
          <RotateCcw size={15} />{t("clearRecoveredJob")}
        </button>
      </div>
      {hasReceipt && (
        <>
          <textarea className="aa-relay-drawer__readonly aa-relay-drawer__readonly--receipt" value={relayReceiptJson} readOnly aria-label={t("currentReceipt")} />
          <OpenUiNotice icon={<RadioTower size={18} />} title={outcomeCopy(t, chainStatus)} type={chainStatus === "fault" || chainStatus === "mismatch" ? "warning" : "info"}>
            {chainReason}
          </OpenUiNotice>
        </>
      )}
    </OpenUiPanel>
  );

  const panels: Record<DrawerMode, ReactNode> = {
    request: requestPanel,
    package: packagePanel,
    receipt: receiptPanel,
  };
  const drawer = (
    <div className="aa-relay-drawer">
      <OpenUiSegmented
        className="aa-relay-drawer__tabs"
        segmentedClassName="aa-relay-drawer__tab-group"
        label={t("workspaceSections")}
        value={drawerMode}
        onChange={selectDrawer}
        options={[
          { value: "request", label: t("requestBuilder") },
          { value: "package", label: t("reviewPackage") },
          { value: "receipt", label: t("receiptRecovery") },
        ]}
      />
      {panels[drawerMode]}
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="aa-relay-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("relayStageKicker"),
            title: t("relayHeroTitle"),
            subtitle: t("relayStageTitle"),
          }}
          scene={scene}
          actions={{
            primary: {
              label: primaryLabel,
              onClick: handlePrimary,
              loading: primaryTracks ? isTracking : isPreparing,
              disabled: primaryDisabled,
            },
            secondary: [
              {
                label: isCheckingSponsorship ? t("checkingSponsor") : t("checkSponsorEvidence"),
                onClick: handleSponsor,
                disabled: !canUseReview || busy,
              },
            ],
          }}
          drawerToggleLabel={t("openJobWorkspace")}
          drawer={{ title: t("jobWorkspace"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
