import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import {
  MiniAppInfo,
  MiniAppStats,
  MiniAppNotification,
  AppDetailHeader,
  AppStatsCard,
  AppNewsList,
  WalletState,
} from "../../components";
import { useTheme } from "../../components/providers/ThemeProvider";
import { ActivityTicker } from "../../components/ActivityTicker";
import { AppSecretsTab } from "../../components/features/secrets/AppSecretsTab";
import { ReviewsTab } from "../../components/features/reviews";
import { ForumTab } from "../../components/features/forum";
import { SplitViewLayout } from "../../components/layout/SplitViewLayout";
import { RightSidebarPanel } from "../../components/layout/RightSidebarPanel";
import { LaunchDock } from "../../components/LaunchDock";
import { FederatedMiniApp } from "../../components/FederatedMiniApp";
import { LiveChat } from "../../components/features/chat";
import { MiniAppFrame } from "../../components/features/miniapp";
import { SimilarApps } from "../../components/features/discovery/SimilarApps";
import { TagCloud } from "../../components/features/tags";
import { MiniAppTransition } from "../../components/ui";
import { useActivityFeed } from "../../hooks/useActivityFeed";
import {
  buildMiniAppEntryUrl,
  coerceMiniAppInfo,
  parseFederatedEntryUrl,
  getContractForChain,
  resolveChainIdForApp,
  getEntryUrlForChain,
  getAllSupportedChains,
} from "../../lib/miniapp";
import { fetchWithTimeout, resolveInternalBaseUrl } from "../../lib/edge";
import { getBuiltinApp } from "../../lib/builtin-apps";
import { logger } from "../../lib/logger";
import { useTranslation } from "../../lib/i18n/react";
import { installMiniAppSDK } from "../../lib/miniapp-sdk";
import { injectMiniAppViewportStyles } from "../../lib/miniapp-iframe";
import { dispatchBridgeCall, resolveIframeOrigin } from "../../lib/miniapp-sdk-bridge";
import type { MiniAppSDK } from "../../lib/miniapp-sdk";
import type { ChainId } from "../../lib/chains/types";
// Chain configuration comes from MiniApp manifest only - no environment defaults
import { useI18n } from "../../lib/i18n/react";
import { useWalletStore, getWalletAdapter } from "../../lib/wallet/store";
import { useMiniAppStats } from "../../lib/query";
import { getChainRegistry } from "../../lib/chains/registry";
import { CelebrationEffects, WaterRippleEffect, useSpecialEffects } from "../../components/effects";
import { getLocalizedField, getMiniappLocale } from "@neo/shared/i18n";

// Sanitize object for JSON serialization (convert undefined to null)
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

type StatCardConfig = {
  title: string;
  value: string | number;
  icon: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
};

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

const DEFAULT_STATS_DISPLAY = ["total_transactions", "view_count", "total_gas_used", "daily_active_users"];

const STAT_KEY_ALIASES: Record<string, string> = {
  tx_count: "total_transactions",
  gas_burned: "total_gas_used",
  gas_consumed: "total_gas_used",
};

// Factory function to create stat card builders with i18n support
function createStatCardBuilders(
  t: (key: string) => string,
): Record<string, (stats: MiniAppStats) => StatCardConfig | null> {
  return {
    total_transactions: (stats) =>
      stats.total_transactions != null
        ? {
            title: t("detail.totalTxs"),
            value: stats.total_transactions.toLocaleString(),
            icon: "📊",
            trend: "neutral",
          }
        : null,
    total_users: (stats) =>
      stats.total_users != null
        ? { title: t("detail.totalUsers"), value: stats.total_users.toLocaleString(), icon: "👥", trend: "neutral" }
        : null,
    total_gas_used: (stats) => ({
      title: t("detail.gasBurned"),
      value: formatGas(stats.total_gas_used),
      icon: "🔥",
      trend: "neutral",
    }),
    total_gas_earned: (stats) => ({
      title: t("detail.gasEarned"),
      value: formatGas(stats.total_gas_earned),
      icon: "💰",
      trend: "neutral",
    }),
    daily_active_users: (stats) =>
      stats.daily_active_users != null
        ? {
            title: t("detail.dailyActiveUsers"),
            value: stats.daily_active_users.toLocaleString(),
            icon: "👥",
            trend: "up",
          }
        : null,
    weekly_active_users: (stats) =>
      stats.weekly_active_users != null
        ? {
            title: t("detail.weeklyActive"),
            value: stats.weekly_active_users.toLocaleString(),
            icon: "📈",
            trend: "up",
          }
        : null,
    view_count: (stats) => ({
      title: t("detail.views"),
      value: (stats.view_count || 0).toLocaleString(),
      icon: "👁️",
      trend: "neutral",
    }),
    last_activity_at: (stats) => ({
      title: t("detail.lastActive"),
      value: formatLastActive(stats.last_activity_at),
      icon: "⏱",
      trend: "neutral",
    }),
  };
}

export type AppDetailPageProps = {
  app: MiniAppInfo | null;
  stats: MiniAppStats | null;
  notifications: MiniAppNotification[];
  error?: string;
};

interface WindowWithMiniAppSDK {
  MiniAppSDK?: MiniAppSDK;
}

export default function MiniAppDetailPage({ app, stats: ssrStats, notifications, error }: AppDetailPageProps) {
  const router = useRouter();
  const { t } = useTranslation("host");
  const { locale } = useI18n();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "forum" | "news" | "secrets">("overview");

  // Use cached stats with SSR data as initial value (prevents reload on navigation)
  const { data: cachedStats } = useMiniAppStats(app?.app_id || "", {
    initialData: ssrStats,
    enabled: !!app?.app_id,
  });
  const stats = cachedStats ?? ssrStats;

  // Use global wallet store
  const { address, connected, provider, chainId: storeChainId, setChainId } = useWalletStore();
  const requestedChainId = useMemo(() => {
    const raw = router.query.chain ?? router.query.chainId;
    if (Array.isArray(raw)) return (raw[0] || "") as ChainId;
    if (typeof raw === "string" && raw.trim()) return raw as ChainId;
    return null;
  }, [router.query.chain, router.query.chainId]);
  const supportedChainIds = useMemo(() => (app ? getAllSupportedChains(app) : []), [app]);
  // Chain comes from: 1) URL param, 2) wallet store, 3) app manifest fallback
  const walletChainId = app ? resolveChainIdForApp(app, requestedChainId || storeChainId) : null;
  const wallet: WalletState = {
    connected,
    address,
    provider: provider as WalletState["provider"],
    chainId: walletChainId,
  };
  const contractAddress = useMemo(() => (app ? getContractForChain(app, walletChainId) : null), [app, walletChainId]);
  const chainType = useMemo(() => {
    if (!walletChainId) return undefined;
    return getChainRegistry().getChain(walletChainId)?.type;
  }, [walletChainId]);
  const entryUrl = useMemo(() => (app ? getEntryUrlForChain(app, walletChainId) : ""), [app, walletChainId]);

  // Special effects for miniapp operations
  const {
    celebrationType,
    celebrationActive,
    celebrationIntensity,
    celebrationDuration,
    rippleActive,
    triggerEvent: triggerSpecialEffect,
  } = useSpecialEffects();

  useEffect(() => {
    if (!app || !walletChainId) return;
    if (storeChainId === walletChainId) return;
    if (!connected || provider === "auth0") {
      setChainId(walletChainId);
    }
  }, [app, walletChainId, storeChainId, connected, provider, setChainId]);

  // Ref for accessing wallet in callbacks
  const walletRef = useRef(wallet);
  useEffect(() => {
    walletRef.current = wallet;
  }, [connected, address, provider]);

  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const showNews = app?.news_integration !== false;
  const showSecrets = app?.permissions?.confidential === true;

  // TEE Verification State
  const [teeVerification, setTeeVerification] = useState<{
    txHash: string;
    attestation: string;
    method: string;
    timestamp: number;
  } | null>(null);

  // App-specific activity feed
  const { activities: appActivities } = useActivityFeed({
    appId: app?.app_id,
    pollInterval: 5000,
    enabled: Boolean(app?.app_id),
  });

  // MiniApp launch logic
  const federated = app ? parseFederatedEntryUrl(entryUrl, app.app_id) : null;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sdkRef = useRef<MiniAppSDK | null>(null);

  // Build iframe URL with language parameter
  const iframeSrc = useMemo(() => {
    if (!app) return "";
    const supportedLocale = getMiniappLocale(locale);
    return buildMiniAppEntryUrl(entryUrl, { lang: supportedLocale, theme, embedded: "1" });
  }, [entryUrl, locale, theme, app]);

  useEffect(() => {
    if (!app || federated) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const origin = resolveIframeOrigin(entryUrl);
    if (!origin) return;
    iframe.contentWindow.postMessage({ type: "theme-change", theme }, origin);
  }, [theme, entryUrl, federated]);

  // Self-contained i18n: use MiniApp's own translations based on locale
  const appName = app ? getLocalizedField(app, "name", locale) : "";
  const appDesc = app ? getLocalizedField(app, "description", locale) : "";

  // Track view count on page load (with multi-chain support)
  useEffect(() => {
    if (!app?.app_id || !walletChainId) return;
    const chainQuery = `?chain_id=${encodeURIComponent(walletChainId)}`;
    fetch(`/api/miniapps/${app.app_id}/view${chainQuery}`, { method: "POST" }).catch(() => {});
  }, [app?.app_id, walletChainId]);

  // Initialize SDK
  useEffect(() => {
    if (!app) return;
    sdkRef.current = installMiniAppSDK({
      appId: app.app_id,
      chainId: walletChainId,
      chainType,
      contractAddress,
      permissions: app.permissions,
      supportedChains: app.supportedChains,
      chainContracts: app.chainContracts,
    });
  }, [app, walletChainId, contractAddress, chainType]);

  // Iframe bridge for SDK communication
  useEffect(() => {
    if (!app || federated) return;
    if (typeof window === "undefined") return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    const expectedOrigin = resolveIframeOrigin(entryUrl);
    if (!expectedOrigin) return;

    const allowSameOriginInjection = expectedOrigin === window.location.origin;

    const ensureSDK = () => {
      if (!sdkRef.current) {
        sdkRef.current = installMiniAppSDK({
          appId: app.app_id,
          chainId: walletChainId,
          chainType,
          contractAddress,
          permissions: app.permissions,
          supportedChains: app.supportedChains,
          chainContracts: app.chainContracts,
        });
      }
      return sdkRef.current;
    };

    const sendConfig = () => {
      const sdk = ensureSDK();
      if (!sdk?.getConfig) return;
      if (!iframe.contentWindow) return;
      iframe.contentWindow.postMessage({ type: "miniapp_config", config: sdk.getConfig() }, expectedOrigin);
    };

    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      if (event.origin !== expectedOrigin) return;

      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object") return;
      if (data.type === "miniapp_ready") {
        sendConfig();
        return;
      }
      if (data.type !== "miniapp_sdk_request") return;

      const id = String(data.id ?? "").trim();
      if (!id) return;

      const method = String(data.method ?? "").trim();
      const params = Array.isArray(data.params) ? data.params : [];
      const source = event.source as Window | null;
      if (!source || typeof source.postMessage !== "function") return;

      const respond = (ok: boolean, result?: unknown, error?: string) => {
        source.postMessage(
          {
            type: "miniapp_sdk_response",
            id,
            ok,
            result,
            error,
          },
          expectedOrigin,
        );
      };

      try {
        // Handle special effect trigger method directly (no SDK needed)
        if (method === "triggerEffect" || method === "celebrate") {
          const eventName = String(params[0] || "").trim();
          if (eventName) {
            triggerSpecialEffect(eventName);
            respond(true, { triggered: eventName });
            return;
          }
          respond(false, undefined, "Event name required");
          return;
        }

        const sdk = ensureSDK();
        if (!sdk) throw new Error("MiniAppSDK unavailable");
        // Pass the current wallet address from the ref
        const result = await dispatchBridgeCall(
          sdk,
          method,
          params,
          app.permissions,
          app.app_id,
          walletRef.current.address,
        );

        // Intercept TEE metadata for the UI
        if (result && typeof result === "object") {
          const res = result as Record<string, any>;
          if (res.attestation || res.txHash || res.txid) {
            setTeeVerification({
              txHash: res.txHash || res.txid || "N/A",
              attestation: res.attestation || "Hardware Attested",
              method,
              timestamp: Date.now(),
            });
            // Auto-hide after 10 seconds
            setTimeout(() => setTeeVerification(null), 10000);
          }

          // Trigger special effects based on result type
          if (res.success !== false) {
            if (res.win || res.jackpot || method.includes("claim_prize")) {
              triggerSpecialEffect("jackpot");
            } else if (res.reward || res.bonus || method.includes("reward")) {
              triggerSpecialEffect("reward");
            } else if (res.txHash || res.txid) {
              triggerSpecialEffect("transaction_success");
            }
          }
        }

        respond(true, result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "request failed";
        respond(false, undefined, message);
      }
    };

    const handleLoad = () => {
      sendConfig();
      if (!allowSameOriginInjection) return;
      injectMiniAppViewportStyles(iframe);
      const sdk = ensureSDK();
      if (!sdk) return;
      try {
        if (iframe.contentWindow) {
          (iframe.contentWindow as WindowWithMiniAppSDK).MiniAppSDK = sdk;
          iframe.contentWindow.dispatchEvent(new Event("miniapp-sdk-ready"));
        }
      } catch {
        // Ignore cross-origin access failures
      }
    };

    window.addEventListener("message", handleMessage);
    iframe.addEventListener("load", handleLoad);
    handleLoad();

    return () => {
      window.removeEventListener("message", handleMessage);
      iframe.removeEventListener("load", handleLoad);
    };
  }, [app?.app_id, iframeSrc, app?.permissions, federated, entryUrl, chainType]);

  // Network latency monitoring
  useEffect(() => {
    const measureLatency = async () => {
      try {
        const start = performance.now();

        const adapter = getWalletAdapter();
        if (connected && address && adapter && "getBalance" in adapter && walletChainId) {
          // Use wallet balance check as a ping to the blockchain node (Neo N3 only)
          await adapter.getBalance(address, walletChainId);
        } else {
          // Fallback to internal health check
          await fetch("/api/health", { method: "HEAD" });
        }

        const end = performance.now();
        setNetworkLatency(Math.round(end - start));
      } catch (e) {
        setNetworkLatency(null);
      }
    };
    measureLatency();
    const interval = setInterval(measureLatency, 5000);
    return () => clearInterval(interval);
  }, [connected, address, walletChainId]);

  // Wallet connection is handled globally by useWalletStore

  if (error || !app) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">{t("detail.appNotFound")}</h1>
          <p className="text-base text-muted-foreground mb-6">{error || t("detail.appNotFoundDesc")}</p>
          <button
            className="px-6 py-3 rounded-lg border border-border bg-transparent text-foreground text-sm cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => router.push("/miniapps")}
          >
            ← {t("detail.backToMiniApps")}
          </button>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 2) {
      router.back();
    } else {
      router.push("/miniapps");
    }
  };

  const handleShare = useCallback(() => {
    const chainQuery = walletChainId ? `?chain=${encodeURIComponent(walletChainId)}` : "";
    const url = `${window.location.origin}/miniapps/${app.app_id}${chainQuery}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setToastMessage("Link copied!");
        setTimeout(() => setToastMessage(null), 2000);
      })
      .catch((e) => logger.error("Failed to copy link", e));
  }, [app.app_id]);

  const statCards = stats ? buildStatCards(stats, app.stats_display ?? undefined, t) : [];

  // Left panel: App details
  const leftPanel = (
    <div className="h-full overflow-auto bg-background">
      <AppDetailHeader app={app} stats={stats || undefined} />

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Hero Section */}
        <section className="mb-8">
          <p className="text-base text-muted-foreground leading-relaxed m-0">{appDesc}</p>
          <TagCloud appId={app.app_id} onTagClick={(tagId) => router.push(`/miniapps?tag=${tagId}`)} className="mt-4" />
        </section>

        {/* Stats Grid */}
        {stats && statCards.length > 0 && (
          <section className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-8">
            {statCards.map((card) => (
              <AppStatsCard
                key={card.title}
                title={card.title}
                value={card.value}
                icon={card.icon}
                trend={card.trend}
                trendValue={card.trendValue}
              />
            ))}
          </section>
        )}

        {/* App Activity Ticker */}
        <section className="mb-6">
          <ActivityTicker
            activities={appActivities}
            title={`${appName} ${t("detail.activity")}`}
            height={150}
            scrollSpeed={20}
          />
        </section>

        {/* Tabs */}
        <section className="mb-8">
          <div className="flex gap-2 border-b border-border mb-6">
            <button
              className={`px-6 py-3 bg-transparent border-none border-b-2 text-sm font-semibold cursor-pointer transition-all ${
                activeTab === "overview"
                  ? "border-neo text-neo"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("overview")}
            >
              {t("detail.overview")}
            </button>
            <button
              className={`px-6 py-3 bg-transparent border-none border-b-2 text-sm font-semibold cursor-pointer transition-all ${
                activeTab === "reviews"
                  ? "border-neo text-neo"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("reviews")}
            >
              ⭐ {t("detail.reviews")}
            </button>
            <button
              className={`px-6 py-3 bg-transparent border-none border-b-2 text-sm font-semibold cursor-pointer transition-all ${
                activeTab === "forum"
                  ? "border-neo text-neo"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("forum")}
            >
              💬 {t("detail.forum")}
            </button>
            {showNews && (
              <button
                className={`px-6 py-3 bg-transparent border-none border-b-2 text-sm font-semibold cursor-pointer transition-all ${
                  activeTab === "news"
                    ? "border-neo text-neo"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("news")}
              >
                {t("detail.news")} ({notifications.length})
              </button>
            )}
            {showSecrets && (
              <button
                className={`px-6 py-3 bg-transparent border-none border-b-2 text-sm font-semibold cursor-pointer transition-all ${
                  activeTab === "secrets"
                    ? "border-neo text-neo"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("secrets")}
              >
                🔐 {t("detail.secrets")}
              </button>
            )}
          </div>

          <div className="min-h-[200px]">
            {activeTab === "overview" && <OverviewTab app={app} t={t} entryUrl={entryUrl} chainId={walletChainId} />}
            {activeTab === "reviews" && <ReviewsTab appId={app.app_id} />}
            {activeTab === "forum" && <ForumTab appId={app.app_id} />}
            {activeTab === "news" && showNews && <AppNewsList notifications={notifications} />}
            {activeTab === "secrets" && showSecrets && <AppSecretsTab appId={app.app_id} appName={appName} />}
            {!showNews && activeTab === "news" && (
              <p className="mt-4 text-xs text-muted-foreground">{t("detail.newsDisabled")}</p>
            )}
          </div>
        </section>

        {/* Similar Apps Section - Steam-style recommendation */}
        <SimilarApps currentAppId={app.app_id} category={app.category} maxItems={4} />
      </main>
    </div>
  );

  // Right panel: MiniApp iframe
  // Right panel: MiniApp iframe
  const rightPanel = (
    <div className="relative h-full bg-transparent flex flex-col overflow-hidden">
      <LaunchDock
        appName={appName}
        appId={app.app_id}
        wallet={wallet}
        supportedChainIds={supportedChainIds}
        networkLatency={networkLatency}
        onBack={handleBack}
        onExit={handleBack}
        onShare={handleShare}
      />
      <div className="flex-1 w-full min-h-0 overflow-hidden relative">
        <MiniAppTransition>
          <MiniAppFrame>
            {federated ? (
              <div className="w-full h-full overflow-y-auto overflow-x-hidden">
                <FederatedMiniApp appId={federated.appId} view={federated.view} remote={federated.remote} />
              </div>
            ) : (
              <>
                {isIframeLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-white via-[#f5f6ff] to-[#e6fbf3] dark:from-[#05060d] dark:via-[#090a14] dark:to-[#050a0d] z-10 overflow-hidden">
                    {/* E-Robo Water Wave Background */}
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] bg-[radial-gradient(ellipse_at_center,rgba(159,157,243,0.15)_0%,transparent_50%)] animate-[water-wave_12s_ease-in-out_infinite]" />
                      <div className="absolute w-[250%] h-[250%] top-[-75%] left-[-75%] bg-[radial-gradient(ellipse_at_center,rgba(247,170,199,0.1)_0%,transparent_60%)] animate-[water-wave-reverse_15s_ease-in-out_infinite]" />
                    </div>
                    {/* Concentric ripple rings */}
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="absolute rounded-full border-2 border-erobo-purple/30 animate-[concentric-ripple_2s_ease-out_infinite]"
                        style={{
                          animationDelay: `${i * 0.4}s`,
                          width: 100 + i * 80,
                          height: 100 + i * 80,
                        }}
                      />
                    ))}
                    {/* Center loading indicator */}
                    <div className="relative z-10 flex flex-col items-center p-8 rounded-[24px] bg-white/85 dark:bg-white/[0.06] backdrop-blur-[50px] border border-white/60 dark:border-erobo-purple/20 shadow-[0_0_30px_rgba(159,157,243,0.15)]">
                      <div className="w-16 h-16 rounded-full border-4 border-erobo-purple/30 border-t-erobo-purple animate-spin mb-4 shadow-[0_0_20px_rgba(159,157,243,0.4)]" />
                      <div className="text-xl font-bold text-erobo-ink dark:text-white tracking-tight">
                        {t("detail.launching")}
                      </div>
                      <div className="text-sm font-medium text-erobo-ink-soft/70 dark:text-white/60 mt-1">
                        {appName}
                      </div>
                    </div>
                  </div>
                )}
                <iframe
                  key={locale}
                  src={iframeSrc}
                  ref={iframeRef}
                  onLoad={() => setIsIframeLoading(false)}
                  className={`w-full h-full border-0 bg-white dark:bg-[#0a0f1a] transition-opacity duration-500 ${
                    isIframeLoading ? "opacity-0" : "opacity-100"
                  }`}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  title={`${appName} MiniApp`}
                  allowFullScreen
                />
              </>
            )}
          </MiniAppFrame>
        </MiniAppTransition>
      </div>
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#00ff88]/90 text-black px-6 py-3 rounded-lg font-semibold text-sm z-[9999] shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* TEE Verification Overlay */}
      {teeVerification && (
        <div className="absolute bottom-6 right-6 w-[340px] bg-[#0a0f1a]/95 backdrop-blur-xl rounded-2xl border border-[#00ff88]/30 shadow-[0_12px_40px_rgba(0,0,0,0.4)] text-white z-[1000] overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="px-4 py-3 bg-[#00ff88]/10 border-b border-[#00ff88]/20 flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00ff88] shadow-[0_0_10px_#00ff88] animate-pulse" />
            <span className="text-[11px] font-bold text-[#00ff88] uppercase tracking-wider flex-1">
              {t("miniapp.tee.verified")}
            </span>
            <button
              onClick={() => setTeeVerification(null)}
              className="bg-transparent border-none text-white text-xl cursor-pointer opacity-60 hover:opacity-100 leading-none transition-opacity"
            >
              ×
            </button>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-white/40 uppercase font-semibold">{t("miniapp.tee.method")}</span>
              <span className="text-[11px] text-white/90 break-all">{teeVerification.method}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-white/40 uppercase font-semibold">{t("miniapp.tee.txHash")}</span>
              <span className="text-[11px] text-white/90 break-all font-mono">{teeVerification.txHash}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-white/40 uppercase font-semibold">{t("miniapp.tee.attestation")}</span>
              <span className="text-[11px] font-bold text-[#00ff88]">{teeVerification.attestation}</span>
            </div>
          </div>
          <div className="px-4 py-2 text-[9px] text-white/30 border-t border-white/5 text-center bg-white/5">
            {t("miniapp.tee.footer")}
          </div>
        </div>
      )}

      <LiveChat
        appId={app.app_id}
        walletAddress={wallet.address}
        userName={wallet.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : undefined}
      />

      {/* Celebration Effects Overlay */}
      <CelebrationEffects
        type={celebrationType}
        active={celebrationActive}
        intensity={celebrationIntensity}
        duration={celebrationDuration}
      />

      {/* Water Ripple Effect for transactions */}
      {rippleActive && (
        <div className="absolute inset-0 pointer-events-none z-[1001]">
          <WaterRippleEffect active={rippleActive} intensity={25} duration={1200}>
            <div className="w-full h-full" />
          </WaterRippleEffect>
        </div>
      )}
    </div>
  );

  // Use walletChainId which is already computed from app manifest and wallet state
  const effectiveChainId = walletChainId;

  return (
    <SplitViewLayout
      leftPanel={leftPanel}
      centerPanel={rightPanel}
      rightPanel={
        <RightSidebarPanel
          appId={app.app_id}
          appName={appName}
          chainId={effectiveChainId}
          permissions={app.permissions}
          contractInfo={{
            contractAddress: getContractForChain(app, effectiveChainId),
            masterKeyAddress: app.developer?.address,
          }}
        />
      }
      leftWidth={450}
      rightWidth={520}
    />
  );
}

function OverviewTab({
  app,
  t,
  entryUrl,
  chainId,
}: {
  app: MiniAppInfo;
  t: (key: string) => string;
  entryUrl: string;
  chainId: ChainId | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card rounded-xl p-6 border border-border">
        <h3 className="text-lg font-semibold text-foreground mt-0 mb-4">{t("detail.permissions")}</h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {Object.entries(app.permissions).map(([key, value]) =>
            value ? (
              <div key={key} className="flex items-center gap-2">
                <span className="text-neo font-bold text-base">✓</span>
                <span className="text-sm text-foreground">{formatPermission(key)}</span>
              </div>
            ) : null,
          )}
        </div>
      </div>

      {app.limits && (
        <div className="bg-card rounded-xl p-6 border border-border">
          <h3 className="text-lg font-semibold text-foreground mt-0 mb-4">{t("detail.limits")}</h3>
          <ul className="list-none p-0 m-0">
            {app.limits.max_gas_per_tx && (
              <li className="text-sm text-muted-foreground py-2 border-b border-border">
                {t("detail.maxGasPerTx")}: {app.limits.max_gas_per_tx}
              </li>
            )}
            {app.limits.daily_gas_cap_per_user && (
              <li className="text-sm text-muted-foreground py-2 border-b border-border">
                {t("detail.dailyGasCap")}: {app.limits.daily_gas_cap_per_user}
              </li>
            )}
            {app.limits.governance_cap && (
              <li className="text-sm text-muted-foreground py-2 border-b border-border">
                {t("detail.governanceCap")}: {app.limits.governance_cap}
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="bg-card rounded-xl p-6 border border-border">
        <h3 className="text-lg font-semibold text-foreground mt-0 mb-4">{t("detail.appInfo")}</h3>
        <p className="text-sm text-muted-foreground my-2">
          {t("detail.appId")}:{" "}
          <code className="bg-neo/10 px-1.5 py-0.5 rounded text-xs font-mono text-neo">{app.app_id}</code>
        </p>
        <p className="text-sm text-muted-foreground my-2">
          {t("detail.entryUrl")}
          {chainId ? ` (${chainId})` : ""}:{" "}
          <code className="bg-neo/10 px-1.5 py-0.5 rounded text-xs font-mono text-neo">{entryUrl}</code>
        </p>
      </div>
    </div>
  );
}

function formatPermission(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildStatCards(stats: MiniAppStats, display?: string[], t?: (key: string) => string): StatCardConfig[] {
  const keys = display ? display : DEFAULT_STATS_DISPLAY;
  const cards: StatCardConfig[] = [];
  const builders = createStatCardBuilders(t || ((key) => key));
  for (const rawKey of keys) {
    const key = String(rawKey || "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    const canonicalKey = STAT_KEY_ALIASES[key] ?? key;
    const builder = builders[canonicalKey];
    if (!builder) continue;
    const card = builder(stats);
    if (card) cards.push(card);
  }
  return cards;
}

function formatGas(value?: string): string {
  if (!value) return "0.00";
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return "0.00";
  return parsed.toFixed(2);
}

function formatLastActive(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const diffMs = Date.now() - date.getTime();
  if (diffMs <= 0) return "Just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Server-Side Props
export const getServerSideProps: GetServerSideProps<AppDetailPageProps> = async (context) => {
  const { id } = context.params as { id: string };
  const baseUrl = resolveInternalBaseUrl(context.req as RequestLike | undefined);
  const encodedId = encodeURIComponent(id);

  // First check if it's a builtin app - return immediately if found
  const fallback = getBuiltinApp(id);

  try {
    // Parallel fetch with shorter timeout (2s) for faster page load
    // Note: /api/miniapp-stats returns aggregated stats across ALL chains by default
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
        props: {
          app: null,
          stats: null,
          notifications: [],
          error: "App not found",
        },
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
      props: {
        app: null,
        stats: null,
        notifications: [],
        error: "Failed to load app details",
      },
    };
  }
};
