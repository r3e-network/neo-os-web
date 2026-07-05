/**
 * PlayArea.tsx — NeoDID Passport (v2 scene-driven rebuild)
 *
 * NFT/tool identity. The passport card IS the scene: a DID identity document
 * being assembled with a holographic seal, identity fields lighting up as the
 * document resolves, and a signature stamp on sign. Build Passport is the
 * primary write once the foreground credential lane is ready; proof provider,
 * sign, and reset live in the drawer. Real state bound throughout.
 */
import { useState, useEffect, useRef } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt } from "@shared/art";
import {
  OpenUiNotice,
  OpenUiPanel,
  OpenUiProvider,
  OpenUiTextField,
  PlayStage,
} from "@shared/components-react/v2";
import {
  BadgeCheck,
  FileCheck2,
  Fingerprint,
  Github,
  Mail,
  ShieldCheck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const DEFAULT_SUBJECT = "did:morpheus:neo_n3:service:neodid";
const DEFAULT_CLAIM = "wallet-ownership";
const DEFAULT_AUDIENCE = "miniapp-neodid-passport";

interface CredentialTemplate {
  key: string;
  subject: string;
  claim: string;
  audience: string;
  labelKey: string;
  hintKey: string;
  icon: LucideIcon;
}

const CREDENTIAL_TEMPLATES: CredentialTemplate[] = [
  {
    key: "wallet",
    subject: DEFAULT_SUBJECT,
    claim: DEFAULT_CLAIM,
    audience: DEFAULT_AUDIENCE,
    labelKey: "passportTemplateWallet",
    hintKey: "passportTemplateWalletHint",
    icon: WalletCards,
  },
  {
    key: "relying-party",
    subject: DEFAULT_SUBJECT,
    claim: "relying-party-access",
    audience: "miniapp-onegate-vault",
    labelKey: "passportTemplateRelying",
    hintKey: "passportTemplateRelyingHint",
    icon: ShieldCheck,
  },
  {
    key: "developer",
    subject: DEFAULT_SUBJECT,
    claim: "developer-pass",
    audience: "miniapp-oracle-services",
    labelKey: "passportTemplateDeveloper",
    hintKey: "passportTemplateDeveloperHint",
    icon: BadgeCheck,
  },
];

function shortHash(value: string): string {
  const v = String(value || "").trim();
  if (!v || v === "—") return "—";
  if (v.length <= 20) return v;
  return `${v.slice(0, 12)}…${v.slice(-6)}`;
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num } = useStateBindings(state);

  const lastStatus = str("lastStatus");
  const lastDigest = str("lastDigest");
  const requestCount = num("requestCount");
  const proofStatus = str("proofStatus");
  const documentId = str("documentId");
  const documentVersion = str("documentVersion");
  const serviceCount = num("serviceCount");
  const lastError = str("lastError");
  const isResolving = bool("isResolving");
  const isSigning = bool("isSigning");

  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [claim, setClaim] = useState(DEFAULT_CLAIM);
  const [audience, setAudience] = useState(DEFAULT_AUDIENCE);
  const [provider, setProvider] = useState("wallet");

  const [buildPreview, setBuildPreview] = useState(false);
  const buildPreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (buildPreviewTimeout.current) clearTimeout(buildPreviewTimeout.current); }, []);
  const startBuildPreview = () => {
    if (buildPreviewTimeout.current) clearTimeout(buildPreviewTimeout.current);
    setBuildPreview(true);
    buildPreviewTimeout.current = setTimeout(() => { setBuildPreview(false); buildPreviewTimeout.current = null; }, 1200);
  };

  const busy = isResolving || isSigning || buildPreview;
  const hasPayload =
    requestCount > 0 ||
    lastStatus === t("passportReady") ||
    lastStatus === t("passportSigned");
  const isSigned = proofStatus === t("signedStatus") || /^signed$/i.test(proofStatus.trim());
  const subjectReady = subject.trim().length > 0;
  const claimReady = claim.trim().length > 0;
  const laneReady = subjectReady && claimReady && !busy;
  const passportStateLabel = isSigned
    ? t("passportSigned")
    : hasPayload
      ? t("passportReady")
      : laneReady
        ? t("passportSealHint")
        : t("emptyPayloadTitle");
  const passportSubject = hasPayload ? shortHash(documentId) : (subject.trim() || t("previewSubjectFallback"));
  const passportClaim = claim.trim() || t("claimPlaceholder");
  const passportAudience = audience.trim() || t("audiencePlaceholder");
  const activeTemplate = CREDENTIAL_TEMPLATES.find((template) =>
    template.subject === subject &&
    template.claim === claim &&
    template.audience === audience,
  );
  const statusLabel = lastError || (busy
    ? (isSigning ? `${t("signAction")}...` : `${t("routeResolve")}...`)
    : hasPayload ? proofStatus : laneReady ? t("passportSealHint") : t("emptyPayloadTitle"));
  const routeSteps = [
    { key: "subject", label: t("sealSubject"), value: hasPayload ? t("resolvedStatus") : t("routeResolve"), active: hasPayload || busy, icon: Fingerprint },
    { key: "payload", label: t("sealPayload"), value: hasPayload ? shortHash(lastDigest) : t("emptyPayloadTitle"), active: hasPayload, icon: FileCheck2 },
    { key: "proof", label: t("sealProof"), value: isSigned ? t("signedStatus") : t("notSignedStatus"), active: isSigned, icon: BadgeCheck },
  ];

  const handleBuild = () => {
    if (!laneReady) return;
    startBuildPreview();
    void dispatch("buildPassport", {
      subject: subject.trim(),
      claim: claim.trim(),
      audience: audience.trim(),
      provider,
    });
  };
  const applyTemplate = (template: CredentialTemplate) => {
    if (busy) return;
    setSubject(template.subject);
    setClaim(template.claim);
    setAudience(template.audience);
  };
  const handleSign = () => { void dispatch("signPassport"); };
  const handleReset = () => {
    setSubject(DEFAULT_SUBJECT);
    setClaim(DEFAULT_CLAIM);
    setAudience(DEFAULT_AUDIENCE);
    void dispatch("resetPassport");
  };

  const scene = (
    <div className="did-scene" data-state={busy ? "busy" : isSigned ? "signed" : hasPayload ? "resolved" : "idle"}>
      <section className={["did-passport", busy ? "is-resolving" : "", isSigned ? "is-signed" : ""].filter(Boolean).join(" ")} aria-label={t("passportPreview")}>
        <div className="did-passport__cover">
          <span className="did-passport__seal" aria-hidden="true">
            <CoinArt size={34} variant="gas" />
          </span>
          <div className="did-passport__heading">
            <span>{t("credentialCardTitle")}</span>
            <strong>{passportSubject}</strong>
          </div>
          <span className="did-passport__stamp" data-signed={isSigned ? "true" : undefined}>
            {isSigned ? t("signedStatus") : hasPayload ? t("preparedStatus") : t("notSignedStatus")}
          </span>
        </div>
        <div className="did-passport__fields">
          <span>
            <small>{t("documentId")}</small>
            <strong>{hasPayload ? shortHash(documentId) : t("previewSubjectFallback")}</strong>
          </span>
          <span>
            <small>{t("previewClaimLabel")}</small>
            <strong>{passportClaim}</strong>
          </span>
          <span>
            <small>{t("audience")}</small>
            <strong>{passportAudience}</strong>
          </span>
        </div>
        <div className="did-passport__footer">
          <span>{t("documentVersion")}: <strong>{hasPayload ? shortHash(documentVersion) : "—"}</strong></span>
          <span>{t("services")}: <strong>{serviceCount || 0}</strong></span>
        </div>
      </section>

      <section className="did-credential-lane" data-ready={laneReady ? "true" : undefined} aria-label={t("passportWorkspaceTitle")}>
        <header className="did-credential-lane__head">
          <span>{t("passportWorkspaceTitle")}</span>
          <strong>{activeTemplate ? t(activeTemplate.labelKey) : t("passportCustomCredential")}</strong>
        </header>
        <div className="did-template-deck" role="radiogroup" aria-label={t("passportTemplateTitle")}>
          {CREDENTIAL_TEMPLATES.map((template) => {
            const Icon = template.icon;
            const selected = activeTemplate?.key === template.key;
            return (
              <button
                key={template.key}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? "is-active" : undefined}
                onClick={() => applyTemplate(template)}
                disabled={busy}
              >
                <span className="did-template-card__icon" aria-hidden="true">
                  <Icon size={18} strokeWidth={2.35} />
                </span>
                <span>
                  <strong>{t(template.labelKey)}</strong>
                  <small>{t(template.hintKey)}</small>
                </span>
              </button>
            );
          })}
        </div>
        <dl className="did-lane-summary">
          <div data-ready={subjectReady ? "true" : undefined}>
            <dt>{t("subject")}</dt>
            <dd>{shortHash(subject)}</dd>
          </div>
          <div data-ready={claimReady ? "true" : undefined}>
            <dt>{t("claim")}</dt>
            <dd>{passportClaim}</dd>
          </div>
          <div data-ready={audience.trim() ? "true" : undefined}>
            <dt>{t("audience")}</dt>
            <dd>{passportAudience}</dd>
          </div>
        </dl>
      </section>

      <section className="did-issuance" aria-label={t("passportSealTrack")}>
        <div className="did-issuance__head">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <span>{t("passportSealTrack")}</span>
            <strong>{passportStateLabel}</strong>
          </div>
        </div>
        <div className="did-issuance__steps">
          {routeSteps.map(({ key, label, value, active, icon: Icon }) => (
            <div key={key} className="did-issuance__step" data-active={active ? "true" : undefined}>
              <span className="did-issuance__icon" aria-hidden="true"><Icon size={17} /></span>
              <span>
                <strong>{label}</strong>
                <small>{value}</small>
              </span>
            </div>
          ))}
        </div>
        <p className="did-issuance__copy">{t("credentialFlowCopy")}</p>
      </section>

      <p className="did-scene__status" data-error={lastError ? "true" : undefined}>
        {statusLabel}
      </p>
    </div>
  );

  const score = [
    { label: t("payloadDigest"), value: shortHash(lastDigest), accent: true },
    { label: t("tabPassport"), value: String(requestCount) },
    { label: t("signedStatus"), value: isSigned ? "✓" : "—" },
  ];

  const drawer = (
    <div className="did-drawer">
      <OpenUiNotice
        className="did-drawer__notice"
        icon={<ShieldCheck size={18} strokeWidth={2.35} aria-hidden="true" />}
        title={t("proofLaneHint")}
      >
        {t("offChainNote")}
      </OpenUiNotice>

      <OpenUiPanel
        className="did-drawer__panel did-drawer__panel--wide"
        icon={<Fingerprint size={18} strokeWidth={2.35} aria-hidden="true" />}
        title={t("advancedFieldsTitle")}
        subtitle={t("advancedFieldsCopy")}
      >
        <div className="did-drawer__field-grid">
          <OpenUiTextField
            className="did-drawer__field did-drawer__field--wide"
            label={t("subject")}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("subjectPlaceholder")}
            disabled={busy}
            mono
            spellCheck={false}
          />
          <OpenUiTextField
            className="did-drawer__field"
            label={t("claim")}
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder={t("claimPlaceholder")}
            disabled={busy}
            mono
            spellCheck={false}
          />
          <OpenUiTextField
            className="did-drawer__field"
            label={t("audience")}
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder={t("audiencePlaceholder")}
            disabled={busy}
            mono
            spellCheck={false}
          />
        </div>
      </OpenUiPanel>

      <OpenUiPanel
        className="did-drawer__panel"
        icon={<BadgeCheck size={18} strokeWidth={2.35} aria-hidden="true" />}
        title={t("provider")}
        subtitle={provider === "wallet" ? t("walletProviderTile") : t("apiProofHint")}
      >
        <div className="did-provider-deck" role="radiogroup" aria-label={t("provider")}>
          {[
            { key: "wallet", icon: WalletCards, hint: "walletProviderTile" },
            { key: "email", icon: Mail, hint: "emailProviderTile" },
            { key: "github", icon: Github, hint: "githubProviderTile" },
          ].map(({ key, icon: Icon, hint }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={provider === key}
              className={provider === key ? "is-active" : ""}
              onClick={() => setProvider(key)}
              disabled={busy}
            >
              <Icon size={17} strokeWidth={2.35} aria-hidden="true" />
              <span>
                <strong>{t(`${key}Provider`) || key}</strong>
                <small>{t(hint)}</small>
              </span>
            </button>
          ))}
        </div>
      </OpenUiPanel>

      <OpenUiPanel
        className="did-drawer__panel"
        icon={<FileCheck2 size={18} strokeWidth={2.35} aria-hidden="true" />}
        title={t("passportActionsTitle")}
        subtitle={statusLabel}
      >
        <div className="did-drawer__row">
          <button type="button" className="did-drawer__primary" onClick={handleBuild} disabled={busy || !subject.trim() || !claim.trim()}>{t("routeBuild") || t("tabPassport")}</button>
          <button type="button" onClick={handleSign} disabled={busy || !hasPayload}>{t("signAction")}</button>
          <button type="button" className="did-drawer__reset" onClick={handleReset} disabled={busy}>{t("reset")}</button>
        </div>
      </OpenUiPanel>
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="neodid-passport-play-area mx2 mx2-cat-nft">
        <PlayStage
          category="nft"
          stage={{ eyebrow: t("panelTitle"), title: t("title"), subtitle: t("credentialFlowCopy") }}
          scene={scene}
          score={score}
          actions={{
            primary: { label: busy ? "…" : t("routeBuild") || t("tabPassport"), onClick: handleBuild, loading: busy, disabled: !laneReady },
            secondary: hasPayload ? [{ label: t("signAction"), onClick: handleSign }] : undefined,
          }}
          drawerToggleLabel={t("panelTitle")}
          drawer={{ title: t("panelTitle"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
