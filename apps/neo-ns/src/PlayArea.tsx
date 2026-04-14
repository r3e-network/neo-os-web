/**
 * PlayArea.tsx -- Neo Name Service
 *
 * Full interactive NNS console: stats bar with domain/expiry counts,
 * search form, domain list, and domain management panel.
 */

import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { Domain } from "./hooks/useNeoNS";
import DomainManagement from "./components/DomainManagement";
import ManageDomain from "./components/ManageDomain";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, bool, str, num } = useStateBindings(state);

  const loading = bool("loading");
  const isSearching = bool("isSearching");
  const error = str("error", "");
  const address = str("address", "");
  const searchQuery = str("searchQuery", "");
  const walletStatus = str("walletStatus", "");
  const myDomains = val<Domain[]>("myDomains", []) ?? [];
  const managingDomain = val<Domain | null>("managingDomain", null);
  const searchResult = val<unknown>("searchResult", null);
  const domainCount = num("domainCount");
  const expiringSoon = num("expiringSoon");
  const registrationCost = num("registrationCost");

  const setSearch = (v: string) => {
    if (state.searchQuery) state.searchQuery.set(v);
  };

  return (
    <div className="neo-ns-play-area">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-value">{domainCount}</span>
          <span className="stat-label">{t("tabDomains") || "Domains"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{expiringSoon}</span>
          <span className="stat-label">{t("expiringSoon") || "Expiring"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{walletStatus || "--"}</span>
          <span className="stat-label">{t("walletStatus") || "Wallet"}</span>
        </div>
      </div>

      {/* Address Display */}
      {address && (
        <div className="address-bar">
          <span className="address-label">{t("connectedAddress") || "Address"}</span>
          <span className="address-value">{address}</span>
        </div>
      )}

      {/* Hero Section */}
      <div className="hero-container">
        <div className="hero-stats">
          <div className="hero-stat-item">
            <span className="hero-stat-value">{myDomains.length}</span>
            <span className="hero-stat-label">{t("tabDomains") || "Domains"}</span>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && <div className="error-banner">{error}</div>}

      {/* Search Section */}
      <NeoCard variant="erobo" className="search-card">
        <div className="search-row">
          <NeoInput
            value={searchQuery}
            label={t("searchDomain") || "Search Domain"}
            placeholder={t("enterDomainName") || "myname.neo"}
            onChange={setSearch}
          />
          <NeoButton
            variant="primary"
            loading={isSearching}
            onClick={() => dispatch("searchDomain")}
            aria-label={t("search") || "Search"}
          >
            {t("search") || "Search"}
          </NeoButton>
        </div>
        {Boolean(searchResult) && (
          <div className="search-result">
            <span className="result-status">
              {(searchResult as { available?: boolean })?.available
                ? t("domainAvailable") || "Available"
                : t("domainTaken") || "Taken"}
            </span>
            {(searchResult as { available?: boolean })?.available && (
              <div className="register-row">
                <span className="cost-label">{t("registrationCost") || "Cost"}: {registrationCost} GAS</span>
                <NeoButton variant="primary" loading={loading} onClick={() => dispatch("registerDomain")} aria-label={t("register") || "Register"}>
                  {t("register") || "Register"}
                </NeoButton>
              </div>
            )}
          </div>
        )}
      </NeoCard>

      {/* Domain Management */}
      {managingDomain ? (
        <ManageDomain
          t={t}
          domain={managingDomain}
          loading={loading}
          dispatch={dispatch}
        />
      ) : (
        <DomainManagement
          t={t}
          domains={myDomains}
          dispatch={dispatch}
        />
      )}
    </div>
  );
}
