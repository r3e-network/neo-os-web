import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import {
  MiniAppInfo,
  MiniAppStats,
  MiniAppNotification,
  colors,
  getThemeColors,
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
import { MiniAppTransition } from "@/components/ui";
import { useActivityFeed } from "../../hooks/useActivityFeed";
import { buildMiniAppEntryUrl, coerceMiniAppInfo, parseFederatedEntryUrl } from "../../lib/miniapp";
import { fetchWithTimeout, resolveInternalBaseUrl } from "../../lib/edge";
import { getBuiltinApp } from "../../lib/builtin-apps";
import { logger } from "../../lib/logger";
import { useTranslation } from "../../lib/i18n/react";
import { installMiniAppSDK } from "../../lib/miniapp-sdk";
import { injectMiniAppViewportStyles } from "../../lib/miniapp-iframe";
import type { MiniAppSDK } from "../../lib/miniapp-sdk";
import { useI18n } from "../../lib/i18n/react";
import { useWalletStore, getWalletAdapter } from "../../lib/wallet/store";
import { useMiniAppStats } from "../../lib/query";

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

/** NeoLine N3 wallet interface */
interface NeoLineN3Wallet {
  Init: new () => { getAccount: () => Promise<{ address: string }> };
}

interface WindowWithNeoLine extends Window {
  NEOLineN3?: NeoLineN3Wallet;
}

interface WindowWithMiniAppSDK {
  MiniAppSDK?: MiniAppSDK;
}

export default function MiniAppDetailPage({ app, stats: ssrStats, notifications, error }: AppDetailPageProps) {
  const router = useRouter();
  const { t } = useTranslation("host");
  const { locale } = useI18n();
  const { theme } = useTheme();
  const themeColors = getThemeColors(theme);
  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "forum" | "news" | "secrets">("overview");

  // Use cached stats with SSR data as initial value (prevents reload on navigation)
  const { data: cachedStats } = useMiniAppStats(app?.app_id || "", {
    initialData: ssrStats,
    enabled: !!app?.app_id,
  });
  const stats = cachedStats ?? ssrStats;

  // Use global wallet store
  const { address, connected, provider } = useWalletStore();
  const wallet = { connected, address, provider };

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
  const federated = app ? parseFederatedEntryUrl(app.entry_url, app.app_id) : null;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sdkRef = useRef<MiniAppSDK | null>(null);

  // Build iframe URL with language parameter
  const iframeSrc = useMemo(() => {
    if (!app) return "";
    const supportedLocale = locale === "zh" ? "zh" : "en";
    return buildMiniAppEntryUrl(app.entry_url, { lang: supportedLocale, theme, embedded: "1" });
  }, [app?.entry_url, locale, theme]);

  useEffect(() => {
    if (!app || federated) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const origin = resolveIframeOrigin(app.entry_url);
    if (!origin) return;
    iframe.contentWindow.postMessage({ type: "theme-change", theme }, origin);
  }, [theme, app?.entry_url, federated]);

  // Self-contained i18n: use MiniApp's own translations based on locale
  const appName = app ? (locale === "zh" && app.name_zh ? app.name_zh : app.name) : "";
  const appDesc = app ? (locale === "zh" && app.description_zh ? app.description_zh : app.description) : "";

  // Track view count on page load
  useEffect(() => {
    if (!app?.app_id) return;
    fetch(`/api/miniapps/${app.app_id}/view`, { method: "POST" }).catch(() => {});
  }, [app?.app_id]);

  // Initialize SDK
  useEffect(() => {
    if (!app) return;
    sdkRef.current = installMiniAppSDK({
      appId: app.app_id,
      contractHash: app.contract_hash ?? null,
      permissions: app.permissions,
    });
  }, [app?.app_id, app?.contract_hash, app?.permissions]);

  // Iframe bridge for SDK communication
  useEffect(() => {
    if (!app || federated) return;
    if (typeof window === "undefined") return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    const expectedOrigin = resolveIframeOrigin(app.entry_url);
    if (!expectedOrigin) return;

    const allowSameOriginInjection = expectedOrigin === window.location.origin;

    const ensureSDK = () => {
      if (!sdkRef.current) {
        sdkRef.current = installMiniAppSDK({
          appId: app.app_id,
          contractHash: app.contract_hash ?? null,
          permissions: app.permissions,
        });
      }
      return sdkRef.current;
    };

    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      if (event.origin !== expectedOrigin) return;

      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object") return;
      if (data.type !== "neo_miniapp_sdk_request") return;

      const id = String(data.id ?? "").trim();
      if (!id) return;

      const method = String(data.method ?? "").trim();
      const params = Array.isArray(data.params) ? data.params : [];
      const source = event.source as Window | null;
      if (!source || typeof source.postMessage !== "function") return;

      const respond = (ok: boolean, result?: unknown, error?: string) => {
        source.postMessage(
          {
            type: "neo_miniapp_sdk_response",
            id,
            ok,
            result,
            error,
          },
          expectedOrigin,
        );
      };

      try {
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
        }

        respond(true, result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "request failed";
        respond(false, undefined, message);
      }
    };

    const handleLoad = () => {
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
  }, [app?.app_id, iframeSrc, app?.permissions, federated, app?.entry_url]);

  // Network latency monitoring
  useEffect(() => {
    const measureLatency = async () => {
      try {
        const start = performance.now();

        const adapter = getWalletAdapter();
        if (connected && address && adapter) {
          // Use wallet balance check as a ping to the blockchain node
          await adapter.getBalance(address);
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
  }, [connected, address]);

  // Wallet connection is handled globally by useWalletStore

  if (error || !app) {
    return (
      <div style={{ ...containerStyle, background: themeColors.bg, color: themeColors.text }}>
        <div style={errorContainerStyle}>
          <h1 style={{ ...errorTitleStyle, color: themeColors.text }}>{t("detail.appNotFound")}</h1>
          <p style={{ ...errorMessageStyle, color: themeColors.textMuted }}>{error || t("detail.appNotFoundDesc")}</p>
          <button
            style={{ ...backButtonStyle, color: themeColors.text, borderColor: themeColors.border }}
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
    const url = `${window.location.origin}/miniapps/${app.app_id}`;
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
    <div style={{ ...leftPanelStyle, background: themeColors.bg }}>
      <AppDetailHeader app={app} stats={stats || undefined} />

      <main style={mainStyle}>
        {/* Hero Section */}
        <section style={heroStyle}>
          <p style={{ ...descriptionStyle, color: themeColors.textMuted }}>{appDesc}</p>
        </section>

        {/* Stats Grid */}
        {stats && statCards.length > 0 && (
          <section style={statsGridStyle}>
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
        <section style={activitySectionStyle}>
          <ActivityTicker
            activities={appActivities}
            title={`${appName} ${t("detail.activity")}`}
            height={150}
            scrollSpeed={20}
          />
        </section>

        {/* Tabs */}
        <section style={tabsContainerStyle}>
          <div style={{ ...tabsHeaderStyle, borderColor: themeColors.border }}>
            <button
              style={
                activeTab === "overview"
                  ? { ...tabButtonActiveStyle, color: themeColors.primary, borderBottomColor: themeColors.primary }
                  : { ...tabButtonStyle, color: themeColors.textMuted }
              }
              onClick={() => setActiveTab("overview")}
            >
              {t("detail.overview")}
            </button>
            <button
              style={
                activeTab === "reviews"
                  ? { ...tabButtonActiveStyle, color: themeColors.primary, borderBottomColor: themeColors.primary }
                  : { ...tabButtonStyle, color: themeColors.textMuted }
              }
              onClick={() => setActiveTab("reviews")}
            >
              ⭐ {t("detail.reviews")}
            </button>
            <button
              style={
                activeTab === "forum"
                  ? { ...tabButtonActiveStyle, color: themeColors.primary, borderBottomColor: themeColors.primary }
                  : { ...tabButtonStyle, color: themeColors.textMuted }
              }
              onClick={() => setActiveTab("forum")}
            >
              💬 {t("detail.forum")}
            </button>
            {showNews && (
              <button
                style={
                  activeTab === "news"
                    ? { ...tabButtonActiveStyle, color: themeColors.primary, borderBottomColor: themeColors.primary }
                    : { ...tabButtonStyle, color: themeColors.textMuted }
                }
                onClick={() => setActiveTab("news")}
              >
                {t("detail.news")} ({notifications.length})
              </button>
            )}
            {showSecrets && (
              <button
                style={
                  activeTab === "secrets"
                    ? { ...tabButtonActiveStyle, color: themeColors.primary, borderBottomColor: themeColors.primary }
                    : { ...tabButtonStyle, color: themeColors.textMuted }
                }
                onClick={() => setActiveTab("secrets")}
              >
                🔐 {t("detail.secrets")}
              </button>
            )}
          </div>

          <div style={tabContentStyle}>
            {activeTab === "overview" && <OverviewTab app={app} t={t} />}
            {activeTab === "reviews" && <ReviewsTab appId={app.app_id} />}
            {activeTab === "forum" && <ForumTab appId={app.app_id} />}
            {activeTab === "news" && showNews && <AppNewsList notifications={notifications} />}
            {activeTab === "secrets" && showSecrets && <AppSecretsTab appId={app.app_id} appName={appName} />}
            {!showNews && activeTab === "news" && <p style={newsDisabledStyle}>{t("detail.newsDisabled")}</p>}
          </div>
        </section>
      </main>
    </div>
  );

  // Right panel: MiniApp iframe
  const rightPanel = (
    <div style={rightPanelContainerStyle}>
      <LaunchDock
        appName={appName}
        appId={app.app_id}
        wallet={wallet}
        networkLatency={networkLatency}
        onBack={handleBack}
        onExit={handleBack}
        onShare={handleShare}
      />
      <div style={iframeWrapperStyle}>
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
      {toastMessage && <div style={toastStyle}>{toastMessage}</div>}

      {/* TEE Verification Overlay */}
      {teeVerification && (
        <div style={teeOverlayStyle}>
          <div style={teeHeaderStyle}>
            <div style={teePulseStyle} />
            <span style={teeTitleStyle}>{t("miniapp.tee.verified")}</span>
            <button onClick={() => setTeeVerification(null)} style={teeCloseStyle}>
              ×
            </button>
          </div>
          <div style={teeBodyStyle}>
            <div style={teeFieldStyle}>
              <span style={teeLabelStyle}>{t("miniapp.tee.method")}</span>
              <span style={teeValueStyle}>{teeVerification.method}</span>
            </div>
            <div style={teeFieldStyle}>
              <span style={teeLabelStyle}>{t("miniapp.tee.txHash")}</span>
              <span style={{ ...teeValueStyle, fontFamily: "monospace", fontSize: "11px" }}>
                {teeVerification.txHash}
              </span>
            </div>
            <div style={teeFieldStyle}>
              <span style={teeLabelStyle}>{t("miniapp.tee.attestation")}</span>
              <span style={{ ...teeValueStyle, color: "#00ff88", fontWeight: "bold" }}>
                {teeVerification.attestation}
              </span>
            </div>
          </div>
          <div style={teeFooterStyle}>{t("miniapp.tee.footer")}</div>
        </div>
      )}

      <LiveChat
        appId={app.app_id}
        walletAddress={wallet.address}
        userName={wallet.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : undefined}
      />
    </div>
  );

  return (
    <SplitViewLayout
      leftPanel={leftPanel}
      centerPanel={rightPanel}
      rightPanel={
        <RightSidebarPanel
          appId={app.app_id}
          appName={appName}
          network="testnet"
          permissions={app.permissions}
          contractInfo={{
            contractHash: app.contract_hash,
            masterKeyAddress: app.developer?.address,
          }}
        />
      }
      leftWidth={450}
      rightWidth={520}
    />
  );
}

function OverviewTab({ app, t }: { app: MiniAppInfo; t: (key: string) => string }) {
  return (
    <div style={overviewContainerStyle}>
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>{t("detail.permissions")}</h3>
        <div style={permissionsGridStyle}>
          {Object.entries(app.permissions).map(([key, value]) =>
            value ? (
              <div key={key} style={permissionItemStyle}>
                <span style={permissionIconStyle}>✓</span>
                <span style={permissionTextStyle}>{formatPermission(key)}</span>
              </div>
            ) : null,
          )}
        </div>
      </div>

      {app.limits && (
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>{t("detail.limits")}</h3>
          <ul style={limitListStyle}>
            {app.limits.max_gas_per_tx && (
              <li style={limitItemStyle}>
                {t("detail.maxGasPerTx")}: {app.limits.max_gas_per_tx}
              </li>
            )}
            {app.limits.daily_gas_cap_per_user && (
              <li style={limitItemStyle}>
                {t("detail.dailyGasCap")}: {app.limits.daily_gas_cap_per_user}
              </li>
            )}
            {app.limits.governance_cap && (
              <li style={limitItemStyle}>
                {t("detail.governanceCap")}: {app.limits.governance_cap}
              </li>
            )}
          </ul>
        </div>
      )}

      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>{t("detail.appInfo")}</h3>
        <p style={infoTextStyle}>
          {t("detail.appId")}: <code style={codeStyle}>{app.app_id}</code>
        </p>
        <p style={infoTextStyle}>
          {t("detail.entryUrl")}: <code style={codeStyle}>{app.entry_url}</code>
        </p>
      </div>
    </div>
  );
}

// Helper functions for iframe bridge
function resolveIframeOrigin(entryUrl: string): string | null {
  const trimmed = String(entryUrl || "").trim();
  if (!trimmed || trimmed.startsWith("mf://")) return null;
  try {
    return new URL(trimmed, window.location.origin).origin;
  } catch {
    return null;
  }
}

function hasPermission(method: string, permissions: MiniAppInfo["permissions"]): boolean {
  if (!permissions) return false;
  switch (method) {
    case "payments.payGAS":
      return Boolean(permissions.payments);
    case "governance.vote":
      return Boolean(permissions.governance);
    case "rng.requestRandom":
      return Boolean(permissions.randomness);
    case "datafeed.getPrice":
      return Boolean(permissions.datafeed);
    default:
      return true;
  }
}

function resolveScopedAppId(requested: unknown, appId: string): string {
  const trimmed = String(requested ?? "").trim();
  if (trimmed && trimmed !== appId) {
    throw new Error("app_id mismatch");
  }
  return appId;
}

function normalizeListParams(raw: unknown, appId: string): Record<string, unknown> {
  const base = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  return { ...base, app_id: resolveScopedAppId(base.app_id, appId) };
}

async function dispatchBridgeCall(
  sdk: MiniAppSDK,
  method: string,
  params: unknown[],
  permissions: MiniAppInfo["permissions"],
  appId: string,
  walletAddress?: string,
): Promise<unknown> {
  if (!hasPermission(method, permissions)) {
    throw new Error(`permission denied: ${method}`);
  }

  switch (method) {
    case "wallet.getAddress":
    case "getAddress": {
      if (walletAddress) return walletAddress;
      if (sdk.wallet?.getAddress) return sdk.wallet.getAddress();
      if (sdk.getAddress) return sdk.getAddress();
      throw new Error("wallet.getAddress not available");
    }
    case "wallet.invokeIntent": {
      if (!sdk.wallet?.invokeIntent) throw new Error("wallet.invokeIntent not available");
      const [requestId] = params;
      return sdk.wallet.invokeIntent(String(requestId ?? ""));
    }
    case "payments.payGAS": {
      if (!sdk.payments?.payGAS) throw new Error("payments.payGAS not available");
      const [requestedAppId, amount, memo] = params;
      const scopedAppId = resolveScopedAppId(requestedAppId, appId);
      const memoValue = memo === undefined || memo === null ? undefined : String(memo);
      return sdk.payments.payGAS(scopedAppId, String(amount ?? ""), memoValue);
    }
    case "governance.vote": {
      if (!sdk.governance?.vote) throw new Error("governance.vote not available");
      const [requestedAppId, proposalId, neoAmount, support] = params;
      const scopedAppId = resolveScopedAppId(requestedAppId, appId);
      const supportValue = typeof support === "boolean" ? support : undefined;
      return sdk.governance.vote(scopedAppId, String(proposalId ?? ""), String(neoAmount ?? ""), supportValue);
    }
    case "rng.requestRandom": {
      if (!sdk.rng?.requestRandom) throw new Error("rng.requestRandom not available");
      const [requestedAppId] = params;
      const scopedAppId = resolveScopedAppId(requestedAppId, appId);
      return sdk.rng.requestRandom(scopedAppId);
    }
    case "datafeed.getPrice": {
      if (!sdk.datafeed?.getPrice) throw new Error("datafeed.getPrice not available");
      const [symbol] = params;
      return sdk.datafeed.getPrice(String(symbol ?? ""));
    }
    case "stats.getMyUsage": {
      if (!sdk.stats?.getMyUsage) throw new Error("stats.getMyUsage not available");
      const [requestedAppId, date] = params;
      const resolvedAppId = resolveScopedAppId(requestedAppId, appId);
      const dateValue = date === undefined || date === null ? undefined : String(date);
      return sdk.stats.getMyUsage(resolvedAppId, dateValue);
    }
    case "events.list": {
      if (!sdk.events?.list) throw new Error("events.list not available");
      const [rawParams] = params;
      return sdk.events.list(normalizeListParams(rawParams, appId));
    }
    case "transactions.list": {
      if (!sdk.transactions?.list) throw new Error("transactions.list not available");
      const [rawParams] = params;
      return sdk.transactions.list(normalizeListParams(rawParams, appId));
    }
    default:
      throw new Error(`unsupported method: ${method}`);
  }
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

// Styles
const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: colors.bg,
  color: colors.text,
};

const leftPanelStyle: React.CSSProperties = {
  height: "100%",
  overflow: "auto",
  background: colors.bg,
};

const rightPanelContainerStyle: React.CSSProperties = {
  position: "relative",
  height: "100%",
  background: "transparent",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

// Wrapper for iframe - fills remaining space after LaunchDock
const iframeWrapperStyle: React.CSSProperties = {
  flex: 1,
  width: "100%",
  minHeight: 0,
  overflow: "hidden",
};

const errorContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  padding: 32,
};

const errorTitleStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: colors.text,
  marginBottom: 16,
};

const errorMessageStyle: React.CSSProperties = {
  fontSize: 16,
  color: colors.textMuted,
  marginBottom: 24,
};

const backButtonStyle: React.CSSProperties = {
  padding: "12px 24px",
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  background: "transparent",
  color: colors.text,
  fontSize: 14,
  cursor: "pointer",
};

const mainStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "32px 24px",
};

const heroStyle: React.CSSProperties = {
  marginBottom: 32,
};

const descriptionStyle: React.CSSProperties = {
  fontSize: 16,
  color: colors.textMuted,
  lineHeight: 1.6,
  margin: 0,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
  marginBottom: 32,
};

const activitySectionStyle: React.CSSProperties = {
  marginBottom: 24,
};

const tabsContainerStyle: React.CSSProperties = {
  marginBottom: 32,
};

const tabsHeaderStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  borderBottom: `1px solid ${colors.border}`,
  marginBottom: 24,
};

const tabButtonStyle: React.CSSProperties = {
  padding: "12px 24px",
  background: "transparent",
  border: "none",
  borderBottom: "2px solid transparent",
  color: colors.textMuted,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s",
};

const tabButtonActiveStyle: React.CSSProperties = {
  padding: "12px 24px",
  background: "transparent",
  border: "none",
  borderBottom: `2px solid ${colors.primary}`,
  color: colors.primary,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s",
};

const tabContentStyle: React.CSSProperties = {
  minHeight: 200,
};

const newsDisabledStyle: React.CSSProperties = {
  marginTop: 16,
  fontSize: 13,
  color: colors.textMuted,
};

const toastStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(0, 255, 136, 0.9)",
  color: "#000",
  padding: "12px 24px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
  zIndex: 9999,
};

const overviewContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 24,
};

const sectionStyle: React.CSSProperties = {
  background: colors.bgCard,
  borderRadius: 12,
  padding: 24,
  border: `1px solid ${colors.border}`,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: colors.text,
  marginTop: 0,
  marginBottom: 16,
};

const permissionsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 12,
};

const permissionItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const permissionIconStyle: React.CSSProperties = {
  color: colors.primary,
  fontSize: 16,
  fontWeight: 700,
};

const permissionTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: colors.text,
};

const limitListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
};

const limitItemStyle: React.CSSProperties = {
  fontSize: 14,
  color: colors.textMuted,
  padding: "8px 0",
  borderBottom: `1px solid ${colors.border}`,
};

const infoTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: colors.textMuted,
  margin: "8px 0",
};

const codeStyle: React.CSSProperties = {
  background: "rgba(0,212,170,0.1)",
  padding: "2px 6px",
  borderRadius: 4,
  fontSize: 13,
  fontFamily: "monospace",
  color: colors.primary,
};

const teeOverlayStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 24,
  right: 24,
  width: 340,
  background: "rgba(10, 15, 26, 0.95)",
  backdropFilter: "blur(12px)",
  borderRadius: 16,
  border: "1px solid rgba(0, 255, 136, 0.3)",
  boxShadow: "0 12px 40px rgba(0, 0, 0, 0.4)",
  color: "#fff",
  zIndex: 1000,
  overflow: "hidden",
};

const teeHeaderStyle: React.CSSProperties = {
  padding: "12px 16px",
  background: "rgba(0, 255, 136, 0.1)",
  borderBottom: "1px solid rgba(0, 255, 136, 0.2)",
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const teePulseStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#00ff88",
  boxShadow: "0 0 10px #00ff88",
};

const teeTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#00ff88",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  flex: 1,
};

const teeCloseStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 20,
  cursor: "pointer",
  opacity: 0.6,
  lineHeight: 1,
};

const teeBodyStyle: React.CSSProperties = {
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const teeFieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const teeLabelStyle: React.CSSProperties = {
  fontSize: 9,
  color: "rgba(255, 255, 255, 0.4)",
  textTransform: "uppercase",
  fontWeight: 600,
};

const teeValueStyle: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(255, 255, 255, 0.9)",
  wordBreak: "break-all",
};

const teeFooterStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 9,
  color: "rgba(255, 255, 255, 0.3)",
  borderTop: "1px solid rgba(255, 255, 255, 0.05)",
  textAlign: "center",
  background: "rgba(255, 255, 255, 0.02)",
};
