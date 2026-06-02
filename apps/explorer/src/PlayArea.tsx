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

  const handleSearch = async () => {
    await dispatch("search");
  };

  const handleViewTx = async (hash: string) => {
    await dispatch("viewTx", hash);
  };

  return (
    <div className="explorer-play-area">
      <section className="explorer-hero" aria-label={t("title")}>
        <div className="explorer-hero__intro">
          <div className="explorer-hero__badge" aria-hidden="true">N3</div>
          <div className="explorer-hero__copy">
            <span className="explorer-eyebrow">{t("docSubtitle")}</span>
            <h2>{t("title")}</h2>
            <p>{t("docDescription")}</p>
            <span className="explorer-hero__tag">
              {t("explorerReadOnly")} · {activeNetworkLabel}
            </span>
          </div>
        </div>
      </section>

      <section className="explorer-network-overview" aria-label={t("sidebarNetwork")}>
        <header className="explorer-section-head">
          <span className="explorer-eyebrow">{t("sidebarNetwork")}</span>
          <strong>{activeNetworkHint}</strong>
        </header>
        <div className="network-stats">
          {[
            { label: t("mainnet"), height: mainnetHeight, txCount: mainnetTxCount },
            { label: t("testnet"), height: testnetHeight, txCount: testnetTxCount },
          ].map((network) => (
            <NeoCard variant="erobo" className="stat-card" key={network.label}>
              <div className="stat-block">
                <span className="stat-network-label">{network.label}</span>
                <div className="stat-row">
                  <span className="stat-label">{t("blockHeight")}</span>
                  <span className="stat-value mono">{formatNumber(network.height)}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">{t("transactions")}</span>
                  <span className="stat-value mono">{formatNumber(network.txCount)}</span>
                </div>
              </div>
            </NeoCard>
          ))}
        </div>
      </section>

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
        <div className="explorer-search-primer">
          <span className="explorer-eyebrow">{t("feature3Name")}</span>
          <strong>{t("explorerSearchHint")}</strong>
          <ul>
            <li>{t("explorerTipTx")}</li>
            <li>{t("explorerTipAddress")}</li>
            <li>{t("explorerTipContract")}</li>
            <li>{t("explorerTipBlock")}</li>
          </ul>
        </div>
      </section>

      <NeoCard variant="erobo" className="explorer-readonly-note">
        <div className="explorer-readonly-note__summary">
          <span>{t("explorerSafetyTitle")}</span>
          <strong>{t("explorerReadOnly")}</strong>
          <p>{t("explorerSafetyDesc")}</p>
        </div>
        <div className="explorer-readonly-note__stats">
          <div>
            <span>{t("sidebarRecentTxs")}</span>
            <strong>{recentTxCount > 0 ? recentTxCount.toLocaleString() : t("explorerDataPending")}</strong>
          </div>
          <div>
            <span>{t("searchResult")}</span>
            <strong>{searchResult ? t("explorerResultReady") : t("explorerDataPending")}</strong>
          </div>
        </div>
      </NeoCard>

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
