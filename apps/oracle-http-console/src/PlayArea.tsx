/**
 * PlayArea.tsx — oracle http console (v2 scene-driven rebuild)
 * Tool identity. The console IS the scene: a request builder with a status readout.
 */
import { useMemo, useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { useTransientFlag } from "@shared/components-react";
import type { ObservableState } from "@shared/react/context";
import {
  OpenUiPanel,
  OpenUiProvider,
  OpenUiSegmented,
  OpenUiTextArea,
  OpenUiTextField,
  PlayStage,
} from "@shared/components-react/v2";
import {
  appMeta,
  consoleConfig,
  MAX_ORACLE_HTTP_BODY_BYTES,
  MAX_ORACLE_HTTP_PATH_LENGTH,
  MAX_ORACLE_HTTP_URL_LENGTH,
  resolveOracleHttpEnvironment,
  validateOracleHttpBody,
  validateOracleHttpEndpoint,
  validateOracleHttpPath,
} from "./appConfig";
import {
  ArrowRight,
  Braces,
  CheckCircle2,
  Copy,
  FileJson,
  KeyRound,
  Link2,
  RadioTower,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<unknown>;
  launchContext?: { network?: string | null; params?: Record<string, string> };
}

function defaultFieldValue(key: string): string {
  const field = consoleConfig.fields.find((item) => item.key === key);
  return String(field?.defaultValue ?? "");
}

function compactValue(value: string, limit = 28): string {
  const text = String(value || "").trim();
  if (!text || text === "—") return "—";
  if (text.length <= limit) return text;
  const head = Math.max(8, Math.floor(limit * 0.55));
  const tail = Math.max(6, limit - head - 1);
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

function hostLabel(url: string, fallback: string): string {
  try {
    return new URL(url).host;
  } catch {
    return fallback;
  }
}

const PIPELINE_IMAGE = "http-oracle-pipeline.webp";
type DrawerMode = "overview" | "route" | "digest";
type HttpValues = {
  body: string;
  jsonPath: string;
  method: string;
  url: string;
};

function defaultValues(params: Record<string, string> = {}, network?: string | null): HttpValues {
  const environment = resolveOracleHttpEnvironment(network);
  return {
    body: params.body ?? defaultFieldValue("body"),
    jsonPath: params.jsonPath ?? defaultFieldValue("jsonPath") ?? "status",
    method: String(params.method ?? "").toUpperCase() === "POST" ? "POST" : defaultFieldValue("method") || "GET",
    url: params.url ?? environment.defaultUrl,
  };
}

interface RouteStep {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  active: boolean;
}

export default function PlayArea({ t, state, dispatch, launchContext }: PlayAreaProps) {
  const { str, num } = useStateBindings(state);
  const networkLabel = str("networkLabel");
  const endpointLabel = str("endpointLabel");
  const lastStatus = str("lastStatus", t("statusReady"));
  const lastDigest = str("lastDigest", t("digestPlaceholder"));
  const requestCount = num("requestCount");

  const [values, setValues] = useState<HttpValues>(() => defaultValues(launchContext?.params, launchContext?.network));
  // Shared transient "previewing" pulse (console kernel §S14) — replaces the
  // hand-rolled useState + timeout-ref + unmount-cleanup trio.
  const previewFlag = useTransientFlag(1200);
  const actionPreview = previewFlag.active;
  const copyFlag = useTransientFlag(1200);
  const [copying, setCopying] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("overview");
  const update = (key: keyof HttpValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    // Clear the host-shell digest as soon as an already-prepared draft is
    // edited. The scene also compares digests locally, so the receipt cannot
    // remain copyable while this handled action updates shared state.
    void dispatch("invalidateRequest").catch(() => undefined);
  };
  const setMethod = (method: string) => {
    update("method", method === "POST" ? "POST" : "GET");
  };
  const resetValues = () => {
    setValues(defaultValues(launchContext?.params, launchContext?.network));
    previewFlag.clear();
    copyFlag.clear();
    setCopying(false);
    void dispatch("resetRequest").catch(() => undefined);
  };

  function handleBuild() {
    if (!canPreview) return;
    previewFlag.trigger();
    void dispatch("buildRequest", {
      ...values,
      network: launchContext?.network ?? "",
    }).catch(() => undefined);
  }
  const method = values.method === "POST" ? "POST" : "GET";
  const url = values.url || endpointLabel || appMeta.endpointLabel;
  const jsonPath = values.jsonPath || "status";
  const bodyIncluded = method === "POST" && values.body.trim().length > 0;
  const pathValidation = validateOracleHttpPath(jsonPath);
  const canonicalPath = pathValidation.normalizedPath || jsonPath;
  const endpointValidation = validateOracleHttpEndpoint(url);
  const sourceReady = endpointValidation.valid;
  const pathReady = pathValidation.valid;
  const bodyValidation = validateOracleHttpBody(method, values.body);
  const bodyReady = bodyValidation.valid;
  const canPreview = sourceReady && pathReady && bodyReady;
  const currentResult = useMemo(
    () => consoleConfig.buildResult(
      { ...values, network: launchContext?.network ?? "" },
      t,
    ),
    [launchContext?.network, t, values],
  );
  const currentDigest = String(currentResult.payload.digest ?? "");
  const digestPlaceholder = t("digestPlaceholder");
  const hasPreviousDigest = Boolean(lastDigest && lastDigest !== digestPlaceholder);
  const digestReady = canPreview && hasPreviousDigest && lastDigest === currentDigest;
  const draftDirty = (hasPreviousDigest && !digestReady)
    || (!hasPreviousDigest && lastStatus === t("httpDraftChanged"));
  const blockedReason = !sourceReady
    ? t(endpointValidation.errorKey || "httpInvalidUrl")
    : !pathReady
      ? t("httpInvalidPath")
      : !bodyReady
        ? t(bodyValidation.errorKey)
        : "";
  const statusLabel = actionPreview
    ? t("previewingRequest")
    : draftDirty
      ? t("httpDraftChanged")
      : digestReady
        ? t("httpValidationReady")
        : canPreview
          ? t("httpInputsReady")
          : blockedReason;
  const runActionLabel = t("runAction");
  const primaryLabel = actionPreview
    ? t("previewingRequest")
    : runActionLabel === "runAction"
      ? t("buildRequest") || "Prepare Payload"
      : runActionLabel;
  const digestValue = digestReady ? compactValue(lastDigest, 36) : t("digestPlaceholder");
  const morpheusPayload = currentResult.payload.morpheusPayload as Record<string, unknown>;
  const copyPayload = () => {
    if (!digestReady || !morpheusPayload || copying) return;
    setCopying(true);
    void dispatch("copyPayload", JSON.stringify(morpheusPayload, null, 2))
      .then((copied) => {
        if (copied === true) copyFlag.trigger();
      })
      .catch(() => undefined)
      .finally(() => setCopying(false));
  };
  const detailsLabel = t("detailsLabel");
  const routeSteps: RouteStep[] = [
    {
      key: "source",
      icon: Link2,
      label: t("httpRouteSourceNode"),
      value: hostLabel(url, endpointLabel || appMeta.endpointLabel),
      detail: sourceReady ? t("httpUrlReadyHint") : blockedReason,
      active: sourceReady,
    },
    {
      key: "extractor",
      icon: Braces,
      label: t("httpRouteExtractNode"),
      value: canonicalPath,
      detail: pathReady ? t("httpPathReadyHint") : t("httpPathInvalidHint"),
      active: pathReady,
    },
    {
      key: "digest",
      icon: digestReady ? CheckCircle2 : KeyRound,
      label: t("httpRouteDigestNode"),
      value: digestValue,
      detail: digestReady ? lastDigest : draftDirty ? t("httpDraftChanged") : t("httpEmptyTitle"),
      active: digestReady,
    },
  ];
  const drawerModes: Array<{ id: DrawerMode; label: string; value: string }> = [
    { id: "overview", label: detailsLabel, value: statusLabel },
    { id: "route", label: t("httpFlowTitle"), value: hostLabel(url, endpointLabel || appMeta.endpointLabel) },
    { id: "digest", label: t("statDigest"), value: digestValue },
  ];
  const setDrawerModeSafe = (mode: string) => {
    if (drawerModes.some((item) => item.id === mode)) setDrawerMode(mode as DrawerMode);
  };
  const drawer = (
    <OpenUiProvider>
      <div className="oracle-http-drawer">
        <OpenUiSegmented
          className="oracle-http-drawer__switcher"
          segmentedClassName="oracle-http-drawer__switcher-group"
          label={detailsLabel}
          value={drawerMode}
          onChange={setDrawerModeSafe}
          options={drawerModes.map((mode) => ({
            value: mode.id,
            label: (
              <span className="oracle-http-drawer-tab">
                <span>{mode.label}</span>
                <strong>{mode.value}</strong>
              </span>
            ),
          }))}
        />

        {drawerMode === "overview" && (
          <OpenUiPanel
            className="oracle-http-drawer__panel"
            icon={<RadioTower size={18} strokeWidth={2.35} aria-hidden="true" />}
            title={t("httpRequestPlan")}
            subtitle={statusLabel}
          >
            <div className="oracle-http-composer" aria-label={t("httpRequestPlan")}>
              <OpenUiSegmented
                className="oracle-http-method-switch"
                segmentedClassName="oracle-http-method-switch__group"
                label={t("httpMethodTitle")}
                value={method}
                onChange={setMethod}
                options={[
                  {
                    value: "GET",
                    label: (
                      <span className="oracle-http-method-card">
                        <strong>GET</strong>
                        <small>{t("httpMethodGetHint")}</small>
                      </span>
                    ),
                  },
                  {
                    value: "POST",
                    label: (
                      <span className="oracle-http-method-card">
                        <strong>POST</strong>
                        <small>{t("httpMethodPostHint")}</small>
                      </span>
                    ),
                  },
                ]}
              />
              <div className="oracle-http-composer__grid">
                <OpenUiTextField
                  className="oracle-http-field oracle-http-field--url"
                  inputClassName="oracle-http-input oracle-http-input--url"
                  label={<><Link2 size={14} /> {t("url")}</>}
                  value={values.url}
                  onChange={(event) => update("url", event.target.value)}
                  placeholder={t("urlPlaceholder")}
                  hint={sourceReady ? t("httpUrlReadyHint") : blockedReason}
                  maxLength={MAX_ORACLE_HTTP_URL_LENGTH}
                  spellCheck={false}
                  mono
                />
                <OpenUiTextField
                  className="oracle-http-field oracle-http-field--path"
                  inputClassName="oracle-http-input oracle-http-input--path"
                  label={<><Braces size={14} /> {t("jsonPath")}</>}
                  value={values.jsonPath}
                  onChange={(event) => update("jsonPath", event.target.value)}
                  placeholder={t("jsonPathPlaceholder")}
                  hint={pathReady ? t("httpPathReadyHint") : t("httpPathInvalidHint")}
                  maxLength={MAX_ORACLE_HTTP_PATH_LENGTH}
                  spellCheck={false}
                  mono
                />
              </div>
              <OpenUiTextArea
                className="oracle-http-field oracle-http-field--body"
                textareaClassName="oracle-http-input oracle-http-input--body"
                label={<><FileJson size={14} /> {t("body")}</>}
                value={values.body}
                onChange={(event) => update("body", event.target.value)}
                placeholder={t("bodyPlaceholder")}
                hint={method !== "POST"
                  ? t("httpBodyGetHint")
                  : bodyReady
                    ? t("httpBodyPostHint")
                    : t(bodyValidation.errorKey)}
                disabled={method !== "POST"}
                maxLength={MAX_ORACLE_HTTP_BODY_BYTES}
                spellCheck={false}
              />
            </div>
            <dl className="oracle-http-drawer__facts">
              <div><dt>{t("lastStatus")}</dt><dd>{statusLabel}</dd></div>
              <div><dt>{t("method")}</dt><dd>{method}</dd></div>
              <div>
                <dt>{t("httpBodyState")}</dt>
                <dd>{!bodyReady
                  ? t(bodyValidation.errorKey)
                  : bodyIncluded
                    ? t("httpBodyIncluded")
                    : method === "POST"
                      ? t("httpBodyEmpty")
                      : t("httpBodyIgnored")}</dd>
              </div>
            </dl>
          </OpenUiPanel>
        )}

        {drawerMode === "route" && (
          <OpenUiPanel
            className="oracle-http-drawer__panel"
            icon={<Link2 size={18} strokeWidth={2.35} aria-hidden="true" />}
            title={t("httpFlowTitle")}
            subtitle={t("httpPipelineTitle")}
          >
            <ol className="oracle-http-drawer__route">
              {routeSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <li key={step.key} data-active={step.active ? "true" : "false"}>
                    <span aria-hidden="true"><Icon size={16} strokeWidth={2.35} /></span>
                    <div>
                      <strong>{step.label}</strong>
                      <code>{step.value}</code>
                      <small>{step.detail}</small>
                    </div>
                  </li>
                );
              })}
            </ol>
          </OpenUiPanel>
        )}

        {drawerMode === "digest" && (
          <OpenUiPanel
            className="oracle-http-drawer__panel"
            icon={<KeyRound size={18} strokeWidth={2.35} aria-hidden="true" />}
            title={t("httpResultPreview")}
            subtitle={digestReady ? t("httpValidationReady") : t("httpEmptyTitle")}
          >
            <div className="oracle-http-drawer__digest">
              <span>{t("statDigest")}</span>
              <code>{digestReady ? lastDigest : t("digestPlaceholder")}</code>
              <small>{digestReady ? t("httpEmptyCopy") : draftDirty ? t("httpDraftChanged") : t("httpPipelineCopy")}</small>
              <button
                type="button"
                className="oracle-http-copy-action"
                onClick={copyPayload}
                disabled={!digestReady || copying || copyFlag.active}
              >
                {copyFlag.active
                  ? <CheckCircle2 size={15} aria-hidden="true" />
                  : <Copy size={15} aria-hidden="true" />}
                <span>{copying ? t("copyingPayload") : copyFlag.active ? t("payloadCopied") : t("copyPayload")}</span>
              </button>
            </div>
          </OpenUiPanel>
        )}
      </div>
    </OpenUiProvider>
  );

  const scene = (
    <div className="oracle-console-scene oracle-http-workbench" data-state={actionPreview ? "building" : digestReady ? "ready" : "idle"}>
      <section className={["oracle-http-request", actionPreview ? "oracle-http-request--active mx2-float" : null].filter(Boolean).join(" ")} aria-label={t("httpRequestPlan")}>
        <header className="oracle-http-request__head">
          <span className="oracle-http-request__icon" aria-hidden="true"><RadioTower size={22} /></span>
          <div>
            <span>{t("httpPipelineTitle")}</span>
            <strong>{statusLabel}</strong>
          </div>
          <em>{method}</em>
        </header>

        <p className="oracle-http-request__copy">{t("httpPipelineCopy")}</p>

        <div className="oracle-http-track" aria-label={t("httpFlowTitle")}>
          {routeSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article key={step.key} className="oracle-http-track__item" data-active={step.active ? "true" : "false"}>
                <span className="oracle-http-track__icon" aria-hidden="true"><Icon size={17} strokeWidth={2.35} /></span>
                <span>{step.label}</span>
                <strong>{step.value}</strong>
                <small>{step.detail}</small>
                {index < routeSteps.length - 1 && <ArrowRight className="oracle-http-track__arrow" size={15} aria-hidden="true" />}
              </article>
            );
          })}
        </div>

        <div className="oracle-http-source-strip" aria-label={t("httpSignalsLabel")}>
          <span><FileJson size={14} aria-hidden="true" /> {t("httpSourceLabel")}</span>
          <code>{compactValue(url, 52)}</code>
        </div>
      </section>

      <aside className="oracle-http-lane" aria-label={t("httpRouteWorkbench")}>
        <figure className="oracle-http-lane__art" aria-hidden="true">
          <img src={PIPELINE_IMAGE} alt="" loading="eager" decoding="async" />
        </figure>
        <section className="oracle-http-receipt" aria-label={t("httpResultPreview")}>
          <header className="oracle-http-receipt__head">
            <span aria-hidden="true"><ShieldCheck size={18} /></span>
            <div>
              <span>{t("httpResultPreview")}</span>
              <strong>{digestValue}</strong>
            </div>
          </header>
          <dl className="oracle-http-receipt__facts">
            <div>
              <dt>{t("method")}</dt>
              <dd>{method}</dd>
            </div>
            <div>
              <dt>{t("jsonPath")}</dt>
              <dd>{canonicalPath}</dd>
            </div>
            <div>
              <dt>{t("statDigest")}</dt>
              <dd>{digestReady ? lastDigest : t("digestPlaceholder")}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  );

  return (
    <div className="oracle-console-play-area mx2 mx2-cat-tool">
      <PlayStage category="tool"
        stage={{ eyebrow: t(consoleConfig?.eyebrowKey || "panelEyebrow"), title: t(consoleConfig?.titleKey || "panelTitle"), subtitle: endpointLabel || "", badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {networkLabel || appMeta.networkLabel}</span> }}
        scene={scene}
        score={[{ label: t("statRequests"), value: String(requestCount), accent: true }, { label: t("lastStatus"), value: statusLabel }]}
        actions={{
          primary: {
            label: primaryLabel,
            onClick: () => void handleBuild(),
            loading: actionPreview,
            disabled: !canPreview || actionPreview,
            hint: canPreview ? undefined : blockedReason,
          },
          secondary: [
            { label: t("reset"), onClick: resetValues, disabled: actionPreview },
          ],
        }}
        drawerToggleLabel={detailsLabel} drawer={{ title: detailsLabel, children: drawer }}
      />
    </div>
  );
}
