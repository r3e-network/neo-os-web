/**
 * PlayArea.tsx - Oracle Compute Lab.
 *
 * Clean task desk: the compute package is the foreground, while the generated
 * art is kept as a small supporting resource preview instead of a full backdrop.
 */
import { useEffect, useRef, useState } from "react";
import {
  Braces,
  CheckCircle2,
  Cpu,
  Eye,
  Fingerprint,
  Network,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import {
  OpenUiPanel,
  OpenUiProvider,
  OpenUiSegmented,
  OpenUiTextArea,
  PlayStage,
} from "@shared/components-react/v2";
import { consoleConfig, appMeta } from "./appConfig";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface PipelineItem {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  active?: boolean;
}

const COMPUTE_STAGE_IMAGE = new URL("../public/compute-privacy-stage.webp", import.meta.url).href;
type DrawerMode = "receipt" | "route" | "payload";
const WORKFLOW_HINT_KEYS: Record<string, string> = {
  "risk-score": "workflowRiskHint",
  "proof-check": "workflowProofHint",
  "batch-transform": "workflowBatchHint",
};

function defaultFieldValue(key: string): string {
  const field = consoleConfig.fields.find((item) => item.key === key);
  return String(field?.defaultValue ?? "");
}

function optionLabel(
  fieldKey: string,
  value: string,
  t: (key: string, p?: Record<string, string | number>) => string,
): string {
  const field = consoleConfig.fields.find((item) => item.key === fieldKey);
  const option = field?.options?.find((item) => item.value === value);
  if (option?.labelKey) return t(option.labelKey);
  if (option?.label) return option.label;
  return value || t("notAvailable");
}

function compactDigest(value: string, placeholder: string): string {
  const text = String(value || "").trim();
  if (!text || text === placeholder) return placeholder;
  if (text.length <= 28) return text;
  return `${text.slice(0, 14)}...${text.slice(-10)}`;
}

function compactPayload(value: string): string {
  const text = String(value || "").trim();
  if (!text) return "{}";
  if (text.length <= 72) return text;
  return `${text.slice(0, 42)}...${text.slice(-20)}`;
}

function isValidJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, num } = useStateBindings(state);
  const networkLabel = str("networkLabel");
  const endpointLabel = str("endpointLabel");
  const lastStatus = str("lastStatus", t("statusReady"));
  const digestPlaceholder = t("digestPlaceholder");
  const lastDigest = str("lastDigest", digestPlaceholder);
  const requestCount = num("requestCount");

  const [actionPreview, setActionPreview] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("receipt");
  const [workflow, setWorkflow] = useState(defaultFieldValue("workflow") || "risk-score");
  const [privacy, setPrivacy] = useState(defaultFieldValue("privacy") || "sealed");
  const [inputPayload, setInputPayload] = useState(defaultFieldValue("input") || "{}");
  const previewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (previewTimeout.current) clearTimeout(previewTimeout.current);
    },
    [],
  );

  const startPreview = () => {
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    setActionPreview(true);
    previewTimeout.current = setTimeout(() => {
      setActionPreview(false);
      previewTimeout.current = null;
    }, 1200);
  };

  const handleBuild = () => {
    startPreview();
    void dispatch("buildRequest", { workflow, privacy, input: inputPayload });
  };

  const inputReady = isValidJson(inputPayload);
  const workflowLabel = optionLabel("workflow", workflow, t);
  const privacyLabel = optionLabel("privacy", privacy, t);
  const workflowOptions = consoleConfig.fields.find((field) => field.key === "workflow")?.options ?? [];
  const privacyOptions = consoleConfig.fields.find((field) => field.key === "privacy")?.options ?? [];
  const capsuleModeLabel = t("computePreviewOnly");
  const digestReady = Boolean(lastDigest && lastDigest !== digestPlaceholder);
  const visibleDigest = compactDigest(lastDigest, digestPlaceholder);
  const pipelineStatus = actionPreview
    ? t("computePipelineReady")
    : digestReady
      ? t("computePipelineBuilt")
      : inputReady
        ? t("computePipelineReady")
        : t("computePipelineDraft");
  const primaryLabel = actionPreview
    ? t("computeBuildActive")
    : t(consoleConfig.primaryActionKey || "buildRequest");
  const inputVisibility = privacy === "public" ? t("inputPublic") : t("inputRedacted");
  const inputVisibilityCopy = privacy === "public"
    ? t("computeInputPublicCopy")
    : t("computeInputSealedCopy");
  const payloadPreview = privacy === "public" ? compactPayload(inputPayload) : t("inputRedacted");
  const drawerModes: Array<{ id: DrawerMode; label: string; value: string }> = [
    { id: "receipt", label: t("computeReceipt"), value: visibleDigest },
    { id: "route", label: t("computeDrawerRouteTitle"), value: endpointLabel || appMeta.endpointLabel },
    { id: "payload", label: t("computeInputTitle"), value: t("computeInputBytes", { count: inputPayload.length }) },
  ];
  const setDrawerModeSafe = (mode: string) => {
    if (drawerModes.some((item) => item.id === mode)) setDrawerMode(mode as DrawerMode);
  };

  const pipeline: PipelineItem[] = [
    {
      key: "workflow",
      icon: Cpu,
      label: t("computePipelineWorkflow"),
      value: workflowLabel,
      detail: t(WORKFLOW_HINT_KEYS[workflow] ?? "workflowRiskHint"),
      active: true,
    },
    {
      key: "privacy",
      icon: ShieldCheck,
      label: t("computePipelinePrivacy"),
      value: privacyLabel,
      detail:
        privacy === "public" ? t("privacyPublicHint") : t("privacySealedHint"),
      active: privacy !== "public",
    },
    {
      key: "input",
      icon: Braces,
      label: t("computePipelineInput"),
      value: inputReady ? t("yes") : t("no"),
      detail: inputReady ? t("computeInputReadyHint") : t("computeInputInvalidHint"),
      active: inputReady,
    },
    {
      key: "digest",
      icon: Fingerprint,
      label: t("computePipelineDigest"),
      value: visibleDigest,
      detail: digestReady ? lastDigest : t("computeEmptyCopy"),
      active: digestReady,
    },
  ];

  const scene = (
    <div
      className="oracle-compute-desk"
      data-state={actionPreview ? "building" : digestReady ? "ready" : "idle"}
    >
      <section className="compute-request-card" aria-label={t("computePlan")}>
        <header className="compute-request-card__head">
          <span className="compute-request-card__icon" aria-hidden="true">
            <Cpu size={22} strokeWidth={2.3} />
          </span>
          <div>
            <span>{t("computePipelineKicker")}</span>
            <strong>{lastStatus}</strong>
          </div>
          <span className="compute-request-card__badge">
            <span className="compute-status-dot" />
            {pipelineStatus}
          </span>
        </header>

        <p className="compute-request-card__copy">{t("computePlanCopy")}</p>

        <div className="compute-control-deck" aria-label={t("computeControlsLabel")}>
          <section className="compute-choice-panel" aria-label={t("workflow")}>
            <div className="compute-choice-panel__head">
              <Cpu size={15} strokeWidth={2.35} aria-hidden="true" />
              <span>{t("computeWorkflowTitle")}</span>
            </div>
            <OpenUiSegmented
              className="compute-option-grid"
              segmentedClassName="compute-option-grid__group"
              label={t("workflow")}
              value={workflow}
              onChange={setWorkflow}
              options={workflowOptions.map((option) => ({
                value: option.value,
                label: (
                  <span className="compute-option-card">
                    <strong>{optionLabel("workflow", option.value, t)}</strong>
                    <small>{t(WORKFLOW_HINT_KEYS[option.value] ?? "workflowRiskHint")}</small>
                  </span>
                ),
              }))}
            />
          </section>

          <section className="compute-choice-panel" aria-label={t("privacy")}>
            <div className="compute-choice-panel__head">
              <ShieldCheck size={15} strokeWidth={2.35} aria-hidden="true" />
              <span>{t("computePrivacyTitle")}</span>
            </div>
            <OpenUiSegmented
              className="compute-privacy-switch"
              segmentedClassName="compute-privacy-switch__group"
              label={t("privacy")}
              value={privacy}
              onChange={setPrivacy}
              options={privacyOptions.map((option) => {
                const Icon = option.value === "public" ? Eye : ShieldCheck;
                return {
                  value: option.value,
                  label: (
                    <span className="compute-privacy-card">
                      <Icon size={16} strokeWidth={2.35} aria-hidden="true" />
                      <span>
                        <strong>{optionLabel("privacy", option.value, t)}</strong>
                        <small>{option.value === "public" ? t("privacyPublicHint") : t("privacySealedHint")}</small>
                      </span>
                    </span>
                  ),
                };
              })}
            />
          </section>

          <section
            className="compute-payload-card"
            data-valid={inputReady ? "true" : "false"}
            data-visibility={privacy}
          >
            <div className="compute-payload-card__head">
              <span>
                <Braces size={15} strokeWidth={2.35} aria-hidden="true" />
                {t("computeInputTitle")}
              </span>
              <strong>{inputVisibility}</strong>
            </div>
            <div className="compute-payload-card__preview">
              <span>{t("computeVisibility")}</span>
              <code>{payloadPreview}</code>
            </div>
            <div className="compute-payload-card__metric">
              <span>{t("computeInputBytes", { count: inputPayload.length })}</span>
              <strong>{inputReady ? t("yes") : t("no")}</strong>
            </div>
            <small>{inputReady ? t("computeInputReadyHint") : t("computeInputInvalidHint")}</small>
          </section>
        </div>

        <div className="compute-pipeline" aria-label={t("computePipelineLabel")}>
          {pipeline.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.key}
                className="compute-pipeline__item"
                data-active={item.active ? "true" : "false"}
              >
                <span className="compute-pipeline__icon" aria-hidden="true">
                  <Icon size={17} strokeWidth={2.35} />
                </span>
                <span className="compute-pipeline__label">{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            );
          })}
        </div>

        <div className="compute-receipt-strip" aria-label={t("computeReceipt")}>
          <span>{t("statDigest")}</span>
          <code>{visibleDigest}</code>
        </div>
      </section>

      <aside className="compute-side-panel" aria-label={t("computeCapsuleTitle")}>
        <figure className="compute-stage-art" aria-hidden="true">
          <img src={COMPUTE_STAGE_IMAGE} alt="" loading="eager" decoding="async" />
        </figure>

        <section className="compute-capsule-card">
          <div className="compute-capsule-card__head">
            <span className="compute-capsule-card__icon" aria-hidden="true">
              <CheckCircle2 size={18} strokeWidth={2.35} />
            </span>
            <div>
              <span>{t("computeCapsuleTitle")}</span>
              <strong>{t("computeVisibility")}: {privacyLabel}</strong>
            </div>
          </div>
          <p>{t("computeCapsuleCopy")}</p>
          <dl className="compute-capsule-card__facts">
            <div>
              <dt>{t("statRequests")}</dt>
              <dd>{requestCount}</dd>
            </div>
            <div>
              <dt>{t("statEndpoint")}</dt>
              <dd>{capsuleModeLabel}</dd>
            </div>
            <div>
              <dt>{t("statNetwork")}</dt>
              <dd>{networkLabel || appMeta.networkLabel}</dd>
            </div>
          </dl>
        </section>

        <section className="compute-route-card" aria-label={t("computePipelineLabel")}>
          <Network size={17} strokeWidth={2.35} aria-hidden="true" />
          <span>{t("statEndpoint")}</span>
          <strong>{endpointLabel || appMeta.endpointLabel}</strong>
        </section>
      </aside>
    </div>
  );

  const drawer = (
    <div className="compute-drawer">
      <OpenUiSegmented
        className="compute-drawer__switcher"
        segmentedClassName="compute-drawer__switcher-group"
        label={t("detailsLabel")}
        value={drawerMode}
        onChange={setDrawerModeSafe}
        options={drawerModes.map((mode) => ({
          value: mode.id,
          label: (
            <span className="compute-drawer-tab">
              <span>{mode.label}</span>
              <strong>{mode.value}</strong>
            </span>
          ),
        }))}
      />

      {drawerMode === "receipt" && (
        <OpenUiPanel
          className="compute-drawer__panel"
          icon={<CheckCircle2 size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("computeReceipt")}
          subtitle={digestReady ? t("computePipelineBuilt") : t("computeDrawerNoDigest")}
        >
          <dl className="compute-drawer__facts">
            <div>
              <dt>{t("computePipelineWorkflow")}</dt>
              <dd>{workflowLabel}</dd>
            </div>
            <div>
              <dt>{t("computePipelinePrivacy")}</dt>
              <dd>{privacyLabel}</dd>
            </div>
            <div>
              <dt>{t("computePipelineInput")}</dt>
              <dd>{inputReady ? t("computeValidationReady") : t("computePipelineDraft")}</dd>
            </div>
            <div>
              <dt>{t("computePipelineDigest")}</dt>
              <dd><code>{visibleDigest}</code></dd>
            </div>
          </dl>
        </OpenUiPanel>
      )}

      {drawerMode === "route" && (
        <OpenUiPanel
          className="compute-drawer__panel"
          icon={<Network size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("computeDrawerRouteTitle")}
          subtitle={endpointLabel || appMeta.endpointLabel}
        >
          <div className="compute-drawer__route">
            <span>
              <small>{t("statNetwork")}</small>
              <strong>{networkLabel || appMeta.networkLabel}</strong>
            </span>
            <span>
              <small>{t("statEndpoint")}</small>
              <strong>{capsuleModeLabel}</strong>
            </span>
            <span>
              <small>{t("statRequests")}</small>
              <strong>{requestCount}</strong>
            </span>
          </div>
        </OpenUiPanel>
      )}

      {drawerMode === "payload" && (
        <OpenUiPanel
          className="compute-drawer__panel"
          icon={<Braces size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("computeInputTitle")}
          subtitle={inputVisibilityCopy}
        >
          <div className="compute-drawer__payload-grid">
            <OpenUiTextArea
              className="compute-drawer__payload"
              textareaClassName="compute-drawer__payload-input"
              label={t("computeInputTitle")}
              value={inputPayload}
              onChange={(event) => setInputPayload(event.target.value)}
              placeholder={t("inputPlaceholder")}
              spellCheck={false}
              hint={inputReady ? t("computeInputReadyHint") : t("computeInputInvalidHint")}
            />
            <div
              className="compute-drawer__json"
              data-valid={inputReady ? "true" : "false"}
              data-visibility={privacy}
            >
              <div className="compute-drawer__json-head">
                <span>{inputVisibility}</span>
                <strong>{t("computeInputBytes", { count: inputPayload.length })}</strong>
              </div>
              <pre>{privacy === "public" ? inputPayload : t("inputRedacted")}</pre>
              <small>{inputVisibilityCopy}</small>
            </div>
          </div>
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
            eyebrow: t(consoleConfig.eyebrowKey || "panelEyebrow"),
            title: t(consoleConfig.titleKey || "panelTitle"),
            subtitle: endpointLabel || "",
            badges: (
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {networkLabel || appMeta.networkLabel}
              </span>
            ),
          }}
          scene={scene}
          score={[
            { label: t("statRequests"), value: String(requestCount), accent: true },
            { label: t("lastStatus"), value: lastStatus },
          ]}
          actions={{
            primary: {
              label: primaryLabel,
              onClick: () => void handleBuild(),
              loading: actionPreview,
            },
          }}
          drawerToggleLabel={t("detailsLabel")}
          drawer={{ title: t("detailsLabel"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
