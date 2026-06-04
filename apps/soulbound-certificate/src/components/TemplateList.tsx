import { NeoButton, NeoCard } from "@shared/components-react";
import { EmptyStateArt } from "@shared/components-react/illustrations";
import { Copy, Share2 } from "lucide-react";
import type { TemplateItem } from "../types";

interface TemplateListProps {
  templates: TemplateItem[];
  refreshing: boolean;
  togglingId: string | null;
  hasAddress: boolean;
  connecting?: boolean;
  onRefresh: () => void;
  onConnect: () => void;
  onIssue: (template: TemplateItem) => void;
  onToggle: (template: TemplateItem) => void;
  onCopyIssueLink: (template: TemplateItem) => void;
  onShareIssueLink: (template: TemplateItem) => void;
  t: (key: string) => string;
}

function formatCount(value: bigint) {
  return value.toLocaleString("en-US");
}

export default function TemplateList({
  templates,
  refreshing,
  togglingId,
  hasAddress,
  connecting = false,
  onRefresh,
  onConnect,
  onIssue,
  onToggle,
  onCopyIssueLink,
  onShareIssueLink,
  t,
}: TemplateListProps) {
  return (
    <NeoCard title={t("yourTemplates")} className="templates-card">
      <div className="templates-header">
        <NeoButton
          size="sm"
          variant="secondary"
          loading={refreshing}
          onClick={onRefresh}
        >
          {t("refresh")}
        </NeoButton>
      </div>
      {!hasAddress ? (
        <div className="empty-state">
          <EmptyStateArt size={150} title={t("walletNotConnected")} />
          <span className="empty-title">{t("walletNotConnected")}</span>
          <span className="empty-hint">{t("walletNotConnectedHint")}</span>
          <NeoButton
            className="empty-action"
            size="sm"
            variant="primary"
            loading={connecting}
            disabled={connecting}
            onClick={onConnect}
          >
            {t("connectWallet")}
          </NeoButton>
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <EmptyStateArt size={150} title={t("emptyTemplates")} />
          <span className="empty-title">{t("emptyTemplates")}</span>
          <span className="empty-hint">{t("emptyTemplatesHint")}</span>
        </div>
      ) : (
        <div className="template-list">
          {templates.map((template) => {
            const exhausted = template.issued >= template.maxSupply;
            const busy = togglingId === template.id;
            return (
              <article key={template.id} className="template-card">
                <div className="template-card__main">
                  <div className="template-card__title-row">
                    <strong>{template.name || `#${template.id}`}</strong>
                    <span
                      className={`template-status ${
                        template.active ? "is-active" : "is-inactive"
                      }`}
                    >
                      {template.active ? t("statusActive") : t("statusInactive")}
                    </span>
                  </div>
                  <p>{template.description || t("emptyTemplateDescription")}</p>
                  <dl className="template-metrics">
                    <div>
                      <dt>{t("issuerName")}</dt>
                      <dd>{template.issuerName || template.issuer || "—"}</dd>
                    </div>
                    <div>
                      <dt>{t("category")}</dt>
                      <dd>{template.category || "—"}</dd>
                    </div>
                    <div>
                      <dt>{t("issued")}</dt>
                      <dd>
                        {formatCount(template.issued)}/
                        {formatCount(template.maxSupply)}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="template-actions">
                  <button
                    type="button"
                    className="certificate-button certificate-button--primary"
                    disabled={!template.active || exhausted}
                    onClick={() => onIssue(template)}
                  >
                    {exhausted ? t("soldOut") : t("issueCertificate")}
                  </button>
                  <button
                    type="button"
                    className="certificate-button"
                    disabled={busy}
                    onClick={() => onToggle(template)}
                  >
                    {busy
                      ? t("updating")
                      : template.active
                        ? t("deactivate")
                        : t("activate")}
                  </button>
                  <button
                    type="button"
                    className="certificate-icon-button"
                    onClick={() => onCopyIssueLink(template)}
                    aria-label={t("copyIssueLink")}
                    title={t("copyIssueLink")}
                  >
                    <Copy size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="certificate-icon-button"
                    onClick={() => onShareIssueLink(template)}
                    aria-label={t("shareIssueLink")}
                    title={t("shareIssueLink")}
                  >
                    <Share2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </NeoCard>
  );
}
