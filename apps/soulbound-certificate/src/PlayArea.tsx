/**
 * PlayArea.tsx — Soulbound Certificate
 *
 * NFT credential workbench. The certificate is the primary artifact, the
 * issuer's fields sit beside it as a compact dossier, and template/verify work
 * is secondary instead of flattening three form tabs onto the stage.
 */
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Award, BookOpenCheck, CalendarCheck, Clipboard, Pencil, Plus, RefreshCw, ScrollText, Search, Share2, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import CertificatePreview from "./components/CertificatePreview";
import { OpenUiPanel, OpenUiProvider, OpenUiSegmented, OpenUiTextArea, OpenUiTextField } from "./components/LightUi";
import TokenQr from "./components/TokenQr";
import {
  CERTIFICATE_LIMITS,
  buildCertificateVerifyUrl,
  isPositiveTemplateId,
  isValidCertificateTokenId,
  isValidNeoRecipient,
  type PendingCertificateOperation,
} from "./certificate-safety";
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
  maxSupply?: bigint | number | string;
  issued?: bigint | number | string;
  description?: string;
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
  const isRefreshing = bool("isRefreshing");
  const isRefreshingCertificates = bool("isRefreshingCertificates");
  const isIssuing = bool("isIssuing");
  const isCreatingTemplate = bool("isCreatingTemplate");
  const isUpdatingTemplate = bool("isUpdatingTemplate");
  const isVerifying = bool("isVerifying");
  const isRevoking = bool("isRevoking");
  const isRecovering = bool("isRecovering");
  const togglingId = str("togglingId", "");
  const lastError = str("lastError", "");
  const lastSuccess = str("lastSuccess", "");
  const lastNotice = str("lastNotice", "");
  const templatesSource = str("templatesSource", "chain");
  const certificatesSource = str("certificatesSource", "chain");
  const templatesValue = val("templates");
  const certificatesValue = val("certificates");
  const templates = useMemo(() => (templatesValue ?? []) as TemplateItem[], [templatesValue]);
  const certificates = useMemo(() => (certificatesValue ?? []) as CertificateItem[], [certificatesValue]);
  const verifiedCertificate = val<CertificateItem | null>("verifiedCertificate", null);
  const verifiedIsIssuer = bool("verifiedIsIssuer");
  const deepLinkTemplateId = str("deepLinkTemplateId", "");
  const deepLinkAutoIssue = bool("deepLinkAutoIssue");
  const deepLinkVerifyTokenId = str("deepLinkVerifyTokenId", "");
  const pendingOperation = val<PendingCertificateOperation | null>("pendingOperation", null);
  const recoveryStorageAvailable = bool("recoveryStorageAvailable");
  const hasPendingWrite = Boolean(pendingOperation?.txid);
  const verifyDeepLinkHandled = useRef("");
  const issueDeepLinkHandled = useRef("");
  const successHandled = useRef("");

  const [mode, setMode] = useState<WorkMode>(() =>
    deepLinkVerifyTokenId
      ? "verify"
      : deepLinkTemplateId || (["chain", "partial"].includes(templatesSource) && templates.some((template) => template.active !== false))
        ? "issue"
        : address ? "templates" : "verify",
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
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [recipientDetailsOpen, setRecipientDetailsOpen] = useState(false);
  const [templateDetailsOpen, setTemplateDetailsOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("templates");

  const isConnected = address.length > 0;
  const templatesComplete = templatesSource === "chain";
  // Every partial-list item was still read from its exact on-chain template
  // record. The list may be incomplete, but listed items remain safe to use;
  // issue/toggle also repeat an authoritative preflight immediately before a
  // wallet signature.
  const templatesActionable = templatesComplete || templatesSource === "partial";
  const certificatesTrusted = certificatesSource === "chain";
  const templatesUncertain = ["partial", "cache", "failed"].includes(templatesSource);
  const certificatesUncertain = ["partial", "cache", "failed"].includes(certificatesSource);
  const templateTrustNotice = templatesSource === "failed"
    ? t("templateLoadFailedHint")
    : templatesSource === "partial"
      ? t("partialTemplateNotice")
      : t("cachedDataNotice");
  const certificateTrustNotice = certificatesSource === "failed"
    ? t("certificateLoadFailedHint")
    : certificatesSource === "partial"
      ? t("partialChainNotice")
      : t("cachedDataNotice");
  const certificateUntrustedLabel = certificatesSource === "failed"
    ? t("statusUnavailable")
    : certificatesSource === "partial"
      ? t("partialVerifyRequired")
      : t("cachedVerifyRequired");
  const activeTemplates = templatesActionable ? templates.filter((tp) => tp.active !== false) : [];
  const selectedTemplate = templates.find((tp) => String(tp.id) === issueForm.templateId.trim());
  const editingTemplate = templates.find((tp) => String(tp.id) === editingTemplateId);
  const templateReady = isPositiveTemplateId(issueForm.templateId);
  const recipientReady = isValidNeoRecipient(issueForm.recipient);
  const recipientProfileReady =
    issueForm.recipientName.trim().length > 0 &&
    issueForm.recipientName.trim().length <= CERTIFICATE_LIMITS.recipientName &&
    issueForm.achievement.trim().length > 0 &&
    issueForm.achievement.trim().length <= CERTIFICATE_LIMITS.achievement;
  const issueReady =
    templateReady &&
    recipientReady &&
    recipientProfileReady &&
    issueForm.memo.trim().length <= CERTIFICATE_LIMITS.memo;
  const createSupply = Number(createForm.maxSupply.trim());
  const createReady =
    createForm.name.trim().length > 0 &&
    createForm.name.trim().length <= CERTIFICATE_LIMITS.templateName &&
    createForm.issuerName.trim().length > 0 &&
    createForm.issuerName.trim().length <= CERTIFICATE_LIMITS.issuerName &&
    createForm.category.trim().length > 0 &&
    createForm.category.trim().length <= CERTIFICATE_LIMITS.category &&
    createForm.description.trim().length <= CERTIFICATE_LIMITS.description &&
    Number.isInteger(createSupply) &&
    createSupply > 0 &&
    createSupply <= 100000;
  const editingIssued = Number(String(editingTemplate?.issued ?? "0"));
  const templateChanged = Boolean(
    editingTemplate && (
      createForm.name.trim() !== String(editingTemplate.name ?? "").trim() ||
      createForm.issuerName.trim() !== String(editingTemplate.issuerName ?? "").trim() ||
      createForm.category.trim() !== String(editingTemplate.category ?? "").trim() ||
      createForm.maxSupply.trim() !== String(editingTemplate.maxSupply ?? "").trim() ||
      createForm.description.trim() !== String(editingTemplate.description ?? "").trim()
    ),
  );
  const templateSubmitReady = createReady && (
    !editingTemplateId ||
    Boolean(editingTemplate && templateChanged && Number.isFinite(editingIssued) && createSupply >= editingIssued)
  );
  const templateWriteBusy = isCreatingTemplate || isUpdatingTemplate;
  const verifyReady = isValidCertificateTokenId(verifyTokenId);
  const selectedTemplateName = selectedTemplate?.name || (issueForm.templateId.trim() ? `${t("templateId")} #${issueForm.templateId.trim()}` : t("noTemplateSelected"));
  const recipientDisplay = issueForm.recipientName.trim() || issueForm.recipient.trim() || t("awardedToPlaceholder");
  const walletDisplay = isConnected ? compactAddress(address) : t("walletNotConnected");
  const verifiedMatchesInput = Boolean(
    verifiedCertificate && certificateToken(verifiedCertificate) === verifyTokenId.trim(),
  );
  const displayedVerifiedCertificate = verifiedMatchesInput ? verifiedCertificate : null;
  const verifiedTokenId = certificateToken(displayedVerifiedCertificate);
  const verifiedLink = verifiedTokenId
    ? buildCertificateVerifyUrl(verifiedTokenId)
    : "";
  const countLabel = (source: string, count: number) => {
    if (source === "chain") return String(count);
    if (source === "partial") return `${count}+`;
    if (source === "cache") return `${count}*`;
    return "—";
  };
  const templateCountLabel = countLabel(templatesSource, templates.length || templatesCount);
  const certificateCountLabel = countLabel(certificatesSource, certificates.length || certificatesCount);

  const handleIssue = () => {
    if (!isConnected || !recoveryStorageAvailable || !issueReady || hasPendingWrite) return;
    void dispatch("issueCertificate", issueForm);
  };
  const handleCreate = () => {
    if (!isConnected || !recoveryStorageAvailable || !templateSubmitReady || hasPendingWrite) return;
    if (editingTemplateId) {
      void dispatch("updateTemplate", { templateId: editingTemplateId, ...createForm });
      return;
    }
    void dispatch("createTemplate", createForm);
  };
  const handleVerify = () => {
    if (!verifyReady) return;
    void dispatch("verifyCertificate", { tokenId: verifyTokenId.trim() });
  };
  const handleConnect = () => void dispatch("connectWallet");
  const handleRefreshTemplates = () => void dispatch("refreshTemplates");
  const handleRefreshCertificates = () => void dispatch("refreshCertificates");
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
  const editTemplate = (template: TemplateItem) => {
    setEditingTemplateId(String(template.id));
    setActiveBlueprint("");
    setCreateForm({
      name: String(template.name ?? ""),
      issuerName: String(template.issuerName ?? ""),
      category: String(template.category ?? ""),
      maxSupply: String(template.maxSupply ?? ""),
      description: String(template.description ?? ""),
    });
    setTemplateDetailsOpen(true);
    setMode("templates");
  };
  const startNewTemplate = () => {
    setEditingTemplateId("");
    setActiveBlueprint("");
    setCreateForm({ name: "", issuerName: "", category: "", maxSupply: "", description: "" });
    setTemplateDetailsOpen(false);
    setMode("templates");
  };
  const selectCertificateForVerify = (certificate: CertificateItem) => {
    const tokenId = certificateToken(certificate);
    if (!tokenId) return;
    setVerifyTokenId(tokenId);
    setMode("verify");
  };

  useEffect(() => {
    if (!deepLinkVerifyTokenId) return;
    if (verifyDeepLinkHandled.current === deepLinkVerifyTokenId) return;
    verifyDeepLinkHandled.current = deepLinkVerifyTokenId;
    setVerifyTokenId(deepLinkVerifyTokenId);
    setMode("verify");
    void dispatch("consumeVerifyDeepLink").finally(() => {
      void dispatch("verifyCertificate", { tokenId: deepLinkVerifyTokenId });
    });
  }, [deepLinkVerifyTokenId, dispatch]);

  useEffect(() => {
    if (!deepLinkTemplateId && !deepLinkAutoIssue) return;
    const signature = `${deepLinkTemplateId}:${deepLinkAutoIssue ? "1" : "0"}`;
    if (issueDeepLinkHandled.current === signature) return;
    issueDeepLinkHandled.current = signature;
    if (deepLinkTemplateId) {
      setIssueForm((form) => ({ ...form, templateId: deepLinkTemplateId }));
    }
    setMode("issue");
    // The link prepares an issuer draft only. It never broadcasts or prompts a
    // wallet without the issuer deliberately pressing the primary action.
    void dispatch("consumeDeepLink");
  }, [deepLinkAutoIssue, deepLinkTemplateId, dispatch]);

  useEffect(() => {
    if (!lastSuccess) {
      successHandled.current = "";
      return;
    }
    if (successHandled.current === lastSuccess) return;
    successHandled.current = lastSuccess;
    if (lastSuccess === t("issuedSuccess")) {
      const tokenId = certificateToken(verifiedCertificate);
      setIssueForm((form) => ({ ...form, recipient: "", recipientName: "", achievement: "", memo: "" }));
      setRecipientDetailsOpen(false);
      if (tokenId) {
        setVerifyTokenId(tokenId);
        setMode("verify");
      }
    }
    if (lastSuccess === t("templateCreated") && !editingTemplateId) {
      setCreateForm({ name: "", issuerName: "", category: "", maxSupply: "", description: "" });
      setActiveBlueprint("");
      setTemplateDetailsOpen(false);
    }
  }, [editingTemplateId, lastSuccess, t, verifiedCertificate]);

  const modeItems: Array<{ mode: WorkMode; label: string; helper: string; Icon: LucideIcon }> = [
    { mode: "issue", label: t("issueTab"), helper: t("issueRecipientPassHint"), Icon: Award },
    { mode: "templates", label: t("templatesTab"), helper: t("createTemplateDrawerHint"), Icon: ScrollText },
    { mode: "verify", label: t("verifyTab"), helper: t("verifyDrawerHint"), Icon: Search },
  ];
  const drawerModes: Array<{ mode: DrawerMode; label: string; value: string; Icon: LucideIcon }> = [
    { mode: "templates", label: t("yourTemplates"), value: templateCountLabel, Icon: ScrollText },
    { mode: "certificates", label: t("certificatesTab"), value: certificateCountLabel, Icon: Award },
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

  const stepItems = mode === "templates"
    ? [
        { key: "design", label: t("templateFlowDesign"), ready: Boolean(createForm.name.trim() && createForm.issuerName.trim()) },
        { key: "policy", label: t("templateFlowPolicy"), ready: Boolean(createForm.category.trim() && Number.isInteger(createSupply) && createSupply > 0) },
        { key: "publish", label: t(editingTemplateId ? "templateFlowUpdate" : "templateFlowPublish"), ready: templateSubmitReady },
      ]
    : mode === "verify"
      ? [
          { key: "token", label: t("verifyFlowToken"), ready: verifyReady },
          { key: "chain", label: t("verifyFlowChain"), ready: Boolean(displayedVerifiedCertificate) },
          { key: "status", label: t("verifyFlowStatus"), ready: Boolean(displayedVerifiedCertificate) },
        ]
      : [
          { key: "template", label: t("issueFlowTemplate"), ready: templateReady },
          { key: "recipient", label: t("issueFlowRecipient"), ready: recipientReady && recipientProfileReady },
          { key: "seal", label: t("issueFlowMint"), ready: issueReady },
        ];

  const statusMessage = isIssuing
    ? t("mintLaneSealing")
    : !recoveryStorageAvailable
      ? t("recoveryStorageUnavailable")
      : !isConnected
        ? t("walletRequiredIssueHint")
        : issueReady
          ? t("mintLaneReady")
          : t("mintLaneDraft");

  const previewTitle = mode === "templates"
    ? createForm.name.trim()
    : mode === "verify" && displayedVerifiedCertificate
      ? String(displayedVerifiedCertificate.name || displayedVerifiedCertificate.templateName || "")
      : selectedTemplate?.name || (issueForm.templateId.trim() ? `${t("templateId")} #${issueForm.templateId.trim()}` : "");
  const previewIssuer = mode === "templates"
    ? createForm.issuerName
    : mode === "verify" && displayedVerifiedCertificate
      ? String(displayedVerifiedCertificate.issuerName || "")
      : selectedTemplate?.issuerName || createForm.issuerName;
  const previewRecipientName = mode === "templates"
    ? createForm.category
    : mode === "verify" && displayedVerifiedCertificate
      ? String(displayedVerifiedCertificate.recipientName || displayedVerifiedCertificate.recipient || "")
      : issueForm.recipientName;
  const previewAchievement = mode === "templates"
    ? createForm.description
    : mode === "verify" && displayedVerifiedCertificate
      ? String(displayedVerifiedCertificate.achievement || displayedVerifiedCertificate.name || "")
      : issueForm.achievement;
  const previewFooter = mode === "templates"
    ? createForm.maxSupply.trim()
      ? `${t("maxSupply")}: ${createForm.maxSupply.trim()}`
      : t("templateBlueprintFoot")
    : mode === "verify"
      ? verifiedTokenId
        ? `${t("tokenId")}: ${verifiedTokenId}`
        : t("verifyDrawerHint")
      : selectedTemplate
      ? `${t("templateId")} #${selectedTemplate.id}`
      : issueForm.memo.trim() || t("issueDossierLabel");
  // Form completeness only means "ready to sign". A certificate stops being a
  // preview exclusively after an exact, authoritative verification read.
  const previewDraft = !displayedVerifiedCertificate;
  const sealStateLabel = issueReady ? t("credentialReadyLabel") : t("credentialDraftLabel");
  const workbenchState = hasPendingWrite
    ? "pending"
    : isIssuing
      ? "sealing"
      : isCreatingTemplate
        ? "publishing"
        : isUpdatingTemplate
          ? "updating"
        : isVerifying
          ? "verifying"
          : mode === "verify" && displayedVerifiedCertificate
            ? displayedVerifiedCertificate.revoked ? "revoked" : "verified"
            : mode === "templates" ? templateSubmitReady ? "ready" : "draft" : issueReady ? "ready" : "draft";

  const verifiedStatus = displayedVerifiedCertificate ? (
    <span className={["cert-badge", displayedVerifiedCertificate.revoked ? "cert-badge--revoked" : "cert-badge--valid"].join(" ")}>
      {displayedVerifiedCertificate.revoked ? t("certificateRevoked") : t("certificateValid")}
    </span>
  ) : null;
  const previewStatus = mode === "verify"
    ? verifiedStatus ?? <span className="cert-badge cert-badge--preview">{t("verificationPendingLabel")}</span>
    : <span className="cert-badge cert-badge--preview">
        {mode === "templates" ? t("templatePreviewLabel") : t("certificatePreviewLabel")}
      </span>;
  const primary = (() => {
    if (hasPendingWrite) {
      if (!recoveryStorageAvailable) {
        return {
          label: t("retryRecoveryStorage"),
          onClick: () => void dispatch("refreshRecoveryStorage"),
          hint: t("recoveryStorageUnavailable"),
        };
      }
      if (!isConnected) {
        return {
          label: isConnecting ? t("connecting") : t("connectWallet"),
          onClick: handleConnect,
          loading: isConnecting,
          hint: t("pendingContextMismatch"),
        };
      }
      return {
        label: isRecovering ? t("checkingConfirmation") : t("checkConfirmation"),
        onClick: () => void dispatch("recoverPendingOperation"),
        loading: isRecovering,
        hint: lastNotice || t("transactionPending"),
      };
    }

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

    if (!recoveryStorageAvailable) {
      return {
        label: t("retryRecoveryStorage"),
        onClick: () => void dispatch("refreshRecoveryStorage"),
        hint: t("recoveryStorageUnavailable"),
      };
    }

    if (mode === "issue") {
      return {
        label: isIssuing ? t("issuing") : t("issue"),
        onClick: handleIssue,
        disabled: !recoveryStorageAvailable || !issueReady,
        loading: isIssuing,
        hint: statusMessage,
      };
    }

    return {
      label: templateWriteBusy
        ? t(editingTemplateId ? "updating" : "creating")
        : t(editingTemplateId ? "updateTemplate" : "createTemplate"),
      onClick: handleCreate,
      disabled: !recoveryStorageAvailable || !templateSubmitReady,
      loading: templateWriteBusy,
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
                {templatesActionable ? (
                  <span className="cert-drawer-item__actions">
                    <button
                      type="button"
                      className="cert-drawer-action cert-drawer-action--edit"
                      onClick={() => editTemplate(tp)}
                      disabled={!isConnected || hasPendingWrite || templateWriteBusy}
                    >
                      <Pencil size={13} aria-hidden="true" /> {t("editTemplate")}
                    </button>
                    <button
                      type="button"
                      className="cert-drawer-action"
                      onClick={() => void dispatch("toggleTemplate", tp)}
                      disabled={!isConnected || !recoveryStorageAvailable || hasPendingWrite || Boolean(togglingId) || templateWriteBusy}
                    >
                      {togglingId === String(tp.id)
                        ? t("updating")
                        : tp.active === false ? t("activate") : t("deactivate")}
                    </button>
                  </span>
                ) : (
                  <span className="cert-drawer-status cert-drawer-status--cached">{t("cachedVerifyRequired")}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="cert-drawer-empty">
            <strong>{templatesSource === "failed" ? t("loadFailed") : t("emptyTemplates")}</strong>
            <span>{templatesSource === "failed" ? t("templateLoadFailedHint") : t("emptyTemplatesHint")}</span>
            {isConnected && templatesSource === "failed" && (
              <button type="button" className="cert-drawer-action cert-drawer-retry" onClick={handleRefreshTemplates} disabled={isRefreshing}>
                <RefreshCw size={14} className={isRefreshing ? "cert-icon--spin" : undefined} aria-hidden="true" />
                {isRefreshing ? t("refreshing") : t("retryTemplates")}
              </button>
            )}
          </div>
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
                <span className={certificatesTrusted ? cert.revoked ? "cert-drawer-status cert-drawer-status--revoked" : "cert-drawer-status" : "cert-drawer-status cert-drawer-status--cached"}>
                  {certificatesTrusted ? cert.revoked ? t("certificateRevoked") : t("certificateValid") : certificateUntrustedLabel}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="cert-drawer-empty">
            <strong>
              {certificatesSource === "failed"
                ? t("certificateLoadFailed")
                : certificatesSource === "partial"
                  ? t("partialCertificateEmpty")
                  : t("emptyCertificates")}
            </strong>
            <span>
              {certificatesSource === "failed"
                ? t("certificateLoadFailedHint")
                : certificatesSource === "partial"
                  ? t("partialChainNotice")
                  : t("emptyCertificatesHint")}
            </span>
            {isConnected && ["failed", "partial"].includes(certificatesSource) && (
              <button type="button" className="cert-drawer-action cert-drawer-retry" onClick={handleRefreshCertificates} disabled={isRefreshingCertificates}>
                <RefreshCw size={14} className={isRefreshingCertificates ? "cert-icon--spin" : undefined} aria-hidden="true" />
                {isRefreshingCertificates ? t("refreshing") : t("retryCertificateWallet")}
              </button>
            )}
          </div>
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
    <div className="cert-workbench" data-mode={mode} data-state={workbenchState}>
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
            status={previewStatus}
            footer={<span>{previewFooter}</span>}
            draft={previewDraft}
            textureSrc={CERTIFICATE_PAPER_ART}
          />
          <div className="cert-credential-strip" aria-label={t("credentialStripLabel")}>
            <span>
              <small>{t("credentialStripTemplate")}</small>
              <strong>
                {mode === "templates"
                  ? createForm.name.trim() || t("templateNamePlaceholder")
                  : mode === "verify" && displayedVerifiedCertificate
                    ? certificateTitle(displayedVerifiedCertificate, t("certificateValid"))
                    : selectedTemplateName}
              </strong>
            </span>
            <span>
              <small>{t("credentialStripRecipient")}</small>
              <strong>
                {mode === "templates"
                  ? createForm.category.trim() || t("categoryPlaceholder")
                  : mode === "verify" && displayedVerifiedCertificate
                    ? String(displayedVerifiedCertificate.recipientName || displayedVerifiedCertificate.recipient || "")
                    : recipientDisplay}
              </strong>
            </span>
            <span>
              <small>{t("credentialStripSeal")}</small>
              <strong>
                {mode === "templates"
                  ? t("templateBlueprintLabel")
                  : mode === "verify"
                    ? displayedVerifiedCertificate
                      ? displayedVerifiedCertificate.revoked ? t("certificateRevoked") : t("certificateValid")
                      : t("verifyFlowStatus")
                    : sealStateLabel}
              </strong>
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
          {lastNotice && (
            <div className="cert-controls__notice" role="status">
              <span>
                <strong>{lastNotice}</strong>
                {pendingOperation?.txid && <small>{compactAddress(pendingOperation.txid)}</small>}
              </span>
            </div>
          )}
          {!recoveryStorageAvailable && (
            hasPendingWrite || mode !== "verify" || Boolean(displayedVerifiedCertificate && verifiedIsIssuer)
          ) && (
            <p className="cert-data-trust cert-data-trust--warning" role="alert">
              <TriangleAlert size={14} aria-hidden="true" />
              {t("recoveryStorageUnavailable")}
            </p>
          )}
          {((mode !== "verify" && templatesUncertain) || (mode === "verify" && certificatesUncertain)) && (
            <p className="cert-data-trust">
              <ShieldCheck size={14} aria-hidden="true" />
              {mode === "verify" ? certificateTrustNotice : templateTrustNotice}
            </p>
          )}

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
                {activeTemplates.length === 0 && (
                  <span className="cert-controls__hint">
                    {templatesUncertain ? templateTrustNotice : t("emptyTemplatesHint")}
                  </span>
                )}
              </div>
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
                    maxLength={42}
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
                      maxLength={CERTIFICATE_LIMITS.recipientName}
                      disabled={isIssuing}
                    />
                    <OpenUiTextField
                      className="cert-field"
                      inputClassName="cert-input"
                      label={t("achievement")}
                      value={issueForm.achievement}
                      onChange={(e) => setIssueForm((f) => ({ ...f, achievement: e.target.value }))}
                      placeholder={t("achievementPlaceholder")}
                      maxLength={CERTIFICATE_LIMITS.achievement}
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
                  maxLength={20}
                  disabled={isIssuing}
                />
                <OpenUiTextField
                  className="cert-field"
                  inputClassName="cert-input"
                  label={t("memo")}
                  value={issueForm.memo}
                  onChange={(e) => setIssueForm((f) => ({ ...f, memo: e.target.value }))}
                  placeholder={t("memoPlaceholder")}
                  maxLength={CERTIFICATE_LIMITS.memo}
                  disabled={isIssuing}
                />
              </details>
            </div>
          )}

          {mode === "templates" && (
            <div className="cert-dossier cert-dossier--template">
              <div className="cert-dossier__head">
                <span>{t(editingTemplateId ? "updateTemplate" : "createTemplate")}</span>
                <small>{t(editingTemplateId ? "updateTemplateHelp" : "createTemplateHelp")}</small>
              </div>
              <div className="cert-blueprint-card" aria-label={t("templateBlueprintLabel")}>
                <span>{editingTemplateId ? `${t("editingTemplate")} #${editingTemplateId}` : t("templateBlueprintLabel")}</span>
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
                      disabled={templateWriteBusy}
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
                  <span>{editingTemplateId ? t("editingTemplate") : t("templateBlueprintLabel")}</span>
                  <strong>{createForm.name.trim() || t("templateNamePlaceholder")}</strong>
                  <small>
                    {(createForm.category.trim() || t("categoryPlaceholder"))} · {createForm.maxSupply.trim() || t("maxSupplyPlaceholder")}
                  </small>
                </div>
                <span className="cert-template-dossier__actions">
                  {editingTemplateId && (
                    <button
                      type="button"
                      className="cert-template-new"
                      onClick={startNewTemplate}
                      disabled={templateWriteBusy}
                    >
                      <Plus size={13} aria-hidden="true" /> {t("newTemplate")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="cert-detail-toggle"
                    onClick={() => setTemplateDetailsOpen((value) => !value)}
                    aria-expanded={templateDetailsOpen}
                    disabled={templateWriteBusy}
                  >
                    {t("templateDetails")}
                  </button>
                </span>
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
                      maxLength={CERTIFICATE_LIMITS.templateName}
                      disabled={templateWriteBusy}
                    />
                    <OpenUiTextField
                      className="cert-field"
                      inputClassName="cert-input"
                      label={t("issuerName")}
                      value={createForm.issuerName}
                      onChange={(e) => updateCreateForm("issuerName", e.target.value)}
                      placeholder={t("issuerNamePlaceholder")}
                      maxLength={CERTIFICATE_LIMITS.issuerName}
                      disabled={templateWriteBusy}
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
                        maxLength={CERTIFICATE_LIMITS.category}
                        disabled={templateWriteBusy}
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
                        disabled={templateWriteBusy}
                      />
                    </div>
                    <OpenUiTextArea
                      className="cert-field cert-field--textarea"
                      textareaClassName="cert-input cert-input--textarea"
                      label={t("description")}
                      value={createForm.description}
                      onChange={(e) => updateCreateForm("description", e.target.value)}
                      placeholder={t("descriptionPlaceholder")}
                      maxLength={CERTIFICATE_LIMITS.description}
                      disabled={templateWriteBusy}
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
                <small>{displayedVerifiedCertificate ? displayedVerifiedCertificate.revoked ? t("certificateRevoked") : t("certificateValid") : t("certificateNotFoundHint")}</small>
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
                          <span>{certificatesTrusted ? certificate.revoked ? t("certificateRevoked") : t("certificateValid") : certificateUntrustedLabel}</span>
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
                maxLength={41}
                spellCheck={false}
                mono
              />
              {displayedVerifiedCertificate ? (
                <div className="cert-verify-card">
                  <div>
                    <strong>{certificateTitle(displayedVerifiedCertificate, t("certificateValid"))}</strong>
                    <span>{displayedVerifiedCertificate.revoked ? t("certificateRevoked") : t("soulboundNote")}</span>
                  </div>
                  <TokenQr value={verifiedLink} size={86} label={t("tokenQrLabel")} />
                  <div className="cert-verify-card__actions">
                    <button type="button" className="cert-share-action" onClick={() => void dispatch("copyVerifyLink", verifiedTokenId)}>
                      <Clipboard size={14} aria-hidden="true" /> {t("copyVerifyLink")}
                    </button>
                    <button type="button" className="cert-share-action" onClick={() => void dispatch("shareVerifyLink", verifiedTokenId)}>
                      <Share2 size={14} aria-hidden="true" /> {t("shareVerifyLink")}
                    </button>
                    {verifiedIsIssuer && !displayedVerifiedCertificate.revoked && (
                      <button
                        type="button"
                        className="cert-revoke-action"
                        onClick={() => void dispatch("revokeCertificate", { tokenId: verifiedTokenId })}
                        disabled={!recoveryStorageAvailable || hasPendingWrite || isRevoking}
                      >
                        {isRevoking ? t("revoking") : t("revoke")}
                      </button>
                    )}
                  </div>
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
            eyebrow: t(mode === "verify" ? "verifierWorkspaceTitle" : "issuerWorkspaceTitle"),
            title: t("certificateHeroTitle"),
            subtitle: t("docSubtitle"),
            badges: (
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {t("soulboundStandard")}
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
