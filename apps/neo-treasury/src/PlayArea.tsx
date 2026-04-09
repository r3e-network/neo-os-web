/**
 * PlayArea.tsx — React version of the Neo Treasury PlayArea.
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
  const { bool, str, val } = useStateBindings(state);

  const data = val<TreasuryData>("data");
  const loading = bool("loading");
  const error = str("error");

  const handleRefresh = async () => {
    await dispatch("refresh");
  };

  return (
    <div className="treasury-play-area">
      <TreasuryHero
        t={t}
        totalUsd={data?.totalUsd}
        totalNeo={data?.totalNeo}
        totalGas={data?.totalGas}
      />

      {/* Main Content */}
      {data ? (
        <div>
          <TreasuryLoadingState t={t} loading={loading} error="" hasData={true} />
        </div>
      ) : (
        <TreasuryLoadingState
          t={t}
          loading={loading}
          error={error}
          hasData={false}
          onRetry={handleRefresh}
        />
      )}

      {/* Operation Panel Inline */}
      <NeoCard variant="erobo">
        <NeoButton
          size="sm"
          variant="primary"
          className="op-btn"
          disabled={loading}
          onClick={handleRefresh}
        >
          {loading ? t("refreshing") : t("refreshData")}
        </NeoButton>
      </NeoCard>
    </div>
  );
}
