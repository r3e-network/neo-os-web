import React, { useEffect, useMemo } from "react";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { SplitViewLayout } from "../../components/layout";
import { AppInfoPanel } from "../../components/features/app";
import { MiniAppViewer } from "../../components/features/miniapp";
import { MiniAppInfo, MiniAppStats, MiniAppNotification } from "../../components/types";
import { coerceMiniAppInfo, resolveChainIdForApp } from "../../lib/miniapp";
import { fetchWithTimeout, resolveInternalBaseUrl } from "../../lib/edge";
import { getBuiltinApp } from "../../lib/builtin-apps";
import { logger } from "../../lib/logger";
import { useI18n } from "../../lib/i18n/react";
import type { ChainId } from "../../lib/chains/types";
import { useWalletStore } from "../../lib/wallet/store";
// Chain configuration comes from MiniApp manifest only - no environment defaults

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

function sanitizeForJson<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as T;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForJson) as T;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = value === undefined ? null : sanitizeForJson(value);
  }
  return result as T;
}

export type UnifiedAppPageProps = {
  app: MiniAppInfo | null;
  stats: MiniAppStats | null;
  notifications: MiniAppNotification[];
  error?: string;
};

export default function UnifiedAppPage({ app, stats, notifications, error }: UnifiedAppPageProps) {
  const router = useRouter();
  const { locale } = useI18n();
  const { connected, address, chainId: storeChainId } = useWalletStore();
  const requestedChainId = useMemo(() => {
    const raw = router.query.chain ?? router.query.chainId;
    if (Array.isArray(raw)) return (raw[0] || "") as ChainId;
    if (typeof raw === "string" && raw.trim()) return raw as ChainId;
    return null;
  }, [router.query.chain, router.query.chainId]);
  const effectiveChainId = useMemo(
    () => (app ? resolveChainIdForApp(app, requestedChainId || storeChainId) : null),
    [app, requestedChainId, storeChainId],
  );

  // ESC key to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        router.push("/miniapps");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  if (error || !app) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-white mb-4">App Not Found</h1>
          <p className="text-white/60 mb-6">{error || "The requested app could not be found."}</p>
          <button
            onClick={() => router.push("/miniapps")}
            className="px-6 py-3 rounded-lg border border-white/20 text-white hover:bg-white/10"
          >
            ← Back to MiniApps
          </button>
        </div>
      </div>
    );
  }

  return (
    <SplitViewLayout
      leftPanel={
        <AppInfoPanel
          app={app}
          stats={stats}
          notifications={notifications}
          walletConnected={connected}
          walletAddress={address}
        />
      }
      centerPanel={<MiniAppViewer key={locale} app={app} locale={locale} chainId={effectiveChainId ?? undefined} />}
    />
  );
}

export const getServerSideProps: GetServerSideProps<UnifiedAppPageProps> = async (context) => {
  const { id } = context.params as { id: string };
  const baseUrl = resolveInternalBaseUrl(context.req as RequestLike | undefined);
  const encodedId = encodeURIComponent(id);
  const fallback = getBuiltinApp(id);

  try {
    const [statsRes, notifRes] = await Promise.all([
      fetchWithTimeout(`${baseUrl}/api/miniapp-stats?app_id=${encodedId}`, {}, 2000).catch(() => null),
      fetchWithTimeout(`${baseUrl}/api/app/${encodedId}/news?limit=20`, {}, 2000).catch(() => null),
    ]);

    const statsData = statsRes?.ok ? await statsRes.json().catch(() => ({})) : {};
    const notifData = notifRes?.ok ? await notifRes.json().catch(() => ({ notifications: [] })) : { notifications: [] };

    const statsList = Array.isArray(statsData?.stats)
      ? statsData.stats
      : Array.isArray(statsData)
        ? statsData
        : statsData
          ? [statsData]
          : [];

    const rawStats = statsList.find((s: Record<string, unknown>) => s?.app_id === id) ?? statsList[0] ?? null;
    const app = rawStats ? coerceMiniAppInfo(rawStats, fallback) : (fallback ?? null);

    if (!app) {
      return {
        props: { app: null, stats: null, notifications: [], error: "App not found" },
      };
    }

    return {
      props: {
        app: sanitizeForJson(app),
        stats: sanitizeForJson(rawStats) || null,
        notifications: notifData.notifications || [],
      },
    };
  } catch (error) {
    logger.error("Failed to fetch app details:", error);
    return {
      props: { app: null, stats: null, notifications: [], error: "Failed to load app details" },
    };
  }
};
