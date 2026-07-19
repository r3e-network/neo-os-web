/**
 * Neo Explorer — production read-only chain workspace.
 *
 * Search is the single primary action. Real transaction, block, address, and
 * contract fields occupy the main surface; network telemetry and recent chain
 * objects form a compact secondary rail. Complete records stay in the drawer.
 */
import {
  Activity,
  Blocks,
  Braces,
  CheckCircle2,
  CircleAlert,
  Database,
  FileText,
  History,
  RadioTower,
  RefreshCw,
  Search,
  Server,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import {
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { PhaseValue, resolvePhase } from "@shared/components-react/v2";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type ExplorerNetwork = "mainnet" | "testnet";
type ExplorerDataStatus = "loading" | "live" | "cached" | "empty" | "unavailable";

interface TxItem {
  hash: string;
  vmState?: string;
  blockIndex?: number;
  blockTime?: string;
  sender?: string;
  [key: string]: unknown;
}

interface SearchResult {
  type?: string;
  found?: boolean;
  network?: ExplorerNetwork;
  source?: string;
  query?: string;
  hash?: string;
  label?: string;
  address?: string;
  contract_hash?: string;
  tx_count?: number;
  call_count?: number;
  transactions?: Array<Record<string, unknown>>;
  calls?: Array<Record<string, unknown>>;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ResultField {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "success" | "danger";
}

const SEARCH_TYPES = ["explorerTipTx", "explorerTipAddress", "explorerTipContract", "explorerTipBlock"];
const EXPLORER_BANNER_ART = "banner.webp";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function compactHash(value: unknown, empty = "—") {
  const text = textValue(value);
  if (!text) return empty;
  return text.length > 20 ? `${text.slice(0, 10)}…${text.slice(-8)}` : text;
}

function formatChainTime(value: unknown) {
  if (value == null || value === "") return "—";
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatIntegerValue(value: unknown, fallback = "—") {
  const text = textValue(value);
  if (!/^\d+$/.test(text)) return text || fallback;
  try {
    return BigInt(text).toLocaleString();
  } catch {
    return text;
  }
}

function formatUpdatedAt(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  const date = new Date(numeric);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function resultFound(result: SearchResult | null) {
  if (!result) return false;
  if (["invalid", "unavailable", "none", "unknown"].includes(String(result.type))) return false;
  return result.found !== false;
}

function resultUnavailable(result: SearchResult | null) {
  return result?.type === "unavailable" || result?.source === "indexer_unavailable";
}

function resultTone(result: SearchResult | null) {
  if (!result) return "idle";
  if (result.type === "invalid") return "invalid";
  if (resultUnavailable(result)) return "error";
  return resultFound(result) ? "ready" : "empty";
}

function resultTypeLabel(result: SearchResult | null, t: PlayAreaProps["t"]) {
  switch (result?.type) {
    case "transaction": return t("transaction");
    case "block": return t("explorerTypeBlock");
    case "address": return t("address");
    case "contract": return t("contract");
    default: return t("searchResult");
  }
}

function notFoundCopy(result: SearchResult, t: PlayAreaProps["t"]) {
  switch (result.type) {
    case "transaction": return t("transactionNotFound");
    case "block": return t("blockNotFound");
    case "address": return t("addressNoActivity");
    case "contract": return t("contractNotFound");
    default: return t("searchUnknownDesc");
  }
}

function resultIdentifier(result: SearchResult | null) {
  if (!result) return "";
  const data = asRecord(result.data);
  if (result.type === "address") return textValue(result.address, result.query);
  if (result.type === "contract") return textValue(result.contract_hash, data.hash, result.query);
  return textValue(data.hash, result.hash, result.query, result.label);
}

function resultSourceLabel(result: SearchResult | null, t: PlayAreaProps["t"]) {
  switch (result?.source) {
    case "rpc": return t("explorerSourceRpc");
    case "indexer": return t("explorerSourceIndexer");
    case "indexer_unavailable": return t("explorerSourceIndexerUnavailable");
    default: return t("explorerSourceApi");
  }
}

function resultFields(result: SearchResult, t: PlayAreaProps["t"]): ResultField[] {
  const data = asRecord(result.data);
  const manifest = asRecord(data.manifest);

  if (result.type === "transaction") {
    const vmState = textValue(data.vm_state, data.vmstate, result.vmState, "—");
    return [
      { label: t("hash"), value: textValue(data.hash, result.hash, result.query, "—"), mono: true },
      { label: t("resultStatus"), value: vmState, tone: vmState === "HALT" ? "success" : vmState === "FAULT" ? "danger" : undefined },
      { label: t("block"), value: formatIntegerValue(data.block_index ?? data.blockindex ?? result.blockIndex) },
      { label: t("sender"), value: textValue(data.sender, result.sender, "—"), mono: true },
      { label: t("gasConsumed"), value: textValue(data.gas_consumed, data.sysfee, "—") },
      { label: t("time"), value: formatChainTime(data.block_time ?? data.blocktime) },
    ];
  }

  if (result.type === "block") {
    const transactions = Array.isArray(data.tx) ? data.tx.length : data.tx_count;
    return [
      { label: t("blockHeight"), value: formatIntegerValue(data.index ?? result.query) },
      { label: t("hash"), value: textValue(data.hash, result.hash, "—"), mono: true },
      { label: t("transactions"), value: formatIntegerValue(data.tx_count ?? transactions, "0") },
      { label: t("time"), value: formatChainTime(data.time) },
      { label: t("previousBlock"), value: textValue(data.previousblockhash, "—"), mono: true },
      { label: t("resultSource"), value: resultSourceLabel(result, t) },
    ];
  }

  if (result.type === "address") {
    return [
      { label: t("address"), value: textValue(result.address, result.query, "—"), mono: true },
      { label: t("indexedTransactions"), value: formatIntegerValue(result.tx_count ?? result.transactions?.length, "0") },
      { label: t("resultNetwork"), value: result.network === "testnet" ? t("testnet") : t("mainnet") },
      { label: t("resultSource"), value: resultSourceLabel(result, t) },
    ];
  }

  if (result.type === "contract") {
    return [
      { label: t("hash"), value: textValue(result.contract_hash, data.hash, result.query, "—"), mono: true },
      { label: t("contractName"), value: textValue(manifest.name, data.name, "—") },
      { label: t("contractMethods"), value: formatIntegerValue(Array.isArray(asRecord(manifest.abi).methods) ? (asRecord(manifest.abi).methods as unknown[]).length : null) },
      { label: t("contractUpdates"), value: formatIntegerValue(data.updatecounter ?? data.update_counter) },
      { label: t("contractCalls"), value: formatIntegerValue(result.call_count ?? result.calls?.length, "0") },
      { label: t("resultSource"), value: resultSourceLabel(result, t) },
    ];
  }

  return [];
}

function resultIcon(type: string | undefined): ReactNode {
  switch (type) {
    case "transaction": return <FileText size={22} />;
    case "block": return <Blocks size={22} />;
    case "address": return <WalletCards size={22} />;
    case "contract": return <Braces size={22} />;
    default: return <Search size={22} />;
  }
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function ResultSurface({
  isSearching,
  networkLabel,
  result,
  t,
}: {
  isSearching: boolean;
  networkLabel: string;
  result: SearchResult | null;
  t: PlayAreaProps["t"];
}) {
  if (isSearching) {
    return (
      <section className="explorer-result-surface" data-state="loading" aria-busy="true" aria-live="polite">
        <div className="explorer-loading-head"><RefreshCw size={22} className="is-spinning" /><strong>{t("searching")}</strong></div>
        <span className="explorer-loading-line" />
        <span className="explorer-loading-line explorer-loading-line--short" />
        <div className="explorer-loading-grid"><span /><span /><span /><span /></div>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="explorer-result-surface explorer-result-surface--idle" data-state="idle" aria-label={t("explorerSearchDeck")}>
        <div className="explorer-idle-copy">
          <strong>{t("explorerScannerTargetEmpty")}</strong>
          <p>{t("explorerSearchHint")}</p>
          <div className="explorer-type-strip" aria-label={t("explorerSearchableTypes")}>
            {SEARCH_TYPES.map((key) => <span key={key}>{t(key)}</span>)}
          </div>
        </div>
        <img src={EXPLORER_BANNER_ART} alt={t("explorerHeroAlt")} loading="eager" decoding="async" />
      </section>
    );
  }

  if (result.type === "invalid" || resultUnavailable(result)) {
    const unavailable = resultUnavailable(result);
    const unavailableCopy = result.source === "indexer_unavailable"
      ? t("explorerIndexerUnavailableDesc")
      : t("explorerServiceUnavailable");
    return (
      <section className="explorer-result-surface explorer-result-message" data-state={unavailable ? "error" : "invalid"} role="alert">
        <span className="explorer-result-message__icon"><CircleAlert size={24} /></span>
        <div>
          <strong>{unavailable ? t("searchFailed") : t("searchUnknownTitle")}</strong>
          <p>{unavailable ? unavailableCopy : t("searchUnknownDesc")}</p>
          <code>{textValue(result.query)}</code>
        </div>
      </section>
    );
  }

  if (!resultFound(result)) {
    return (
      <section className="explorer-result-surface explorer-result-message" data-state="empty" role="status">
        <span className="explorer-result-message__icon"><Search size={24} /></span>
        <div>
          <strong>{t("explorerNoMatchTitle", { type: resultTypeLabel(result, t) })}</strong>
          <p>{notFoundCopy(result, t)}</p>
          <code>{resultIdentifier(result)}</code>
        </div>
      </section>
    );
  }

  const fields = resultFields(result, t);
  const relatedTransactions = Array.isArray(result.transactions) ? result.transactions.slice(0, 3) : [];
  const relatedCalls = Array.isArray(result.calls) ? result.calls.slice(0, 3) : [];
  return (
    <section className="explorer-result-surface" data-state="ready" aria-live="polite">
      <header className="explorer-object-head">
        <span className="explorer-object-head__icon" aria-hidden="true">{resultIcon(result.type)}</span>
        <div>
          <span>{resultTypeLabel(result, t)}</span>
          <strong>{t("explorerRecordFound")}</strong>
        </div>
        <em><CheckCircle2 size={14} />{networkLabel}</em>
      </header>

      <code className="explorer-object-id" title={resultIdentifier(result)}>{resultIdentifier(result)}</code>

      <dl className="explorer-field-grid">
        {fields.map((field, index) => (
          <div key={`${field.label}-${index}`} data-tone={field.tone}>
            <dt>{field.label}</dt>
            <dd className={field.mono ? "is-mono" : undefined} title={field.value}>{field.value}</dd>
          </div>
        ))}
      </dl>

      {(relatedTransactions.length > 0 || relatedCalls.length > 0) && (
        <div className="explorer-related-list">
          <strong>{result.type === "address" ? t("recentTransactions") : t("contractCalls")}</strong>
          {(relatedTransactions.length > 0 ? relatedTransactions : relatedCalls).map((row, index) => (
            <div key={textValue(row.tx_hash, row.hash, row.id, index)}>
              <code>{compactHash(textValue(row.tx_hash, row.hash, row.contract_hash, resultIdentifier(result)))}</code>
              <span>{textValue(row.role, row.method, row.vm_state, "—")}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function statusLabel(status: ExplorerDataStatus, t: PlayAreaProps["t"]) {
  switch (status) {
    case "live": return t("explorerDataLive");
    case "cached": return t("explorerDataCached");
    case "empty": return t("explorerDataEmpty");
    case "unavailable": return t("explorerDataUnavailable");
    default: return t("explorerDataLoading");
  }
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  const mainnetHeight = str("mainnetHeight");
  const mainnetTxCount = str("mainnetTxCount");
  const testnetHeight = str("testnetHeight");
  const testnetTxCount = str("testnetTxCount");
  const selectedNetworkValue = str("selectedNetwork", "mainnet");
  const selectedNetwork: ExplorerNetwork = selectedNetworkValue === "testnet" ? "testnet" : "mainnet";
  // `recentTxCount` is `undefined` until the recent-tx read settles (see
  // useExplorer). Read it raw, not through `num()`, which would coerce that
  // unread state to NaN and print "NaN" in the rail header.
  const recentTxCount = val<number>("recentTxCount");
  const isLoading = bool("isLoading");
  const isSearching = bool("isSearching");
  const searchQuery = str("searchQuery");
  const searchResult = val<SearchResult | null>("searchResult", null);
  const recentTxs = (val("recentTxs") ?? []) as TxItem[];
  const statsStatus = str("statsStatus", isLoading ? "loading" : "live") as ExplorerDataStatus;
  const recentStatus = str("recentStatus", isLoading ? "loading" : recentTxs.length > 0 ? "live" : "empty") as ExplorerDataStatus;
  const statsUpdatedAt = val<number | null>("statsUpdatedAt", null);

  const selectedHeight = selectedNetwork === "mainnet" ? mainnetHeight : testnetHeight;
  const selectedTxCount = selectedNetwork === "mainnet" ? mainnetTxCount : testnetTxCount;
  const otherHeight = selectedNetwork === "mainnet" ? testnetHeight : mainnetHeight;
  const otherNetworkLabel = selectedNetwork === "mainnet" ? t("testnet") : t("mainnet");
  const networkLabel = selectedNetwork === "mainnet" ? t("mainnet") : t("testnet");
  const query = searchQuery.trim();
  const resultIsUnavailable = searchResult?.type === "unavailable";
  const notAvailableLabel = t("notAvailable");
  const hasHeight = Boolean(selectedHeight && !["—", "-", notAvailableLabel].includes(selectedHeight));
  const hasTxCount = Boolean(selectedTxCount && !["—", "-", notAvailableLabel].includes(selectedTxCount));
  const railStatsStatus: ExplorerDataStatus = statsStatus === "live" && !hasHeight && !hasTxCount
    ? "unavailable"
    : statsStatus;
  const updatedAt = formatUpdatedAt(statsUpdatedAt);
  /**
   * Phases for the network rail. `statsStatus` is the settled signal the app
   * already tracks: anything other than "loading" means a read attempt has come
   * back. Without this split every absent value rendered an em dash plus an
   * "unavailable" caption, so the rail asserted a dead chain during its own
   * first fetch.
   */
  const statsLoading = statsStatus === "loading" || isLoading;
  const statsSettled = statsStatus !== "loading";
  const heightPhase = resolvePhase({ loading: statsLoading, settled: statsSettled, hasData: hasHeight });
  const txCountPhase = resolvePhase({ loading: statsLoading, settled: statsSettled, hasData: hasTxCount });
  const otherHeightPhase = resolvePhase({
    loading: statsLoading,
    settled: statsSettled,
    hasData: Boolean(otherHeight && !["—", "-", notAvailableLabel].includes(otherHeight)),
  });

  const setNetworkSafe = (network: string) => {
    if (network === "mainnet" || network === "testnet") state.selectedNetwork?.set(network);
  };

  const runSearch = () => {
    if (!query || isSearching) return;
    void dispatch("search");
  };

  const controls = (
    <div className="explorer-controls">
      <div className="explorer-controls__identity">
        <strong>{networkLabel}</strong>
        <span>{t("explorerSourceSummary")}</span>
      </div>

      <OpenUiSegmented
        className="explorer-controls__net"
        segmentedClassName="explorer-controls__net-group"
        label={t("sidebarNetwork")}
        value={selectedNetwork}
        onChange={setNetworkSafe}
        options={(["mainnet", "testnet"] as const).map((network) => ({
          value: network,
          label: <span className="explorer-net-btn">{network === "mainnet" ? t("mainnet") : t("testnet")}</span>,
        }))}
      />

      <div className="explorer-search-shell">
        <Search size={19} aria-hidden="true" />
        <OpenUiTextField
          className="explorer-search-box"
          inputClassName="explorer-search-box__control"
          label={t("explorerSearchDeck")}
          value={searchQuery}
          onChange={(event) => state.searchQuery?.set(event.target.value.slice(0, 128))}
          placeholder={t("searchPlaceholder")}
          maxLength={128}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onKeyDown={(event) => {
            if (event.key === "Enter") runSearch();
          }}
          disabled={isSearching}
          aria-invalid={searchResult?.type === "invalid" || undefined}
        />
      </div>
    </div>
  );

  const liveRail = (
    <aside className="explorer-live-rail" aria-label={t("explorerNetworkTelemetry")}>
      <header>
        <span className="explorer-status-dot" data-status={railStatsStatus} />
        <div>
          <strong>{networkLabel}</strong>
          <span>{statusLabel(railStatsStatus, t)}{updatedAt ? ` · ${updatedAt}` : ""}</span>
        </div>
        <RadioTower size={18} aria-hidden="true" />
      </header>

      {/*
        * The rail used to fall straight through to "—" plus an "unavailable"
        * caption for every value the moment it was absent — including while the
        * very first read was still in flight. A cold first paint therefore
        * opened with Block Height "—", Transactions "—", a Testnet height of
        * "N/A" and two "unavailable" captions, i.e. it reported a degraded
        * chain before it had finished asking. `railStatsStatus` already knows
        * the difference, so each value now renders through the shared DataPhase
        * vocabulary: a shimmer while the read runs, honest zero-state copy once
        * it settles empty, and the real number when there is one.
        */}
      <dl className="explorer-network-metrics">
        <div>
          {/*
            * This caption names where the number comes from; it is a source
            * label, not a status line. Swapping it to "Data temporarily
            * unavailable" made the rail repeat the same bad news the header dot
            * already reports, so one unreachable RPC read printed four
            * degradation messages down a single column. The header owns the
            * status; the value owns whether it loaded. It lives inside the
            * <dt> because a <dl> group may only contain <dt>/<dd> children.
            */}
          <dt>
            {t("blockHeight")}
            <span>{heightPhase === "loading" ? t("explorerDataLoading") : t("explorerSourceRpc")}</span>
          </dt>
          <dd>
            <PhaseValue phase={heightPhase} placeholder={t("explorerValuePending")} skeletonWidth="4.5em">
              {selectedHeight}
            </PhaseValue>
          </dd>
        </div>
        <div>
          <dt>
            {t("transactions")}
            <span>{txCountPhase === "loading" ? t("explorerDataLoading") : t("explorerSourceIndexer")}</span>
          </dt>
          <dd>
            <PhaseValue phase={txCountPhase} placeholder={t("explorerValuePending")} skeletonWidth="4.5em">
              {selectedTxCount}
            </PhaseValue>
          </dd>
        </div>
      </dl>

      <div className="explorer-other-network">
        <span>{otherNetworkLabel}</span>
        <strong>
          <PhaseValue phase={otherHeightPhase} placeholder={t("explorerValuePending")} skeletonWidth="3.5em">
            {otherHeight}
          </PhaseValue>
        </strong>
        <em>{t("blockHeight")}</em>
      </div>

      <section className="explorer-recent-rail">
        <header>
          <div><History size={16} /><strong>{t("recentTransactions")}</strong></div>
          {/* Absence is not zero: the count appears once the read settles. */}
          <span>{recentTxCount ?? t("explorerValuePending")}</span>
        </header>
        {recentTxs.length > 0 ? (
          <ul>
            {recentTxs.slice(0, 4).map((tx) => (
              <li key={tx.hash}>
                <button type="button" onClick={() => void dispatch("viewTx", tx.hash)}>
                  <code>{compactHash(tx.hash)}</code>
                  <span>{tx.vmState || t("vmUnknown")} · #{tx.blockIndex ?? "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="explorer-recent-state" data-status={recentStatus}>
            <p>{recentStatus === "unavailable" ? t("explorerRecentUnavailable") : statusLabel(recentStatus, t)}</p>
            {(recentStatus === "unavailable" || recentStatus === "empty" || recentStatus === "cached") && (
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("refreshExplorer")}>
                <RefreshCw size={14} />{t("refresh")}
              </button>
            )}
          </div>
        )}
      </section>
    </aside>
  );

  const scene = (
    <>
      {controls}
      <div className="explorer-workspace">
        <ResultSurface isSearching={isSearching} networkLabel={networkLabel} result={searchResult} t={t} />
        {liveRail}
      </div>
    </>
  );

  return (
    <OpenUiProvider>
      <div className="explorer-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            title: t("title"),
            subtitle: t("explorerSearchScope"),
          }}
          scene={scene}
          actions={{
            primary: {
              label: isSearching ? t("searching") : (resultIsUnavailable || searchResult?.source === "indexer_unavailable") ? t("retrySearch") : t("search"),
              onClick: runSearch,
              loading: isSearching,
              disabled: !query || isSearching,
              icon: <Search size={17} />,
            },
            secondary: [
              { label: t("refresh"), onClick: () => void dispatch("refreshExplorer"), hint: t("refreshData") },
            ],
          }}
          drawerToggleLabel={t("explorerDetails")}
          drawer={{
            title: t("explorerDetails"),
            children: (
              <div className="explorer-drawer">
                <section className="explorer-drawer-section">
                  <h4>{t("searchResult")}</h4>
                  <div className="explorer-drawer-result" data-tone={resultTone(searchResult)}>
                    <strong>{searchResult ? resultTypeLabel(searchResult, t) : t("searchResultNone")}</strong>
                    <span>{searchResult ? resultIdentifier(searchResult) || (searchResult.type === "unavailable" ? t("explorerServiceUnavailable") : t("searchUnknownDesc")) : t("explorerSearchHint")}</span>
                    {searchResult && resultFound(searchResult) && (
                      <details>
                        <summary>{t("rawRecord")}</summary>
                        <pre>{safeJson(searchResult)}</pre>
                      </details>
                    )}
                  </div>
                </section>

                <section className="explorer-drawer-section">
                  <h4>{t("recentTransactions")}</h4>
                  {recentTxs.length > 0 ? (
                    <ul className="explorer-tx-list">
                      {recentTxs.slice(0, 10).map((tx) => (
                        <li key={tx.hash}>
                          <button type="button" onClick={() => void dispatch("viewTx", tx.hash)}>
                            <span><strong>{compactHash(tx.hash)}</strong><em>{tx.vmState || t("vmUnknown")} · #{tx.blockIndex ?? "—"}</em></span>
                            <span>{t("viewFullRecord")}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="explorer-empty">{recentStatus === "unavailable" ? t("explorerRecentUnavailable") : t("explorerRecentEmptyDesc")}</p>
                  )}
                </section>

                <section className="explorer-drawer-section explorer-source-note">
                  <h4>{t("dataSources")}</h4>
                  <p><Server size={15} />{t("explorerSourceDescription")}</p>
                  <p><Database size={15} />{t("explorerIndexerDescription")}</p>
                  <p><Activity size={15} />{t("explorerPollingDescription")}</p>
                </section>
              </div>
            ),
          }}
        />
      </div>
    </OpenUiProvider>
  );
}
