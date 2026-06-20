/**
 * DomainManagement.tsx -- Domain list for Neo NS.
 */

import { useState } from "react";
import { Clock3, KeyRound, Search, Settings2 } from "lucide-react";
import { NeoButton, NeoCard } from "@shared/components-react";
import type { Domain } from "../hooks/useNeoNS";

interface DomainManagementProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  domains: Domain[];
  /** Whether a wallet is connected — drives the empty-state affordance. */
  connected?: boolean;
  /** Prefill the search box with an example name. */
  onSearchExample?: (name: string) => void;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

/** A few short, friendly names to demonstrate the search as a one-tap action. */
const EXAMPLE_NAMES = ["alice.neo", "wallet.neo", "neo.neo"] as const;

/** Trim trailing zeros from a GAS amount for display (e.g. "2.00000000" -> "2"). */
function formatGas(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(8).replace(/\.?0+$/, "") || "0";
}

export default function DomainManagement({
  t,
  domains,
  connected = false,
  onSearchExample,
  dispatch,
}: DomainManagementProps) {
  // Per-domain renewal confirmation: clicking Renew first discloses the GAS
  // cost (a paid wallet tx) and waits for an explicit confirm.
  const [renewTarget, setRenewTarget] = useState<string | null>(null);
  const [renewCost, setRenewCost] = useState<number | null>(null);
  const [renewLoading, setRenewLoading] = useState<string | null>(null);

  async function beginRenew(domain: Domain) {
    setRenewTarget(domain.name);
    setRenewCost(null);
    const cost = (await dispatch(
      "fetchRenewPrice",
      domain,
    )) as unknown as number;
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
      <NeoCard variant="erobo" className="nns-owned-card">
        <div className="empty-state">
          <div className="empty-state__copy">
            <span className="empty-state__badge" aria-hidden="true">
              <KeyRound size={22} />
            </span>
            <div>
              <p className="empty-state__title">{t("noDomains")}</p>
              <p className="empty-state__hint">
                {connected ? t("noDomainsHint") : t("noDomainsConnectHint")}
              </p>
            </div>
          </div>
          {onSearchExample && (
            <div className="empty-state__examples">
              <span className="empty-state__examples-label">
                {t("tryExample")}
              </span>
              <div className="empty-state__chips">
                {EXAMPLE_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="example-chip"
                    onClick={() => onSearchExample(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </NeoCard>
    );
  }

  return (
    <div className="domain-list" aria-label={t("tabDomains")}>
      {domains.map((domain) => {
        const isConfirming = renewTarget === domain.name;
        // A domain whose expiry timestamp is in the past has lapsed — flag it
        // distinctly so the holder knows renewal may no longer keep ownership.
        const isExpired = domain.expiry > 0 && domain.expiry < Date.now();
        return (
          <NeoCard key={domain.name} variant="erobo" className="domain-card">
            <div className="domain-row">
              <div className="domain-info-wrap">
                <span className="domain-icon" aria-hidden="true">
                  {isExpired ? <Clock3 size={18} /> : <Search size={18} />}
                </span>
                <div className="domain-info">
                  <span className="domain-name">
                    {domain.name}
                    {isExpired && (
                      <span className="domain-expired-badge">
                        {t("expired")}
                      </span>
                    )}
                  </span>
                  <span className="domain-expiry">
                    {t("expires")}:{" "}
                    {domain.expiry > 0
                      ? new Date(domain.expiry).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </div>
              <div className="domain-actions">
                <NeoButton
                  variant="secondary"
                  onClick={() => dispatch("showManage", domain)}
                >
                  <Settings2 size={15} aria-hidden="true" />
                  {t("manage")}
                </NeoButton>
                {!isConfirming && (
                  <NeoButton
                    variant="secondary"
                    onClick={() => beginRenew(domain)}
                  >
                    <Clock3 size={15} aria-hidden="true" />
                    {t("renew")}
                  </NeoButton>
                )}
              </div>
            </div>
            {isExpired && (
              <p className="domain-expired-hint">{t("expiredHint")}</p>
            )}
            {isConfirming && (
              <div className="renew-confirm" role="group">
                <span className="renew-confirm__prompt">
                  {renewCost === null
                    ? "—"
                    : t("renewConfirm", {
                        name: domain.name,
                        cost: formatGas(renewCost),
                      })}
                </span>
                <div className="renew-confirm__actions">
                  <NeoButton
                    variant="secondary"
                    size="sm"
                    onClick={cancelRenew}
                  >
                    {t("cancel")}
                  </NeoButton>
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
