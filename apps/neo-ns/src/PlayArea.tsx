/**
 * PlayArea.tsx - Neo NS
 *
 * A focused name-claiming desk: the first screen is about finding one readable
 * .neo name, while owned-domain management and lifecycle details stay in the
 * drawer.
 */
import { useEffect, useState } from "react";
import { BadgeCheck, CircleAlert, Clock3, Globe2, KeyRound, Search, SendHorizontal, ShieldCheck } from "lucide-react";
import { OpenUiProvider, OpenUiSegmented, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import type { Observable } from "@shared/react/context";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

interface DomainResult {
  name?: string;
  available?: boolean;
  owner?: string;
  [k: string]: unknown;
}

interface MyDomain {
  name: string;
  owner?: string;
  expiry?: number | string;
  target?: string;
  [k: string]: unknown;
}

type DrawerMode = "domains" | "expiring" | "manage" | "guide";

const REGISTRY_IMAGE = new URL("../public/neo-ns-registry-desk.webp", import.meta.url).href;
const EXPIRY_WARNING_MS = 30 * 24 * 60 * 60 * 1000;
const SUGGESTIONS = ["onegate", "agent", "vault"];

function normalizeDomain(name: string, suffix: string) {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.endsWith(suffix) ? trimmed : `${trimmed}${suffix}`;
}

function compact(value: unknown, empty = "-") {
  const text = String(value ?? "").trim();
  if (!text) return empty;
  return text.length > 30 ? `${text.slice(0, 12)}...${text.slice(-8)}` : text;
}

function formatExpiry(value: MyDomain["expiry"], empty: string) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
  }
  const text = String(value ?? "").trim();
  return text || empty;
}

function isExpiringSoon(domain: MyDomain) {
  if (typeof domain.expiry !== "number" || !Number.isFinite(domain.expiry)) return false;
  const remaining = domain.expiry - Date.now();
  return remaining > 0 && remaining < EXPIRY_WARNING_MS;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const loading = bool("loading");
  const isSearching = bool("isSearching");
  const error = str("error", "");
  const searchQuery = str("searchQuery");
  const domainCount = num("domainCount");
  const registrationCost = num("registrationCost");
  const searchResult = val<DomainResult | null>("searchResult", null);
  const myDomains = (val("myDomains") ?? []) as MyDomain[];
  const managingDomain = val<MyDomain | null>("managingDomain", null);
  const expiringSoonValue = val<number | MyDomain[]>("expiringSoon", 0);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("domains");
  const [targetDraft, setTargetDraft] = useState("");
  const [transferDraft, setTransferDraft] = useState("");

  const suffix = t("domainSuffix");
  const expiringDomains = myDomains.filter(isExpiringSoon);
  const expiringCount = Array.isArray(expiringSoonValue)
    ? expiringSoonValue.length
    : Number(expiringSoonValue || expiringDomains.length);
  const queryDomain = normalizeDomain(searchQuery, suffix);
  const resultDomain = normalizeDomain(String(searchResult?.name ?? ""), suffix);
  const resultStillMatchesQuery = Boolean(searchResult && (!queryDomain || queryDomain === resultDomain));
  const canRegisterResult = Boolean(searchResult?.available && resultStillMatchesQuery);
  const domainLabel = resultDomain || queryDomain || t("resultIdleTitle");
  const availabilityLabel = searchResult && resultStillMatchesQuery
    ? (searchResult.available ? t("available") : t("domainTaken"))
    : queryDomain
      ? t("resultIdleEyebrow")
      : t("resultIdleTitle");
  const resultCopy = searchResult && resultStillMatchesQuery
    ? (searchResult.available ? t("resultAvailableCopy") : t("resultTakenCopy"))
    : t("resultIdleCopy");
  const costLabel = registrationCost > 0 ? `${registrationCost} GAS` : t("registrationCostPending");
  const walletLabel = domainCount > 0
    ? `${domainCount} ${t("myDomains").toLowerCase()}`
    : t("noDomains");
  const readinessLabel = isSearching
    ? t("checkingName")
    : canRegisterResult
      ? t("readyToRegister")
      : searchResult && resultStillMatchesQuery
        ? t("nameUnavailable")
        : t("readyToSearch");
  const drawerModes: Array<{ mode: DrawerMode; label: string; count?: number }> = [
    { mode: "domains", label: t("drawerDomains"), count: domainCount },
    { mode: "expiring", label: t("drawerExpiring"), count: expiringCount },
    ...(managingDomain ? [{ mode: "manage" as const, label: t("drawerManage"), count: 1 }] : []),
    { mode: "guide", label: t("drawerGuide") },
  ];
  const activeSuggestion = SUGGESTIONS.find((name) => normalizeDomain(searchQuery, suffix) === `${name}${suffix}`) ?? "";

  useEffect(() => {
    if (!managingDomain) return;
    setTargetDraft(String(managingDomain.target ?? ""));
    setTransferDraft("");
    setDrawerMode("manage");
  }, [managingDomain]);

  const chooseDomain = (domain: MyDomain) => {
    setTargetDraft(String(domain.target ?? ""));
    setTransferDraft("");
    setDrawerMode("manage");
    state.managingDomain?.set(domain);
    void dispatch("showManage", domain);
  };

  const clearManage = () => {
    setTargetDraft("");
    setTransferDraft("");
    setDrawerMode("domains");
    state.managingDomain?.set(null);
    void dispatch("cancelManage");
  };

  const setSuggestion = (name: string) => {
    state.searchQuery?.set(name);
  };
  const setDrawerModeSafe = (value: string) => {
    if (value === "domains" || value === "expiring" || value === "manage" || value === "guide") {
      setDrawerMode(value);
    }
  };

  const scene = (
    <div
      className="ns-desk"
      data-state={isSearching ? "searching" : canRegisterResult ? "available" : searchResult && resultStillMatchesQuery ? "taken" : "idle"}
    >
      <section className="ns-claim" aria-label={t("searchDomain")}>
        <header className="ns-claim__head">
          <span><Globe2 size={16} /> {t("title")}</span>
          <strong>{readinessLabel}</strong>
        </header>

        <div className="ns-domain-card">
          <span className={["ns-domain-card__status", canRegisterResult ? "is-available" : searchResult && resultStillMatchesQuery ? "is-taken" : null].filter(Boolean).join(" ")}>
            {availabilityLabel}
          </span>
          <strong>{domainLabel}</strong>
          <p>{resultCopy}</p>
        </div>

        <div className="ns-search-line">
          <span><Search size={15} /> {t("nameInputLabel")}</span>
          <div className="ns-search-line__control">
            <OpenUiTextField
              className="ns-search-field"
              inputClassName="ns-input-field"
              label={t("nameInputLabel")}
              value={searchQuery}
              onChange={(event) => state.searchQuery?.set(event.target.value)}
              placeholder={t("enterDomainName")}
              disabled={isSearching}
              spellCheck={false}
              onKeyDown={(event) => { if (event.key === "Enter") void dispatch("searchDomain"); }}
            />
            {!searchQuery.trim().toLowerCase().endsWith(suffix) && <em>{suffix}</em>}
          </div>
        </div>

        <OpenUiSegmented
          className="ns-suggestions"
          segmentedClassName="ns-suggestions__group"
          label={t("suggestionsLabel")}
          value={activeSuggestion}
          onChange={setSuggestion}
          disabled={isSearching}
          options={SUGGESTIONS.map((name) => ({
            value: name,
            label: <span className="ns-suggestion-chip">{name}{suffix}</span>,
          }))}
        />
      </section>

      <aside className="ns-registry-card" aria-label={t("resultPanelLabel")}>
        <figure className="ns-registry-art">
          <img className="ns-registry-art__image" src={REGISTRY_IMAGE} alt={t("heroAlt")} loading="eager" decoding="async" />
          <figcaption><KeyRound size={14} /> {t("routeLabel")}</figcaption>
        </figure>

        <div className="ns-result-stack">
          <div className="ns-result-item" data-tone={canRegisterResult ? "good" : undefined}>
            <span><BadgeCheck size={15} /> {t("registrationCost")}</span>
            <strong>{costLabel}</strong>
          </div>
          <div className="ns-result-item">
            <span><ShieldCheck size={15} /> {searchResult && !searchResult.available && resultStillMatchesQuery ? t("owner") : t("walletStatus")}</span>
            <strong>{searchResult && !searchResult.available && resultStillMatchesQuery ? compact(searchResult.owner, t("unknownOwner")) : walletLabel}</strong>
          </div>
          <p className="ns-result-note"><CircleAlert size={15} /> {t("searchHint")}</p>
        </div>
      </aside>
      {error && <p className="ns-scene__error" role="alert">{error}</p>}
    </div>
  );

  const renderDomains = (rows: MyDomain[], emptyTitle: string) => (
    rows.length > 0 ? (
      <ul className="ns-domain-list">
        {rows.slice(0, 10).map((domain) => (
          <li key={domain.name} className="ns-domain-row">
            <span>
              <strong>{domain.name}</strong>
              <em>{formatExpiry(domain.expiry, t("notSet"))}</em>
            </span>
            <button type="button" onClick={() => chooseDomain(domain)}>{t("manage")}</button>
          </li>
        ))}
      </ul>
    ) : (
      <p className="ns-drawer-empty">{emptyTitle}</p>
    )
  );

  const drawer = (
    <div className="ns-drawer" data-mode={drawerMode}>
      <OpenUiSegmented
        className="ns-drawer-tabs"
        segmentedClassName="ns-drawer-tabs__group"
        label={t("drawerGuide")}
        value={drawerMode}
        onChange={setDrawerModeSafe}
        options={drawerModes.map((item) => ({
          value: item.mode,
          label: (
            <span className="ns-drawer-tab">
              <span>{item.label}</span>
              {typeof item.count === "number" && <em>{item.count}</em>}
            </span>
          ),
        }))}
      />

      {drawerMode === "domains" && (
        <section className="ns-drawer-panel">
          <header className="ns-drawer-panel__head">
            <span><Globe2 size={16} /> {t("myDomains")}</span>
            <strong>{domainCount}</strong>
          </header>
          {renderDomains(myDomains, t("noDomainsHint"))}
        </section>
      )}

      {drawerMode === "expiring" && (
        <section className="ns-drawer-panel">
          <header className="ns-drawer-panel__head">
            <span><Clock3 size={16} /> {t("expiringSoon")}</span>
            <strong>{expiringCount}</strong>
          </header>
          {renderDomains(expiringDomains, t("noExpiringDomains"))}
        </section>
      )}

      {drawerMode === "manage" && managingDomain && (
        <section className="ns-drawer-panel ns-drawer-panel--manage">
          <header className="ns-drawer-panel__head">
            <span><KeyRound size={16} /> {managingDomain.name}</span>
            <button type="button" onClick={clearManage}>{t("cancelManage")}</button>
          </header>
          <dl className="ns-manage-summary">
            <div><dt>{t("currentExpiry")}</dt><dd>{formatExpiry(managingDomain.expiry, t("notSet"))}</dd></div>
            <div><dt>{t("currentTarget")}</dt><dd>{compact(managingDomain.target, t("notSet"))}</dd></div>
          </dl>
          <div className="ns-manage-grid">
            <div className="ns-manage-field">
              <span>{t("targetAddress")}</span>
              <OpenUiTextField
                className="ns-manage-text-field"
                inputClassName="ns-manage-input"
                label={t("targetAddress")}
                value={targetDraft}
                onChange={(event) => setTargetDraft(event.target.value)}
                placeholder="N..."
                spellCheck={false}
                mono
              />
              <button type="button" onClick={() => void dispatch("handleSetTarget", targetDraft)} disabled={loading || !targetDraft.trim()}>
                <KeyRound size={15} />
                {t("setTarget")}
              </button>
            </div>
            <div className="ns-manage-field">
              <span>{t("receiverAddress")}</span>
              <OpenUiTextField
                className="ns-manage-text-field"
                inputClassName="ns-manage-input"
                label={t("receiverAddress")}
                value={transferDraft}
                onChange={(event) => setTransferDraft(event.target.value)}
                placeholder="N..."
                spellCheck={false}
                mono
              />
              <button type="button" onClick={() => void dispatch("handleTransfer", transferDraft)} disabled={loading || !transferDraft.trim()}>
                <SendHorizontal size={15} />
                {t("transferDomain")}
              </button>
            </div>
          </div>
          <button type="button" className="ns-renew-btn" onClick={() => void dispatch("handleRenew", managingDomain)} disabled={loading}>
            <Clock3 size={15} />
            {t("renew")}
          </button>
        </section>
      )}

      {drawerMode === "guide" && (
        <section className="ns-drawer-panel ns-drawer-panel--guide">
          <header className="ns-drawer-panel__head">
            <span><ShieldCheck size={16} /> {t("howTitle")}</span>
          </header>
          <div className="ns-guide-grid">
            <article><span>{t("howSearchLabel")}</span><p>{t("howSearchDesc")}</p></article>
            <article><span>{t("howPriceLabel")}</span><p>{t("howPriceDesc")}</p></article>
            <article><span>{t("howOwnLabel")}</span><p>{t("howOwnDesc")}</p></article>
            <article><span>{t("howRenewLabel")}</span><p>{t("howRenewDesc")}</p></article>
          </div>
          <p className="ns-guide-note">{t("howNote")}</p>
        </section>
      )}
    </div>
  );

  return (
    <div className="neo-ns-play-area mx2 mx2-cat-tool">
      <OpenUiProvider>
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("eyebrow"),
            title: t("title"),
            subtitle: t("docSubtitle"),
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {walletLabel}</span>,
          }}
          scene={scene}
          actions={{
            primary: {
              label: canRegisterResult ? t("registerDomain") : (isSearching ? t("checkingName") : t("searchDomain")),
              onClick: () => void (canRegisterResult ? dispatch("registerDomain") : dispatch("searchDomain")),
              loading: isSearching || loading,
              icon: canRegisterResult ? <BadgeCheck size={17} /> : <Search size={17} />,
            },
          }}
          drawerToggleLabel={t("drawerDomains")}
          drawer={{ title: t("drawerTitle"), children: drawer }}
        />
      </OpenUiProvider>
    </div>
  );
}
