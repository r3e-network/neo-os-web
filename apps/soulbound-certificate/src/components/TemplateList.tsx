import { NeoButton, NeoCard } from "@shared/components-react";
import { StateView } from "@shared/components";
import { Copy, FileBadge, RefreshCw } from "lucide-react";
import type { TemplateItem } from "../types";

interface TemplateListProps {
  templates: TemplateItem[];
  refreshing: boolean;
  togglingId: string | null;
  hasAddress: boolean;
  onRefresh: () => void;
  onIssue: (template: TemplateItem) => void;
  onToggle: (template: TemplateItem) => void;
  onCopyIssueLink: (template: TemplateItem) => void;
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
  onRefresh,
  onIssue,
  onToggle,
  onCopyIssueLink,
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
          <RefreshCw size={15} aria-hidden="true" />
          {t("refresh")}
        </NeoButton>
      </div>
      {!hasAddress ? (
        <StateView
          kind="empty"
          title={t("walletNotConnected")}
          hint={t("walletNotConnectedHint")}
        />
      ) : templates.length === 0 ? (
        <StateView
          kind="empty"
          title={t("emptyTemplates")}
          hint={t("emptyTemplatesHint")}
        />
      ) : (
        <div className="template-list">
          {templates.map((template) => {
            const exhausted = template.issued >= template.maxSupply;
            const busy = togglingId === template.id;
            return (
              <article key={template.id} className="template-card">
                <div className="template-card__main">
                  <div className="template-card__title-row">
                    <span className="template-card__icon" aria-hidden="true">
                      <FileBadge size={18} />
                    </span>
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
                    aria-label={t("copyIssueShortcut")}
                    title={t("copyIssueShortcut")}
                  >
                    <Copy size={16} aria-hidden="true" />
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
