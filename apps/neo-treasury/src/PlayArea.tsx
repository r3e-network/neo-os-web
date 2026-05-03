/**
 * PlayArea.tsx — Neo Treasury
 *
 * Full interactive treasury dashboard: stats bar with USD/NEO/GAS totals,
 * hero section, category breakdown, loading/error states, and refresh action.
 */

import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import TreasuryHero from "./components/TreasuryHero";
import TreasuryLoadingState from "./components/TreasuryLoadingState";
import "./PlayArea.scss";

interface TreasuryData {
  totalUsd: number;
  totalNeo: number;
  totalGas: number;
  lastUpdated: string;
  prices: Record<string, unknown>;
  categories: Array<{ name: string; [key: string]: unknown }>;
}

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, str, num, val } = useStateBindings(state);

  const data = val<TreasuryData>("data");
  const loading = bool("loading");
  const error = str("error");
  const totalUsdDisplay = str("totalUsdDisplay");
  const totalNeoDisplay = str("totalNeoDisplay");
  const totalGasDisplay = str("totalGasDisplay");
  const founderCount = num("founderCount");

  const handleRefresh = async () => {
    await dispatch("refresh");
  };

  const formatNumber = (value: unknown, maximumFractionDigits = 2) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "0";
    return amount.toLocaleString(undefined, { maximumFractionDigits });
  };

  const formatCategoryDetail = (cat: { name: string; [key: string]: unknown }) => {
    const walletCount = Array.isArray(cat.wallets) ? cat.wallets.length : 0;
    return [
      walletCount > 0 ? `${walletCount} ${t("wallets") || "wallets"}` : null,
      `${formatNumber(cat.totalNeo, 4)} NEO`,
      `${formatNumber(cat.totalGas, 4)} GAS`,
      `$${formatNumber(cat.totalUsd, 2)}`,
    ].filter(Boolean).join(" | ");
  };

  return (
    <div className="treasury-play-area">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-value">{totalUsdDisplay || "--"}</span>
          <span className="stat-label">{t("sidebarTotalUsd") || "Total USD"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{totalNeoDisplay || "--"}</span>
          <span className="stat-label">{t("tokenNeo") || "NEO"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{totalGasDisplay || "--"}</span>
          <span className="stat-label">{t("tokenGas") || "GAS"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{founderCount}</span>
          <span className="stat-label">{t("categories") || "Categories"}</span>
        </div>
      </div>

      {/* Hero */}
      <TreasuryHero
        t={t}
        totalUsd={data?.totalUsd}
        totalNeo={data?.totalNeo}
        totalGas={data?.totalGas}
      />

      {/* Main Content */}
      {data ? (
        <>
          <TreasuryLoadingState t={t} loading={loading} error="" hasData={true} />

          {/* Category Breakdown */}
          {data.categories && data.categories.length > 0 && (
            <NeoCard variant="erobo" className="categories-card">
              <span className="section-title">{t("treasuryBreakdown") || "Treasury Breakdown"}</span>
              <div className="categories-list">
                {data.categories.map((cat: { name: string; [key: string]: unknown }, idx: number) => (
                  <div key={idx} className="category-row">
                    <span className="category-name">{cat.name}</span>
                    <span className="category-detail">{formatCategoryDetail(cat)}</span>
                  </div>
                ))}
              </div>
            </NeoCard>
          )}

          {/* Last Updated */}
          {data.lastUpdated && (
            <span className="last-updated">{t("lastUpdated") || "Last updated"}: {data.lastUpdated}</span>
          )}
        </>
      ) : (
        <TreasuryLoadingState
          t={t}
          loading={loading}
          error={error}
          hasData={false}
          onRetry={handleRefresh}
        />
      )}

      {/* Operation Panel */}
      <NeoCard variant="erobo" className="operation-card">
        <NeoButton
          size="sm"
          variant="primary"
          className="op-btn"
          disabled={loading}
          onClick={handleRefresh}
          aria-label={loading ? (t("refreshing") || "Refreshing...") : (t("refreshData") || "Refresh")}
        >
          {loading ? (t("refreshing") || "Refreshing...") : (t("refreshData") || "Refresh Data")}
        </NeoButton>
      </NeoCard>
    </div>
  );
}
