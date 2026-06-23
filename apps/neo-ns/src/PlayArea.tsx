/**
 * PlayArea.tsx -- Neo Name Service
 *
 * Full interactive NNS console: visual registry hero, domain finder,
 * result preview, domain list, and domain management panel.
 */

import {
  BadgeCheck,
  CircleDollarSign,
  Clock3,
  Globe2,
  KeyRound,
  Search,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { Domain, SearchResult } from "./hooks/useNeoNS";
import DomainManagement from "./components/DomainManagement";
import ManageDomain from "./components/ManageDomain";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const HERO_EXAMPLES = ["atlas.neo", "vault.neo", "pay.neo"] as const;

function formatAddress(value: string): string {
  if (!value) return "";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function formatSearchName(value: string): string {
  const next = value.trim().toLowerCase();
  if (!next) return "";
  return next.endsWith(".neo") ? next : `${next}.neo`;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { val, bool, str, num } = useStateBindings(state);

  const loading = bool("loading");
  const isSearching = bool("isSearching");
  const error = str("error", "");
  const address = str("address", "");
  const searchQuery = str("searchQuery", "");
  const myDomains = val<Domain[]>("myDomains", []) ?? [];
  const managingDomain = val<Domain | null>("managingDomain", null);
  const searchResult = val<SearchResult | null>("searchResult", null);
  const registrationCost = num("registrationCost");
  const previewName = searchResult?.name ?? formatSearchName(searchQuery);
  const hasQuery = searchQuery.trim().length > 0;
  const playAreaClassName = [
    "neo-ns-play-area",
    hasQuery ? "neo-ns-play-area--query-ready" : "",
    isSearching ? "neo-ns-play-area--searching" : "",
    searchResult
      ? searchResult.available
        ? "neo-ns-play-area--available"
        : "neo-ns-play-area--taken"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const resultCardClassName = [
    "nns-result-card",
    searchResult
      ? searchResult.available
        ? "nns-result-card--available"
        : "nns-result-card--taken"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const setSearch = (v: string) => {
    if (state.searchQuery) state.searchQuery.set(v);
    // Editing the query invalidates the previous search: clear the stale result and
    // price so the Register button (and its cost) only show for the name actually searched.
    state.searchResult?.set(null);
    state.registrationCost?.set(0);
  };

  // Prefill the search box with an example name. Keep the chain lookup behind
  // the explicit Search button so suggestions never trigger surprise wallet work.
  const searchExample = (name: string) => {
    setSearch(name);
  };

  // The lower reference strip belongs to the resting (browsing) view: hide it
  // while drilled into a single domain's manage panel where it would be noise.
  const showReference = !managingDomain;

  return (
    <div className={playAreaClassName}>
      <section className="nns-hero" aria-label={t("title")}>
        <div className="nns-hero__copy">
          <span className="nns-hero__badge" aria-hidden="true">
            <Globe2 size={24} />
          </span>
          <span className="nns-eyebrow">{t("eyebrow")}</span>
          <h2>{t("title")}</h2>
          <p>{t("heroCopy")}</p>
          <div className="nns-hero__steps" aria-label={t("routeLabel")}>
            <span>
              <Search size={16} aria-hidden="true" />
              {t("routeSearch")}
            </span>
            <span>
              <CircleDollarSign size={16} aria-hidden="true" />
              {t("routePrice")}
            </span>
            <span>
              <KeyRound size={16} aria-hidden="true" />
              {t("routeOwn")}
            </span>
          </div>
        </div>
        <figure className="nns-hero__stage">
          <img
            src="./neo-ns-registry-desk.jpg"
            alt={t("heroAlt")}
            loading="eager"
            decoding="async"
          />
          <figcaption>
            <span>
              <WalletCards size={15} aria-hidden="true" />
              {address ? t("walletReady") : t("walletNeeded")}
            </span>
            {address && <strong>{formatAddress(address)}</strong>}
          </figcaption>
        </figure>
      </section>

      <div className="nns-workspace">
        <NeoCard variant="erobo" className="nns-finder-card">
          <div className="nns-card-heading">
            <span className="nns-card-heading__icon" aria-hidden="true">
              <Search size={20} />
            </span>
            <div>
              <span>{t("finderEyebrow")}</span>
              <h3>{t("finderTitle")}</h3>
            </div>
          </div>

          <form
            className="nns-search-form"
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
              className="nns-search-input"
            />
            <button
              type="submit"
              className="nns-visually-hidden"
              tabIndex={-1}
              aria-hidden="true"
            />
            <NeoButton
              variant="primary"
              loading={isSearching}
              onClick={() => dispatch("searchDomain")}
              aria-label={t("search")}
              className={`nns-search-button${hasQuery ? " nns-search-button--ready" : ""}`}
            >
              <Search size={16} aria-hidden="true" />
              {t("search")}
            </NeoButton>
          </form>

          <div className="nns-example-row" aria-label={t("tryExample")}>
            {HERO_EXAMPLES.map((name) => (
              <button
                key={name}
                type="button"
                className="nns-example-chip"
                onClick={() => searchExample(name)}
              >
                {name}
              </button>
            ))}
          </div>

          {error && <div className="error-banner">{error}</div>}
        </NeoCard>

        <NeoCard
          variant="erobo"
          className={resultCardClassName}
        >
          {searchResult ? (
            <>
              <div className="nns-result-card__status">
                <span aria-hidden="true">
                  {searchResult.available ? (
                    <BadgeCheck size={22} />
                  ) : (
                    <ShieldCheck size={22} />
                  )}
                </span>
                <div>
                  <small>
                    {searchResult.available
                      ? t("domainAvailable")
                      : t("domainTaken")}
                  </small>
                  <h3>{searchResult.name}</h3>
                </div>
              </div>
              {searchResult.available ? (
                <div className="nns-result-action">
                  <p>{t("resultAvailableCopy")}</p>
                  <div className="nns-price-line">
                    <span>{t("registrationCost")}</span>
                    <strong>
                      {registrationCost} GAS {t("perYear")}
                    </strong>
                  </div>
                  <NeoButton
                    variant="primary"
                    loading={loading}
                    onClick={() => dispatch("registerDomain")}
                    aria-label={t("register")}
                    className="nns-register-button"
                  >
                    <KeyRound size={16} aria-hidden="true" />
                    {t("register")}
                  </NeoButton>
                </div>
              ) : (
                <div className="nns-result-action">
                  <p>{t("resultTakenCopy")}</p>
                  {searchResult.owner && (
                    <div className="nns-owner-line">
                      <span>{t("owner")}</span>
                      <strong>{searchResult.owner}</strong>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="nns-result-idle">
              <span className="nns-result-idle__icon" aria-hidden="true">
                <KeyRound size={22} />
              </span>
              <small>{t("resultIdleEyebrow")}</small>
              <h3>{previewName || t("resultIdleTitle")}</h3>
              <p>{t("resultIdleCopy")}</p>
            </div>
          )}
        </NeoCard>
      </div>

      {showReference && (
        <div className="nns-route-strip" aria-label={t("routeLabel")}>
          <div className="nns-route-step">
            <Search size={18} aria-hidden="true" />
            <span>{t("howSearchLabel")}</span>
            <p>{t("howSearchDesc")}</p>
          </div>
          <div className="nns-route-step">
            <CircleDollarSign size={18} aria-hidden="true" />
            <span>{t("howPriceLabel")}</span>
            <p>{t("howPriceDesc")}</p>
          </div>
          <div className="nns-route-step">
            <Clock3 size={18} aria-hidden="true" />
            <span>{t("howRenewLabel")}</span>
            <p>{t("howRenewDesc")}</p>
          </div>
        </div>
      )}

      {address && (
        <div className="address-bar">
          <span className="address-label">{t("connectedAddress")}</span>
          <span className="address-value">{address}</span>
        </div>
      )}

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
          connected={Boolean(address)}
          onSearchExample={searchExample}
          dispatch={dispatch}
        />
      )}
    </div>
  );
}
