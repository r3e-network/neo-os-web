/**
 * DomainManagement.tsx -- Domain list for Neo NS.
 */

import { NeoButton, NeoCard } from "@shared/components-react";
import type { Domain } from "../hooks/useNeoNS";

interface DomainManagementProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  domains: Domain[];
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function DomainManagement({ t, domains, dispatch }: DomainManagementProps) {
  if (domains.length === 0) {
    return (
      <NeoCard variant="erobo">
        <div className="empty-state">
          <span className="empty-state__badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18" />
            </svg>
          </span>
          <p className="empty-state__title">{t("noDomains")}</p>
          <p className="empty-state__hint">{t("noDomainsHint")}</p>
        </div>
      </NeoCard>
    );
  }

  return (
    <div className="domain-list">
      {domains.map((domain) => (
        <NeoCard key={domain.name} variant="erobo">
          <div className="domain-row">
            <div className="domain-info">
              <span className="domain-name">{domain.name}</span>
              <span className="domain-expiry">
                {t("expires")}: {domain.expiry > 0 ? new Date(domain.expiry).toLocaleDateString() : "--"}
              </span>
            </div>
            <div className="domain-actions">
              <NeoButton variant="secondary" onClick={() => dispatch("showManage", domain)}>{t("manage")}</NeoButton>
              <NeoButton variant="secondary" onClick={() => dispatch("handleRenew", domain)}>{t("renew")}</NeoButton>
            </div>
          </div>
        </NeoCard>
      ))}
    </div>
  );
}
