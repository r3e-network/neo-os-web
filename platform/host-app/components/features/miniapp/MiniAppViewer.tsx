"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MiniAppLogo } from "./MiniAppLogo";
import { Loader2, ShieldCheck, Zap, Lock } from "lucide-react";
import { MiniAppInfo } from "../../types";
import { FederatedMiniApp } from "../../FederatedMiniApp";
import { buildMiniAppEntryUrl, parseFederatedEntryUrl } from "../../../lib/miniapp";
import { installMiniAppSDK } from "../../../lib/miniapp-sdk";
import { injectMiniAppViewportStyles } from "../../../lib/miniapp-iframe";
import type { MiniAppSDK } from "../../../lib/miniapp-sdk";
import { useTheme } from "../../providers/ThemeProvider";
import { MiniAppFrame } from "./MiniAppFrame";

interface MiniAppViewerProps {
  app: MiniAppInfo;
  locale?: string;
}

interface WindowWithMiniAppSDK {
  MiniAppSDK?: MiniAppSDK;
}

/**
 * MiniAppLoader - Modern tech loading screen
 */
function MiniAppLoader({ app }: { app: MiniAppInfo }) {
  const [msgIndex, setMsgIndex] = React.useState(0);
  const loadingMessages = [
    "Initializing secure sandbox...",
    "Injecting verified SDK...",
    "Connecting to RPC nodes...",
    "Optimizing graphics performance...",
    "App container ready.",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((i) => (i < loadingMessages.length - 1 ? i + 1 : i));
    }, 800);
    return () => clearInterval(timer);
  }, [loadingMessages.length]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-950/80 backdrop-blur-md overflow-hidden"
    >
      {/* Tech Grid Background */}
      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* Main Glass Card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative z-10 flex flex-col items-center p-8 rounded-3xl bg-white/[0.03] border border-white/5 shadow-2xl max-w-sm w-full mx-4"
      >
        {/* Animated Orbs */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-neo/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-electric-purple/20 rounded-full blur-3xl animate-pulse-slow" />

        {/* Logo Container */}
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative mb-6"
        >
          <div className="absolute inset-0 bg-neo/40 rounded-2xl blur-xl animate-pulse" />
          <MiniAppLogo
            appId={app.app_id}
            category={app.category}
            size="lg"
            iconUrl={app.icon}
            className="relative scale-150 rotate-3 shadow-2xl"
          />
        </motion.div>

        {/* Text Details */}
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">{app.name}</h2>
        <div className="flex items-center space-x-2 text-white/40 text-sm mb-8 font-medium">
          <ShieldCheck size={14} className="text-neo" />
          <span>Verified Sandbox</span>
          <span className="w-1 h-1 bg-white/20 rounded-full" />
          <span>v1.0.0</span>
        </div>

        {/* Tech Progress Bar */}
        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-4 border border-white/5">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 4, ease: "linear" }}
            className="h-full bg-gradient-to-r from-neo to-electric-purple relative"
          >
            <div className="absolute top-0 right-0 h-full w-8 bg-white/40 blur-md translate-x-1" />
          </motion.div>
        </div>

        {/* Dynamic Status Messages */}
        <div className="flex items-center space-x-3 h-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={msgIndex}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center space-x-2 text-xs font-mono text-neo/80 uppercase tracking-widest"
            >
              {msgIndex === loadingMessages.length - 1 ? (
                <Zap size={12} className="text-neo animate-pulse" />
              ) : (
                <Loader2 size={12} className="animate-spin" />
              )}
              <span>{loadingMessages[msgIndex]}</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Security Tags */}
      <div className="absolute bottom-12 flex space-x-6 opacity-30 text-[10px] font-mono tracking-tighter uppercase">
        <div className="flex items-center space-x-1 text-white">
          <Lock size={10} />
          <span>Isolated Environment</span>
        </div>
        <div className="flex items-center space-x-1 text-white">
          <Zap size={10} />
          <span>Direct RPC Edge Access</span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * MiniAppViewer - Renders a MiniApp in an iframe or federated module
 * Handles SDK injection and message bridging for the embedded app
 */
export function MiniAppViewer({ app, locale = "en" }: MiniAppViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sdkRef = useRef<MiniAppSDK | null>(null);
  const federated = parseFederatedEntryUrl(app.entry_url, app.app_id);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const { theme } = useTheme();

  // Build iframe URL with language and theme parameters
  const iframeSrc = useMemo(() => {
    const supportedLocale = locale === "zh" ? "zh" : "en";
    return buildMiniAppEntryUrl(app.entry_url, { lang: supportedLocale, theme, embedded: "1" });
  }, [app.entry_url, locale, theme]);

  useEffect(() => {
    if (federated) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const origin = resolveIframeOrigin(app.entry_url);
    if (!origin) return;
    iframe.contentWindow.postMessage({ type: "theme-change", theme }, origin);
  }, [theme, app.entry_url, federated]);

  // Initialize SDK
  useEffect(() => {
    sdkRef.current = installMiniAppSDK({
      appId: app.app_id,
      permissions: app.permissions,
    });
  }, [app.app_id, app.permissions]);

  // Setup message bridge for iframe communication
  useEffect(() => {
    if (federated) {
      // For federated apps, we assume they load very fast or handle their own internal loading
      // But we still want a small delay for the beautiful animation
      const timer = setTimeout(() => setIsLoaded(true), 2500);
      return () => clearTimeout(timer);
    }
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
      if (data.type === "neo_miniapp_ready") {
        setIsLoaded(true);
        return;
      }
      if (data.type !== "neo_miniapp_sdk_request") return;

      const id = String(data.id ?? "").trim();
      if (!id) return;

      const method = String(data.method ?? "").trim();
      const params = Array.isArray(data.params) ? data.params : [];
      const source = event.source as Window | null;
      if (!source || typeof source.postMessage !== "function") return;

      const respond = (ok: boolean, result?: unknown, error?: string) => {
        source.postMessage({ type: "neo_miniapp_sdk_response", id, ok, result, error }, expectedOrigin);
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
      // fallback for apps that don't send "neo_miniapp_ready"
      setTimeout(() => setIsLoaded(true), 1500);

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
  }, [app.app_id, app.entry_url, app.permissions, federated]);

  return (
    <div className="w-full h-full min-h-0 min-w-0 overflow-hidden bg-black">
      <MiniAppFrame>
        <AnimatePresence>
          {!isLoaded && <MiniAppLoader app={app} />}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{
            opacity: isLoaded ? 1 : 0,
            scale: isLoaded ? 1 : 0.98,
          }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full"
        >
          {federated ? (
            <div className="w-full h-full overflow-y-auto overflow-x-hidden">
              <FederatedMiniApp appId={federated.appId} view={federated.view} remote={federated.remote} />
            </div>
          ) : (
            <iframe
              key={locale}
              src={iframeSrc}
              ref={iframeRef}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title={`${app.name} MiniApp`}
              allowFullScreen
            />
          )}
        </motion.div>
      </MiniAppFrame>
    </div>
  );
}

// Helper functions
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
): Promise<unknown> {
  if (!hasPermission(method, permissions)) {
    throw new Error(`permission denied: ${method}`);
  }

  switch (method) {
    case "wallet.getAddress":
    case "getAddress": {
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
