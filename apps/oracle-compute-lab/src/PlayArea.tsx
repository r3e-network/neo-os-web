import { useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  CircleSlash2,
  Copy,
  Cpu,
  FileJson2,
  FileUp,
  Fingerprint,
  LockKeyhole,
  Network,
  ShieldCheck,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import {
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextArea as OpenUiTextArea,
} from "@shared/components-react/v2/OpenUiLite";
import {
  appMeta,
  DEFAULT_COMPUTE_SOURCE,
  DISCLOSURE_OPTIONS,
  PROFILE_OPTIONS,
} from "./appConfig";
import {
  inspectComputeSource,
  type ComputeProfile,
  type SourceDisclosure,
} from "./compute-workbench";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type DrawerMode = "source" | "package" | "route";

const COMPUTE_STAGE_IMAGE = new URL(
  "../public/compute-privacy-stage.webp",
  import.meta.url,
).href;

function compactDigest(value: string, fallback: string): string {
  const digest = String(value || "").trim();
  if (!digest) return fallback;
  if (digest.length <= 34) return digest;
  return `${digest.slice(0, 18)}…${digest.slice(-12)}`;
}

function optionText(
  options: Array<{ value: string; labelKey: string; hintKey: string }>,
  value: string,
  key: "labelKey" | "hintKey",
  t: PlayAreaProps["t"],
): string {
  const option = options.find((candidate) => candidate.value === value) ?? options[0];
  return option ? t(option[key]) : value;
}

function shapeText(shape: string, t: PlayAreaProps["t"]): string {
  if (shape.startsWith("object:")) {
    const keys = shape.slice("object:".length);
    return t("sourceShapeObject", { keys: keys === "empty" ? "—" : keys.replaceAll(",", " · ") });
  }
  if (shape.startsWith("array:")) {
    return t("sourceShapeArray", { count: shape.slice("array:".length) });
  }
  return t("sourceShapeValue");
}

function sourceErrorText(
  inspection: ReturnType<typeof inspectComputeSource>,
  t: PlayAreaProps["t"],
): string {
  if (inspection.valid) return "";
  if (inspection.error === "source_required") return t("sourceRequired");
  if (inspection.error === "source_too_large") return t("sourceTooLarge");
  if (inspection.error === "source_too_deep") return t("sourceTooDeep");
  if (inspection.error === "source_unsafe_number") return t("sourceUnsafeNumber");
  return t("sourceInvalidJson");
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, num, bool } = useStateBindings(state);
  const [profile, setProfile] = useState<ComputeProfile>("risk-signal");
  const [disclosure, setDisclosure] = useState<SourceDisclosure>("digest-only");
  const [source, setSource] = useState(DEFAULT_COMPUTE_SOURCE);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("source");

  const inspection = useMemo(() => inspectComputeSource(source), [source]);
  const packageState = str("packageState", "draft");
  const isPreparing = bool("isPreparing");
  const requestDigest = str("requestDigest");
  const inputDigest = str("inputDigest");
  const requestPackage = str("requestPackage");
  const requestCount = num("requestCount");
  const lastStatus = str("lastStatus", t("statusReady"));
  const networkLabel = str("networkLabel", appMeta.networkLabel);
  const endpointLabel = str("endpointLabel", appMeta.endpointLabel);
  const runtimeBaseUrl = str("runtimeBaseUrl", appMeta.runtimeBaseUrl);
  const oracleContract = str("oracleContract", appMeta.oracleContract);
  const envelopeVersion = str("envelopeVersion", appMeta.envelopeVersion);
  const workflow = str("workflow", appMeta.workflow);
  const route = str("route", appMeta.route);
  const policiesLabel = str("policiesLabel", appMeta.policiesLabel);
  const teeRequired = bool("teeRequired");
  const deliveryMode = str("deliveryMode", appMeta.deliveryMode);
  const requestDigestScope = str("requestDigestScope", appMeta.requestDigestScope);
  const packageReady = packageState === "ready" && Boolean(requestPackage);
  const sourceError = sourceErrorText(inspection, t);

  const dispatchSafely = (name: string, ...args: unknown[]) => {
    void dispatch(name, ...args).catch(() => undefined);
  };

  const invalidatePrepared = () => {
    // Always invalidate on edit. Observable updates can render one frame after
    // a hash starts, so checking a captured packageState here can otherwise let
    // the old result land after the user has already changed the source.
    dispatchSafely("invalidateRequest");
  };

  const updateProfile = (value: string) => {
    if (!PROFILE_OPTIONS.some((option) => option.value === value)) return;
    invalidatePrepared();
    setProfile(value as ComputeProfile);
  };

  const updateDisclosure = (value: string) => {
    if (!DISCLOSURE_OPTIONS.some((option) => option.value === value)) return;
    invalidatePrepared();
    setDisclosure(value as SourceDisclosure);
  };

  const updateSource = (value: string) => {
    invalidatePrepared();
    setSource(value);
  };

  const prepareRequest = () => {
    if (!inspection.valid || isPreparing) return;
    dispatchSafely("prepareRequest", { profile, disclosure, source });
  };

  const profileHint = optionText(PROFILE_OPTIONS, profile, "hintKey", t);
  const disclosureLabel = optionText(DISCLOSURE_OPTIONS, disclosure, "labelKey", t);
  const disclosureHint = optionText(DISCLOSURE_OPTIONS, disclosure, "hintKey", t);
  const visibleRequestDigest = compactDigest(requestDigest, t("noDigest"));
  const visibleInputDigest = compactDigest(inputDigest, t("noDigest"));

  const scene = (
    <div className="compute-workbench" data-state={packageState}>
      <section className="compute-source-stage" aria-labelledby="compute-source-stage-title">
        <figure className="compute-source-stage__visual">
          <img src={COMPUTE_STAGE_IMAGE} alt={t("sourceImageAlt")} loading="eager" decoding="async" />
          <figcaption className="compute-source-stage__badge" data-disclosure={disclosure}>
            {disclosure === "digest-only"
              ? <LockKeyhole size={15} strokeWidth={2.35} aria-hidden="true" />
              : <FileUp size={15} strokeWidth={2.35} aria-hidden="true" />}
            {disclosure === "digest-only" ? t("sourceLocalBadge") : t("sourcePublicBadge")}
          </figcaption>
        </figure>
        <div className="compute-source-stage__copy">
          <span className="compute-section-icon" aria-hidden="true">
            <FileJson2 size={19} strokeWidth={2.25} />
          </span>
          <div>
            <span>{t("sourceStageTitle")}</span>
            <strong id="compute-source-stage-title">{t("sourceStageCopy")}</strong>
          </div>
        </div>
      </section>

      <section className="compute-policy-board" aria-label={t("policyTitle")}>
        <header className="compute-policy-board__head">
          <div>
            <span>{t("policyTitle")}</span>
            <strong>{lastStatus}</strong>
          </div>
          <span className="compute-policy-board__state" data-ready={inspection.valid ? "true" : "false"}>
            {inspection.valid ? t("sourceValid") : t("sourceNeedsFix")}
          </span>
        </header>

        <article className="compute-source-ticket" data-valid={inspection.valid ? "true" : "false"}>
          <span className="compute-source-ticket__icon" aria-hidden="true">
            <FileJson2 size={18} strokeWidth={2.25} />
          </span>
          <div>
            <span>{t("sourceJson")}</span>
            <strong>{inspection.valid ? shapeText(inspection.shape, t) : t("sourceNeedsFix")}</strong>
          </div>
          <small>{t("sourceBytes", { count: inspection.byteLength })}</small>
        </article>
        {sourceError && <p className="compute-source-error" role="alert">{sourceError}</p>}

        <div className="compute-policy-control">
          <div className="compute-policy-control__label">
            <Cpu size={15} strokeWidth={2.25} aria-hidden="true" />
            <span>{t("profileLabel")}</span>
          </div>
          <OpenUiSegmented
            className="compute-profile-switch"
            segmentedClassName="compute-profile-switch__group"
            label={t("profileLabel")}
            value={profile}
            onChange={updateProfile}
            options={PROFILE_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
          />
          <small>{profileHint}</small>
        </div>

        <div className="compute-policy-control compute-policy-control--disclosure">
          <div className="compute-policy-control__label">
            <ShieldCheck size={15} strokeWidth={2.25} aria-hidden="true" />
            <span>{t("disclosureLabel")}</span>
          </div>
          <OpenUiSegmented
            className="compute-disclosure-switch"
            segmentedClassName="compute-disclosure-switch__group"
            label={t("disclosureLabel")}
            value={disclosure}
            onChange={updateDisclosure}
            options={DISCLOSURE_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
          />
          <small>{disclosureHint}</small>
        </div>

        <article className="compute-package-ticket" data-ready={packageReady ? "true" : "false"}>
          <span className="compute-package-ticket__icon" aria-hidden="true">
            <Fingerprint size={19} strokeWidth={2.25} />
          </span>
          <div>
            <span>{t("packageDigestLabel")}</span>
            <code>{visibleRequestDigest}</code>
          </div>
          <strong>{packageReady ? t("flowPrepared") : t("flowDraft")}</strong>
        </article>
      </section>

      <ol className="compute-flow" aria-label={t("flowLabel")}>
        <li data-complete={inspection.valid ? "true" : "false"}>
          <span>01</span>
          <div><strong>{t("flowSource")}</strong><small>{inspection.valid ? t("flowReady") : t("flowDraft")}</small></div>
        </li>
        <ArrowRight className="compute-flow__arrow" size={17} aria-hidden="true" />
        <li data-complete="true">
          <span>02</span>
          <div><strong>{t("flowPolicy")}</strong><small>{disclosureLabel}</small></div>
        </li>
        <ArrowRight className="compute-flow__arrow" size={17} aria-hidden="true" />
        <li data-complete={packageReady ? "true" : "false"}>
          <span>03</span>
          <div><strong>{t("flowPackage")}</strong><small>{packageReady ? t("flowPrepared") : t("flowDraft")}</small></div>
        </li>
        <ArrowRight className="compute-flow__arrow" size={17} aria-hidden="true" />
        <li data-boundary="true">
          <span>04</span>
          <div><strong>{t("flowBoundary")}</strong><small>{t("flowNotRun")}</small></div>
        </li>
      </ol>

      <section className="compute-runtime-boundary" aria-labelledby="compute-runtime-boundary-title">
        <span className="compute-runtime-boundary__icon" aria-hidden="true">
          <CircleSlash2 size={22} strokeWidth={2.2} />
        </span>
        <div className="compute-runtime-boundary__copy">
          <span>{t("boundaryTitle")}</span>
          <strong id="compute-runtime-boundary-title">{t("boundaryHeadline")}</strong>
          <p>{t("boundaryCopy")}</p>
        </div>
        <dl className="compute-runtime-boundary__facts">
          <div><dt>{t("boundaryResult")}</dt><dd>{t("unavailable")}</dd></div>
          <div><dt>{t("boundaryProof")}</dt><dd>{t("unavailable")}</dd></div>
          <div><dt>{t("boundaryAttestation")}</dt><dd>{t("unavailable")}</dd></div>
        </dl>
        <small className="compute-runtime-boundary__recovery">{t("boundaryRecovery")}</small>
      </section>
    </div>
  );

  const drawerModes: Array<{ value: DrawerMode; label: string }> = [
    { value: "source", label: t("drawerSource") },
    { value: "package", label: t("drawerPackage") },
    { value: "route", label: t("drawerRoute") },
  ];

  const drawer = (
    <div className="compute-drawer">
      <OpenUiSegmented
        className="compute-drawer__switcher"
        segmentedClassName="compute-drawer__switcher-group"
        label={t("workbenchDetails")}
        value={drawerMode}
        onChange={(value) => {
          if (drawerModes.some((mode) => mode.value === value)) setDrawerMode(value as DrawerMode);
        }}
        options={drawerModes.map((mode) => ({ value: mode.value, label: mode.label }))}
      />

      {drawerMode === "source" && (
        <OpenUiPanel
          className="compute-drawer__panel"
          icon={<FileJson2 size={18} strokeWidth={2.25} aria-hidden="true" />}
          title={t("sourceEditorTitle")}
          subtitle={t("sourceEditorHint")}
        >
          <div className="compute-source-editor">
            <OpenUiTextArea
              className="compute-source-editor__field"
              textareaClassName="compute-source-editor__input"
              label={t("sourceJson")}
              value={source}
              onChange={(event) => updateSource(event.target.value)}
              placeholder="{}"
              spellCheck={false}
              hint={sourceError || t("sourceBytes", { count: inspection.byteLength })}
            />
            <aside className="compute-source-editor__boundary" data-disclosure={disclosure}>
              <ShieldCheck size={20} strokeWidth={2.2} aria-hidden="true" />
              <span>{t("sourcePreviewTitle")}</span>
              <strong>{disclosureLabel}</strong>
              <p>{disclosure === "digest-only"
                ? t("sourceRedacted")
                : inspection.valid ? shapeText(inspection.shape, t) : t("sourceNeedsFix")}</p>
              <small>{disclosureHint}</small>
            </aside>
          </div>
        </OpenUiPanel>
      )}

      {drawerMode === "package" && (
        <OpenUiPanel
          className="compute-drawer__panel"
          icon={<Boxes size={18} strokeWidth={2.25} aria-hidden="true" />}
          title={t("packageTitle")}
          subtitle={packageReady ? t("packageCopyReady") : t("packageEmpty")}
        >
          <dl className="compute-package-facts">
            <div><dt>{t("inputDigestLabel")}</dt><dd><code>{visibleInputDigest}</code></dd></div>
            <div><dt>{t("packageDigestLabel")}</dt><dd><code>{visibleRequestDigest}</code></dd></div>
            <div><dt>{t("packageCountLabel")}</dt><dd>{requestCount}</dd></div>
            <div><dt>{t("packageScopeLabel")}</dt><dd title={requestDigestScope}>{t("packageScopeValue")}</dd></div>
          </dl>
          <pre className="compute-package-json" data-empty={packageReady ? "false" : "true"}>
            {packageReady ? requestPackage : t("packageEmpty")}
          </pre>
        </OpenUiPanel>
      )}

      {drawerMode === "route" && (
        <OpenUiPanel
          className="compute-drawer__panel"
          icon={<Network size={18} strokeWidth={2.25} aria-hidden="true" />}
          title={t("routeTitle")}
          subtitle={t("routeCopy")}
        >
          <dl className="compute-route-facts">
            <div><dt>{t("routeWorkflow")}</dt><dd><code>{workflow}</code></dd></div>
            <div><dt>{t("routeEndpoint")}</dt><dd><code>{route}</code></dd></div>
            <div><dt>{t("routeRuntime")}</dt><dd>{runtimeBaseUrl}</dd></div>
            <div><dt>{t("routeEnvelope")}</dt><dd>{envelopeVersion}</dd></div>
            <div><dt>{t("routePolicies")}</dt><dd>{policiesLabel}</dd></div>
            <div><dt>{t("routeTee")}</dt><dd>{t(teeRequired ? "yes" : "no")}</dd></div>
            <div><dt>{t("routeDelivery")}</dt><dd>{deliveryMode}</dd></div>
            <div className="compute-route-facts__wide"><dt>{t("routeContract")}</dt><dd><code>{oracleContract}</code></dd></div>
          </dl>
        </OpenUiPanel>
      )}
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="oracle-compute-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("panelEyebrow"),
            title: t("panelTitle"),
            subtitle: t("panelSubtitle"),
            badges: (
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" />
                {t("networkTargetBadge")} · {networkLabel}
              </span>
            ),
          }}
          scene={scene}
          score={[
            { label: t("packageCountLabel"), value: String(requestCount), accent: packageReady },
            { label: t("routeWorkflow"), value: endpointLabel },
          ]}
          actions={{
            primary: {
              label: isPreparing ? t("preparingAction") : t("prepareAction"),
              onClick: prepareRequest,
              disabled: !inspection.valid || isPreparing,
              loading: isPreparing,
              icon: <Boxes size={18} strokeWidth={2.35} aria-hidden="true" />,
            },
            secondary: [
              {
                label: t("copyPackage"),
                onClick: () => dispatchSafely("copyRequestPackage"),
                disabled: !packageReady,
                icon: <Copy size={17} strokeWidth={2.25} aria-hidden="true" />,
              },
            ],
          }}
          drawerToggleLabel={t("workbenchDetails")}
          drawer={{ title: t("workbenchDetails"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
