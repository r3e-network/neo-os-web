import { NeoCard, NeoButton } from "@shared/components-react";

interface TemplateListProps {
  templates: unknown[]; refreshing: boolean; togglingId: string | null; hasAddress: boolean;
  onRefresh: () => void; onConnect: () => void; onIssue: (template: unknown) => void;
  onToggle: (template: unknown) => void; onCopyIssueLink: (template: unknown) => void;
  onShareIssueLink: (template: unknown) => void; t: (key: string) => string;
}

export default function TemplateList({ templates, refreshing, togglingId, hasAddress, onRefresh, onConnect, onIssue, onToggle, onCopyIssueLink, onShareIssueLink, t }: TemplateListProps) {
  return (
    <NeoCard title={t("yourTemplates")}>
      <div className="templates-header">
        <NeoButton size="sm" variant="secondary" loading={refreshing} onClick={onRefresh}>{t("refresh")}</NeoButton>
      </div>
      {!hasAddress ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">🔑</span>
          <span className="empty-title">{t("walletNotConnected")}</span>
          <span className="empty-hint">{t("walletNotConnectedHint")}</span>
          <NeoButton className="empty-action" size="sm" variant="primary" onClick={onConnect}>{t("connectWallet")}</NeoButton>
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">📋</span>
          <span className="empty-title">{t("emptyTemplates")}</span>
          <span className="empty-hint">{t("emptyTemplatesHint")}</span>
        </div>
      ) : (
        (templates as Array<Record<string, unknown>>).map((tmpl) => (
          <div key={String(tmpl.id)} className="template-card">
            <span>{String(tmpl.name || tmpl.id)}</span>
          </div>
        ))
      )}
    </NeoCard>
  );
}
