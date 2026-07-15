/**
 * PlayArea.tsx - Neo NS
 *
 * A focused name-claiming desk: the first screen is about finding one readable
 * .neo name, while owned-domain management and lifecycle details stay in the
 * drawer.
 */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, CircleAlert, Clock3, Copy, Globe2, KeyRound, RefreshCw, Search, SendHorizontal, ShieldCheck } from "lucide-react";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import { CoinArt } from "@shared/art";
import type { Observable } from "@shared/react/context";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { addressToScriptHash } from "@shared/utils/neo";
import { OpenUiProvider, OpenUiSegmented, OpenUiTextField } from "./RegistryControls";
import { normalizeNnsName } from "./hooks/useNeoNS";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

interface DomainResult {
  name?: string;
  available?: boolean;
  restricted?: boolean;
  owner?: string;
  expiry?: number;
  [k: string]: unknown;
}

interface MyDomain {
  name: string;
  owner?: string;
  expiry?: number | string;
  target?: string;
  [k: string]: unknown;
}

interface RenewQuote {
  name: string;
  price: string;
  expiry: number;
}

interface PendingOperation {
  kind: "register" | "renew" | "set-record" | "transfer";
  name: string;
  txid: string;
  network: string;
}

type DrawerMode = "domains" | "expiring" | "manage" | "guide";

const REGISTRY_IMAGE = new URL("../public/neo-ns-registry-desk.webp", import.meta.url).href;
const EXPIRY_WARNING_MS = 30 * 24 * 60 * 60 * 1000;
const SUGGESTIONS = ["onegate", "agent", "vault"];
const NEO_ADDRESS_PATTERN = /^N[1-9A-HJ-NP-Za-km-z]{33}$/;

function isValidNeoAddress(value: string) {
  const address = value.trim();
  return NEO_ADDRESS_PATTERN.test(address) && Boolean(addressToScriptHash(address));
}

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

function isExpired(domain: MyDomain) {
  return typeof domain.expiry === "number" && Number.isFinite(domain.expiry) && domain.expiry <= Date.now();
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const dispatchSafely = useCallback((name: string, ...args: unknown[]) => {
    void dispatch(name, ...args).catch(() => undefined);
  }, [dispatch]);
  const loading = bool("loading");
  const isSearching = bool("isSearching");
  const isRecovering = bool("isRecovering");
  const error = str("error", "");
  const transactionNotice = str("transactionNotice", "");
  const address = str("address", "");
  const walletStatus = str("walletStatus", t("disconnected"));
  const domainsStatus = str("domainsStatus", "idle");
  const activeNetwork = str("activeNetwork", "");
  const activeContract = str("activeContract", "");
  const recoveryStorageStatus = str("recoveryStorageStatus", "unverified");
  const searchQuery = str("searchQuery");
  const domainCount = num("domainCount");
  const registrationCost = str("registrationCost");
  const searchResult = val<DomainResult | null>("searchResult", null);
  const myDomains = (val("myDomains") ?? []) as MyDomain[];
  const managingDomain = val<MyDomain | null>("managingDomain", null);
  const renewQuote = val<RenewQuote | null>("renewQuote", null);
  const pendingOperation = val<PendingOperation | null>("pendingOperation", null);
  const expiringSoonValue = val<number | MyDomain[]>("expiringSoon", 0);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("domains");
  const [targetDraft, setTargetDraft] = useState("");
  const [transferDraft, setTransferDraft] = useState("");
  const [transferReview, setTransferReview] = useState("");

  const suffix = t("domainSuffix");
  const expiringDomains = myDomains.filter(isExpiringSoon);
  const expiringCount = Array.isArray(expiringSoonValue)
    ? expiringSoonValue.length
    : Number(expiringSoonValue || expiringDomains.length);
  const queryDomain = normalizeDomain(searchQuery, suffix);
  const normalizedQuery = normalizeNnsName(searchQuery);
  const resultDomain = normalizeDomain(String(searchResult?.name ?? ""), suffix);
  const resultStillMatchesQuery = Boolean(searchResult && (!queryDomain || queryDomain === resultDomain));
  const canRegisterResult = Boolean(searchResult?.available && resultStillMatchesQuery && !pendingOperation);
  const resultRestricted = Boolean(searchResult?.restricted && resultStillMatchesQuery);
  const domainLabel = resultDomain || queryDomain || t("resultIdleTitle");
  // The eyebrow is the availability status of the name in `domainLabel`. With
  // no query neither exists yet, and falling back to `resultIdleTitle` here
  // printed the same sentence as the eyebrow AND the title, stacked. Name the
  // card in that slot instead.
  const availabilityLabel = searchResult && resultStillMatchesQuery
    ? (searchResult.available ? t("available") : resultRestricted ? t("nameRestricted") : t("domainTaken"))
    : queryDomain
      ? t("resultIdleEyebrow")
      : t("resultIdleStatus");
  const resultCopy = searchResult && resultStillMatchesQuery
    ? (searchResult.available ? t("resultAvailableCopy") : resultRestricted ? t("resultRestrictedCopy") : t("resultTakenCopy"))
    : t("resultIdleCopy");
  const costLabel = resultRestricted
    ? t("notForPublicRegistration")
    : searchResult && resultStillMatchesQuery && registrationCost !== ""
      ? `${registrationCost} GAS`
      : t("registrationCostPending");
  const walletLabel = !address
    ? walletStatus
    : domainsStatus === "failed"
      ? t("domainsUnavailable")
      : domainsStatus === "idle" || domainsStatus === "loading"
        ? t("domainsLoading")
        : domainCount > 0
          ? t("domainCountLabel", { count: domainCount })
          : t("noDomainsShort");
  const readinessLabel = pendingOperation
    ? t("confirmationPending")
    : isSearching
    ? t("checkingName")
    : canRegisterResult
      ? t("readyToRegister")
      : searchResult && resultStillMatchesQuery
        ? t("nameUnavailable")
        : t("readyToSearch");
  const searchExpiry = searchResult?.expiry ? formatExpiry(searchResult.expiry, t("notSet")) : "";
  const showSearchOwner = Boolean(searchResult && !searchResult.available && !resultRestricted && resultStillMatchesQuery);
  // "Checking network" is only true while a check is in flight. Once the read
  // has settled without binding a network (no wallet, no launch network), the
  // honest state is "waiting for a wallet", not a probe that never ends.
  const chainProbeSettled = !loading && domainsStatus !== "loading";
  const networkLabel = activeNetwork === "mainnet"
    ? t("mainnet")
    : activeNetwork === "testnet"
      ? t("testnet")
      : chainProbeSettled && !address
        ? t("networkAwaitingWallet")
        : t("networkChecking");
  const contractLabel = compact(
    activeContract,
    chainProbeSettled && !address ? t("contractAwaitingWallet") : t("contractChecking"),
  );
  const drawerModes: Array<{ mode: DrawerMode; label: string; count?: number }> = [
    { mode: "domains", label: t("drawerDomains"), count: domainCount },
    { mode: "expiring", label: t("drawerExpiring"), count: expiringCount },
    ...(managingDomain ? [{ mode: "manage" as const, label: t("drawerManage"), count: 1 }] : []),
    { mode: "guide", label: t("drawerGuide") },
  ];
  const activeSuggestion = SUGGESTIONS.find((name) => normalizeDomain(searchQuery, suffix) === `${name}${suffix}`) ?? "";
  const targetValid = isValidNeoAddress(targetDraft);
  const transferValid = isValidNeoAddress(transferDraft) && transferDraft.trim() !== address;
  const targetChanged = Boolean(targetValid && targetDraft.trim() !== String(managingDomain?.target ?? "").trim());
  const controlsLocked = loading || isRecovering || Boolean(pendingOperation);
  const managingExpired = Boolean(managingDomain && isExpired(managingDomain));

  useEffect(() => {
    if (!managingDomain) return;
    setTargetDraft(String(managingDomain.target ?? ""));
    setTransferDraft("");
    setTransferReview("");
    setDrawerMode("manage");
  }, [managingDomain]);

  const chooseDomain = (domain: MyDomain) => {
    setTargetDraft(String(domain.target ?? ""));
    setTransferDraft("");
    setDrawerMode("manage");
    state.managingDomain?.set(domain);
    dispatchSafely("showManage", domain);
  };

  const clearManage = () => {
    setTargetDraft("");
    setTransferDraft("");
    setTransferReview("");
    setDrawerMode("domains");
    state.managingDomain?.set(null);
    dispatchSafely("cancelManage");
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
      {pendingOperation && (
        <section className="ns-pending-strip" aria-live="polite">
          <span><Clock3 size={16} /> {t("pendingActionName", { name: pendingOperation.name })}</span>
          <strong>{t("pendingActionCopy")}</strong>
          <div className="ns-pending-strip__receipt">
            <code title={pendingOperation.txid}>{compact(pendingOperation.txid)}</code>
            <button type="button" onClick={() => dispatchSafely("copyPendingTxid")}>
              <Copy size={14} /> {t("copyTxid")}
            </button>
          </div>
        </section>
      )}
      <section className="ns-claim" aria-label={t("searchDomain")}>
        <header className="ns-claim__head">
          <span><Globe2 size={16} /> {t("title")}</span>
          <strong><CoinArt size={18} variant="neo" decorative /> {networkLabel}</strong>
        </header>

        <div className="ns-domain-card">
          <span className={["ns-domain-card__status", searchResult?.available && resultStillMatchesQuery ? "is-available" : resultRestricted ? "is-restricted" : searchResult && resultStillMatchesQuery ? "is-taken" : null].filter(Boolean).join(" ")}>
            {availabilityLabel}
          </span>
          <strong>{domainLabel}</strong>
          <p>{resultCopy}</p>
          <em className="ns-domain-card__readiness">{readinessLabel}</em>
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
              maxLength={67}
              placeholder={t("enterDomainName")}
              disabled={isSearching}
              aria-invalid={Boolean(searchQuery.trim() && !normalizedQuery) || undefined}
              spellCheck={false}
              onKeyDown={(event) => {
                if (event.key === "Enter" && normalizedQuery && !pendingOperation) dispatchSafely("searchDomain");
              }}
            />
            {!searchQuery.trim().toLowerCase().endsWith(suffix) && <em>{suffix}</em>}
          </div>
          {searchQuery.trim() && !normalizedQuery ? (
            <p className="ns-field-hint" data-tone="error">{t("invalidDomainName")}</p>
          ) : null}
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
            <span><CoinArt size={18} variant="gas" decorative /> {t("registrationCost")}</span>
            <strong>{costLabel}</strong>
          </div>
          <div className={["ns-result-item", showSearchOwner ? "ns-result-item--owner" : ""].filter(Boolean).join(" ")}>
            <span><ShieldCheck size={15} /> {searchResult && !searchResult.available && resultStillMatchesQuery ? t("owner") : t("walletStatus")}</span>
            <strong>{showSearchOwner ? String(searchResult?.owner ?? t("unknownOwner")) : walletLabel}</strong>
          </div>
          {searchExpiry && !resultRestricted && (
            <div className="ns-result-item ns-result-item--compact">
              <span><Clock3 size={15} /> {t("currentExpiry")}</span>
              <strong>{searchExpiry}</strong>
            </div>
          )}
          <div className="ns-chain-route">
            <span>{networkLabel}</span>
            <small>{contractLabel}</small>
          </div>
          <p className="ns-result-note"><CircleAlert size={15} /> {t("searchHint")}</p>
        </div>
      </aside>
      {error && <p className="ns-scene__error" role="alert">{error}</p>}
      {!error && recoveryStorageStatus === "unavailable" && (
        <p className="ns-scene__error" role="status">{t("recoveryStorageUnavailableInline")}</p>
      )}
      {transactionNotice && !error && <p className="ns-scene__notice" role="status">{transactionNotice}</p>}
    </div>
  );

  const renderDomains = (rows: MyDomain[], emptyTitle: string) => (
    rows.length > 0 ? (
      <ul className="ns-domain-list">
        {rows.map((domain) => (
          <li key={domain.name} className="ns-domain-row">
            <span>
              <strong>{domain.name}</strong>
              <em>
                {formatExpiry(domain.expiry, t("notSet"))}
                {isExpired(domain) ? <b>{t("expired")}</b> : null}
              </em>
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
            <strong>{domainsStatus === "chain" ? domainCount : t("statusUnknown")}</strong>
          </header>
          {domainsStatus === "failed" && (
            <p className="ns-drawer-warning"><AlertTriangle size={15} /> {t("domainsStaleCopy")}</p>
          )}
          {renderDomains(myDomains, address ? t("noDomainsHint") : t("noDomainsConnectHint"))}
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
            <div>
              <dt>{t("currentExpiry")}</dt>
              <dd>{formatExpiry(managingDomain.expiry, t("notSet"))}{managingExpired ? ` · ${t("expired")}` : ""}</dd>
            </div>
            <div><dt>{t("currentTarget")}</dt><dd title={String(managingDomain.target ?? "")}>{compact(managingDomain.target, t("notSet"))}</dd></div>
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
                maxLength={64}
                placeholder="N..."
                spellCheck={false}
                mono
              />
              {targetDraft.trim() && !targetValid ? <p className="ns-field-hint" data-tone="error">{t("invalidAddressHint")}</p> : null}
              {targetValid && !targetChanged ? <p className="ns-field-hint">{t("targetAlreadySet")}</p> : null}
              <button type="button" onClick={() => dispatchSafely("handleSetTarget", targetDraft)} disabled={controlsLocked || !targetChanged}>
                <KeyRound size={15} />
                {t("setTarget")}
              </button>
            </div>
            <div className="ns-manage-field">
              <span>{t("transferDomain")} · {t("receiverAddress")}</span>
              <OpenUiTextField
                className="ns-manage-text-field"
                inputClassName="ns-manage-input"
                label={t("receiverAddress")}
                value={transferDraft}
                onChange={(event) => {
                  setTransferDraft(event.target.value);
                  setTransferReview("");
                }}
                placeholder="N..."
                maxLength={64}
                spellCheck={false}
                mono
              />
              {transferDraft.trim() && !transferValid ? <p className="ns-field-hint" data-tone="error">{t("invalidTransferAddress")}</p> : null}
              {transferReview === transferDraft.trim() && transferReview ? (
                <p className="ns-transfer-review"><AlertTriangle size={15} /> {t("transferReviewCopy", { address: transferReview })}</p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const receiver = transferDraft.trim();
                  if (transferReview === receiver) dispatchSafely("handleTransfer", receiver);
                  else setTransferReview(receiver);
                }}
                disabled={controlsLocked || !transferValid}
                data-tone={transferReview === transferDraft.trim() && transferReview ? "danger" : undefined}
              >
                <SendHorizontal size={15} />
                {transferReview === transferDraft.trim() && transferReview ? t("confirmTransfer") : t("reviewTransfer")}
              </button>
            </div>
          </div>
          {renewQuote?.name === managingDomain.name ? (
            <div className="ns-renew-review">
              <span><CoinArt size={22} variant="gas" decorative /> {t(managingExpired ? "expiredRenewQuoteCopy" : "renewQuoteCopy", { name: managingDomain.name, cost: renewQuote.price })}</span>
              <div>
                <button type="button" onClick={() => dispatchSafely("cancelRenew")} disabled={loading}>{t("cancel")}</button>
                <button type="button" onClick={() => dispatchSafely("handleRenew", managingDomain)} disabled={controlsLocked}>
                  <Clock3 size={15} /> {t("confirmRenew")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="ns-renew-btn" onClick={() => dispatchSafely("prepareRenew", managingDomain)} disabled={controlsLocked}>
              <Clock3 size={15} />
              {t("reviewRenewal")}
            </button>
          )}
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
              label: pendingOperation
                ? (isRecovering ? t("checkingConfirmation") : t("recoverConfirmation"))
                : canRegisterResult
                  ? t("registerDomain")
                  : (isSearching ? t("checkingName") : t("searchDomain")),
              onClick: () => dispatchSafely(
                pendingOperation
                  ? "recoverPending"
                  : canRegisterResult
                    ? "registerDomain"
                    : "searchDomain",
              ),
              loading: isSearching || loading || isRecovering,
              disabled: !pendingOperation && !canRegisterResult && !normalizedQuery,
              icon: pendingOperation ? <RefreshCw size={17} /> : canRegisterResult ? <BadgeCheck size={17} /> : <Search size={17} />,
            },
          }}
          drawerToggleLabel={t("drawerDomains")}
          drawer={{ title: t("drawerTitle"), children: drawer }}
        />
      </OpenUiProvider>
    </div>
  );
}
