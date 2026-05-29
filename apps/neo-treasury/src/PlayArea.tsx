/**
 * PlayArea.tsx - Neo Treasury
 *
 * Read-only treasury dashboard. The page remains useful while live balances
 * are loading or unavailable, then fills in public chain totals when present.
 */

import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import {
  DA_HONGFEI_ADDRESSES,
  ERIK_ZHANG_ADDRESSES,
} from "./utils/treasury";
import "./PlayArea.scss";

interface TreasuryData {
  totalUsd: number;
  totalNeo: number;
  totalGas: number;
  lastUpdated: number | string;
  prices: Record<string, unknown>;
  categories: Array<{ name: string; [key: string]: unknown }>;
}

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

function formatNumber(value: unknown, maximumFractionDigits = 2) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString(undefined, { maximumFractionDigits });
}

function formatLastUpdated(value: number | string | undefined) {
  if (!value) return "";
  if (typeof value === "string") return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, str, val } = useStateBindings(state);

  const data = val<TreasuryData>("data");
  const loading = bool("loading");
  const error = str("error");
  const totalUsdDisplay = str("totalUsdDisplay");
  const totalNeoDisplay = str("totalNeoDisplay");
  const totalGasDisplay = str("totalGasDisplay");
  const hasLiveData = Boolean(data);
  const watchedAddressCount =
    DA_HONGFEI_ADDRESSES.length + ERIK_ZHANG_ADDRESSES.length;
  const lastUpdated = formatLastUpdated(data?.lastUpdated);
  const signalLabel = hasLiveData
    ? t("treasuryLiveSynced")
    : loading
      ? t("treasuryLiveLoading")
      : t("treasuryLivePending");
  const isRefreshing = loading && hasLiveData;

  const watchGroups = data?.categories?.length
    ? data.categories.map((category) => ({
        name: String(category.name || t("treasuryGroup")),
        addresses: Array.isArray(category.wallets)
          ? category.wallets.length
          : 0,
        neo: `${formatNumber(category.totalNeo, 4)} NEO`,
        gas: `${formatNumber(category.totalGas, 4)} GAS`,
        usd: `$${formatNumber(category.totalUsd, 2)}`,
      }))
    : [
        {
          name: "Da Hongfei",
          addresses: DA_HONGFEI_ADDRESSES.length,
          neo: t("treasuryLivePending"),
          gas: t("treasuryLivePending"),
          usd: t("treasuryLivePending"),
        },
        {
          name: "Erik Zhang",
          addresses: ERIK_ZHANG_ADDRESSES.length,
          neo: t("treasuryLivePending"),
          gas: t("treasuryLivePending"),
          usd: t("treasuryLivePending"),
        },
      ];

  const handleRefresh = async () => {
    await dispatch("refresh");
  };

  return (
    <div className="treasury-play-area">
      <section className="treasury-hero" aria-label={t("title")}>
        <div className="treasury-hero__copy">
          <span className="treasury-eyebrow">{t("docSubtitle")}</span>
          <h2>{t("title")}</h2>
          <p>{t("docDescription")}</p>
        </div>
        <div className="treasury-hero__metrics" aria-label={t("treasuryInfo")}>
          <div className="treasury-metric">
            <span>{t("sidebarTotalUsd")}</span>
            <strong>{hasLiveData ? totalUsdDisplay : t("treasuryLivePending")}</strong>
          </div>
          <div className="treasury-metric">
            <span>{t("tokenNeo")}</span>
            <strong>{hasLiveData ? totalNeoDisplay : "--"}</strong>
          </div>
          <div className="treasury-metric">
            <span>{t("tokenGas")}</span>
            <strong>{hasLiveData ? totalGasDisplay : "--"}</strong>
          </div>
        </div>
      </section>

      <section className="treasury-signal-card" aria-label={t("treasuryLiveStatus")}>
        <div className="treasury-token" aria-hidden="true">
          N
        </div>
        <div className="treasury-signal-card__copy">
          <span>{t("treasuryLiveStatus")}</span>
          <strong>{signalLabel}</strong>
          <p>
            {hasLiveData
              ? t("treasurySyncedHint")
              : t("treasuryPendingHint")}
          </p>
        </div>
        <div className="treasury-sparkline" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </section>

      <section className="treasury-watchlist" aria-label={t("treasuryWatchlist")}>
        {watchGroups.map((group) => (
          <NeoCard variant="erobo" className="treasury-group-card" key={group.name}>
            <div className="treasury-group-header">
              <span>{group.name}</span>
              <strong>
                {group.addresses} {t("addresses")}
              </strong>
            </div>
            <dl>
              <div>
                <dt>{t("tokenNeo")}</dt>
                <dd>{group.neo}</dd>
              </div>
              <div>
                <dt>{t("tokenGas")}</dt>
                <dd>{group.gas}</dd>
              </div>
              <div>
                <dt>{t("sidebarTotalUsd")}</dt>
                <dd>{group.usd}</dd>
              </div>
            </dl>
          </NeoCard>
        ))}
      </section>

      <section className="treasury-route" aria-label={t("treasuryReadOnlyRoute")}>
        <div>
          <span>01</span>
          <strong>{t("step1")}</strong>
        </div>
        <div>
          <span>02</span>
          <strong>{t("step2")}</strong>
        </div>
        <div>
          <span>03</span>
          <strong>{t("step4")}</strong>
        </div>
      </section>

      <NeoCard variant="erobo" className="treasury-action-card">
        <div className="treasury-readonly-note">
          <span>{t("treasuryReadOnlyRoute")}</span>
          <strong>{watchedAddressCount} {t("addresses")}</strong>
          <p>{t("feature3Desc")}</p>
          {error && <p className="treasury-error">{error}</p>}
          {lastUpdated && (
            <p className="treasury-updated">
              {t("lastUpdated")}: {lastUpdated}
            </p>
          )}
        </div>
        <NeoButton
          size="lg"
          variant="primary"
          className="op-btn"
          disabled={isRefreshing}
          onClick={handleRefresh}
          aria-label={isRefreshing ? t("refreshing") : t("refreshData")}
        >
          {isRefreshing ? t("refreshing") : t("refreshData")}
        </NeoButton>
      </NeoCard>
    </div>
  );
}
