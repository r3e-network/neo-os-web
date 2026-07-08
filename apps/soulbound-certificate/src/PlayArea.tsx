/**
 * PlayArea.tsx — Soulbound Certificate
 *
 * NFT credential workbench. The certificate is the primary artifact, the
 * issuer's fields sit beside it as a compact dossier, and template/verify work
 * is secondary instead of flattening three form tabs onto the stage.
 */
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Award, BookOpenCheck, CalendarCheck, ScrollText, Search, ShieldCheck, type LucideIcon } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { OpenUiPanel, OpenUiProvider, OpenUiSegmented, OpenUiTextArea, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import CertificatePreview from "./components/CertificatePreview";
import TokenQr from "./components/TokenQr";
import "./PlayArea.scss";

const CERTIFICATE_PAPER_ART = new URL("../public/certificate-paper.webp", import.meta.url).href;
const CERTIFICATE_ATELIER_ART = new URL("../public/certificate-atelier.webp", import.meta.url).href;

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface TemplateItem {
  id: string;
  name: string;
  issuerName?: string;
  active?: boolean;
  category?: string;
  [k: string]: unknown;
}

interface CertificateItem {
  id?: string;
  tokenId?: string;
  name?: string;
  templateName?: string;
  recipient?: string;
  recipientName?: string;
  achievement?: string;
  issuerName?: string;
  owner?: string;
  revoked?: boolean;
  [k: string]: unknown;
}

type WorkMode = "issue" | "templates" | "verify";
type DrawerMode = "templates" | "certificates" | "trust";

interface BlueprintPreset {
  key: string;
  nameKey: string;
  issuerKey: string;
  categoryKey: string;
  descriptionKey: string;
  supply: string;
  Icon: LucideIcon;
}

const BLUEPRINT_PRESETS: BlueprintPreset[] = [
  {
    key: "course",
    nameKey: "blueprintCourseName",
    issuerKey: "blueprintCourseIssuer",
    categoryKey: "blueprintCourseCategory",
    descriptionKey: "blueprintCourseDescription",
    supply: "500",
    Icon: BookOpenCheck,
  },
  {
    key: "event",
    nameKey: "blueprintEventName",
    issuerKey: "blueprintEventIssuer",
    categoryKey: "blueprintEventCategory",
    descriptionKey: "blueprintEventDescription",
    supply: "1200",
    Icon: CalendarCheck,
  },
  {
    key: "license",
    nameKey: "blueprintLicenseName",
    issuerKey: "blueprintLicenseIssuer",
    categoryKey: "blueprintLicenseCategory",
    descriptionKey: "blueprintLicenseDescription",
    supply: "250",
    Icon: ShieldCheck,
  },
];

function compactAddress(address: string) {
  const trimmed = address.trim();
  if (trimmed.length <= 14) return trimmed;
  return `${trimmed.slice(0, 7)}...${trimmed.slice(-5)}`;
}

function certificateToken(certificate: CertificateItem | null | undefined) {
  return String(certificate?.tokenId ?? certificate?.id ?? "").trim();
}

function certificateTitle(certificate: CertificateItem | null | undefined, fallback: string) {
  const title = String(certificate?.name ?? certificate?.templateName ?? certificate?.recipientName ?? "").trim();
  return title || certificateToken(certificate) || fallback;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, str, bool, val } = useStateBindings(state);
  const templatesCount = num("templatesCount");
  const certificatesCount = num("certificatesCount");
  const address = str("address", "");
  const isConnecting = bool("isConnecting");
  const isIssuing = bool("isIssuing");
  const isCreatingTemplate = bool("isCreatingTemplate");
  const isVerifying = bool("isVerifying");
  const lastError = str("lastError", "");
  const lastSuccess = str("lastSuccess", "");
  const templatesValue = val("templates");
  const certificatesValue = val("certificates");
  const templates = useMemo(() => (templatesValue ?? []) as TemplateItem[], [templatesValue]);
  const certificates = useMemo(() => (certificatesValue ?? []) as CertificateItem[], [certificatesValue]);
  const verifiedCertificate = val<CertificateItem | null>("verifiedCertificate", null);
  const verifiedIsIssuer = bool("verifiedIsIssuer");
  const deepLinkTemplateId = str("deepLinkTemplateId", "");
  const deepLinkVerifyTokenId = str("deepLinkVerifyTokenId", "");

  const [mode, setMode] = useState<WorkMode>(() =>
    deepLinkVerifyTokenId
      ? "verify"
      : deepLinkTemplateId || templates.some((template) => template.active !== false)
        ? "issue"
        : "templates",
  );
  const [issueForm, setIssueForm] = useState({
    templateId: deepLinkTemplateId || "",
    recipient: "",
    recipientName: "",
    achievement: "",
    memo: "",
  });
  const [createForm, setCreateForm] = useState({
    name: "",
    issuerName: "",
    category: "",
    maxSupply: "",
    description: "",
  });
  const [verifyTokenId, setVerifyTokenId] = useState(deepLinkVerifyTokenId);
  const [activeBlueprint, setActiveBlueprint] = useState("");
  const [recipientDetailsOpen, setRecipientDetailsOpen] = useState(false);
  const [templateDetailsOpen, setTemplateDetailsOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("templates");

  const isConnected = address.length > 0;
  const activeTemplates = templates.filter((tp) => tp.active !== false);
  const selectedTemplate = templates.find((tp) => String(tp.id) === issueForm.templateId.trim());
  const recentRecipientWallets = useMemo(() => {
    const seen = new Set<string>();
    const wallets: string[] = [];
    for (const certificate of certificates) {
      const wallet = String(certificate.owner ?? certificate.recipient ?? "").trim();
      if (!wallet || seen.has(wallet)) continue;
      seen.add(wallet);
      wallets.push(wallet);
      if (wallets.length >= 4) break;
    }
    return wallets;
  }, [certificates]);
  const templateReady = issueForm.templateId.trim().length > 0;
  const recipientReady = issueForm.recipient.trim().length > 0;
  const recipientProfileReady = issueForm.recipientName.trim().length > 0 && issueForm.achievement.trim().length > 0;
  const issueReady = templateReady && recipientReady && recipientProfileReady;
  const createSupply = Number(createForm.maxSupply.trim());
  const createReady =
    createForm.name.trim().length > 0 &&
    createForm.issuerName.trim().length > 0 &&
    createForm.category.trim().length > 0 &&
    Number.isInteger(createSupply) &&
    createSupply > 0 &&
    createSupply <= 100000;
  const verifyReady = verifyTokenId.trim().length > 0;
  const selectedTemplateName = selectedTemplate?.name || (issueForm.templateId.trim() ? `${t("templateId")} #${issueForm.templateId.trim()}` : t("noTemplateSelected"));
  const recipientDisplay = issueForm.recipientName.trim() || issueForm.recipient.trim() || t("awardedToPlaceholder");
  const walletDisplay = isConnected ? compactAddress(address) : t("walletNotConnected");

  const handleIssue = () => {
    if (!isConnected || !issueReady) return;
    void dispatch("issueCertificate", issueForm);
  };
  const handleCreate = () => {
    if (!isConnected || !createReady) return;
    void dispatch("createTemplate", createForm);
  };
  const handleVerify = () => {
    if (!verifyReady) return;
    void dispatch("verifyCertificate", { tokenId: verifyTokenId.trim() });
  };
  const handleConnect = () => void dispatch("connectWallet");
  const applyBlueprintPreset = (preset: BlueprintPreset) => {
    setActiveBlueprint(preset.key);
    setTemplateDetailsOpen(false);
    setCreateForm({
      name: t(preset.nameKey),
      issuerName: t(preset.issuerKey),
      category: t(preset.categoryKey),
      maxSupply: preset.supply,
      description: t(preset.descriptionKey),
    });
  };
  const updateCreateForm = (field: keyof typeof createForm, value: string) => {
    setActiveBlueprint("");
    setCreateForm((form) => ({ ...form, [field]: value }));
  };
  const selectCertificateForVerify = (certificate: CertificateItem) => {
    const tokenId = certificateToken(certificate);
    if (!tokenId) return;
    setVerifyTokenId(tokenId);
    setMode("verify");
  };

  useEffect(() => {
    if (!deepLinkVerifyTokenId) return;
    setVerifyTokenId(deepLinkVerifyTokenId);
    setMode("verify");
    void dispatch("consumeVerifyDeepLink");
  }, [deepLinkVerifyTokenId, dispatch]);

  const modeItems: Array<{ mode: WorkMode; label: string; helper: string; Icon: LucideIcon }> = [
    { mode: "issue", label: t("issueTab"), helper: t("issueRecipientPassHint"), Icon: Award },
    { mode: "templates", label: t("templatesTab"), helper: t("createTemplateDrawerHint"), Icon: ScrollText },
    { mode: "verify", label: t("verifyTab"), helper: t("verifyDrawerHint"), Icon: Search },
  ];
  const drawerModes: Array<{ mode: DrawerMode; label: string; value: string; Icon: LucideIcon }> = [
    { mode: "templates", label: t("yourTemplates"), value: String(templates.length || templatesCount), Icon: ScrollText },
    { mode: "certificates", label: t("certificatesTab"), value: String(certificates.length || certificatesCount), Icon: Award },
    { mode: "trust", label: t("certificateTrustSignals"), value: t("soulboundBadge"), Icon: ShieldCheck },
  ];
  const activeDrawerMode = drawerModes.find((item) => item.mode === drawerMode) ?? drawerModes[0]!;
  const ActiveDrawerIcon = activeDrawerMode.Icon;
  const setWorkbenchMode = (value: string) => {
    if (value === "issue" || value === "templates" || value === "verify") {
      setMode(value);
    }
  };
  const setDetailMode = (value: string) => {
    if (value === "templates" || value === "certificates" || value === "trust") {
      setDrawerMode(value);
    }
  };

  const stepItems = [
    { key: "template", label: t("issueFlowTemplate"), ready: templateReady },
    { key: "recipient", label: t("issueFlowRecipient"), ready: recipientReady && recipientProfileReady },
    { key: "seal", label: t("issueFlowMint"), ready: issueReady },
  ];

  const statusMessage = isIssuing
    ? t("mintLaneSealing")
    : !isConnected
      ? t("walletRequiredIssueHint")
      : issueReady
        ? t("mintLaneReady")
        : t("mintLaneDraft");

  const previewTitle = mode === "templates"
    ? createForm.name.trim()
    : mode === "verify" && verifiedCertificate
      ? String(verifiedCertificate.name || verifiedCertificate.templateName || "")
      : selectedTemplate?.name || (issueForm.templateId.trim() ? `${t("templateId")} #${issueForm.templateId.trim()}` : "");
  const previewIssuer = mode === "templates"
    ? createForm.issuerName
    : mode === "verify" && verifiedCertificate
      ? String(verifiedCertificate.issuerName || "")
      : selectedTemplate?.issuerName || createForm.issuerName;
  const previewRecipientName = mode === "templates"
    ? createForm.category
    : mode === "verify" && verifiedCertificate
      ? String(verifiedCertificate.recipientName || verifiedCertificate.recipient || "")
      : issueForm.recipientName;
  const previewAchievement = mode === "templates"
    ? createForm.description
    : mode === "verify" && verifiedCertificate
      ? String(verifiedCertificate.achievement || verifiedCertificate.name || "")
      : issueForm.achievement;
  const previewFooter = mode === "templates"
    ? createForm.maxSupply.trim()
      ? `${t("maxSupply")}: ${createForm.maxSupply.trim()}`
      : t("templateBlueprintFoot")
    : selectedTemplate
      ? `${t("templateId")} #${selectedTemplate.id}`
      : issueForm.memo.trim() || t("issueDossierLabel");
  const previewDraft = mode === "templates" ? !createReady : mode === "verify" ? !verifiedCertificate : !issueReady;
  const sealStateLabel = issueReady ? t("credentialReadyLabel") : t("credentialDraftLabel");

  const verifiedStatus = verifiedCertificate ? (
    <span className={["cert-badge", verifiedCertificate.revoked ? "cert-badge--revoked" : "cert-badge--valid"].join(" ")}>
      {verifiedCertificate.revoked ? t("certificateRevoked") : t("certificateValid")}
    </span>
  ) : null;

  const primary = (() => {
    if (mode === "verify") {
      return {
        label: isVerifying ? t("lookingUp") : t("lookup"),
        onClick: handleVerify,
        disabled: !verifyReady,
        loading: isVerifying,
      };
    }

    if (!isConnected) {
      return {
        label: isConnecting ? t("connecting") : t("connectWallet"),
        onClick: handleConnect,
        loading: isConnecting,
      };
    }

    if (mode === "issue") {
      return {
        label: isIssuing ? t("issuing") : t("issue"),
        onClick: handleIssue,
        disabled: !issueReady,
        loading: isIssuing,
        hint: statusMessage,
      };
    }

    return {
      label: isCreatingTemplate ? t("creating") : t("createTemplate"),
      onClick: handleCreate,
      disabled: !createReady,
      loading: isCreatingTemplate,
    };
  })();

  const drawerPanels: Record<DrawerMode, ReactNode> = {
    templates: (
      <div className="cert-drawer-section" data-mode="templates">
        {templates.length > 0 ? (
          <ul className="cert-drawer-list" aria-label={t("yourTemplates")}>
            {templates.slice(0, 10).map((tp) => (
              <li key={tp.id} className="cert-drawer-item">
                <span className="cert-drawer-item__copy">
                  <strong>{tp.name}</strong>
                  <small>{tp.issuerName || t("issuerPreviewPlaceholder")}</small>
                </span>
                <button type="button" className="cert-drawer-action" onClick={() => void dispatch("toggleTemplate", tp)} disabled={!isConnected}>
                  {tp.active === false ? t("activate") : t("deactivate")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="cert-drawer-empty">{t("emptyTemplates")}</div>
        )}
      </div>
    ),
    certificates: (
      <div className="cert-drawer-section" data-mode="certificates">
        {certificates.length > 0 ? (
          <ul className="cert-drawer-list" aria-label={t("certificatesTab")}>
            {certificates.slice(0, 10).map((cert) => (
              <li key={certificateToken(cert) || certificateTitle(cert, t("certificateValid"))} className="cert-drawer-item">
                <span className="cert-drawer-item__copy">
                  <strong>{certificateTitle(cert, t("certificateValid"))}</strong>
                  <small>{certificateToken(cert) || t("verifyTokenIdPlaceholder")}</small>
                </span>
                <span className={cert.revoked ? "cert-drawer-status cert-drawer-status--revoked" : "cert-drawer-status"}>
                  {cert.revoked ? t("certificateRevoked") : t("certificateValid")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="cert-drawer-empty">{t("emptyCertificates")}</div>
        )}
      </div>
    ),
    trust: (
      <div className="cert-drawer-section cert-drawer-section--trust" data-mode="trust">
        <div className="cert-trust-stack">
          <article>
            <span>{t("soulboundBadge")}</span>
            <strong>{t("certificateProofPermanent")}</strong>
          </article>
          <article>
            <span>{t("verifyTab")}</span>
            <strong>{t("certificateProofVerify")}</strong>
          </article>
          <article>
            <span>{t("certificateValid")}</span>
            <strong>{t("soulboundNote")}</strong>
          </article>
        </div>
      </div>
    ),
  };

  const scene = (
    <div className="cert-workbench" data-mode={mode} data-state={isIssuing ? "sealing" : issueReady ? "ready" : "draft"}>
      <div className="cert-workbench__foreground">
        <section className={["cert-workbench__artifact", isIssuing ? "cert-workbench__artifact--sealing" : null].filter(Boolean).join(" ")}>
          <CertificatePreview
            issuerName={previewIssuer || ""}
            title={previewTitle}
            recipientName={previewRecipientName}
            achievement={previewAchievement}
            sealLabel={t("soulboundBadge")}
            awardedToLabel={t("awardedTo")}
            achievementLabel={t("forAchievement")}
            titlePlaceholder={t("certificateTitlePlaceholder")}
            recipientPlaceholder={t("awardedToPlaceholder")}
            achievementPlaceholder={t("achievementPreviewPlaceholder")}
            issuerPlaceholder={t("issuerPreviewPlaceholder")}
            status={mode === "verify" ? verifiedStatus : <span className="cert-badge cert-badge--valid">{t("soulboundBadge")}</span>}
            footer={<span>{previewFooter}</span>}
            draft={previewDraft}
            textureSrc={CERTIFICATE_PAPER_ART}
          />
          <div className="cert-credential-strip" aria-label={t("credentialStripLabel")}>
            <span>
              <small>{t("credentialStripTemplate")}</small>
              <strong>{mode === "templates" ? createForm.name.trim() || t("templateNamePlaceholder") : selectedTemplateName}</strong>
            </span>
            <span>
              <small>{t("credentialStripRecipient")}</small>
              <strong>
                {mode === "templates"
                  ? createForm.category.trim() || t("categoryPlaceholder")
                  : mode === "verify" && verifiedCertificate
                    ? String(verifiedCertificate.recipientName || verifiedCertificate.recipient || "")
                    : recipientDisplay}
              </strong>
            </span>
            <span>
              <small>{t("credentialStripSeal")}</small>
              <strong>{mode === "templates" ? t("templateBlueprintLabel") : sealStateLabel}</strong>
            </span>
          </div>
          <div className="cert-mint-lane" aria-label={t("mintLaneLabel")}>
            {stepItems.map((step) => (
              <span key={step.key} className={["cert-mint-lane__step", step.ready ? "cert-mint-lane__step--ready" : null].filter(Boolean).join(" ")}>
                <span className="cert-mint-lane__dot" />
                {step.label}
              </span>
            ))}
          </div>
          {mode === "templates" && (
            <aside className="cert-atelier-card" aria-label={t("certificateAtelierLabel")}>
              <img className="cert-atelier-card__image" src={CERTIFICATE_ATELIER_ART} alt="" aria-hidden="true" loading="lazy" decoding="async" />
              <span>
                <small>{t("certificateAtelierLabel")}</small>
                <strong>{t("certificateAtelierCaption")}</strong>
              </span>
            </aside>
          )}
        </section>

        <aside className="cert-workbench__panel">
          <OpenUiSegmented
            className="cert-modebar"
            label={t("certificateAtelierLabel")}
            onChange={setWorkbenchMode}
            options={modeItems.map((item) => {
              const Icon = item.Icon;
              return {
                value: item.mode,
                label: (
                  <span className="cert-tab-label" aria-label={`${item.label}: ${item.helper}`}>
                    <Icon size={16} strokeWidth={2.4} aria-hidden="true" />
                    <strong>{item.label}</strong>
                  </span>
                ),
              };
            })}
            segmentedClassName="cert-modebar__segmented"
            value={mode}
          />

          {lastError && <p className="cert-controls__error" role="alert">{lastError}</p>}
          {lastSuccess && <p className="cert-controls__success">{lastSuccess}</p>}

          {mode === "issue" && (
            <div className="cert-dossier" aria-label={t("issueDossierLabel")}>
              <div className="cert-dossier__head">
                <span>{t("issueRecipientPassLabel")}</span>
                <small>{statusMessage}</small>
              </div>
              <div className="cert-pass-card">
                <div className="cert-pass-card__main">
                  <span>{t("credentialPassLabel")}</span>
                  <strong>{selectedTemplateName}</strong>
                  <small>{recipientDisplay}</small>
                </div>
                <dl>
                  <div>
                    <dt>{t("credentialPassWallet")}</dt>
                    <dd>{walletDisplay}</dd>
                  </div>
                  <div>
                    <dt>{t("credentialPassSeal")}</dt>
                    <dd>{sealStateLabel}</dd>
                  </div>
                </dl>
              </div>
              <div className="cert-template-strip" aria-label={t("selectedTemplate")}>
                {activeTemplates.slice(0, 6).map((tp) => (
                  <button
                    key={tp.id}
                    type="button"
                    className={["cert-template-chip", issueForm.templateId === String(tp.id) ? "cert-template-chip--active" : null].filter(Boolean).join(" ")}
                    onClick={() => setIssueForm((f) => ({ ...f, templateId: String(tp.id) }))}
                    disabled={isIssuing}
                  >
                    <strong>{tp.name}</strong>
                    <span>{tp.issuerName || t("issuerPreviewPlaceholder")}</span>
                  </button>
                ))}
                {activeTemplates.length === 0 && <span className="cert-controls__hint">{t("emptyTemplatesHint")}</span>}
              </div>
              {recentRecipientWallets.length > 0 && (
                <div className="cert-recipient-rail" aria-label={t("recentRecipients")}>
                  <span>{t("recentRecipients")}</span>
                  <div>
                    {recentRecipientWallets.map((wallet) => (
                      <button
                        key={wallet}
                        type="button"
                        className={issueForm.recipient === wallet ? "cert-recipient-chip cert-recipient-chip--active" : "cert-recipient-chip"}
                        onClick={() => setIssueForm((form) => ({ ...form, recipient: wallet }))}
                        disabled={isIssuing}
                      >
                        {compactAddress(wallet)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="cert-recipient-dossier">
                <div>
                  <span>{t("awardedTo")}</span>
                  <strong>{recipientDisplay}</strong>
                  <small>{issueForm.achievement.trim() || t("achievementPlaceholder")}</small>
                </div>
                <button
                  type="button"
                  className="cert-detail-toggle"
                  onClick={() => setRecipientDetailsOpen((value) => !value)}
                  aria-expanded={recipientDetailsOpen}
                  disabled={isIssuing}
                >
                  {t("recipientDetails")}
                </button>
              </div>
              {recipientDetailsOpen && (
                <div className="cert-field-stack">
                  <OpenUiTextField
                    className="cert-field"
                    inputClassName="cert-input"
                    label={t("issueRecipient")}
                    value={issueForm.recipient}
                    onChange={(e) => setIssueForm((f) => ({ ...f, recipient: e.target.value }))}
                    placeholder={t("issueRecipientPlaceholder")}
                    disabled={isIssuing}
                    spellCheck={false}
                    mono
                  />
                  <div className="cert-field-grid cert-field-grid--recipient">
                    <OpenUiTextField
                      className="cert-field"
                      inputClassName="cert-input"
                      label={t("recipientName")}
                      value={issueForm.recipientName}
                      onChange={(e) => setIssueForm((f) => ({ ...f, recipientName: e.target.value }))}
                      placeholder={t("recipientNamePlaceholder")}
                      disabled={isIssuing}
                    />
                    <OpenUiTextField
                      className="cert-field"
                      inputClassName="cert-input"
                      label={t("achievement")}
                      value={issueForm.achievement}
                      onChange={(e) => setIssueForm((f) => ({ ...f, achievement: e.target.value }))}
                      placeholder={t("achievementPlaceholder")}
                      disabled={isIssuing}
                    />
                  </div>
                </div>
              )}
              <details className="cert-advanced">
                <summary>{t("issueAdvancedHint")}</summary>
                <OpenUiTextField
                  className="cert-field"
                  inputClassName="cert-input"
                  label={t("templateId")}
                  value={issueForm.templateId}
                  onChange={(e) => setIssueForm((f) => ({ ...f, templateId: e.target.value }))}
                  placeholder={t("templateIdPlaceholder")}
                  disabled={isIssuing}
                />
                <OpenUiTextField
                  className="cert-field"
                  inputClassName="cert-input"
                  label={t("memo")}
                  value={issueForm.memo}
                  onChange={(e) => setIssueForm((f) => ({ ...f, memo: e.target.value }))}
                  placeholder={t("memoPlaceholder")}
                  disabled={isIssuing}
                />
              </details>
            </div>
          )}

          {mode === "templates" && (
            <div className="cert-dossier cert-dossier--template">
              <div className="cert-dossier__head">
                <span>{t("createTemplate")}</span>
                <small>{t("createTemplateHelp")}</small>
              </div>
              <div className="cert-blueprint-card" aria-label={t("templateBlueprintLabel")}>
                <span>{t("templateBlueprintLabel")}</span>
                <strong>{createForm.name.trim() || t("templateNamePlaceholder")}</strong>
                <p>{createForm.description.trim() || t("templateBlueprintHint")}</p>
                <dl>
                  <div>
                    <dt>{t("issuerName")}</dt>
                    <dd>{createForm.issuerName.trim() || t("issuerNamePlaceholder")}</dd>
                  </div>
                  <div>
                    <dt>{t("maxSupply")}</dt>
                    <dd>{createForm.maxSupply.trim() || t("maxSupplyPlaceholder")}</dd>
                  </div>
                </dl>
              </div>
              <div className="cert-blueprint-presets" role="list" aria-label={t("blueprintPresetsLabel")}>
                {BLUEPRINT_PRESETS.map((preset) => {
                  const Icon = preset.Icon;
                  const active = activeBlueprint === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      className={["cert-blueprint-preset", active ? "cert-blueprint-preset--active" : null].filter(Boolean).join(" ")}
                      onClick={() => applyBlueprintPreset(preset)}
                      disabled={isCreatingTemplate}
                      aria-pressed={active}
                    >
                      <span className="cert-blueprint-preset__icon"><Icon size={18} strokeWidth={2.3} /></span>
                      <span>
                        <strong>{t(preset.nameKey)}</strong>
                        <small>{t(preset.categoryKey)} · {preset.supply}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="cert-template-dossier">
                <div>
                  <span>{t("templateBlueprintLabel")}</span>
                  <strong>{createForm.name.trim() || t("templateNamePlaceholder")}</strong>
                  <small>
                    {(createForm.category.trim() || t("categoryPlaceholder"))} · {createForm.maxSupply.trim() || t("maxSupplyPlaceholder")}
                  </small>
                </div>
                <button
                  type="button"
                  className="cert-detail-toggle"
                  onClick={() => setTemplateDetailsOpen((value) => !value)}
                  aria-expanded={templateDetailsOpen}
                  disabled={isCreatingTemplate}
                >
                  {t("templateDetails")}
                </button>
              </div>
              {templateDetailsOpen && (
                <div className="cert-field-stack">
                  <div className="cert-field-grid cert-field-grid--priority">
                    <OpenUiTextField
                      className="cert-field"
                      inputClassName="cert-input"
                      label={t("templateName")}
                      value={createForm.name}
                      onChange={(e) => updateCreateForm("name", e.target.value)}
                      placeholder={t("templateNamePlaceholder")}
                      disabled={isCreatingTemplate}
                    />
                    <OpenUiTextField
                      className="cert-field"
                      inputClassName="cert-input"
                      label={t("issuerName")}
                      value={createForm.issuerName}
                      onChange={(e) => updateCreateForm("issuerName", e.target.value)}
                      placeholder={t("issuerNamePlaceholder")}
                      disabled={isCreatingTemplate}
                    />
                  </div>
                  <details className="cert-advanced cert-advanced--blueprint">
                    <summary>{t("templateBlueprintDetails")}</summary>
                    <div className="cert-field-grid">
                      <OpenUiTextField
                        className="cert-field"
                        inputClassName="cert-input"
                        label={t("category")}
                        value={createForm.category}
                        onChange={(e) => updateCreateForm("category", e.target.value)}
                        placeholder={t("categoryPlaceholder")}
                        disabled={isCreatingTemplate}
                      />
                      <OpenUiTextField
                        className="cert-field"
                        inputClassName="cert-input"
                        label={t("maxSupply")}
                        value={createForm.maxSupply}
                        onChange={(e) => updateCreateForm("maxSupply", e.target.value)}
                        placeholder={t("maxSupplyPlaceholder")}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        disabled={isCreatingTemplate}
                      />
                    </div>
                    <OpenUiTextArea
                      className="cert-field cert-field--textarea"
                      textareaClassName="cert-input cert-input--textarea"
                      label={t("description")}
                      value={createForm.description}
                      onChange={(e) => updateCreateForm("description", e.target.value)}
                      placeholder={t("descriptionPlaceholder")}
                      disabled={isCreatingTemplate}
                      rows={3}
                    />
                  </details>
                </div>
              )}
            </div>
          )}

          {mode === "verify" && (
            <div className="cert-dossier cert-dossier--verify">
              <div className="cert-dossier__head">
                <span>{t("verifyTab")}</span>
                <small>{t("verifyHelp")}</small>
              </div>
              <div className="cert-verifier-lens">
                <span>{t("verifyLensLabel")}</span>
                <strong>{verifyTokenId.trim() || t("verifyTokenIdPlaceholder")}</strong>
                <small>{verifiedCertificate ? t("certificateValid") : t("certificateNotFoundHint")}</small>
              </div>
              {certificates.length > 0 && (
                <div className="cert-certificate-rail" aria-label={t("certificateWalletLabel")}>
                  <span>{t("certificateWalletLabel")}</span>
                  <div>
                    {certificates.slice(0, 5).map((certificate) => {
                      const tokenId = certificateToken(certificate);
                      const active = tokenId === verifyTokenId.trim();
                      return (
                        <button
                          key={tokenId || certificateTitle(certificate, t("certificateValid"))}
                          type="button"
                          className={["cert-certificate-card", active ? "cert-certificate-card--active" : null].filter(Boolean).join(" ")}
                          onClick={() => selectCertificateForVerify(certificate)}
                          disabled={!tokenId}
                          aria-pressed={active}
                        >
                          <span>{certificate.revoked ? t("certificateRevoked") : t("certificateValid")}</span>
                          <strong>{certificateTitle(certificate, t("certificateValid"))}</strong>
                          <small>{tokenId || t("verifyTokenIdPlaceholder")}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <OpenUiTextField
                className="cert-field"
                inputClassName="cert-input"
                label={t("verifyTokenId")}
                value={verifyTokenId}
                onChange={(e) => setVerifyTokenId(e.target.value)}
                placeholder={t("verifyTokenIdPlaceholder")}
                spellCheck={false}
                mono
              />
              {verifiedCertificate ? (
                <div className="cert-verify-card">
                  <div>
                    <strong>{certificateTitle(verifiedCertificate, t("certificateValid"))}</strong>
                    <span>{verifiedCertificate.revoked ? t("certificateRevoked") : t("soulboundNote")}</span>
                  </div>
                  <TokenQr value={certificateToken(verifiedCertificate)} size={86} label={t("tokenQrLabel")} />
                  {verifiedIsIssuer && !verifiedCertificate.revoked && (
                    <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("revokeCertificate", { tokenId: certificateToken(verifiedCertificate) })}>
                      {t("revoke")}
                    </button>
                  )}
                </div>
              ) : (
                <p className="cert-controls__hint">{t("certificateNotFoundHint")}</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="certificate-play-area mx2 mx2-cat-nft">
        <PlayStage
          category="nft"
          stage={{
            eyebrow: t("issuerWorkspaceTitle"),
            title: t("certificateHeroTitle"),
            subtitle: t("docSubtitle"),
            badges: (
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {templatesCount} {t("templatesTab").toLowerCase()}
              </span>
            ),
          }}
          scene={scene}
          actions={{
            primary,
          }}
          drawerToggleLabel={t("detailsLabel")}
          drawer={{
            title: t("certificatesTab"),
            children: (
              <div className="cert-drawer">
                <OpenUiSegmented
                  className="cert-drawer-tabs"
                  label={t("detailsLabel")}
                  onChange={setDetailMode}
                  options={drawerModes.map((item) => ({
                    value: item.mode,
                    label: (
                      <span className="cert-drawer-tab-label">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </span>
                    ),
                  }))}
                  segmentedClassName="cert-drawer-segmented"
                  value={drawerMode}
                />
                <OpenUiPanel
                  className="cert-drawer__panel"
                  icon={<ActiveDrawerIcon size={18} strokeWidth={2.35} aria-hidden="true" />}
                  title={activeDrawerMode.label}
                  subtitle={activeDrawerMode.value}
                >
                  <div className="cert-drawer__panel-body" data-mode={drawerMode}>
                    {drawerPanels[drawerMode]}
                  </div>
                </OpenUiPanel>
              </div>
            ),
          }}
        />
      </div>
    </OpenUiProvider>
  );
}
