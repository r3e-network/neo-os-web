import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable, ObservableState } from "@shared/react/context";
import { formatHash } from "@shared/utils/format";
import TemplateList from "./components/TemplateList";
import TokenQr from "./components/TokenQr";
import type { CertificateItem, TemplateItem } from "./types";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable> | ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

function tokenLabel(tokenId: string) {
  if (!tokenId) return "";
  return tokenId.length > 18 ? `${tokenId.slice(0, 10)}...${tokenId.slice(-6)}` : tokenId;
}

/**
 * Format an on-chain unix-seconds timestamp for display. Returns an empty
 * string for unset/zero timestamps so the caller can skip the row entirely.
 */
function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

/**
 * Identity badge glyph rendered in the app's own accent (inherits currentColor
 * from the hero badge), so the header stays monochromatic with the green
 * platform accent instead of the shared coral identity tile.
 */
function IdentityGlyph({ title }: { title: string }) {
  return (
    <svg
      className="hero-badge__glyph"
      width={26}
      height={26}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <rect
        x="11"
        y="13"
        width="26"
        height="22"
        rx="6"
        fill="currentColor"
        fillOpacity="0.22"
      />
      <circle cx="24" cy="22" r="4.4" fill="currentColor" />
      <path
        d="M16.5 32c1.6-4 13.4-4 15 0"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, str, bool, val } = useStateBindings(state as ObservableState);

  const templatesCount = num("templatesCount");
  const certificatesCount = num("certificatesCount");
  const activeTemplatesCount = num("activeTemplatesCount");
  const templates = val<TemplateItem[]>("templates", []) ?? [];
  const certificates = val<CertificateItem[]>("certificates", []) ?? [];
  const verifiedCertificate = val<CertificateItem | null>(
    "verifiedCertificate",
    null,
  );
  const verifiedIsIssuer = bool("verifiedIsIssuer");
  const address = str("address", "");
  const isConnecting = bool("isConnecting");
  const isRefreshing = bool("isRefreshing");
  const isLoading = bool("isLoading");
  const isCreatingTemplate = bool("isCreatingTemplate");
  const isIssuing = bool("isIssuing");
  const isVerifying = bool("isVerifying");
  const isRevoking = bool("isRevoking");
  const togglingId = str("togglingId", "");
  const lastTxid = str("lastTxid", "");
  const lastError = str("lastError", "");
  const lastSuccess = str("lastSuccess", "");
  const deepLinkTemplateId = str("deepLinkTemplateId", "");
  const deepLinkAutoIssue = bool("deepLinkAutoIssue");
  const deepLinkVerifyTokenId = str("deepLinkVerifyTokenId", "");

  const [createForm, setCreateForm] = useState({
    name: "Neo Course Completion",
    issuerName: "Neo Academy",
    category: "Course",
    maxSupply: "1000",
    description: "Issued to graduates who completed the Neo builder track.",
  });
  const [issueForm, setIssueForm] = useState({
    templateId: "",
    recipient: "",
    recipientName: "",
    achievement: "",
    memo: "",
  });
  const [verifyTokenId, setVerifyTokenId] = useState("");

  const issuePanelRef = useRef<HTMLDivElement | null>(null);
  const deepLinkApplied = useRef(false);
  const verifyDeepLinkApplied = useRef(false);

  // Read side of the Copy/Share Issue Link deep-link: when the app is opened
  // with ?issueTemplateId=…, preselect that template in the Issue panel (and
  // scroll it into view when the link asked to auto-draft) instead of leaving
  // the recipient on the default state. Apply once, then clear the launch flag.
  useEffect(() => {
    if (deepLinkApplied.current) return;
    const linkedTemplateId = deepLinkTemplateId.trim();
    if (!linkedTemplateId) return;
    deepLinkApplied.current = true;
    setIssueForm((current) =>
      current.templateId
        ? current
        : { ...current, templateId: linkedTemplateId },
    );
    // The anchor uses `display: contents` (no box of its own), so scroll the
    // rendered NeoCard element it wraps. Guard scrollIntoView for environments
    // (and older runtimes) where it is unavailable.
    const panelEl = issuePanelRef.current?.firstElementChild;
    if (
      deepLinkAutoIssue &&
      panelEl instanceof HTMLElement &&
      typeof panelEl.scrollIntoView === "function"
    ) {
      panelEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    void dispatch("consumeDeepLink");
  }, [deepLinkTemplateId, deepLinkAutoIssue, dispatch]);

  // Recipient-facing verify deep-link (?verifyTokenId=…): prefill and run the
  // permissionless Verify lookup once so a shared certificate opens already
  // resolved instead of on the empty default state.
  useEffect(() => {
    if (verifyDeepLinkApplied.current) return;
    const linkedTokenId = deepLinkVerifyTokenId.trim();
    if (!linkedTokenId) return;
    verifyDeepLinkApplied.current = true;
    setVerifyTokenId(linkedTokenId);
    void dispatch("verifyCertificate", { tokenId: linkedTokenId });
    void dispatch("consumeVerifyDeepLink");
  }, [deepLinkVerifyTokenId, dispatch]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === issueForm.templateId),
    [issueForm.templateId, templates],
  );
  const issuableTemplates = useMemo(
    () => templates.filter((template) => template.active),
    [templates],
  );
  const createFormValid =
    createForm.name.trim() &&
    createForm.issuerName.trim() &&
    createForm.category.trim() &&
    Number.isInteger(Number(createForm.maxSupply)) &&
    Number(createForm.maxSupply) > 0 &&
    Number(createForm.maxSupply) <= 100000;
  const issueFormValid =
    issueForm.templateId.trim() &&
    issueForm.recipient.trim() &&
    issueForm.recipientName.trim() &&
    issueForm.achievement.trim();
  const verifyFormValid = verifyTokenId.trim().length > 0;
  const hasAddress = Boolean(address);
  const hasMetrics =
    templatesCount > 0 || certificatesCount > 0 || activeTemplatesCount > 0;

  const updateCreateForm = (key: keyof typeof createForm, value: string) => {
    setCreateForm((current) => ({ ...current, [key]: value }));
  };
  const updateIssueForm = (key: keyof typeof issueForm, value: string) => {
    setIssueForm((current) => ({ ...current, [key]: value }));
  };
  const selectTemplateForIssue = (template: TemplateItem) => {
    setIssueForm((current) => ({
      ...current,
      templateId: template.id,
      achievement: current.achievement || template.name,
    }));
  };
  const submitCreateTemplate = () => {
    if (!createFormValid || isCreatingTemplate) return;
    void dispatch("createTemplate", createForm);
  };
  const submitIssueCertificate = () => {
    if (!issueFormValid || isIssuing) return;
    void dispatch("issueCertificate", issueForm);
  };
  const submitVerify = () => {
    if (!verifyFormValid || isVerifying) return;
    void dispatch("verifyCertificate", { tokenId: verifyTokenId });
  };
  const submitRevoke = (tokenId: string) => {
    if (!tokenId || isRevoking) return;
    void dispatch("revokeCertificate", { tokenId });
  };

  return (
    <div className="certificate-play-area">
      <section className="certificate-hero" aria-label={t("title")}>
        <div className="hero-lead">
          <div className="hero-badge">
            <IdentityGlyph title={t("title")} />
          </div>
          <div className="hero-copy">
            <span className="hero-eyebrow">{t("issuerWorkspaceTitle")}</span>
            <h2 className="hero-title">{t("title")}</h2>
            <p className="hero-subtitle">{t("docSubtitle")}</p>
            {hasMetrics && (
              <p className="hero-metrics">
                <span>
                  <strong>{templatesCount}</strong> {t("templatesTab")}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong>{activeTemplatesCount}</strong> {t("sidebarActive")}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong>{certificatesCount}</strong> {t("certificatesTab")}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="connect-prompt">
          {hasAddress ? (
            <span className="wallet-chip">
              {t("walletConnected")}: {formatHash(address, 8, 6)}
            </span>
          ) : (
            <NeoButton
              variant="primary"
              loading={isConnecting}
              disabled={isConnecting}
              onClick={() => dispatch("connectWallet")}
            >
              {t("connectWallet")}
            </NeoButton>
          )}
        </div>
      </section>

      {(lastSuccess || lastError || lastTxid) && (
        <div
          className={`certificate-status-strip${
            lastError ? " certificate-status-strip--error" : ""
          }`}
          role={lastError ? "alert" : "status"}
        >
          <strong>{lastError || lastSuccess}</strong>
          {lastTxid && <code>tx {formatHash(lastTxid, 10, 8)}</code>}
        </div>
      )}

      <div className="certificate-workspace">
        <div className="certificate-column">
        <div className="issue-panel-anchor" ref={issuePanelRef}>
        <NeoCard title={t("issueCertificate")} className="certificate-panel">
          <p className="panel-copy">{t("issueHelp")}</p>

          {selectedTemplate && (
            <div className="selected-template">
              <span>{t("selectedTemplate")}</span>
              <strong>{`${selectedTemplate.name} #${selectedTemplate.id}`}</strong>
            </div>
          )}

          {!selectedTemplate && issuableTemplates.length > 0 && (
            <div className="template-picker" role="list">
              {issuableTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  role="listitem"
                  className="template-chip"
                  onClick={() => selectTemplateForIssue(template)}
                >
                  <span className="template-chip__name">
                    {template.name || `#${template.id}`}
                  </span>
                  <span className="template-chip__meta">#{template.id}</span>
                </button>
              ))}
            </div>
          )}

          <div className="certificate-form-grid">
            <label className="certificate-field">
              <span>{t("templateId")}</span>
              <input
                value={issueForm.templateId}
                placeholder={t("templateIdPlaceholder")}
                onChange={(event) =>
                  updateIssueForm("templateId", event.currentTarget.value)
                }
              />
            </label>
            <label className="certificate-field">
              <span>{t("issueRecipient")}</span>
              <input
                value={issueForm.recipient}
                placeholder={t("issueRecipientPlaceholder")}
                onChange={(event) =>
                  updateIssueForm("recipient", event.currentTarget.value)
                }
              />
            </label>
            <label className="certificate-field">
              <span>{t("recipientName")}</span>
              <input
                value={issueForm.recipientName}
                placeholder={t("recipientNamePlaceholder")}
                onChange={(event) =>
                  updateIssueForm("recipientName", event.currentTarget.value)
                }
              />
            </label>
            <label className="certificate-field">
              <span>{t("achievement")}</span>
              <input
                value={issueForm.achievement}
                placeholder={t("achievementPlaceholder")}
                onChange={(event) =>
                  updateIssueForm("achievement", event.currentTarget.value)
                }
              />
            </label>
            <label className="certificate-field">
              <span>{t("memo")}</span>
              <input
                value={issueForm.memo}
                placeholder={t("memoPlaceholder")}
                onChange={(event) =>
                  updateIssueForm("memo", event.currentTarget.value)
                }
              />
            </label>
          </div>
          <NeoButton
            variant="primary"
            block
            loading={isIssuing}
            disabled={!issueFormValid || isIssuing}
            onClick={submitIssueCertificate}
          >
            {isIssuing ? t("issuing") : t("issue")}
          </NeoButton>
        </NeoCard>
        </div>

          <NeoCard
            title={t("certificatesTab")}
            variant="default"
            className="certificates-card"
          >
            {certificates.length > 0 ? (
              <div className="certificates-grid">
                {certificates.map((cert, idx) => (
                  <div key={cert.tokenId || String(idx)} className="cert-item">
                    <div className="cert-info">
                      <span className="cert-name">
                        {cert.templateName || `#${idx + 1}`}
                      </span>
                      <span className="cert-recipient">
                        {cert.recipientName || tokenLabel(cert.tokenId)}
                      </span>
                    </div>
                    <div className="cert-row-actions">
                      <span
                        className={`cert-badge ${cert.revoked ? "revoked" : "valid"}`}
                      >
                        {cert.revoked
                          ? t("certificateRevoked")
                          : t("certificateValid")}
                      </span>
                      <button
                        type="button"
                        className="certificate-button"
                        onClick={() => {
                          setVerifyTokenId(cert.tokenId);
                          void dispatch("verifyCertificate", {
                            tokenId: cert.tokenId,
                          });
                        }}
                      >
                        {t("lookup")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-note">{t("emptyCertificatesHint")}</div>
            )}
          </NeoCard>
        </div>

        <div className="certificate-column">
          <TemplateList
            templates={templates}
            refreshing={isRefreshing}
            togglingId={togglingId || null}
            hasAddress={hasAddress}
            connecting={isConnecting}
            onRefresh={() => dispatch("refreshTemplates")}
            onConnect={() => dispatch("connectWallet")}
            onIssue={selectTemplateForIssue}
            onToggle={(template) => dispatch("toggleTemplate", template)}
            onCopyIssueLink={(template) => dispatch("copyIssueLink", template)}
            t={t}
          />

          <NeoCard title={t("createTemplate")} className="certificate-panel">
            <div className="panel-head">
              <p className="panel-copy">{t("createTemplateHelp")}</p>
            </div>
            <div className="certificate-form-grid">
                  <label className="certificate-field">
                    <span>{t("templateName")}</span>
                    <input
                      value={createForm.name}
                      placeholder={t("templateNamePlaceholder")}
                      onChange={(event) =>
                        updateCreateForm("name", event.currentTarget.value)
                      }
                    />
                  </label>
                  <label className="certificate-field">
                    <span>{t("issuerName")}</span>
                    <input
                      value={createForm.issuerName}
                      placeholder={t("issuerNamePlaceholder")}
                      onChange={(event) =>
                        updateCreateForm("issuerName", event.currentTarget.value)
                      }
                    />
                  </label>
                  <label className="certificate-field">
                    <span>{t("category")}</span>
                    <input
                      value={createForm.category}
                      placeholder={t("categoryPlaceholder")}
                      onChange={(event) =>
                        updateCreateForm("category", event.currentTarget.value)
                      }
                    />
                  </label>
                  <label className="certificate-field">
                    <span>{t("maxSupply")}</span>
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      step="1"
                      value={createForm.maxSupply}
                      placeholder={t("maxSupplyPlaceholder")}
                      aria-invalid={
                        createForm.maxSupply !== "" &&
                        !Number.isInteger(Number(createForm.maxSupply))
                      }
                      onChange={(event) =>
                        updateCreateForm("maxSupply", event.currentTarget.value)
                      }
                    />
                  </label>
                  <label className="certificate-field certificate-field--wide">
                    <span>{t("description")}</span>
                    <textarea
                      value={createForm.description}
                      placeholder={t("descriptionPlaceholder")}
                      onChange={(event) =>
                        updateCreateForm("description", event.currentTarget.value)
                      }
                    />
                  </label>
                </div>
                <NeoButton
                  variant="primary"
                  block
                  loading={isCreatingTemplate}
                  disabled={!createFormValid || isCreatingTemplate}
                  onClick={submitCreateTemplate}
                >
              {isCreatingTemplate ? t("creating") : t("createTemplate")}
            </NeoButton>
          </NeoCard>

          <NeoCard title={t("verifyTab")} variant="default" className="verify-card">
            <p className="panel-copy">{t("verifyHelp")}</p>
            <div className="verify-row">
              <label className="certificate-field certificate-field--grow">
                <span>{t("verifyTokenId")}</span>
                <input
                  value={verifyTokenId}
                  placeholder={t("verifyTokenIdPlaceholder")}
                  onChange={(event) => setVerifyTokenId(event.currentTarget.value)}
                />
              </label>
              <NeoButton
                variant="primary"
                loading={isVerifying}
                disabled={!verifyFormValid || isVerifying}
                onClick={submitVerify}
              >
                {isVerifying ? t("lookingUp") : t("lookup")}
              </NeoButton>
            </div>

            {isLoading && (
              <div className="loading-content">
                <div className="loading-spinner" />
                <span className="loading-text">{t("lookingUp")}</span>
              </div>
            )}

            {verifiedCertificate ? (
              <div className="certificate-detail">
                <div className="certificate-detail__top">
                  <strong>
                    {verifiedCertificate.templateName ||
                      tokenLabel(verifiedCertificate.tokenId)}
                  </strong>
                  <span
                    className={`cert-badge ${
                      verifiedCertificate.revoked ? "revoked" : "valid"
                    }`}
                  >
                    {verifiedCertificate.revoked
                      ? t("certificateRevoked")
                      : t("certificateValid")}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>{t("tokenId")}</dt>
                    <dd>{tokenLabel(verifiedCertificate.tokenId)}</dd>
                  </div>
                  <div>
                    <dt>{t("recipientName")}</dt>
                    <dd>{verifiedCertificate.recipientName || "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("achievement")}</dt>
                    <dd>{verifiedCertificate.achievement || "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("issueRecipient")}</dt>
                    <dd>{formatHash(verifiedCertificate.owner, 8, 6)}</dd>
                  </div>
                  {formatTimestamp(verifiedCertificate.issuedTime) && (
                    <div>
                      <dt>{t("issuedAt")}</dt>
                      <dd>{formatTimestamp(verifiedCertificate.issuedTime)}</dd>
                    </div>
                  )}
                  {verifiedCertificate.revoked &&
                    formatTimestamp(verifiedCertificate.revokedTime) && (
                      <div>
                        <dt>{t("certificateRevoked")}</dt>
                        <dd>{formatTimestamp(verifiedCertificate.revokedTime)}</dd>
                      </div>
                    )}
                </dl>

                <div className="certificate-detail__qr">
                  <TokenQr
                    value={verifiedCertificate.tokenId}
                    label={t("tokenQrLabel")}
                  />
                  <span className="certificate-detail__qr-caption">
                    {t("tokenQrCaption")}
                  </span>
                </div>

                <div className="certificate-detail__share">
                  <button
                    type="button"
                    className="certificate-button"
                    onClick={() =>
                      dispatch("copyVerifyLink", verifiedCertificate.tokenId)
                    }
                  >
                    <Copy size={15} aria-hidden="true" />
                    <span>{t("copyVerifyLink")}</span>
                  </button>
                  <button
                    type="button"
                    className="certificate-button"
                    onClick={() =>
                      dispatch("shareVerifyLink", verifiedCertificate.tokenId)
                    }
                  >
                    <Share2 size={15} aria-hidden="true" />
                    <span>{t("shareVerifyLink")}</span>
                  </button>
                </div>

                {!verifiedCertificate.revoked && verifiedIsIssuer && (
                  <div className="certificate-detail__revoke">
                    <NeoButton
                      size="sm"
                      variant="danger"
                      loading={isRevoking}
                      disabled={isRevoking}
                      onClick={() => submitRevoke(verifiedCertificate.tokenId)}
                    >
                      {isRevoking ? t("revoking") : t("revoke")}
                    </NeoButton>
                  </div>
                )}
                {!verifiedCertificate.revoked && !verifiedIsIssuer && (
                  <p className="certificate-detail__note">
                    {t("onlyIssuerCanRevoke")}
                  </p>
                )}
              </div>
            ) : (
              <div className="empty-note">{t("certificateNotFoundHint")}</div>
            )}
          </NeoCard>
        </div>
      </div>
    </div>
  );
}
