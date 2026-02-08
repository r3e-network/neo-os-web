import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import type { MiniAppInfo, MiniAppStats, MiniAppNotification, WalletState } from "../../components";
import { AppDetailHeader, AppNewsList } from "../../components";
import { useTheme } from "../../components/providers/ThemeProvider";
import { ActivityTicker } from "../../components/ActivityTicker";
import { AppSecretsTab } from "../../components/features/secrets/AppSecretsTab";
import { ReviewsTab } from "../../components/features/reviews";
import { ForumTab } from "../../components/features/forum";
import { TwoPanelLayout } from "../../components/layout/TwoPanelLayout";
import { CompactHeader } from "../../components/CompactHeader";
import { OperationsPanel } from "../../components/features/operations";
import { FederatedMiniApp } from "../../components/FederatedMiniApp";
import { LiveChat } from "../../components/features/chat";
import { ScreenshotGallery, VersionHistory, PermissionsCard } from "../../components/features/miniapp";
import { SimilarApps } from "../../components/features/discovery/SimilarApps";
import { TagCloud } from "../../components/features/tags";
import { MiniAppTransition } from "../../components/ui";
import { ShareModal } from "../../components/features/share";
import { useActivityFeed } from "../../hooks/useActivityFeed";
import { useMiniAppLayout } from "../../hooks/useMiniAppLayout";
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
import { useTranslation, useI18n } from "../../lib/i18n/react";
import { installMiniAppSDK } from "../../lib/miniapp-sdk";
import { injectMiniAppViewportStyles } from "../../lib/miniapp-iframe";
import { dispatchBridgeCall, resolveIframeOrigin } from "../../lib/miniapp-sdk-bridge";
import type { MiniAppSDK } from "../../lib/miniapp-sdk";
import type { ChainId } from "../../lib/chains/types";
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

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

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
  const layout = useMiniAppLayout(router.query.layout);

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
    if (!connected) {
      setChainId(walletChainId);
    }
  }, [app, walletChainId, storeChainId, connected, setChainId]);

  // Ref for accessing wallet in callbacks
  const walletRef = useRef(wallet);
  useEffect(() => {
    walletRef.current = wallet;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, address, provider]);

  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const showNews = app?.news_integration !== false;
  const showSecrets = app?.permissions?.confidential === true;
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

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
    return buildMiniAppEntryUrl(entryUrl, { lang: supportedLocale, theme, embedded: "1", layout });
  }, [entryUrl, locale, theme, app, layout]);

  useEffect(() => {
    if (!app || federated) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const origin = resolveIframeOrigin(entryUrl);
    if (!origin) return;
    const sandboxAttr = iframe.getAttribute("sandbox") || "";
    const sandboxAllowsSameOrigin = sandboxAttr.split(/\s+/).includes("allow-same-origin");
    const responseOrigin = sandboxAttr && !sandboxAllowsSameOrigin ? "*" : origin;
    iframe.contentWindow.postMessage({ type: "theme-change", theme }, responseOrigin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, entryUrl, federated]);

  useEffect(() => {
    if (!app || federated) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const origin = resolveIframeOrigin(entryUrl);
    if (!origin) return;
    const sandboxAttr = iframe.getAttribute("sandbox") || "";
    const sandboxAllowsSameOrigin = sandboxAttr.split(/\s+/).includes("allow-same-origin");
    const responseOrigin = sandboxAttr && !sandboxAllowsSameOrigin ? "*" : origin;
    const supportedLocale = getMiniappLocale(locale);
    iframe.contentWindow.postMessage({ type: "language-change", language: supportedLocale }, responseOrigin);
  }, [locale, entryUrl, federated, app]);

  useEffect(() => {
    if (!app || federated) return;

    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const origin = resolveIframeOrigin(entryUrl);
    if (!origin) return;

    const sandboxAttr = iframe.getAttribute("sandbox") || "";
    const sandboxAllowsSameOrigin = sandboxAttr.split(/\s+/).includes("allow-same-origin");
    const targetOrigin = sandboxAttr && !sandboxAllowsSameOrigin ? "*" : origin;

    const sendWalletState = () => {
      const state = useWalletStore.getState();
      iframe.contentWindow?.postMessage(
        {
          type: "miniapp_wallet_state_change",
          connected: state.connected,
          address: state.connected ? state.address : null,
          chainId: state.chainId,
          chainType: state.chainType,
          balance: state.balance
            ? {
                native: state.balance.native || "0",
                nativeSymbol: state.balance.nativeSymbol,
                governance: state.balance.governance,
                governanceSymbol: state.balance.governanceSymbol,
              }
            : null,
        },
        targetOrigin,
      );
    };

    const unsubscribe = useWalletStore.subscribe(sendWalletState);
    sendWalletState();
    const delayedSend = window.setTimeout(sendWalletState, 500);

    return () => {
      unsubscribe();
      window.clearTimeout(delayedSend);
    };
  }, [entryUrl, federated, app?.app_id]);

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
      layout,
    });
  }, [app, walletChainId, contractAddress, chainType, layout]);

  // Iframe bridge for SDK communication
  useEffect(() => {
    if (!app || federated) return;
    if (typeof window === "undefined") return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    const expectedOrigin = resolveIframeOrigin(entryUrl);
    if (!expectedOrigin) return;

    const sandboxAttr = iframe.getAttribute("sandbox") || "";
    const sandboxAllowsSameOrigin = sandboxAttr.split(/\s+/).includes("allow-same-origin");
    const allowNullOrigin = sandboxAttr.length > 0 && !sandboxAllowsSameOrigin;
    const allowSameOriginInjection = sandboxAllowsSameOrigin && expectedOrigin === window.location.origin;

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
          layout,
        });
      }
      return sdkRef.current;
    };

    const sendConfig = (targetOrigin?: string) => {
      const sdk = ensureSDK();
      if (!sdk?.getConfig) return;
      if (!iframe.contentWindow) return;
      const responseOrigin = targetOrigin ?? (allowNullOrigin ? "*" : expectedOrigin);
      iframe.contentWindow.postMessage({ type: "miniapp_config", config: sdk.getConfig() }, responseOrigin);
    };

    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      if (event.origin !== expectedOrigin && !(allowNullOrigin && event.origin === "null")) return;

      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object") return;
      if (data.type === "miniapp_ready") {
        const responseOrigin = event.origin === "null" ? "*" : expectedOrigin;
        sendConfig(responseOrigin);
        // Dismiss the loading overlay when MiniApp signals it's ready
        setIsIframeLoading(false);
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
        const responseOrigin = event.origin === "null" ? "*" : expectedOrigin;
        source.postMessage(
          {
            type: "miniapp_sdk_response",
            id,
            ok,
            result,
            error,
          },
          responseOrigin,
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
          const res = result as Record<string, unknown>;
          if (res.attestation || res.txHash || res.txid) {
            setTeeVerification({
              txHash: String(res.txHash || res.txid || "N/A"),
              attestation: String(res.attestation || "Hardware Attested"),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.app_id, iframeSrc, app?.permissions, federated, entryUrl, chainType]);

  // Safety timeout: dismiss loading overlay after 10 seconds even if signals fail
  // This handles cases where CSP violations or network issues prevent normal load signals
  useEffect(() => {
    if (!app || federated || !isIframeLoading) return;
    const timer = setTimeout(() => {
      setIsIframeLoading(false);
    }, 10000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.app_id, federated, isIframeLoading]);

  // Listen for share requests from SDK
  useEffect(() => {
    if (!app) return;
    const handleShareRequest = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.appId === app.app_id) {
        setIsShareModalOpen(true);
      }
    };
    window.addEventListener("miniapp-share-request", handleShareRequest);
    return () => window.removeEventListener("miniapp-share-request", handleShareRequest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.app_id]);

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
      } catch {
        setNetworkLatency(null);
      }
    };
    measureLatency();
    const interval = setInterval(measureLatency, 5000);
    return () => clearInterval(interval);
  }, [connected, address, walletChainId]);

  // Wallet connection is handled globally by useWalletStore

  // Move hooks before early return to comply with React hooks rules
  const shareUrl = useMemo(() => {
    if (!app) return "";
    const chainQuery = walletChainId ? `?chain=${encodeURIComponent(walletChainId)}` : "";
    return `${typeof window !== "undefined" ? window.location.origin : ""}/miniapps/${app.app_id}${chainQuery}`;
  }, [app, walletChainId]);

  const handleShare = useCallback(() => {
    setIsShareModalOpen(true);
  }, []);

  const handleBack = useCallback(() => {
    router.push("/miniapps");
  }, [router]);

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

  // Use walletChainId which is already computed from app manifest and wallet state
  const effectiveChainId = walletChainId;

  const mainContent = (
    <div className="bg-background">
      {/* ── MiniApp Content (top of left column) ── */}
      <div className="relative" style={{ minHeight: federated ? undefined : 600 }}>
        <MiniAppTransition>
          {federated ? (
            <FederatedMiniApp appId={federated.appId} view={federated.view} remote={federated.remote} layout={layout} />
          ) : (
            <>
              {isIframeLoading && (
                <div
                  role="status"
                  aria-label={`${t("detail.launching")} ${appName}`}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-white via-[#f5f6ff] to-[#e6fbf3] dark:from-[#05060d] dark:via-[#090a14] dark:to-[#050a0d] z-10 overflow-hidden"
                >
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] bg-[radial-gradient(ellipse_at_center,rgba(159,157,243,0.15)_0%,transparent_50%)] animate-[water-wave_12s_ease-in-out_infinite]" />
                    <div className="absolute w-[250%] h-[250%] top-[-75%] left-[-75%] bg-[radial-gradient(ellipse_at_center,rgba(247,170,199,0.1)_0%,transparent_60%)] animate-[water-wave-reverse_15s_ease-in-out_infinite]" />
                  </div>
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="absolute rounded-full border-2 border-erobo-purple/30 animate-[concentric-ripple_2s_ease-out_infinite]"
                      style={{ animationDelay: `${i * 0.4}s`, width: 100 + i * 80, height: 100 + i * 80 }}
                    />
                  ))}
                  <div className="relative z-10 flex flex-col items-center p-8 rounded-[24px] bg-white/85 dark:bg-white/[0.06] backdrop-blur-[50px] border border-white/60 dark:border-erobo-purple/20 shadow-[0_0_30px_rgba(159,157,243,0.15)]">
                    <div className="w-16 h-16 rounded-full border-4 border-erobo-purple/30 border-t-erobo-purple animate-spin mb-4 shadow-[0_0_20px_rgba(159,157,243,0.4)]" />
                    <div className="text-xl font-bold text-erobo-ink dark:text-white tracking-tight">
                      {t("detail.launching")}
                    </div>
                    <div className="text-sm font-medium text-erobo-ink-soft/70 dark:text-white/60 mt-1">{appName}</div>
                  </div>
                </div>
              )}
              <iframe
                key={locale}
                src={iframeSrc}
                ref={iframeRef}
                onLoad={() => setIsIframeLoading(false)}
                className={`w-full border-0 bg-white dark:bg-[#0a0f1a] transition-opacity duration-500 ${
                  isIframeLoading ? "opacity-0" : "opacity-100"
                }`}
                style={{ minHeight: 600 }}
                sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                title={`${appName} MiniApp`}
                allowFullScreen
              />
            </>
          )}
        </MiniAppTransition>

        {/* Overlays scoped to miniapp section */}
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
        <CelebrationEffects
          type={celebrationType}
          active={celebrationActive}
          intensity={celebrationIntensity}
          duration={celebrationDuration}
        />
        {rippleActive && (
          <div className="absolute inset-0 pointer-events-none z-[1001]">
            <WaterRippleEffect active={rippleActive} intensity={25} duration={1200}>
              <div className="w-full h-full" />
            </WaterRippleEffect>
          </div>
        )}
      </div>
      {/* ── App Info Below MiniApp ── */}
      <AppDetailHeader app={app} stats={stats || undefined} description={appDesc} />

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <section className="mb-8">
          <TagCloud appId={app.app_id} onTagClick={(tagId) => router.push(`/miniapps?tag=${tagId}`)} className="mt-4" />
        </section>

        {/* Inline LiveChat */}
        <section className="mb-6">
          <LiveChat
            appId={app.app_id}
            walletAddress={wallet.address}
            userName={wallet.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : undefined}
            mode="inline"
          />
        </section>

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
          <div className="flex gap-2 border-b border-border mb-6" role="tablist" aria-label="App sections">
            <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
              {t("detail.overview")}
            </TabButton>
            <TabButton active={activeTab === "reviews"} onClick={() => setActiveTab("reviews")}>
              ⭐ {t("detail.reviews")}
            </TabButton>
            <TabButton active={activeTab === "forum"} onClick={() => setActiveTab("forum")}>
              💬 {t("detail.forum")}
            </TabButton>
            {showNews && (
              <TabButton active={activeTab === "news"} onClick={() => setActiveTab("news")}>
                {t("detail.news")} ({notifications.length})
              </TabButton>
            )}
            {showSecrets && (
              <TabButton active={activeTab === "secrets"} onClick={() => setActiveTab("secrets")}>
                🔐 {t("detail.secrets")}
              </TabButton>
            )}
          </div>

          <div className="min-h-[200px]" role="tabpanel" aria-label={activeTab}>
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

        <SimilarApps currentAppId={app.app_id} category={app.category} maxItems={4} />
      </main>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        url={shareUrl}
        title={appName}
        description={appDesc}
        iconUrl={app.icon}
        locale={locale}
      />
    </div>
  );

  return (
    <TwoPanelLayout
      header={
        <CompactHeader
          appName={appName}
          appId={app.app_id}
          wallet={wallet}
          supportedChainIds={supportedChainIds}
          networkLatency={networkLatency}
          onBack={handleBack}
          onExit={handleBack}
          onShare={handleShare}
        />
      }
      mainContent={mainContent}
      sidePanel={
        <OperationsPanel
          appId={app.app_id}
          appName={appName}
          chainId={effectiveChainId}
          permissions={app.permissions}
          contractInfo={{
            contractAddress: getContractForChain(app, effectiveChainId),
            masterKeyAddress: app.developer?.address,
          }}
          supportedChainIds={supportedChainIds}
          networkLatency={networkLatency}
          activities={appActivities}
        />
      }
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
      {/* Screenshots Gallery */}
      {app.screenshots && app.screenshots.length > 0 && (
        <ScreenshotGallery screenshots={app.screenshots} appName={app.name} className="mb-2" />
      )}

      {/* Permissions Card - Enhanced */}
      <PermissionsCard permissions={app.permissions} />

      {/* Version History */}
      {app.versions && app.versions.length > 0 && (
        <VersionHistory versions={app.versions} currentVersion={app.currentVersion} maxVisible={3} />
      )}

      {app.limits && (
        <div className="bg-white dark:bg-[#1a1b26] rounded-xl p-6 border border-border">
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

      <div className="bg-white dark:bg-[#1a1b26] rounded-xl p-6 border border-border">
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
        {app.currentVersion && (
          <p className="text-sm text-muted-foreground my-2">
            {t("detail.version") || "Version"}:{" "}
            <code className="bg-neo/10 px-1.5 py-0.5 rounded text-xs font-mono text-neo">v{app.currentVersion}</code>
          </p>
        )}
        {app.developer && (
          <p className="text-sm text-muted-foreground my-2">
            {t("detail.developer") || "Developer"}:{" "}
            <span className="font-medium text-foreground">{app.developer.name}</span>
            {app.developer.verified && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-neo/10 text-neo">✓ Verified</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
      }`}
    >
      {children}
    </button>
  );
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
    let app = rawStats ? coerceMiniAppInfo(rawStats, fallback) : (fallback ?? null);
    if (!app) {
      const { fetchCommunityAppById } = await import("../../lib/community-apps");
      app = await fetchCommunityAppById(id);
    }

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
