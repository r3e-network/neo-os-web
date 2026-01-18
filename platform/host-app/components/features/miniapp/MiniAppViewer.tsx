"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MiniAppLogo } from "./MiniAppLogo";
import { Loader2, ShieldCheck, Zap, Lock } from "lucide-react";
import { MiniAppInfo } from "../../types";
import { FederatedMiniApp } from "../../FederatedMiniApp";
import {
  buildMiniAppEntryUrl,
  parseFederatedEntryUrl,
  getContractForChain,
  resolveChainIdForApp,
  getEntryUrlForChain,
} from "@/lib/miniapp";
import { installMiniAppSDK } from "@/lib/miniapp-sdk";
import { injectMiniAppViewportStyles } from "@/lib/miniapp-iframe";
import type { MiniAppSDK } from "@/lib/miniapp-sdk";
import type { ChainId } from "@/lib/chains/types";
// Chain configuration comes from MiniApp manifest only - no environment defaults
import { useTheme } from "../../providers/ThemeProvider";
import { useWalletStore, type WalletStore } from "@/lib/wallet/store";
import { MiniAppFrame } from "./MiniAppFrame";
import { WaterWaveBackground } from "../../ui/WaterWaveBackground";
import { getChainRegistry } from "@/lib/chains/registry";
import { getMiniappLocale } from "@neo/shared/i18n";

interface MiniAppViewerProps {
  app: MiniAppInfo;
  locale?: string;
  /** Override chain ID (defaults to first supported chain from manifest, null if none) */
  chainId?: ChainId;
}

interface WindowWithMiniAppSDK {
  MiniAppSDK?: MiniAppSDK;
}

/**
 * MiniAppLoader - E-Robo water ripple launch styling
 */
function MiniAppLoader({ app }: { app: MiniAppInfo }) {
  const [msgIndex, setMsgIndex] = React.useState(0);
  const loadingMessages = [
    "WARMING UP VAULT",
    "VERIFYING SDK INTEGRITY",
    "SYNCING WALLET STATE",
    "ALIGNING NEON SIGNALS",
    "LAUNCH READY",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((i) => (i < loadingMessages.length - 1 ? i + 1 : i));
    }, 900);
    return () => clearInterval(timer);
  }, [loadingMessages.length]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-white via-[#f5f6ff] to-[#e6fbf3] dark:from-[#05060d] dark:via-[#090a14] dark:to-[#050a0d]"
    >
      <WaterWaveBackground intensity="medium" colorScheme="mixed" className="opacity-80" />
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.5)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px]" />

      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative z-10 flex flex-col items-center gap-6 px-10 py-10 rounded-[28px] bg-white/80 dark:bg-white/[0.06] border border-white/60 dark:border-white/10 shadow-[0_20px_60px_rgba(70,60,120,0.15)] backdrop-blur-2xl"
      >
        <div className="relative flex items-center justify-center w-32 h-32">
          <span className="absolute inset-0 rounded-full border border-erobo-purple/30 animate-concentric-ripple" />
          <span className="absolute inset-0 rounded-full border border-erobo-purple/20 animate-concentric-ripple [animation-delay:0.35s]" />
          <span className="absolute inset-0 rounded-full border border-neo/20 animate-concentric-ripple [animation-delay:0.7s]" />
          <span className="absolute inset-0 rounded-full bg-erobo-purple/20 blur-md animate-[water-drop_1.6s_ease-out_infinite]" />
          <MiniAppLogo
            appId={app.app_id}
            category={app.category}
            size="lg"
            iconUrl={app.icon}
            className="relative z-10"
          />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">{app.name}</h2>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-white/60">MiniApp Launch</p>
        </div>

        <div className="w-56 h-2 rounded-full bg-gray-200/70 dark:bg-white/10 overflow-hidden">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 4, ease: "linear" }}
            className="h-full bg-gradient-to-r from-neo/80 via-erobo-purple/80 to-erobo-purple-dark/90"
          />
        </div>

        <div className="h-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={msgIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white/70"
            >
              {msgIndex === loadingMessages.length - 1 ? (
                <Zap size={14} className="text-neo" strokeWidth={2.5} />
              ) : (
                <Loader2 size={14} className="animate-spin text-erobo-purple" strokeWidth={2.5} />
              )}
              <span>{loadingMessages[msgIndex]}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-gray-400 dark:text-white/40">
          <span className="flex items-center gap-1">
            <ShieldCheck size={12} className="text-neo" />
            Secure Sandbox
          </span>
          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
          <span className="flex items-center gap-1">
            <Lock size={12} className="text-erobo-purple" />
            Isolated
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * MiniAppViewer - Renders a MiniApp in an iframe or federated module
 * Handles SDK injection and message bridging for the embedded app
 */
export function MiniAppViewer({ app, locale = "en", chainId: chainIdProp }: MiniAppViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sdkRef = useRef<MiniAppSDK | null>(null);
  const effectiveChainId = useMemo(() => resolveChainIdForApp(app, chainIdProp), [app, chainIdProp]);
  const entryUrl = useMemo(() => getEntryUrlForChain(app, effectiveChainId), [app, effectiveChainId]);
  const federated = parseFederatedEntryUrl(entryUrl, app.app_id);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const { theme } = useTheme();

  const contractAddress = useMemo(() => getContractForChain(app, effectiveChainId), [app, effectiveChainId]);
  const chainType = useMemo(() => {
    if (!effectiveChainId) return undefined;
    return getChainRegistry().getChain(effectiveChainId)?.type;
  }, [effectiveChainId]);

  // Build iframe URL with language and theme parameters
  const iframeSrc = useMemo(() => {
    const supportedLocale = getMiniappLocale(locale);
    return buildMiniAppEntryUrl(entryUrl, { lang: supportedLocale, theme, embedded: "1" });
  }, [entryUrl, locale, theme]);

  useEffect(() => {
    if (federated) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const origin = resolveIframeOrigin(entryUrl);
    if (!origin) return;
    const sandboxAttr = iframe.getAttribute("sandbox") || "";
    const sandboxAllowsSameOrigin = sandboxAttr.split(/\s+/).includes("allow-same-origin");
    const targetOrigin = sandboxAttr && !sandboxAllowsSameOrigin ? "*" : origin;
    iframe.contentWindow.postMessage({ type: "theme-change", theme }, targetOrigin);
  }, [theme, entryUrl, federated]);

  // Sync wallet state to iframe when it changes
  useEffect(() => {
    if (federated) return;
    // CRITICAL: Only sync after iframe is loaded and ready
    if (!isLoaded) return;

    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const origin = resolveIframeOrigin(entryUrl);
    if (!origin) return;
    const sandboxAttr = iframe.getAttribute("sandbox") || "";
    const sandboxAllowsSameOrigin = sandboxAttr.split(/\s+/).includes("allow-same-origin");
    const targetOrigin = sandboxAttr && !sandboxAllowsSameOrigin ? "*" : origin;

    // Helper to send wallet state to MiniApp iframe
    const sendWalletState = (state: WalletStore) => {
      iframe.contentWindow?.postMessage(
        {
          type: "miniapp_wallet_state_change",
          connected: state.connected,
          address: state.address,
          balance: state.balance
            ? {
                native: state.balance.native || "0",
                nativeSymbol: state.balance.nativeSymbol,
                governance: state.balance.governance,
                governanceSymbol: state.balance.governanceSymbol,
              }
            : null,
          chainId: state.chainId,
          chainType: state.chainType,
        },
        targetOrigin,
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
  }, [entryUrl, federated, isLoaded]);

  // Initialize SDK
  useEffect(() => {
    const sdk = installMiniAppSDK({
      appId: app.app_id,
      chainId: effectiveChainId,
      chainType,
      contractAddress,
      permissions: app.permissions,
      supportedChains: app.supportedChains,
      chainContracts: app.chainContracts,
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
  }, [app.app_id, app.chainContracts, app.permissions, effectiveChainId, contractAddress, chainType]);

  useEffect(() => {
    if (federated) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const origin = resolveIframeOrigin(entryUrl);
    if (!origin) return;
    const sandboxAttr = iframe.getAttribute("sandbox") || "";
    const sandboxAllowsSameOrigin = sandboxAttr.split(/\s+/).includes("allow-same-origin");
    const responseOrigin = sandboxAttr && !sandboxAllowsSameOrigin ? "*" : origin;

    const sdk = sdkRef.current;
    if (sdk?.getConfig) {
      iframe.contentWindow.postMessage({ type: "miniapp_config", config: sdk.getConfig() }, responseOrigin);
    }
  }, [federated, entryUrl, effectiveChainId, contractAddress, chainType, app.chainContracts, app.supportedChains]);

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
        setIsLoaded(true);
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
        source.postMessage({ type: "miniapp_sdk_response", id, ok, result, error }, responseOrigin);
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
      // fallback for apps that don't send "miniapp_ready"
      setTimeout(() => setIsLoaded(true), 1500);

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
  }, [app.app_id, entryUrl, app.permissions, app.chainContracts, federated, effectiveChainId, chainType]);

  return (
    <div className="w-full h-full min-h-0 min-w-0 overflow-hidden bg-black">
      <MiniAppFrame>
        <AnimatePresence>{!isLoaded && <MiniAppLoader app={app} />}</AnimatePresence>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{
            opacity: isLoaded ? 1 : 0,
            scale: isLoaded ? 1 : 0.98,
            filter: isLoaded ? "blur(0px)" : "blur(8px)",
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
              sandbox="allow-scripts allow-forms allow-popups"
              title={`${app.name} MiniApp`}
              allowFullScreen
              referrerPolicy="no-referrer"
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
    case "payments.payGASAndInvoke":
      return Boolean(permissions.payments);
    case "governance.vote":
    case "governance.voteAndInvoke":
    case "governance.getCandidates":
      return Boolean(permissions.governance);
    case "rng.requestRandom":
      return Boolean(permissions.rng);
    case "datafeed.getPrice":
    case "datafeed.getPrices":
    case "datafeed.getNetworkStats":
    case "datafeed.getRecentTransactions":
      return Boolean(permissions.datafeed);
    case "wallet.signMessage":
      return Boolean(permissions.confidential);
    case "getConfig":
    case "wallet.getAddress":
    case "getAddress":
    case "wallet.switchChain":
    case "wallet.invokeIntent":
    case "invokeRead":
    case "invokeFunction":
    case "stats.getMyUsage":
    case "events.list":
    case "transactions.list":
      return true;
    default:
      return false;
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
    case "getConfig": {
      if (!sdk.getConfig) throw new Error("getConfig not available");
      return sdk.getConfig();
    }
    case "wallet.getAddress":
    case "getAddress": {
      if (wallet.connected && wallet.address) return wallet.address;
      if (sdk.wallet?.getAddress) return sdk.wallet.getAddress();
      if (sdk.getAddress) return sdk.getAddress();
      throw new Error("wallet.getAddress not available");
    }
    case "wallet.switchChain": {
      const [chainId] = params;
      if (!chainId || typeof chainId !== "string") throw new Error("chainId required");
      await useWalletStore.getState().switchChain(chainId as import("@/lib/chains/types").ChainId);
      return true;
    }
    case "wallet.invokeIntent": {
      if (!sdk.wallet?.invokeIntent) throw new Error("wallet.invokeIntent not available");
      const [requestId] = params;
      return sdk.wallet.invokeIntent(String(requestId ?? ""));
    }
    case "wallet.signMessage": {
      if (!sdk.wallet?.signMessage) throw new Error("wallet.signMessage not available");
      const [payload] = params;
      const message =
        typeof payload === "string"
          ? payload
          : payload && typeof payload === "object"
            ? String((payload as { message?: unknown }).message ?? "")
            : "";
      if (!message) throw new Error("message required");
      return sdk.wallet.signMessage(message);
    }
    case "invokeRead":
    case "invokeFunction": {
      if (!sdk.invoke) throw new Error("invoke not available");
      const [payload] = params;
      if (!payload || typeof payload !== "object") {
        throw new Error(`${method} params required`);
      }
      return sdk.invoke(method, payload);
    }
    case "payments.payGAS": {
      if (!sdk.payments?.payGAS) throw new Error("payments.payGAS not available");
      const [requestedAppId, amount, memo] = params;
      const scopedAppId = resolveScopedAppId(requestedAppId, appId);
      const memoValue = memo === undefined || memo === null ? undefined : String(memo);
      return sdk.payments.payGAS(scopedAppId, String(amount ?? ""), memoValue);
    }
    case "payments.payGASAndInvoke": {
      if (!sdk.payments?.payGASAndInvoke) throw new Error("payments.payGASAndInvoke not available");
      const [requestedAppId, amount, memo] = params;
      const scopedAppId = resolveScopedAppId(requestedAppId, appId);
      const memoValue = memo === undefined || memo === null ? undefined : String(memo);
      return sdk.payments.payGASAndInvoke(scopedAppId, String(amount ?? ""), memoValue);
    }
    case "governance.vote": {
      if (!sdk.governance?.vote) throw new Error("governance.vote not available");
      const [requestedAppId, proposalId, neoAmount, support] = params;
      const scopedAppId = resolveScopedAppId(requestedAppId, appId);
      const supportValue = typeof support === "boolean" ? support : undefined;
      return sdk.governance.vote(scopedAppId, String(proposalId ?? ""), String(neoAmount ?? ""), supportValue);
    }
    case "governance.voteAndInvoke": {
      if (!sdk.governance?.voteAndInvoke) throw new Error("governance.voteAndInvoke not available");
      const [requestedAppId, proposalId, neoAmount, support] = params;
      const scopedAppId = resolveScopedAppId(requestedAppId, appId);
      const supportValue = typeof support === "boolean" ? support : undefined;
      return sdk.governance.voteAndInvoke(scopedAppId, String(proposalId ?? ""), String(neoAmount ?? ""), supportValue);
    }
    case "governance.getCandidates": {
      if (!sdk.governance?.getCandidates) throw new Error("governance.getCandidates not available");
      return sdk.governance.getCandidates();
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
    case "datafeed.getPrices": {
      if (!sdk.datafeed?.getPrices) throw new Error("datafeed.getPrices not available");
      return sdk.datafeed.getPrices();
    }
    case "datafeed.getNetworkStats": {
      if (!sdk.datafeed?.getNetworkStats) throw new Error("datafeed.getNetworkStats not available");
      return sdk.datafeed.getNetworkStats();
    }
    case "datafeed.getRecentTransactions": {
      if (!sdk.datafeed?.getRecentTransactions) throw new Error("datafeed.getRecentTransactions not available");
      const [limit] = params;
      const limitValue = typeof limit === "number" ? limit : undefined;
      return sdk.datafeed.getRecentTransactions(limitValue);
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
