import type { HeroStatsStripItem, StatsDisplayItem } from "@shared/components";

export function buildOracleHeroStats(params: {
  oracleHash: string;
  network: string;
  middleLabel: string;
  middleValue: string | number;
}) {
  return [
    { label: "Oracle", value: `${params.oracleHash.slice(0, 10)}…` },
    { label: params.middleLabel, value: params.middleValue },
    { label: "Network", value: params.network },
  ] satisfies HeroStatsStripItem[];
}

export function buildOracleOverviewStats(params: {
  oracleHash: string;
  publicApiUrl: string;
  extra?: StatsDisplayItem | null;
}) {
  return [
    { label: "Oracle", value: params.oracleHash, variant: "accent" },
    ...(params.extra ? [params.extra] : []),
    { label: "Public API", value: params.publicApiUrl, variant: "success" },
  ] satisfies StatsDisplayItem[];
}

export function buildAAHeroStats(params: {
  aaCore: string;
  middleLabel: string;
  middleValue: string | number;
  trailingLabel: string;
  trailingValue: string | number;
}) {
  return [
    { label: "AA Core", value: `${params.aaCore.slice(0, 10)}…` },
    { label: params.middleLabel, value: params.middleValue },
    { label: params.trailingLabel, value: params.trailingValue },
  ] satisfies HeroStatsStripItem[];
}

export function buildAAOverviewStats(params: {
  aaCore: string;
  walletValue?: string;
  extra?: StatsDisplayItem | null;
}) {
  return [
    { label: "AA Core", value: params.aaCore, variant: "accent" },
    ...(params.extra ? [params.extra] : []),
    ...(params.walletValue !== undefined
      ? [{ label: "Wallet", value: params.walletValue, variant: "success" as const }]
      : []),
  ] satisfies StatsDisplayItem[];
}
