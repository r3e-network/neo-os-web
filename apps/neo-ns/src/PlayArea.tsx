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
    // Editing the query invalidates the previous search: clear the stale result and
    // price so the Register button (and its cost) only show for the name actually searched.
    state.searchResult?.set(null);
    state.registrationCost?.set(0);
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
            <span className="nns-hero__eyebrow">{t("eyebrow")}</span>
            <h2 className="nns-hero__title">{t("title")}</h2>
            <p className="nns-hero__subtitle">
              {t("docSubtitle")}
            </p>
          </div>
          <div className="nns-hero__stats" aria-hidden={false}>
            <div className={`nns-stat${domainCount > 0 ? " nns-stat--active" : ""}`}>
              <span className="nns-stat__value">{domainCount}</span>
              <span className="nns-stat__label">{t("tabDomains")}</span>
            </div>
            <div className={`nns-stat${expiringSoon > 0 ? " nns-stat--warn" : ""}`}>
              <span className="nns-stat__value">{expiringSoon}</span>
              <span className="nns-stat__label">{t("expiringSoon")}</span>
            </div>
            <div className={`nns-stat nns-stat--status${address ? " is-connected" : ""}`}>
              <span className="nns-stat__status">
                <span className="nns-stat__dot" aria-hidden="true" />
                <span className="nns-stat__statusText">{walletStatus || "—"}</span>
              </span>
              <span className="nns-stat__label">{t("walletStatus")}</span>
            </div>
          </div>
        </div>

        <form
          className="search-row"
          onSubmit={(e) => {
            e.preventDefault();
            void dispatch("searchDomain");
          }}
        >
          <NeoInput
            value={searchQuery}
            label={t("searchDomain")}
            placeholder={t("enterDomainName")}
            onChange={setSearch}
          />
          {/* Hidden native submit so pressing Enter in the input runs the
              search; the visible NeoButton renders type="button". */}
          <button type="submit" className="nns-visually-hidden" tabIndex={-1} aria-hidden="true" />
          <NeoButton
            variant="primary"
            loading={isSearching}
            onClick={() => dispatch("searchDomain")}
            aria-label={t("search")}
          >
            {t("search")}
          </NeoButton>
        </form>

        {/* Address Display */}
        {address && (
          <div className="address-bar">
            <span className="address-label">{t("connectedAddress")}</span>
            <span className="address-value">{address}</span>
          </div>
        )}

        {/* Error Display */}
        {error && <div className="error-banner">{error}</div>}
        {Boolean(searchResult) && (
          <div className="search-result">
            <span
              className={`result-status${
                (searchResult as { available?: boolean })?.available
                  ? " result-status--available"
                  : " result-status--taken"
              }`}
            >
              <span className="result-status__dot" aria-hidden="true" />
              {(searchResult as { available?: boolean })?.available
                ? t("domainAvailable")
                : t("domainTaken")}
            </span>
            {(searchResult as { available?: boolean })?.available ? (
              <div className="register-row">
                <span className="cost-label">
                  {t("registrationCost")}: {registrationCost} GAS {t("perYear")}
                </span>
                <NeoButton variant="primary" loading={loading} onClick={() => dispatch("registerDomain")} aria-label={t("register")}>
                  {t("register")}
                </NeoButton>
              </div>
            ) : (
              (searchResult as { owner?: string })?.owner && (
                <div className="result-owner">
                  <span className="result-owner__label">{t("owner")}</span>
                  <span className="result-owner__value">{(searchResult as { owner?: string }).owner}</span>
                </div>
              )
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
