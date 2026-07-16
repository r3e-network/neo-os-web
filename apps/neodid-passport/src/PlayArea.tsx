import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  CircleAlert,
  ClipboardCopy,
  FileCheck2,
  Fingerprint,
  KeyRound,
  Landmark,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import type { ObservableState } from "@shared/react/context";
import { useNowMs } from "@shared/react/hooks/useNowMs";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import {
  canonicalMorpheusDid,
  PASSPORT_FIELD_LIMITS,
  passportUtf8Length,
  passportMatchesForm,
  truncatePassportUtf8,
  validatePassportForm,
  type NeoDidRegistryProbe,
  type PassportForm,
  type PassportPayload,
} from "./passport";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const DEFAULT_FORM: PassportForm = {
  subject: "did:morpheus:neo_n3:service:neodid",
  claim: "wallet-signature-context",
  audience: "miniapp-neodid-passport",
};

const PASSPORT_DESK = new URL("../public/passport-desk.webp", import.meta.url).href;
const PASSPORT_MARK = new URL("../public/logo.webp", import.meta.url).href;

interface ReviewTemplate {
  key: string;
  claim: string;
  audience: string;
  labelKey: string;
  hintKey: string;
  icon: LucideIcon;
}

const REVIEW_TEMPLATES: ReviewTemplate[] = [
  {
    key: "wallet-context",
    claim: "wallet-signature-context",
    audience: "miniapp-neodid-passport",
    labelKey: "passportTemplateWallet",
    hintKey: "passportTemplateWalletHint",
    icon: WalletCards,
  },
  {
    key: "app-context",
    claim: "relying-party-context",
    audience: "miniapp-relying-party",
    labelKey: "passportTemplateRelying",
    hintKey: "passportTemplateRelyingHint",
    icon: ShieldCheck,
  },
  {
    key: "developer-context",
    claim: "developer-context",
    audience: "miniapp-oracle-services",
    labelKey: "passportTemplateDeveloper",
    hintKey: "passportTemplateDeveloperHint",
    icon: KeyRound,
  },
];

function compact(value: string, head = 12, tail = 7): string {
  const text = String(value || "").trim();
  if (!text || text === "—") return "—";
  if (text.length <= head + tail + 1) return text;
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

function registryLabel(probe: NeoDidRegistryProbe | null, t: P["t"]) {
  if (!probe || probe.status === "idle") return t("registryNotChecked");
  if (probe.status === "checking") return t("registryChecking");
  if (probe.status === "verified") return t("registryDeploymentVerified");
  if (probe.status === "mismatch") {
    if (probe.reason === "resolver-anchor-mismatch") return t("registryAnchorMismatch");
    if (probe.reason === "contract-state-mismatch") return t("registryContractMismatch");
    return t("registryNetworkMismatch");
  }
  if (probe.reason === "resolver-anchor-missing") return t("registryAnchorMissing");
  return probe.reason === "no-network-deployment"
    ? t("registryNoDeployment")
    : t("registryUnavailable");
}

function assuranceIcon(tone: string): ReactNode {
  if (tone === "ready") return <BadgeCheck size={17} aria-hidden="true" />;
  if (tone === "warning") return <CircleAlert size={17} aria-hidden="true" />;
  return <FileCheck2 size={17} aria-hidden="true" />;
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);
  const network = str("network", "testnet");
  const networkLabel = str("networkLabel", t("testnet"));
  const lastStatus = str("lastStatus", t("statusReady"));
  const lastDigest = str("lastDigest", "—");
  const resolverStatus = str("resolverStatus", t("resolverNotCheckedStatus"));
  const runtimeStatus = str("runtimeStatus", t("runtimeNotCheckedStatus"));
  const documentId = str("documentId", "—");
  const documentVersion = str("documentVersion", "—");
  const anchorContract = str("anchorContract", "—");
  const serviceCount = num("serviceCount");
  const verificationMethodCount = num("verificationMethodCount");
  const lastError = str("lastError");
  const recoveryStatus = str("recoveryStatus");
  const isResolving = bool("isResolving");
  const isSigning = bool("isSigning");
  const storageHealthy = bool("storageHealthy");
  const payload = val<PassportPayload>("passportPayload");
  const recoveredForm = val<PassportForm>("recoveryForm", DEFAULT_FORM) ?? DEFAULT_FORM;
  const registryProbe = val<NeoDidRegistryProbe>("registryProbe");

  const [subject, setSubject] = useState(() => truncatePassportUtf8(
    recoveredForm.subject || DEFAULT_FORM.subject,
    PASSPORT_FIELD_LIMITS.subject,
  ));
  const [claim, setClaim] = useState(() => truncatePassportUtf8(
    recoveredForm.claim || DEFAULT_FORM.claim,
    PASSPORT_FIELD_LIMITS.claim,
  ));
  const [audience, setAudience] = useState(() => truncatePassportUtf8(
    recoveredForm.audience || DEFAULT_FORM.audience,
    PASSPORT_FIELD_LIMITS.audience,
  ));
  const now = useNowMs(30_000);
  const hydratedRecoveryRef = useRef("");
  const discardedDraftRef = useRef("");
  const busy = isResolving || isSigning;
  const form = useMemo<PassportForm>(() => ({ subject, claim, audience }), [audience, claim, subject]);
  const canonicalSubject = canonicalMorpheusDid(subject);
  const draftValidationKey = validatePassportForm(form);
  const draftReady = !draftValidationKey && !busy;
  const payloadMatchesDraft = Boolean(payload && passportMatchesForm(payload, form));
  const visiblePayload = payloadMatchesDraft ? payload : null;
  const expired = Boolean(visiblePayload && Date.parse(visiblePayload.expiresAt) <= now);
  const proofAttached = visiblePayload?.proof.status === "attached";

  useEffect(() => {
    const fingerprint = JSON.stringify([
      recoveredForm.subject,
      recoveredForm.claim,
      recoveredForm.audience,
    ]);
    if (!fingerprint || hydratedRecoveryRef.current === fingerprint) return;
    hydratedRecoveryRef.current = fingerprint;
    setSubject(truncatePassportUtf8(
      recoveredForm.subject || DEFAULT_FORM.subject,
      PASSPORT_FIELD_LIMITS.subject,
    ));
    setClaim(truncatePassportUtf8(
      recoveredForm.claim || DEFAULT_FORM.claim,
      PASSPORT_FIELD_LIMITS.claim,
    ));
    setAudience(truncatePassportUtf8(
      recoveredForm.audience || DEFAULT_FORM.audience,
      PASSPORT_FIELD_LIMITS.audience,
    ));
  }, [recoveredForm.audience, recoveredForm.claim, recoveredForm.subject]);

  useEffect(() => {
    if (!payload || payloadMatchesDraft) return;
    const fingerprint = `${payload.digest}:${canonicalSubject ?? subject}:${claim}:${audience}`;
    if (discardedDraftRef.current === fingerprint) return;
    discardedDraftRef.current = fingerprint;
    void dispatch("discardPassportReview");
  }, [audience, canonicalSubject, claim, dispatch, payload, payloadMatchesDraft, subject]);

  const activeTemplate = REVIEW_TEMPLATES.find((template) =>
    template.claim === claim && template.audience === audience
  );

  const applyTemplate = (template: ReviewTemplate) => {
    if (busy) return;
    setClaim(template.claim);
    setAudience(template.audience);
  };
  const build = () => {
    if (!draftReady) return;
    void dispatch("buildPassport", form);
  };
  const sign = () => {
    if (!visiblePayload || expired || proofAttached || busy) return;
    void dispatch("signPassport", form);
  };
  const copy = () => {
    if (!visiblePayload) return;
    void dispatch("copyPassportPayload");
  };
  const reset = () => {
    if (busy) return;
    void dispatch("resetPassport");
  };
  const retryStorage = () => {
    if (!visiblePayload || storageHealthy || busy) return;
    void dispatch("retryPassportStorage");
  };

  const passportStateLabel = proofAttached
    ? t("proofAttachedUnverifiedStatus")
    : visiblePayload
      ? expired
        ? t("passportExpiredStatus")
        : t("reviewEnvelopeReady")
      : t("reviewNotBuilt");

  const assuranceItems = [
    {
      key: "document",
      label: t("assuranceDocument"),
      value: visiblePayload ? resolverStatus : t("resolverNotCheckedStatus"),
      tone: visiblePayload ? "ready" : "idle",
    },
    {
      key: "runtime",
      label: t("assuranceRuntime"),
      value: visiblePayload ? runtimeStatus : t("runtimeNotCheckedStatus"),
      tone: visiblePayload?.assurance.runtimeAttestation === "metadata-available" ? "ready" : "warning",
    },
    {
      key: "registry",
      label: t("assuranceRegistry"),
      value: registryLabel(registryProbe, t),
      tone: registryProbe?.status === "verified" ? "ready" : "warning",
    },
    {
      key: "proof",
      label: t("assuranceWallet"),
      value: proofAttached ? t("proofAttachedUnverifiedStatus") : t("proofNotAttachedStatus"),
      tone: proofAttached ? "warning" : "idle",
    },
    {
      key: "recovery",
      label: t("assuranceRecovery"),
      value: storageHealthy ? t("storageAvailable") : t("storageUnavailableStatus"),
      tone: storageHealthy ? "ready" : "warning",
    },
  ];

  const scene = (
    <div
      className="did-scene"
      data-state={busy ? "busy" : proofAttached ? "attached" : visiblePayload ? "resolved" : "idle"}
      aria-busy={busy || undefined}
    >
      <section className="did-identity-stage" aria-label={t("passportPreview")}>
        <img className="did-identity-stage__art" src={PASSPORT_DESK} alt={t("heroVisualAlt")} loading="eager" decoding="async" />
        <div className="did-identity-stage__veil" aria-hidden="true" />
        <div className="did-identity-stage__meta">
          <span>{t("resolverNetwork", { network: networkLabel })}</span>
          <strong>{t("localReviewBoundary")}</strong>
        </div>

        <article className="did-passport" data-attached={proofAttached ? "true" : undefined}>
          <header className="did-passport__cover">
            <img className="did-passport__mark" src={PASSPORT_MARK} alt="" aria-hidden="true" />
            <div className="did-passport__heading">
              <span>{t("credentialCardTitle")}</span>
              <strong>{visiblePayload ? compact(documentId, 18, 8) : compact(subject, 18, 8)}</strong>
            </div>
            <span className="did-passport__stamp" data-attached={proofAttached ? "true" : undefined}>
              {passportStateLabel}
            </span>
          </header>
          <div className="did-passport__fields">
            <span>
              <small>{t("claimContext")}</small>
              <strong>{claim || t("claimPlaceholder")}</strong>
            </span>
            <span>
              <small>{t("audience")}</small>
              <strong>{audience || t("audiencePlaceholder")}</strong>
            </span>
            <span>
              <small>{t("reviewExpiry")}</small>
              <strong>{visiblePayload ? new Date(visiblePayload.expiresAt).toLocaleString() : t("tenMinuteReview")}</strong>
            </span>
          </div>
          <footer className="did-passport__footer">
            {/* Its two neighbours already degrade to an honest 0 rather than a
                dash, and the evidence list states this very condition as "Not
                resolved" (see the resolverStatus row above). Nothing is in
                flight before the visitor resolves, so name the settled state in
                the app's own vocabulary instead of voiding the chip. */}
            <span>{t("documentVersion")}: <strong>{visiblePayload ? compact(documentVersion) : t("resolverNotCheckedStatus")}</strong></span>
            <span>{t("services")}: <strong>{visiblePayload ? serviceCount : 0}</strong></span>
            <span>{t("verificationMethods")}: <strong>{visiblePayload ? verificationMethodCount : 0}</strong></span>
          </footer>
        </article>
      </section>

      <section className="did-credential-lane" data-ready={draftReady ? "true" : undefined} aria-label={t("passportWorkspaceTitle")}>
        <header className="did-credential-lane__head">
          <div>
            <span>{t("passportTemplateTitle")}</span>
            <strong>{activeTemplate ? t(activeTemplate.labelKey) : t("passportCustomCredential")}</strong>
          </div>
          <Fingerprint size={24} aria-hidden="true" />
        </header>
        <div className="did-template-deck" aria-label={t("passportTemplateTitle")}>
          {REVIEW_TEMPLATES.map((template) => {
            const Icon = template.icon;
            const selected = activeTemplate?.key === template.key;
            return (
              <button
                key={template.key}
                type="button"
                aria-pressed={selected}
                className={selected ? "is-active" : undefined}
                onClick={() => applyTemplate(template)}
                disabled={busy}
              >
                <span className="did-template-card__icon" aria-hidden="true"><Icon size={18} /></span>
                <span>
                  <strong>{t(template.labelKey)}</strong>
                  <small>{t(template.hintKey)}</small>
                </span>
              </button>
            );
          })}
        </div>
        <p className="did-credential-lane__truth"><CircleAlert size={15} aria-hidden="true" />{t("selfAuthoredClaimNote")}</p>
      </section>

      <section className="did-assurance" aria-label={t("assuranceTitle")}>
        <header className="did-assurance__head">
          <Landmark size={20} aria-hidden="true" />
          <div>
            <span>{t("assuranceTitle")}</span>
            <strong>{t("assuranceSubtitle")}</strong>
          </div>
        </header>
        <div className="did-assurance__list">
          {assuranceItems.map((item) => (
            <div key={item.key} data-tone={item.tone}>
              <span>{assuranceIcon(item.tone)}</span>
              <div><strong>{item.label}</strong><small>{item.value}</small></div>
            </div>
          ))}
        </div>
      </section>

      <p className="did-scene__status" data-error={lastError ? "true" : undefined} role="status" aria-live="polite">
        {busy ? (isSigning ? t("waitingWalletStatus") : t("resolvingStatus")) : lastError || recoveryStatus || lastStatus}
      </p>
    </div>
  );

  const drawer = (
    <div className="did-drawer">
      <OpenUiNotice
        className="did-drawer__notice"
        icon={<ShieldCheck size={18} aria-hidden="true" />}
        title={t("proofLaneHint")}
      >
        {t("offChainNote")}
      </OpenUiNotice>

      <OpenUiPanel
        className="did-drawer__panel did-drawer__panel--wide"
        icon={<Fingerprint size={18} aria-hidden="true" />}
        title={t("advancedFieldsTitle")}
        subtitle={t("advancedFieldsCopy")}
      >
        <div className="did-drawer__field-grid">
          <OpenUiTextField
            className="did-drawer__field did-drawer__field--wide"
            label={t("subject")}
            value={subject}
            onChange={(event) => setSubject(truncatePassportUtf8(
              event.target.value,
              PASSPORT_FIELD_LIMITS.subject,
            ))}
            placeholder={t("subjectPlaceholder")}
            hint={t("byteLimitHint", {
              count: passportUtf8Length(subject),
              max: PASSPORT_FIELD_LIMITS.subject,
            })}
            disabled={busy}
            mono
            spellCheck={false}
          />
          <OpenUiTextField
            className="did-drawer__field"
            label={t("claimContext")}
            value={claim}
            onChange={(event) => setClaim(truncatePassportUtf8(
              event.target.value,
              PASSPORT_FIELD_LIMITS.claim,
            ))}
            placeholder={t("claimPlaceholder")}
            hint={t("byteLimitHint", {
              count: passportUtf8Length(claim),
              max: PASSPORT_FIELD_LIMITS.claim,
            })}
            disabled={busy}
            mono
            spellCheck={false}
          />
          <OpenUiTextField
            className="did-drawer__field"
            label={t("audience")}
            value={audience}
            onChange={(event) => setAudience(truncatePassportUtf8(
              event.target.value,
              PASSPORT_FIELD_LIMITS.audience,
            ))}
            placeholder={t("audiencePlaceholder")}
            hint={t("byteLimitHint", {
              count: passportUtf8Length(audience),
              max: PASSPORT_FIELD_LIMITS.audience,
            })}
            disabled={busy}
            mono
            spellCheck={false}
          />
        </div>
        {/* The build action lives in the PlayStage action bar, far from these
            fields; when a field goes invalid that button silently disables and
            the translated reason (runBuild's validation branch) is unreachable
            because the disabled button can never dispatch it. Surface the same
            message at the point of edit instead. */}
        {draftValidationKey ? (
          <p className="did-draft-error" role="status">
            <CircleAlert size={14} aria-hidden="true" />
            <span>{t(draftValidationKey)}</span>
          </p>
        ) : null}
      </OpenUiPanel>

      <OpenUiPanel
        className="did-drawer__panel did-drawer__panel--wide"
        icon={<FileCheck2 size={18} aria-hidden="true" />}
        title={t("reviewEvidenceTitle")}
        subtitle={t("reviewEvidenceCopy")}
      >
        <dl className="did-evidence-list">
          <div><dt>{t("payloadDigest")}</dt><dd><code title={visiblePayload?.digest}>{visiblePayload?.digest ?? lastDigest}</code></dd></div>
          <div><dt>{t("anchorContract")}</dt><dd><code title={visiblePayload?.didDocument.anchorContract}>{visiblePayload?.didDocument.anchorContract || anchorContract}</code></dd></div>
          <div><dt>{t("reviewNonce")}</dt><dd><code>{visiblePayload?.nonce ?? "—"}</code></dd></div>
          <div><dt>{t("registryObservation")}</dt><dd><code>{visiblePayload ? `${visiblePayload.registry.status} · ${visiblePayload.registry.reason}` : "—"}</code></dd></div>
          <div><dt>{t("registryCheckedAt")}</dt><dd>{visiblePayload?.registry.checkedAt ? new Date(visiblePayload.registry.checkedAt).toLocaleString() : "—"}</dd></div>
          <div><dt>{t("proofAddress")}</dt><dd><code>{visiblePayload?.proof.address ?? "—"}</code></dd></div>
          <div><dt>{t("messageDigest")}</dt><dd><code>{visiblePayload?.proof.messageDigest ?? "—"}</code></dd></div>
          <div><dt>{t("proofVerification")}</dt><dd>{t("proofNotVerifiedHere")}</dd></div>
        </dl>
        <div className="did-drawer__row">
          {!storageHealthy && visiblePayload ? (
            <button type="button" className="did-drawer__recovery" onClick={retryStorage} disabled={busy}>
              <RefreshCw size={16} aria-hidden="true" />{t("retryStorageAction")}
            </button>
          ) : null}
          <button type="button" className="did-drawer__primary" onClick={copy} disabled={!visiblePayload || busy}>
            <ClipboardCopy size={16} aria-hidden="true" />{t("copyAction")}
          </button>
          <button type="button" className="did-drawer__reset" onClick={reset} disabled={busy}>
            <RotateCcw size={16} aria-hidden="true" />{t("reset")}
          </button>
        </div>
      </OpenUiPanel>
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="neodid-passport-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            title: t("title"),
            subtitle: t("passportProductSubtitle"),
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" />{t("reviewScopeBadge")}</span>,
          }}
          scene={scene}
          actions={{
            primary: {
              label: isResolving ? t("resolvingStatus") : t("routeBuild"),
              onClick: build,
              loading: isResolving,
              disabled: !draftReady,
              icon: <FileCheck2 size={17} aria-hidden="true" />,
            },
            secondary: visiblePayload && !expired && !proofAttached
              ? [{
                  label: isSigning ? t("waitingWalletStatus") : t("signAction"),
                  onClick: sign,
                  disabled: busy,
                  icon: <WalletCards size={16} aria-hidden="true" />,
                }]
              : undefined,
          }}
          drawerToggleLabel={t("details")}
          drawer={{ title: t("reviewDetailsTitle"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
