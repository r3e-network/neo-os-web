/**
 * PlayArea.tsx — Explorer
 *
 * Read-only blockchain explorer with network stats, search, and recent transactions.
 * Uses all state keys and actions from main.tsx setup().
 */

import { NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import SearchPanel from "./components/SearchPanel";
import SearchResultDisplay from "./components/SearchResultDisplay";
import RecentTransactions from "./components/RecentTransactions";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  // mainnet*/testnet* observables expose already-formatted strings (e.g.
  // "1,234,567" or the "N/A" placeholder), so read them as strings — parsing
  // them back through num() would yield NaN and hide every live figure.
  const mainnetHeight = str("mainnetHeight");
  const mainnetTxCount = str("mainnetTxCount");
  const testnetHeight = str("testnetHeight");
  const testnetTxCount = str("testnetTxCount");
  const recentTxCount = num("recentTxCount");
  const isLoading = bool("isLoading");

  const searchQuery = str("searchQuery");
  const selectedNetwork = str("selectedNetwork", "mainnet") as "mainnet" | "testnet";
  const isSearching = bool("isSearching");
  const searchResult = val<Record<string, unknown>>("searchResult");
  const recentTxs = val<Array<{ hash: string; vmState: string; blockTime: unknown }>>("recentTxs") ?? [];

  const formatTime = (time: unknown) => {
    if (typeof time === "number") {
      const ms = time > 10_000_000_000 ? time : time * 1000;
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(ms));
    }
    const dateStr = typeof time === "string" ? time : String(time ?? "");
    if (/^\d+$/.test(dateStr)) {
      const raw = Number(dateStr);
      const ms = raw > 10_000_000_000 ? raw : raw * 1000;
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(ms));
    }
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat(undefined).format(d);
  };

  const truncateHash = (hash: unknown) => {
    const s = typeof hash === "string" ? hash : String(hash ?? "");
    if (!s) return "";
    return `${s.slice(0, 10)}...${s.slice(-8)}`;
  };

  // Unloaded figures use the calm "—" placeholder convention rather than
  // repeating "Sync pending" across every tile (which reads error-ish).
  const PENDING_PLACEHOLDER = "—";
  const notAvailable = t("notAvailable");
  // A pre-formatted figure string counts as pending only when the source value
  // is genuinely absent (empty or the "N/A" placeholder). A real fetched figure
  // — even a genuine "0" — is shown verbatim, so live chain stats land on first
  // paint instead of collapsing to "—" because the figure happened to be zero.
  const isPendingFigure = (s: string) => !s || s === notAvailable;
  const displayFigure = (s: string) => (isPendingFigure(s) ? PENDING_PLACEHOLDER : s);

  const activeNetworkLabel = selectedNetwork === "mainnet" ? t("mainnet") : t("testnet");
  const activeNetworkHint = selectedNetwork === "mainnet"
    ? t("explorerMainnetHint")
    : t("explorerTestnetHint");

  // Surface the active network's live figures inline in the hero / metrics strip.
  const activeHeight = selectedNetwork === "mainnet" ? mainnetHeight : testnetHeight;
  const activeTxCount = selectedNetwork === "mainnet" ? mainnetTxCount : testnetTxCount;
  const heightPending = isPendingFigure(activeHeight);
  const txCountPending = isPendingFigure(activeTxCount);

  // Show the recent-tx lane (which carries its own empty-state guidance card)
  // as the resting-state content rather than gating the whole block away — the
  // only time it stays hidden is the brief initial load before any data lands,
  // to avoid flashing the empty guidance over an in-flight fetch.
  const showRecent = recentTxs.length > 0 || !isLoading;

  const handleSearch = async () => {
    await dispatch("search");
  };

  const handleViewTx = async (hash: string) => {
    await dispatch("viewTx", hash);
  };

  return (
    <div className="explorer-play-area">
      {/* ── Hero: headline state + the few relevant facts folded inline ── */}
      <section className="explorer-hero" aria-label={t("title")}>
        <div className="explorer-hero__intro">
          <div className="explorer-hero__badge" aria-hidden="true">N3</div>
          <div className="explorer-hero__copy">
            <span className="explorer-eyebrow">{t("docSubtitle")}</span>
            <h2>{t("title")}</h2>
            <p>{t("docDescription")}</p>
            <div className="explorer-hero__facts">
              <span className="explorer-hero__tag">
                {t("explorerReadOnly")} · {activeNetworkLabel}
              </span>
              <span className="explorer-hero__fact">{activeNetworkHint}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Primary action: search (surfaced immediately after the hero) ── */}
      <section className="explorer-search-section" aria-label={t("explorerSearchScope")}>
        <SearchPanel
          t={t}
          searchQuery={searchQuery}
          selectedNetwork={selectedNetwork}
          isSearching={isSearching}
          onUpdateSearchQuery={(v) => state.searchQuery?.set(v)}
          onUpdateSelectedNetwork={(v) => state.selectedNetwork?.set(v)}
          onSearch={handleSearch}
        />
      </section>

      {/* ── One compact metrics strip (replaces the two duplicated network cards) ── */}
      <section className="explorer-metrics" aria-label={t("sidebarNetwork")}>
        <div className="explorer-metric">
          <span className="explorer-metric__label">{t("blockHeight")}</span>
          <span className={`explorer-metric__value mono${heightPending ? " is-pending" : ""}`}>
            {displayFigure(activeHeight)}
          </span>
        </div>
        <div className="explorer-metric">
          <span className="explorer-metric__label">{t("transactions")}</span>
          <span className={`explorer-metric__value mono${txCountPending ? " is-pending" : ""}`}>
            {displayFigure(activeTxCount)}
          </span>
        </div>
        <div className="explorer-metric">
          <span className="explorer-metric__label">{t("sidebarRecentTxs")}</span>
          <span className={`explorer-metric__value mono${recentTxCount > 0 ? "" : " is-pending"}`}>
            {recentTxCount > 0 ? recentTxCount.toLocaleString() : PENDING_PLACEHOLDER}
          </span>
        </div>
        <div className="explorer-metric">
          <span className="explorer-metric__label">{t("searchResult")}</span>
          <span className={`explorer-metric__value${searchResult ? " is-ready" : " is-pending"}`}>
            {searchResult ? t("explorerResultReady") : PENDING_PLACEHOLDER}
          </span>
        </div>
      </section>

      {(isSearching || isLoading) && (
        <div className="loading" role="status" aria-live="polite">
          <div className="loading-spinner" />
          {/* The first mount runs loadAll (isLoading) before the user has typed
              anything — show "Loading…" there, reserving "Searching…" for an
              actual in-flight search so the label always matches the action. */}
          <span>{isSearching ? t("searching") : t("loading")}</span>
        </div>
      )}

      <SearchResultDisplay
        t={t}
        result={searchResult}
        formatTime={formatTime}
        network={selectedNetwork === "testnet" ? "testnet" : "mainnet"}
      />

      {/* Recent transactions — when empty, RecentTransactions renders the
          workflow-tips guidance card so the lower area has purposeful resting
          content before the first interaction (only suppressed mid-initial-load). */}
      {showRecent && (
        <RecentTransactions
          t={t}
          transactions={recentTxs}
          formatTime={formatTime}
          truncateHash={truncateHash}
          onViewTx={handleViewTx}
        />
      )}
    </div>
  );
}
