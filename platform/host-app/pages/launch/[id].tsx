import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { LaunchDock } from "../../components/LaunchDock";
import { FederatedMiniApp } from "../../components/FederatedMiniApp";
import { LiveChat } from "../../components/features/chat";
import { WalletState, MiniAppInfo } from "../../components/types";
import { installMiniAppSDK } from "../../lib/miniapp-sdk";
import { injectMiniAppViewportStyles } from "../../lib/miniapp-iframe";
import { dispatchBridgeCall, resolveIframeOrigin } from "../../lib/miniapp-sdk-bridge";
import type { MiniAppSDK } from "../../lib/miniapp-sdk";
import type { ChainId } from "../../lib/chains/types";
// Chain configuration comes from MiniApp manifest only - no environment defaults
import {
  buildMiniAppEntryUrl,
  coerceMiniAppInfo,
  getContractForChain,
  resolveChainIdForApp,
  getEntryUrlForChain,
  getAllSupportedChains,
  parseFederatedEntryUrl,
} from "../../lib/miniapp";
import { logger } from "../../lib/logger";
import { resolveInternalBaseUrl } from "../../lib/edge";
import { BUILTIN_APPS } from "../../lib/builtin-apps";
import { useI18n } from "../../lib/i18n/react";
import { useTheme } from "../../components/providers/ThemeProvider";
import { MiniAppFrame } from "../../components/features/miniapp";
import { MiniAppTransition } from "../../components/ui";
import { useWalletStore } from "../../lib/wallet/store";
import { getChainRegistry } from "../../lib/chains/registry";

/** Window with MiniAppSDK for iframe injection */
interface WindowWithMiniAppSDK {
  MiniAppSDK?: MiniAppSDK;
}

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

// Use centralized app catalog from builtin-apps.ts
const MINIAPP_CATALOG: MiniAppInfo[] = BUILTIN_APPS;

type LaunchPageProps = {
  app: MiniAppInfo;
};

export default function LaunchPage({ app }: LaunchPageProps) {
  const router = useRouter();
  const { locale } = useI18n();
  const { theme } = useTheme();
  const { address, connected, provider, chainId: storeChainId, setChainId } = useWalletStore();
  const requestedChainId = useMemo(() => {
    const raw = router.query.chain ?? router.query.chainId;
    if (Array.isArray(raw)) return (raw[0] || "") as ChainId;
    if (typeof raw === "string" && raw.trim()) return raw as ChainId;
    return null;
  }, [router.query.chain, router.query.chainId]);
  const supportedChainIds = useMemo(() => getAllSupportedChains(app), [app]);
  const effectiveChainId = useMemo(
    () => resolveChainIdForApp(app, requestedChainId || storeChainId),
    [app, requestedChainId, storeChainId],
  );
  const contractAddress = useMemo(() => getContractForChain(app, effectiveChainId), [app, effectiveChainId]);
  const chainType = useMemo(() => {
    if (!effectiveChainId) return undefined;
    return getChainRegistry().getChain(effectiveChainId)?.type;
  }, [effectiveChainId]);
  const entryUrl = useMemo(() => getEntryUrlForChain(app, effectiveChainId), [app, effectiveChainId]);
  const wallet: WalletState = {
    connected,
    address,
    provider: provider as WalletState["provider"],
    chainId: effectiveChainId,
  };
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const federated = parseFederatedEntryUrl(entryUrl, app.app_id);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sdkRef = useRef<MiniAppSDK | null>(null);

  // Build iframe URL with language and theme parameters
  const iframeSrc = useMemo(() => {
    const supportedLocale = locale === "zh" ? "zh" : "en";
    return buildMiniAppEntryUrl(entryUrl, { lang: supportedLocale, theme, embedded: "1" });
  }, [entryUrl, locale, theme]);

  useEffect(() => {
    if (federated) {
      setIsIframeLoading(false);
    }
  }, [federated]);

  useEffect(() => {
    sdkRef.current = installMiniAppSDK({
      appId: app.app_id,
      chainId: effectiveChainId,
      chainType,
      contractAddress,
      permissions: app.permissions,
      supportedChains: app.supportedChains,
      chainContracts: app.chainContracts,
    });
  }, [app, effectiveChainId, contractAddress, chainType]);

  useEffect(() => {
    if (!effectiveChainId) return;
    if (storeChainId === effectiveChainId) return;
    if (!connected || provider === "auth0") {
      setChainId(effectiveChainId);
    }
  }, [effectiveChainId, storeChainId, connected, provider, setChainId]);

  // Network latency monitoring
  useEffect(() => {
    const measureLatency = async () => {
      try {
        const start = performance.now();
        // Ping a lightweight endpoint (using /api/health or Supabase REST endpoint)
        await fetch("/api/health", { method: "HEAD" });
        const end = performance.now();
        setNetworkLatency(Math.round(end - start));
      } catch (e) {
        setNetworkLatency(null); // Network error
      }
    };

    // Measure immediately on mount
    measureLatency();

    // Then measure every 5 seconds
    const interval = setInterval(measureLatency, 5000);

    return () => clearInterval(interval);
  }, []);

  // Wallet state is managed by useWalletStore - no auto-connect needed here

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleExit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Sync theme changes to iframe via postMessage
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const origin = resolveIframeOrigin(entryUrl);
    if (!origin) return;
    const sandboxAttr = iframe.getAttribute("sandbox") || "";
    const sandboxAllowsSameOrigin = sandboxAttr.split(/\s+/).includes("allow-same-origin");
    const targetOrigin = sandboxAttr && !sandboxAllowsSameOrigin ? "*" : origin;
    iframe.contentWindow.postMessage({ type: "theme-change", theme }, targetOrigin);
  }, [theme, entryUrl]);

  useEffect(() => {
    if (federated) return;
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
          chainId: effectiveChainId,
          chainType,
          contractAddress,
          permissions: app.permissions,
          supportedChains: app.supportedChains,
          chainContracts: app.chainContracts,
        });
      }
      return sdkRef.current;
    };

    const sendConfig = (target: Window | null, responseOrigin: string) => {
      if (!target) return;
      const sdk = ensureSDK();
      if (!sdk?.getConfig) return;
      target.postMessage({ type: "miniapp_config", config: sdk.getConfig() }, responseOrigin);
    };

    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      if (event.origin !== expectedOrigin && !(allowNullOrigin && event.origin === "null")) return;

      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object") return;
      if (data.type === "miniapp_ready") {
        const responseOrigin = event.origin === "null" ? "*" : expectedOrigin;
        sendConfig(event.source as Window | null, responseOrigin);
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
        const sdk = ensureSDK();
        if (!sdk) throw new Error("MiniAppSDK unavailable");
        const result = await dispatchBridgeCall(sdk, method, params, app.permissions, app.app_id);
        respond(true, result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "request failed";
        respond(false, undefined, message);
      }
    };

    const handleLoad = () => {
      const responseOrigin = allowNullOrigin ? "*" : expectedOrigin;
      sendConfig(iframe.contentWindow, responseOrigin);

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
        // Ignore cross-origin access failures.
      }
    };

    window.addEventListener("message", handleMessage);
    iframe.addEventListener("load", handleLoad);
    handleLoad();

    return () => {
      window.removeEventListener("message", handleMessage);
      iframe.removeEventListener("load", handleLoad);
    };
  }, [app.app_id, iframeSrc, app.permissions, federated, entryUrl, effectiveChainId, chainType]);

  const handleExit = useCallback(() => {
    // Return to app detail page
    router.push(`/miniapps/${app.app_id}`);
  }, [router, app.app_id]);

  const handleBack = useCallback(() => {
    // Use browser history to go back
    router.back();
  }, [router]);

  const handleShare = useCallback(() => {
    const chainQuery = effectiveChainId ? `?chain=${encodeURIComponent(effectiveChainId)}` : "";
    const url = `${window.location.origin}/launch/${app.app_id}${chainQuery}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setToastMessage("Link copied!");
        setTimeout(() => setToastMessage(null), 2000);
        logger.debug("Link copied:", url);
      })
      .catch((e) => {
        logger.error("Failed to copy link", e);
      });
  }, [app.app_id]);

  return (
    <div style={{ ...containerStyle, background: theme === "dark" ? "#05060d" : "var(--erobo-body-bg)" }}>
      <LaunchDock
        appName={app.name}
        appId={app.app_id}
        wallet={wallet}
        supportedChainIds={supportedChainIds}
        networkLatency={networkLatency}
        onBack={handleBack}
        onExit={handleExit}
        onShare={handleShare}
      />
      <div style={frameWrapperStyle}>
        <MiniAppTransition>
          <MiniAppFrame>
            {federated ? (
              <div className="w-full h-full overflow-y-auto overflow-x-hidden">
                <FederatedMiniApp appId={federated.appId} view={federated.view} remote={federated.remote} />
              </div>
            ) : (
              <>
                {isIframeLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-white via-[#f5f6ff] to-[#ffece4] dark:from-[#05060d] dark:via-[#090a14] dark:to-[#050a0d] z-10 overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] bg-[radial-gradient(ellipse_at_center,rgba(159,157,243,0.15)_0%,transparent_55%)] animate-[water-wave_12s_ease-in-out_infinite]" />
                      <div className="absolute w-[250%] h-[250%] top-[-75%] left-[-75%] bg-[radial-gradient(ellipse_at_center,rgba(247,170,199,0.12)_0%,transparent_60%)] animate-[water-wave-reverse_15s_ease-in-out_infinite]" />
                    </div>
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="absolute rounded-full border-2 border-erobo-purple/30 animate-[concentric-ripple_2s_ease-out_infinite]"
                        style={{
                          animationDelay: `${i * 0.4}s`,
                          width: 120 + i * 90,
                          height: 120 + i * 90,
                        }}
                      />
                    ))}
                    <div className="relative z-10 flex flex-col items-center p-8 rounded-[24px] bg-white/85 dark:bg-white/[0.06] backdrop-blur-[50px] border border-white/60 dark:border-erobo-purple/20 shadow-[0_0_30px_rgba(159,157,243,0.15)]">
                      <div className="w-16 h-16 rounded-full border-4 border-erobo-purple/30 border-t-erobo-purple animate-spin mb-4 shadow-[0_0_20px_rgba(159,157,243,0.4)]" />
                      <div className="text-xl font-bold text-erobo-ink dark:text-white tracking-tight">
                        Launching MiniApp
                      </div>
                      <div className="text-sm font-medium text-erobo-ink-soft/70 dark:text-white/60 mt-1">
                        {app.name}
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
                  sandbox="allow-scripts allow-forms allow-popups"
                  title={`${app.name} MiniApp`}
                  allowFullScreen
                  referrerPolicy="no-referrer"
                />
              </>
            )}
          </MiniAppFrame>
        </MiniAppTransition>
      </div>
      {toastMessage && <div style={toastStyle}>{toastMessage}</div>}

      {/* LiveChat for MiniApp */}
      <LiveChat
        appId={app.app_id}
        walletAddress={wallet.address}
        userName={wallet.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : undefined}
      />
    </div>
  );
}

// SSR: Fetch app info from API or static catalog
export const getServerSideProps: GetServerSideProps<LaunchPageProps> = async (context) => {
  const { id } = context.params as { id: string };
  const fallback = MINIAPP_CATALOG.find((app) => app.app_id === id);
  const baseUrl = resolveInternalBaseUrl(context.req as RequestLike | undefined);

  try {
    const res = await fetch(`${baseUrl}/api/miniapp-stats?app_id=${encodeURIComponent(id)}`);
    const payload = await res.json();
    const statsList = Array.isArray(payload?.stats)
      ? payload.stats
      : Array.isArray(payload)
        ? payload
        : payload
          ? [payload]
          : [];
    const raw = statsList.find((item: Record<string, unknown>) => item?.app_id === id) ?? statsList[0];
    const app = coerceMiniAppInfo(raw, fallback) ?? fallback ?? null;
    if (!app) {
      return { notFound: true };
    }

    return {
      props: { app },
    };
  } catch (error) {
    logger.error("Failed to load launch app info:", error);
    if (!fallback) {
      return { notFound: true };
    }
    return {
      props: { app: fallback },
    };
  }
};

// Styles
const LAUNCH_DOCK_HEIGHT = 56;

const containerStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  overflow: "hidden",
};

const frameWrapperStyle: React.CSSProperties = {
  position: "absolute",
  top: LAUNCH_DOCK_HEIGHT,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: "hidden",
};

const toastStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(159, 157, 243, 0.9)",
  color: "#1b1b2f",
  padding: "12px 24px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
  zIndex: 9999,
};
