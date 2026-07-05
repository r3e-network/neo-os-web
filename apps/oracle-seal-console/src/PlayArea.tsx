/**
 * PlayArea.tsx - Oracle Seal Console
 *
 * Reference-envelope builder for oracle request metadata. The UI keeps the
 * critical truth visible: this creates a checksum reference, not encryption.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  CircleAlert,
  ClipboardCheck,
  FileCheck2,
  Fingerprint,
  KeyRound,
  PackageCheck,
  RefreshCw,
  Route,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import {
  OpenUiNotice,
  OpenUiPanel,
  OpenUiProvider,
  OpenUiSegmented,
  OpenUiTextArea,
  OpenUiTextField,
  PlayStage,
} from "@shared/components-react/v2";
import { appMeta, consoleConfig } from "./appConfig";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const STAGE_IMAGE = "seal-reference-stage.webp";

const PURPOSES = [
  { value: "oracle-input", labelKey: "purposeInput", hintKey: "purposeInputHint" },
  { value: "callback-secret", labelKey: "purposeCallback", hintKey: "purposeCallbackHint" },
  { value: "attestation", labelKey: "purposeAttestation", hintKey: "purposeAttestationHint" },
] as const;

type PurposeValue = (typeof PURPOSES)[number]["value"];
type DrawerMode = "receipt" | "flow" | "source";

const PURPOSE_ICONS: Record<PurposeValue, LucideIcon> = {
  "oracle-input": ClipboardCheck,
  "callback-secret": KeyRound,
  attestation: BadgeCheck,
};

function compact(value: string, empty = "-") {
  const text = String(value || "").trim();
  if (!text) return empty;
  return text.length > 30 ? `${text.slice(0, 14)}...${text.slice(-10)}` : text;
}

function isJson(value: string) {
  try {
    JSON.parse(value || "{}");
    return true;
  } catch {
    return false;
  }
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, num } = useStateBindings(state);
  const networkLabel = str("networkLabel", appMeta.networkLabel);
  const endpointLabel = str("endpointLabel", appMeta.endpointLabel);
  const lastStatus = str("lastStatus", t("statusReady"));
  const lastDigest = str("lastDigest", t("digestPlaceholder"));
  const requestCount = num("requestCount");

  const [purpose, setPurpose] = useState("oracle-input");
  const [recipient, setRecipient] = useState("");
  const [payload, setPayload] = useState("{\n  \"source\": \"oracle\",\n  \"ttl\": 60\n}");
  const [actionPreview, setActionPreview] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("receipt");
  const previewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
  }, []);

  const selectedPurpose = useMemo(
    () => PURPOSES.find((item) => item.value === purpose) ?? PURPOSES[0],
    [purpose],
  );
  const payloadValid = isJson(payload);
  const payloadSize = t("sealPayloadChars", { count: payload.length });
  const hasDigest = lastDigest && lastDigest !== t("digestPlaceholder");
  const statusTone = payloadValid ? "ready" : "invalid";

  const startPreview = () => {
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    setActionPreview(true);
    previewTimeout.current = setTimeout(() => {
      setActionPreview(false);
      previewTimeout.current = null;
    }, 950);
  };

  const handleBuild = () => {
    startPreview();
    void dispatch("buildRequest", {
      purpose,
      recipient: recipient.trim(),
      payload,
    });
  };

  const resetDraft = () => {
    setPurpose("oracle-input");
    setRecipient("");
    setPayload("{\n  \"source\": \"oracle\",\n  \"ttl\": 60\n}");
    setDrawerMode("receipt");
  };

  const drawerModes: Array<{ id: DrawerMode; label: string; value: string }> = [
    { id: "receipt", label: t("sealReceipt"), value: hasDigest ? compact(lastDigest) : t("sealEmptyTitle") },
    { id: "flow", label: t("sealFlowTitle"), value: t(selectedPurpose.labelKey) },
    { id: "source", label: t("sealComposerTitle"), value: payloadSize },
  ];
  const setDrawerModeSafe = (mode: string) => {
    if (drawerModes.some((item) => item.id === mode)) setDrawerMode(mode as DrawerMode);
  };

  const scene = (
    <div className="seal-workspace" data-state={actionPreview ? "building" : statusTone}>
      <section className="seal-envelope" aria-label={t("sealStageTitle")}>
        <div className="seal-envelope__head">
          <span><PackageCheck size={16} />{t("sealPlan")}</span>
          <strong>{actionPreview ? t("sealStageBuilding") : payloadValid ? t("sealValidationReady") : t("sealPayloadStateInvalid")}</strong>
        </div>

        <div className="seal-envelope__body">
          <figure className="seal-envelope__asset">
            <img className="seal-preview__image" src={STAGE_IMAGE} alt="" aria-hidden="true" />
            <figcaption><Fingerprint size={14} />{t("sealReferenceOnly")}</figcaption>
          </figure>

          <div className="seal-envelope__lanes">
            <div className="seal-envelope__lane seal-envelope__lane--active">
              <span>{t("purpose")}</span>
              <strong>{t(selectedPurpose.labelKey)}</strong>
              <small>{t(selectedPurpose.hintKey)}</small>
            </div>
            <div className={["seal-envelope__lane", recipient.trim() ? "seal-envelope__lane--active" : ""].filter(Boolean).join(" ")}>
              <span>{t("recipient")}</span>
              <strong>{compact(recipient, t("digestPlaceholder"))}</strong>
              <small>{recipient.trim() ? t("sealFlowRouteDesc") : t("recipientHint")}</small>
            </div>
            <div className={["seal-envelope__lane", payloadValid ? "seal-envelope__lane--active" : "seal-envelope__lane--warn"].join(" ")}>
              <span>{t("payloadValid")}</span>
              <strong>{payloadValid ? t("yes") : t("no")}</strong>
              <small>{payloadValid ? payloadSize : t("payloadInvalidHint")}</small>
            </div>
          </div>
        </div>

        <div className="seal-preview__receipt">
          <div>
            <span>{t("purpose")}</span>
            <strong>{t(selectedPurpose.labelKey)}</strong>
          </div>
          <div>
            <span>{t("recipient")}</span>
            <strong>{compact(recipient, t("digestPlaceholder"))}</strong>
          </div>
          <div>
            <span>{t("statDigest")}</span>
            <strong>{hasDigest ? compact(lastDigest) : t("sealEmptyTitle")}</strong>
          </div>
        </div>

        <div className="seal-truth">
          <ShieldAlert size={18} />
          <div>
            <strong>{t("protectionValue")}</strong>
            <p>{t("sealProtectionCopy")}</p>
          </div>
        </div>
      </section>

      <section className="seal-builder" aria-label={t("sealComposerTitle")}>
        <div className="seal-purpose">
          <div className="seal-source-head">
            <span>{t("sealPurposeTitle")}</span>
            <strong>{t("sealComposerTitle")}</strong>
          </div>
          <OpenUiSegmented
            className="seal-purpose__options"
            segmentedClassName="seal-purpose__options-group"
            label={t("sealPurposeTitle")}
            value={purpose}
            onChange={setPurpose}
            options={PURPOSES.map((item) => {
              const Icon = PURPOSE_ICONS[item.value];
              return {
                value: item.value,
                label: (
                  <span className="seal-purpose-card">
                    <span className="seal-purpose__option-icon" aria-hidden="true">
                      <Icon size={16} strokeWidth={2.4} />
                    </span>
                    <span className="seal-purpose__option-label">{t(item.labelKey)}</span>
                  </span>
                ),
              };
            })}
          />
          <p className="seal-purpose__active-hint" aria-live="polite">{t(selectedPurpose.hintKey)}</p>
        </div>

        <div className="seal-source-summary" data-valid={payloadValid ? "true" : undefined}>
          <article className="seal-source-summary__card">
            <span>{t("sealRecipientTitle")}</span>
            <strong>{compact(recipient, t("digestPlaceholder"))}</strong>
            <small>{recipient.trim() ? t("sealFlowRouteDesc") : t("recipientHint")}</small>
          </article>

          <article className="seal-source-summary__card">
            <span>{t("sealPayloadTitle")}</span>
            <strong>{payloadSize}</strong>
            <small>{payloadValid ? t("payloadReadyHint") : t("payloadInvalidHint")}</small>
          </article>

          <div className="seal-validation" role="status" data-valid={payloadValid ? "true" : undefined}>
            {payloadValid ? <FileCheck2 size={18} /> : <CircleAlert size={18} />}
            <div>
              <strong>{payloadValid ? t("sealPayloadStateReady") : t("sealPayloadStateInvalid")}</strong>
              <p>{payloadValid ? t("payloadReadyHint") : t("payloadInvalidHint")}</p>
            </div>
            <span>{payloadSize}</span>
          </div>
        </div>
      </section>
    </div>
  );

  const drawer = (
    <div className="seal-drawer">
      <OpenUiSegmented
        className="seal-drawer__switcher"
        segmentedClassName="seal-drawer__switcher-group"
        label={t("sealReceipt")}
        value={drawerMode}
        onChange={setDrawerModeSafe}
        options={drawerModes.map((mode) => ({
          value: mode.id,
          label: (
            <span className="seal-drawer-tab">
              <span>{mode.label}</span>
              <strong>{mode.value}</strong>
            </span>
          ),
        }))}
      />

      {drawerMode === "receipt" && (
        <OpenUiPanel
          className="seal-drawer__panel"
          icon={<ClipboardCheck size={18} strokeWidth={2.4} aria-hidden="true" />}
          title={t("sealReceipt")}
          subtitle={hasDigest ? t("sealValidationReady") : t("sealEmptyTitle")}
        >
          {hasDigest ? (
            <dl className="seal-drawer__receipt">
              <div><dt>{t("protectionLabel")}</dt><dd>{t("protectionValue")}</dd></div>
              <div><dt>{t("purpose")}</dt><dd>{t(selectedPurpose.labelKey)}</dd></div>
              <div><dt>{t("recipient")}</dt><dd>{recipient || t("digestPlaceholder")}</dd></div>
              <div><dt>{t("payloadValid")}</dt><dd>{payloadValid ? t("yes") : t("no")}</dd></div>
              <div><dt>{t("statDigest")}</dt><dd><code>{lastDigest}</code></dd></div>
            </dl>
          ) : (
            <OpenUiNotice
              className="seal-drawer__empty"
              icon={<ShieldAlert size={18} strokeWidth={2.4} aria-hidden="true" />}
              title={t("sealEmptyTitle")}
            >
              {t("sealEmptyCopy")}
            </OpenUiNotice>
          )}
        </OpenUiPanel>
      )}

      {drawerMode === "flow" && (
        <OpenUiPanel
          className="seal-drawer__panel"
          icon={<Route size={18} strokeWidth={2.4} aria-hidden="true" />}
          title={t("sealFlowTitle")}
          subtitle={t("sealFlowChecksumDesc")}
        >
          <ol className="seal-flow">
            <li><strong>{t("sealFlowPlain")}</strong><span>{t("sealFlowPlainDesc")}</span></li>
            <li><strong>{t("sealFlowRoute")}</strong><span>{t("sealFlowRouteDesc")}</span></li>
            <li><strong>{t("sealFlowChecksum")}</strong><span>{t("sealFlowChecksumDesc")}</span></li>
          </ol>
        </OpenUiPanel>
      )}

      {drawerMode === "source" && (
        <OpenUiPanel
          className="seal-drawer__panel"
          icon={<FileCheck2 size={18} strokeWidth={2.4} aria-hidden="true" />}
          title={t("sealComposerTitle")}
          subtitle={payloadValid ? t("sealPayloadStateReady") : t("sealPayloadStateInvalid")}
        >
          <div className="seal-drawer__source">
            <OpenUiTextField
              className="seal-field seal-field--route"
              inputClassName="seal-input seal-input--recipient"
              label={t("sealRecipientTitle")}
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder={t("recipientPlaceholder")}
              spellCheck={false}
              mono
            />

            <OpenUiTextArea
              className="seal-field seal-field--payload"
              textareaClassName="seal-input seal-input--payload"
              label={t("sealPayloadTitle")}
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              placeholder={t("payloadPlaceholder")}
              rows={4}
              spellCheck={false}
              hint={payloadValid ? t("payloadReadyHint") : t("payloadInvalidHint")}
            />

            <div className="seal-validation" role="status" data-valid={payloadValid ? "true" : undefined}>
              {payloadValid ? <FileCheck2 size={18} /> : <CircleAlert size={18} />}
              <div>
                <strong>{payloadValid ? t("sealPayloadStateReady") : t("sealPayloadStateInvalid")}</strong>
                <p>{payloadValid ? t("payloadReadyHint") : t("payloadInvalidHint")}</p>
              </div>
              <span>{payloadSize}</span>
            </div>
          </div>
        </OpenUiPanel>
      )}
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="oracle-console-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t(consoleConfig.eyebrowKey),
            title: t(consoleConfig.titleKey),
            subtitle: t("sealHeroCopy"),
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {networkLabel}</span>,
          }}
          scene={scene}
          score={[
            { label: t("statRequests"), value: String(requestCount), accent: true },
            { label: t("lastStatus"), value: lastStatus },
            { label: t("statEndpoint"), value: endpointLabel },
          ]}
          actions={{
            primary: {
              label: actionPreview ? t("sealBuildActionActive") : t("runAction"),
              onClick: handleBuild,
              loading: actionPreview,
              icon: <BadgeCheck size={17} />,
            },
            secondary: [
              {
                label: t("reset"),
                onClick: resetDraft,
                icon: <RefreshCw size={16} />,
              },
            ],
          }}
          drawerToggleLabel={t("sealReceipt")}
          drawer={{ title: t("sealReceipt"), children: drawer }}
        />
        <p className="seal-status-line" role="status">
          <KeyRound size={14} />
          {lastStatus}
        </p>
      </div>
    </OpenUiProvider>
  );
}
