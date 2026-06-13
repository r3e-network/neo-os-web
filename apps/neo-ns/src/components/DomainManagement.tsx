/**
 * DomainManagement.tsx -- Domain list for Neo NS.
 */

import { useState } from "react";
import { NeoButton, NeoCard } from "@shared/components-react";
import type { Domain } from "../hooks/useNeoNS";

interface DomainManagementProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  domains: Domain[];
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

/** Trim trailing zeros from a GAS amount for display (e.g. "2.00000000" -> "2"). */
function formatGas(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(8).replace(/\.?0+$/, "") || "0";
}

export default function DomainManagement({ t, domains, dispatch }: DomainManagementProps) {
  // Per-domain renewal confirmation: clicking Renew first discloses the GAS
  // cost (a paid wallet tx) and waits for an explicit confirm.
  const [renewTarget, setRenewTarget] = useState<string | null>(null);
  const [renewCost, setRenewCost] = useState<number | null>(null);
  const [renewLoading, setRenewLoading] = useState<string | null>(null);

  async function beginRenew(domain: Domain) {
    setRenewTarget(domain.name);
    setRenewCost(null);
    const cost = (await dispatch("fetchRenewPrice", domain)) as unknown as number;
    setRenewCost(typeof cost === "number" ? cost : 0);
  }

  function cancelRenew() {
    setRenewTarget(null);
    setRenewCost(null);
  }

  async function confirmRenew(domain: Domain) {
    setRenewLoading(domain.name);
    try {
      await dispatch("handleRenew", domain);
    } finally {
      setRenewLoading(null);
      cancelRenew();
    }
  }

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
      {domains.map((domain) => {
        const isConfirming = renewTarget === domain.name;
        return (
          <NeoCard key={domain.name} variant="erobo">
            <div className="domain-row">
              <div className="domain-info">
                <span className="domain-name">{domain.name}</span>
                <span className="domain-expiry">
                  {t("expires")}: {domain.expiry > 0 ? new Date(domain.expiry).toLocaleDateString() : "—"}
                </span>
              </div>
              <div className="domain-actions">
                <NeoButton variant="secondary" onClick={() => dispatch("showManage", domain)}>{t("manage")}</NeoButton>
                {!isConfirming && (
                  <NeoButton variant="secondary" onClick={() => beginRenew(domain)}>{t("renew")}</NeoButton>
                )}
              </div>
            </div>
            {isConfirming && (
              <div className="renew-confirm" role="group">
                <span className="renew-confirm__prompt">
                  {renewCost === null
                    ? "—"
                    : t("renewConfirm", { name: domain.name, cost: formatGas(renewCost) })}
                </span>
                <div className="renew-confirm__actions">
                  <NeoButton variant="secondary" size="sm" onClick={cancelRenew}>{t("cancel")}</NeoButton>
                  <NeoButton
                    variant="primary"
                    size="sm"
                    loading={renewLoading === domain.name}
                    disabled={renewCost === null}
                    onClick={() => confirmRenew(domain)}
                  >
                    {t("confirmRenew")}
                  </NeoButton>
                </div>
              </div>
            )}
          </NeoCard>
        );
      })}
    </div>
  );
}
