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
import { useWalletStore } from "../../../lib/wallet/store";
import { MiniAppFrame } from "./MiniAppFrame";

interface MiniAppViewerProps {
  app: MiniAppInfo;
  locale?: string;
}

interface WindowWithMiniAppSDK {
  MiniAppSDK?: MiniAppSDK;
}

/**
 * MiniAppLoader - Neo Brutalist styling
 */
function MiniAppLoader({ app }: { app: MiniAppInfo }) {
  const [msgIndex, setMsgIndex] = React.useState(0);
  const loadingMessages = [
    "INITIALIZING SANDBOX",
    "VERIFYING SDK INTEGRITY",
    "CONNECTING RPC NODES",
    "OPTIMIZING GRAPHICS",
    "CONTAINER READY",
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
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-brutal-yellow dark:bg-[#050505] overflow-hidden"
    >
      {/* Brutalist Pattern Background */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,#000_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] bg-[size:16px_16px]" />

      {/* Main Card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative z-10 flex flex-col items-center p-8 bg-white dark:bg-[#111] border-4 border-black dark:border-white shadow-[8px_8px_0_#000] dark:shadow-[8px_8px_0_#fff] max-w-sm w-full mx-4"
      >
        {/* Decorative Corner Squares */}
        <div className="absolute top-2 left-2 w-3 h-3 bg-black dark:bg-white" />
        <div className="absolute top-2 right-2 w-3 h-3 bg-black dark:bg-white" />
        <div className="absolute bottom-2 left-2 w-3 h-3 bg-black dark:bg-white" />
        <div className="absolute bottom-2 right-2 w-3 h-3 bg-black dark:bg-white" />

        {/* Logo Container */}
        <motion.div
          animate={{
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatDelay: 2,
            ease: "easeInOut",
          }}
          className="relative mb-8 mt-2"
        >
          <div className="absolute inset-0 bg-black dark:bg-white translate-x-1 translate-y-1" />
          <MiniAppLogo
            appId={app.app_id}
            category={app.category}
            size="lg"
            iconUrl={app.icon}
            className="relative border-2 border-black dark:border-white z-10"
          />
        </motion.div>

        {/* Text Details */}
        <h2 className="text-3xl font-black text-black dark:text-white mb-1 tracking-tighter uppercase italic text-center leading-none">
          {app.name}
        </h2>

        <div className="flex items-center gap-2 text-black text-xs font-bold uppercase mb-8 border-2 border-black dark:border-white px-3 py-1 bg-neo shadow-[2px_2px_0_#000] dark:shadow-[2px_2px_0_#fff]">
          <ShieldCheck size={14} className="text-black" strokeWidth={3} />
          <span>Verified Sandbox v1.0</span>
        </div>

        {/* Hard Progress Bar */}
        <div className="w-full h-4 border-2 border-black dark:border-white bg-white dark:bg-black mb-4 p-0.5 shadow-[2px_2px_0_#000] dark:shadow-[2px_2px_0_#fff]">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 4, ease: "linear" }}
            className="h-full bg-black dark:bg-white"
          />
        </div>

        {/* Dynamic Status Messages */}
        <div className="h-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={msgIndex}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center gap-2 text-xs font-black text-black dark:text-white uppercase tracking-wider"
            >
              {msgIndex === loadingMessages.length - 1 ? (
                <Zap size={14} className="text-black dark:text-white fill-yellow-400" strokeWidth={2} />
              ) : (
                <Loader2 size={14} className="animate-spin text-black dark:text-white" strokeWidth={3} />
              )}
              <span>{loadingMessages[msgIndex]}</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Footer Tags */}
      <div className="absolute bottom-12 flex gap-8">
        <div className="flex items-center gap-2 bg-white dark:bg-black border-2 border-black dark:border-white px-3 py-1 shadow-[4px_4px_0_#000] dark:shadow-[4px_4px_0_#fff] rotate-[-2deg]">
          <Lock size={12} strokeWidth={3} className="text-black dark:text-white" />
          <span className="text-[10px] font-black uppercase text-black dark:text-white">Isolated Env</span>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-black border-2 border-black dark:border-white px-3 py-1 shadow-[4px_4px_0_#000] dark:shadow-[4px_4px_0_#fff] rotate-[2deg]">
          <Zap size={12} strokeWidth={3} className="text-black dark:text-white" />
          <span className="text-[10px] font-black uppercase text-black dark:text-white">Direct RPC</span>
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

  // Sync wallet state to iframe when it changes
  useEffect(() => {
    if (federated) return;
    // CRITICAL: Only sync after iframe is loaded and ready
    if (!isLoaded) return;

    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const origin = resolveIframeOrigin(app.entry_url);
    if (!origin) return;

    // Helper to send wallet state
    const sendWalletState = (state: {
      connected: boolean;
      address: string | null;
      balance: { neo: string; gas: string } | null;
    }) => {
      iframe.contentWindow?.postMessage(
        {
          type: "neo_wallet_state_change",
          connected: state.connected,
          address: state.address,
          balance: state.balance,
        },
        origin,
      );
    };

    // Subscribe to wallet store changes
    const unsubscribe = useWalletStore.subscribe(sendWalletState);

    // Send initial wallet state immediately when iframe is ready
    const currentState = useWalletStore.getState();
    sendWalletState(currentState);

    // Also send after a short delay to ensure MiniApp listener is ready
    const delayedSend = setTimeout(() => {
      const state = useWalletStore.getState();
      sendWalletState(state);
    }, 500);

    return () => {
      unsubscribe();
      clearTimeout(delayedSend);
    };
  }, [app.entry_url, federated, isLoaded]);

  // Initialize SDK
  useEffect(() => {
    const sdk = installMiniAppSDK({
      appId: app.app_id,
      contractHash: app.contract_hash ?? null,
      permissions: app.permissions,
    });

    if (sdk && sdk.wallet) {
      // Patch SDK for Federated Apps sharing the window
      const baseGetAddress = sdk.wallet.getAddress;
      sdk.wallet.getAddress = async () => {
        const { connected, address } = useWalletStore.getState();
        if (connected && address) return address;
        if (baseGetAddress) return baseGetAddress();
        throw new Error("Wallet not connected");
      };

      const baseGetAddressRoot = sdk.getAddress;
      if (baseGetAddressRoot) {
        sdk.getAddress = async () => {
          const { connected, address } = useWalletStore.getState();
          if (connected && address) return address;
          return baseGetAddressRoot();
        };
      }
    }

    sdkRef.current = sdk;
  }, [app.app_id, app.contract_hash, app.permissions]);

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
        <AnimatePresence>{!isLoaded && <MiniAppLoader app={app} />}</AnimatePresence>

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
              <FederatedMiniApp appId={federated.appId} view={federated.view} remote={federated.remote} theme={theme} />
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

  const wallet = useWalletStore.getState();

  switch (method) {
    case "wallet.getAddress":
    case "getAddress": {
      if (wallet.connected && wallet.address) return wallet.address;
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
