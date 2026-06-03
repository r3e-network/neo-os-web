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

  const mainnetHeight = num("mainnetHeight");
  const mainnetTxCount = num("mainnetTxCount");
  const testnetHeight = num("testnetHeight");
  const testnetTxCount = num("testnetTxCount");
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

  const formatNumber = (n: number) =>
    n > 0 ? n.toLocaleString() : t("explorerDataPending");

  const activeNetworkLabel = selectedNetwork === "mainnet" ? t("mainnet") : t("testnet");
  const activeNetworkHint = selectedNetwork === "mainnet"
    ? t("explorerMainnetHint")
    : t("explorerTestnetHint");

  // Surface the active network's live figures inline in the hero / metrics strip.
  const activeHeight = selectedNetwork === "mainnet" ? mainnetHeight : testnetHeight;
  const activeTxCount = selectedNetwork === "mainnet" ? mainnetTxCount : testnetTxCount;

  const hasSearched = Boolean(searchResult) || recentTxs.length > 0;

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
          <span className={`explorer-metric__value mono${activeHeight > 0 ? "" : " is-pending"}`}>
            {formatNumber(activeHeight)}
          </span>
        </div>
        <div className="explorer-metric">
          <span className="explorer-metric__label">{t("transactions")}</span>
          <span className={`explorer-metric__value mono${activeTxCount > 0 ? "" : " is-pending"}`}>
            {formatNumber(activeTxCount)}
          </span>
        </div>
        <div className="explorer-metric">
          <span className="explorer-metric__label">{t("sidebarRecentTxs")}</span>
          <span className={`explorer-metric__value mono${recentTxCount > 0 ? "" : " is-pending"}`}>
            {recentTxCount > 0 ? recentTxCount.toLocaleString() : t("explorerDataPending")}
          </span>
        </div>
        <div className="explorer-metric">
          <span className="explorer-metric__label">{t("searchResult")}</span>
          <span className={`explorer-metric__value${searchResult ? " is-ready" : " is-pending"}`}>
            {searchResult ? t("explorerResultReady") : t("explorerDataPending")}
          </span>
        </div>
      </section>

      {(isSearching || isLoading) && (
        <div className="loading" role="status" aria-live="polite">
          <div className="loading-spinner" />
          <span>{t("searching")}</span>
        </div>
      )}

      <SearchResultDisplay
        t={t}
        result={searchResult}
        formatTime={formatTime}
      />

      {/* Recent transactions appear once data has loaded; otherwise stay hidden. */}
      {hasSearched && (
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
