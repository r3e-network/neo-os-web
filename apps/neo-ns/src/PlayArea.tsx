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
      {/* Hero — leads with identity + the primary search action */}
      <NeoCard variant="erobo" className="search-card nns-hero">
        <div className="nns-hero__head">
          <div className="nns-hero__badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18" />
            </svg>
          </div>
          <div className="nns-hero__text">
            <h2 className="nns-hero__title">{t("title") || "Neo Name Service"}</h2>
            <p className="nns-hero__subtitle">
              {t("docSubtitle") || "Human-readable .neo domain names for Neo addresses"}
            </p>
          </div>
          <div className="nns-hero__stats" aria-hidden={false}>
            <div className="nns-stat">
              <span className="nns-stat__value">{domainCount}</span>
              <span className="nns-stat__label">{t("tabDomains") || "Domains"}</span>
            </div>
            <div className="nns-stat">
              <span className="nns-stat__value">{expiringSoon}</span>
              <span className="nns-stat__label">{t("expiringSoon") || "Expiring"}</span>
            </div>
            <div className="nns-stat">
              <span className="nns-stat__value">{walletStatus || "--"}</span>
              <span className="nns-stat__label">{t("walletStatus") || "Wallet"}</span>
            </div>
          </div>
        </div>

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

        {/* Address Display */}
        {address && (
          <div className="address-bar">
            <span className="address-label">{t("connectedAddress") || "Address"}</span>
            <span className="address-value">{address}</span>
          </div>
        )}

        {/* Error Display */}
        {error && <div className="error-banner">{error}</div>}
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
