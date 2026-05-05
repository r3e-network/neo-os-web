/**
 * PlayArea.tsx — Explorer
 *
 * READ-ONLY blockchain explorer with network stats, search, and recent transactions.
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

  // Network stats
  const mainnetHeight = num("mainnetHeight");
  const mainnetTxCount = num("mainnetTxCount");
  const testnetHeight = num("testnetHeight");
  const testnetTxCount = num("testnetTxCount");
  const recentTxCount = num("recentTxCount");
  const isLoading = bool("isLoading");

  // Search state
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
    n > 0 ? n.toLocaleString() : (t("notAvailable") || "N/A");

  const handleSearch = async () => {
    await dispatch("search");
  };

  const handleViewTx = async (hash: string) => {
    await dispatch("viewTx", hash);
  };

  return (
    <div className="explorer-play-area">
      {/* Network Stats */}
      <div className="network-stats">
        <NeoCard variant="erobo" className="stat-card">
          <div className="stat-block">
            <span className="stat-network-label">{t("mainnet") || "Mainnet"}</span>
            <div className="stat-row">
              <span className="stat-label">{t("blockHeight") || "Block Height"}</span>
              <span className="stat-value mono">{formatNumber(mainnetHeight)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">{t("transactions") || "Transactions"}</span>
              <span className="stat-value mono">{formatNumber(mainnetTxCount)}</span>
            </div>
          </div>
        </NeoCard>
        <NeoCard variant="erobo" className="stat-card">
          <div className="stat-block">
            <span className="stat-network-label">{t("testnet") || "Testnet"}</span>
            <div className="stat-row">
              <span className="stat-label">{t("blockHeight") || "Block Height"}</span>
              <span className="stat-value mono">{formatNumber(testnetHeight)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">{t("transactions") || "Transactions"}</span>
              <span className="stat-value mono">{formatNumber(testnetTxCount)}</span>
            </div>
          </div>
        </NeoCard>
      </div>

      {/* Search */}
      <SearchPanel
        t={t}
        searchQuery={searchQuery}
        selectedNetwork={selectedNetwork}
        isSearching={isSearching}
        onUpdateSearchQuery={(v) => state.searchQuery?.set(v)}
        onUpdateSelectedNetwork={(v) => state.selectedNetwork?.set(v)}
        onSearch={handleSearch}
      />

      {/* Loading State */}
      {(isSearching || isLoading) && (
        <div className="loading" role="status" aria-live="polite">
          <div className="loading-spinner" />
          <span>{t("searching") || "Searching..."}</span>
        </div>
      )}

      {/* Search Result */}
      <SearchResultDisplay
        t={t}
        result={searchResult}
        formatTime={formatTime}
      />

      {/* Recent Transactions */}
      <RecentTransactions
        t={t}
        transactions={recentTxs}
        formatTime={formatTime}
        truncateHash={truncateHash}
        onViewTx={handleViewTx}
      />

      {/* Recent TX count footer */}
      {recentTxCount > 0 && (
        <div className="recent-count-footer">
          <span className="recent-count-label">
            {t("recentTxCount") || "Recent transactions"}: {recentTxCount}
          </span>
        </div>
      )}
    </div>
  );
}
