/**
 * PlayArea.tsx - Oracle NeoDID Console.
 *
 * Identity request desk: the DID, provider, claim, and receipt are foreground
 * objects. The generated identity artwork is a quiet supporting asset, not a
 * full-stage backdrop.
 */
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Fingerprint,
  IdCard,
  KeyRound,
  Network,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import {
  OpenUiNotice,
  OpenUiPanel,
  OpenUiProvider,
  OpenUiSegmented,
  OpenUiTextField,
  PlayStage,
} from "@shared/components-react/v2";
import {
  appMeta,
  consoleConfig,
  isValidCallback,
  isValidDid,
} from "./appConfig";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext?: { params?: Record<string, string> };
}

type NeoDidValues = {
  callback: string;
  claim: string;
  did: string;
  provider: string;
};

type DrawerMode = "identity" | "flow" | "receipt";

interface TrackItem {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  active?: boolean;
}

const IDENTITY_STAGE_IMAGE = "neodid-identity-stage.webp";
const PROVIDER_HINT_KEYS: Record<string, string> = {
  "neodid-registry": "providerRegistryHint",
  "wallet-signature": "providerWalletHint",
  "social-attestation": "providerSocialHint",
};

function defaultFieldValue(key: string): string {
  const field = consoleConfig.fields.find((item) => item.key === key);
  return String(field?.defaultValue ?? "");
}

function defaultValues(params: Record<string, string> = {}): NeoDidValues {
  return {
    callback: params.callback ?? defaultFieldValue("callback"),
    claim: params.claim ?? defaultFieldValue("claim"),
    did: params.did ?? defaultFieldValue("did"),
    provider: (params.provider ?? defaultFieldValue("provider")) || "neodid-registry",
  };
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

function compactValue(value: string, fallback: string, head = 16, tail = 10) {
  const text = String(value || "").trim();
  if (!text) return fallback;
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

export default function PlayArea({ t, state, dispatch, launchContext }: PlayAreaProps) {
  const { str, num } = useStateBindings(state);
  const networkLabel = str("networkLabel");
  const endpointLabel = str("endpointLabel");
  const lastStatus = str("lastStatus", t("statusReady"));
  const digestPlaceholder = t("digestPlaceholder");
  const lastDigest = str("lastDigest", digestPlaceholder);
  const requestCount = num("requestCount");

  const [values, setValues] = useState<NeoDidValues>(() => defaultValues(launchContext?.params));
  const [actionPreview, setActionPreview] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("identity");
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
  const update = (key: keyof NeoDidValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };
  const resetValues = () => {
    setValues(defaultValues(launchContext?.params));
  };

  function handleBuild() {
    if (!formatReady) return;
    startPreview();
    void dispatch("buildRequest", values);
  }

  const { did, provider, claim, callback } = values;
  const didReady = isValidDid(did);
  const callbackReady = isValidCallback(callback);
  const claimReady = claim.trim().length > 0;
  const formatReady = didReady && callbackReady && claimReady;
  const providerLabel = optionLabel("provider", provider, t);
  const providerHint = t(PROVIDER_HINT_KEYS[provider] ?? "providerRegistryHint");
  const digestReady = Boolean(lastDigest && lastDigest !== digestPlaceholder);
  const visibleDigest = compactValue(lastDigest, digestPlaceholder, 14, 10);
  const blockedReason = !didReady
    ? t("didInvalid")
    : !claimReady
      ? t("claimMissingHint")
      : !callbackReady
        ? t("callbackInvalid")
        : "";
  const statusLabel = actionPreview
    ? t("previewReady")
    : digestReady
      ? t("neodidValidationReady")
      : formatReady
        ? t("ready")
        : blockedReason;
  const primaryLabel = actionPreview
    ? t("neodidBuildActive")
    : t(consoleConfig.primaryActionKey || "buildRequest");
  const providerOptions = consoleConfig.fields.find((item) => item.key === "provider")?.options ?? [];
  const drawerModes: Array<{ id: DrawerMode; label: string; value: string }> = [
    { id: "identity", label: t("neodidSubjectTitle"), value: compactValue(did, t("did"), 11, 6) },
    { id: "flow", label: t("neodidFlowTitle"), value: providerLabel },
    { id: "receipt", label: t("neodidReceipt"), value: visibleDigest },
  ];
  const setDrawerModeSafe = (mode: string) => {
    if (drawerModes.some((item) => item.id === mode)) setDrawerMode(mode as DrawerMode);
  };

  const track: TrackItem[] = [
    {
      key: "did",
      icon: IdCard,
      label: t("neodidTrackSubject"),
      value: compactValue(did, t("did"), 17, 11),
      detail: didReady ? t("didReadyHint") : t("didInvalidHint"),
      active: didReady,
    },
    {
      key: "provider",
      icon: ShieldCheck,
      label: t("neodidTrackProvider"),
      value: providerLabel,
      detail: providerHint,
      active: true,
    },
    {
      key: "claim",
      icon: BadgeCheck,
      label: t("neodidTrackClaim"),
      value: claim || t("claim"),
      detail: claimReady ? t("claimReadyHint") : t("claimMissingHint"),
      active: claimReady,
    },
    {
      key: "receipt",
      icon: Fingerprint,
      label: t("neodidTrackReceipt"),
      value: visibleDigest,
      detail: digestReady ? lastDigest : t("neodidEmptyCopy"),
      active: digestReady,
    },
  ];

  const scene = (
    <div
      className="neodid-workspace"
      data-state={actionPreview ? "building" : digestReady ? "ready" : "idle"}
    >
      <section className="neodid-request-card" aria-label={t("neodidPlan")}>
        <header className="neodid-request-card__head">
          <span className="neodid-request-card__icon" aria-hidden="true">
            <IdCard size={22} strokeWidth={2.3} />
          </span>
          <div>
            <span>{t("neodidIdentityTrackTitle")}</span>
            <strong>{lastStatus}</strong>
          </div>
          <span className="neodid-request-card__badge">
            <span className="neodid-status-dot" />
            {statusLabel}
          </span>
        </header>

        <p className="neodid-request-card__copy">{t("neodidPlanCopy")}</p>

        <div className="neodid-track" aria-label={t("neodidFlowTitle")}>
          {track.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.key}
                className="neodid-track__item"
                data-active={item.active ? "true" : "false"}
              >
                <span className="neodid-track__icon" aria-hidden="true">
                  <Icon size={17} strokeWidth={2.35} />
                </span>
                <span className="neodid-track__label">{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            );
          })}
        </div>

        <div className="neodid-receipt-strip" aria-label={t("neodidReceipt")}>
          <span>{t("statDigest")}</span>
          <code>{visibleDigest}</code>
        </div>
      </section>

      <aside className="neodid-side-panel" aria-label={t("neodidCatalogTitle")}>
        <figure className="neodid-stage-art" aria-hidden="true">
          <img src={IDENTITY_STAGE_IMAGE} alt="" loading="eager" decoding="async" />
        </figure>

        <section className="neodid-catalog-card">
          <div className="neodid-catalog-card__head">
            <span className="neodid-catalog-card__icon" aria-hidden="true">
              <KeyRound size={18} strokeWidth={2.35} />
            </span>
            <div>
              <span>{t("neodidCatalogTitle")}</span>
              <strong>{providerLabel}</strong>
            </div>
          </div>
          <p>{t("neodidCatalogCopy")}</p>
          <dl className="neodid-catalog-card__facts">
            <div>
              <dt>{t("claim")}</dt>
              <dd>{claim}</dd>
            </div>
            <div>
              <dt>{t("callbackShort")}</dt>
              <dd>{callback || t("callbackOptional")}</dd>
            </div>
            <div>
              <dt>{t("statRequests")}</dt>
              <dd>{requestCount}</dd>
            </div>
          </dl>
        </section>

        <section className="neodid-route-card" aria-label={t("statEndpoint")}>
          <Network size={17} strokeWidth={2.35} aria-hidden="true" />
          <span>{t("statEndpoint")}</span>
          <strong>{endpointLabel || appMeta.endpointLabel}</strong>
        </section>
      </aside>
    </div>
  );

  const drawer = (
    <OpenUiProvider>
      <div className="neodid-drawer">
        <OpenUiSegmented
          className="neodid-drawer__switcher"
          segmentedClassName="neodid-drawer__switcher-group"
          label={t("detailsLabel")}
          value={drawerMode}
          onChange={setDrawerModeSafe}
          options={drawerModes.map((mode) => ({
            value: mode.id,
            label: (
              <span className="neodid-drawer-tab">
                <span>{mode.label}</span>
                <strong>{mode.value}</strong>
              </span>
            ),
          }))}
        />

        {drawerMode === "identity" && (
          <OpenUiPanel
            className="neodid-drawer__panel"
            icon={<IdCard size={18} strokeWidth={2.35} aria-hidden="true" />}
            title={t("neodidSubjectTitle")}
            subtitle={statusLabel}
          >
            <div className="neodid-composer">
              <OpenUiTextField
                className="neodid-field neodid-field--did"
                inputClassName="neodid-input neodid-input--did"
                label={<><IdCard size={14} /> {t("did")}</>}
                value={did}
                onChange={(event) => update("did", event.target.value)}
                placeholder={t("didPlaceholder")}
                hint={didReady ? t("didReadyHint") : t("didInvalidHint")}
                spellCheck={false}
                mono
              />
              <OpenUiSegmented
                className="neodid-provider-switch"
                segmentedClassName="neodid-provider-switch__group"
                label={t("providerShort")}
                value={provider}
                onChange={(value) => update("provider", value)}
                options={providerOptions.map((option) => ({
                  value: option.value,
                  label: (
                    <span className="neodid-provider-card">
                      <strong>{option.labelKey ? t(option.labelKey) : option.label}</strong>
                      <small>{t(PROVIDER_HINT_KEYS[option.value] ?? "providerRegistryHint")}</small>
                    </span>
                  ),
                }))}
              />
              <div className="neodid-composer__grid">
                <OpenUiTextField
                  className="neodid-field"
                  inputClassName="neodid-input"
                  label={<><BadgeCheck size={14} /> {t("claim")}</>}
                  value={claim}
                  onChange={(event) => update("claim", event.target.value)}
                  placeholder={t("claimPlaceholder")}
                  hint={claimReady ? t("claimReadyHint") : t("claimMissingHint")}
                  spellCheck={false}
                  mono
                />
                <OpenUiTextField
                  className="neodid-field"
                  inputClassName="neodid-input"
                  label={<><Network size={14} /> {t("callbackShort")}</>}
                  value={callback}
                  onChange={(event) => update("callback", event.target.value)}
                  placeholder={t("callbackPlaceholder")}
                  hint={callbackReady ? t("callbackReadyHint") : t("callbackInvalidHint")}
                  spellCheck={false}
                  mono
                />
              </div>
            </div>
          </OpenUiPanel>
        )}

        {drawerMode === "flow" && (
          <OpenUiPanel
            className="neodid-drawer__panel"
            icon={<ShieldCheck size={18} strokeWidth={2.35} aria-hidden="true" />}
            title={t("neodidFlowTitle")}
            subtitle={providerLabel}
          >
            <ol className="neodid-drawer__flow">
              {track.slice(0, 3).map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.key} data-active={item.active ? "true" : "false"}>
                    <span aria-hidden="true"><Icon size={16} strokeWidth={2.35} /></span>
                    <div>
                      <strong>{item.label}</strong>
                      <code>{item.value}</code>
                      <small>{item.detail}</small>
                    </div>
                  </li>
                );
              })}
            </ol>
          </OpenUiPanel>
        )}

        {drawerMode === "receipt" && (
          <OpenUiPanel
            className="neodid-drawer__panel"
            icon={<Fingerprint size={18} strokeWidth={2.35} aria-hidden="true" />}
            title={t("neodidReceipt")}
            subtitle={digestReady ? t("neodidValidationReady") : t("neodidEmptyTitle")}
          >
            {digestReady ? (
              <dl className="neodid-drawer__facts">
                <div><dt>{t("statDigest")}</dt><dd>{lastDigest}</dd></div>
                <div><dt>{t("providerShort")}</dt><dd>{providerLabel}</dd></div>
                <div><dt>{t("claim")}</dt><dd>{claim}</dd></div>
              </dl>
            ) : (
              <OpenUiNotice
                className="neodid-drawer__empty"
                icon={<Fingerprint size={17} strokeWidth={2.35} aria-hidden="true" />}
                title={t("neodidEmptyTitle")}
              >
                {t("neodidEmptyCopy")}
              </OpenUiNotice>
            )}
          </OpenUiPanel>
        )}
      </div>
    </OpenUiProvider>
  );

  return (
    <div className="oracle-neodid-play-area mx2 mx2-cat-tool">
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
            disabled: !formatReady || actionPreview,
            hint: formatReady ? undefined : blockedReason,
          },
          secondary: [
            { label: t("reset"), onClick: resetValues, disabled: actionPreview },
          ],
        }}
        drawerToggleLabel={t("detailsLabel")}
        drawer={{
          title: t("detailsLabel"),
          children: drawer,
        }}
      />
    </div>
  );
}
