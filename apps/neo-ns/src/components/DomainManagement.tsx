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
        <div className="empty-state">{t("noDomains")}</div>
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
