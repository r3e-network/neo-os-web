/**
 * PlayArea.tsx — React version of the Explorer PlayArea.
 *
 * Composes SearchPanel, SearchResultDisplay, and RecentTransactions.
 */

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
  const { str, bool, val } = useStateBindings(state);

  const searchQuery = str("searchQuery");
  const selectedNetwork = str("selectedNetwork", "mainnet") as "mainnet" | "testnet";
  const isSearching = bool("isSearching");
  const searchResult = val<Record<string, unknown>>("searchResult");
  const recentTxs = val<Array<{ hash: string; vmState: string; blockTime: unknown }> >("recentTxs") ?? [];

  const formatTime = (time: unknown) => {
    const dateStr = typeof time === "string" ? time : String(time ?? "");
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat(undefined).format(d);
  };

  const truncateHash = (hash: unknown) => {
    const s = typeof hash === "string" ? hash : String(hash ?? "");
    if (!s) return "";
    return `${s.slice(0, 10)}...${s.slice(-8)}`;
  };

  const handleSearch = async () => {
    await dispatch("search");
  };

  const handleViewTx = async (hash: string) => {
    await dispatch("viewTx", hash);
  };

  return (
    <div className="explorer-play-area">
      <SearchPanel
        t={t}
        searchQuery={searchQuery}
        selectedNetwork={selectedNetwork}
        isSearching={isSearching}
        onUpdateSearchQuery={(val) => state.searchQuery?.set(val)}
        onUpdateSelectedNetwork={(val) => state.selectedNetwork?.set(val)}
        onSearch={handleSearch}
      />

      {/* Loading State */}
      {isSearching && (
        <div className="loading" role="status" aria-live="polite">
          <span>{t("searching")}</span>
        </div>
      )}

      <SearchResultDisplay
        t={t}
        result={searchResult}
        formatTime={formatTime}
      />

      <RecentTransactions
        t={t}
        transactions={recentTxs}
        formatTime={formatTime}
        truncateHash={truncateHash}
        onViewTx={handleViewTx}
      />
    </div>
  );
}
