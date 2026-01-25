"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MiniAppLoader } from "./MiniAppLoader";
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
import { resolveIframeOrigin, dispatchBridgeCall } from "@/lib/miniapp-sdk-bridge";
import type { MiniAppSDK } from "@/lib/miniapp-sdk";
import type { ChainId } from "@/lib/chains/types";
// Chain configuration comes from MiniApp manifest only - no environment defaults
import { useTheme } from "../../providers/ThemeProvider";
import { useWalletStore, type WalletStore } from "@/lib/wallet/store";
import { MiniAppFrame } from "./MiniAppFrame";
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
    return buildMiniAppEntryUrl(entryUrl, { lang: supportedLocale, theme, embedded: "1", layout: "web" });
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

  useEffect(() => {
    if (federated) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const origin = resolveIframeOrigin(entryUrl);
    if (!origin) return;
    const sandboxAttr = iframe.getAttribute("sandbox") || "";
    const sandboxAllowsSameOrigin = sandboxAttr.split(/\s+/).includes("allow-same-origin");
    const targetOrigin = sandboxAttr && !sandboxAllowsSameOrigin ? "*" : origin;
    const supportedLocale = getMiniappLocale(locale);
    iframe.contentWindow.postMessage({ type: "language-change", language: supportedLocale }, targetOrigin);
  }, [locale, entryUrl, federated]);

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
      layout: "web",
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
          layout: "web",
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
        const walletState = useWalletStore.getState();
        const walletAddress = walletState.connected ? walletState.address : undefined;
        const result = await dispatchBridgeCall(sdk, method, params, app.permissions, app.app_id, walletAddress);
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

      // SECURITY: Inject parent origin for Safari iframe support
      // This allows MiniApps to safely communicate without using "*"
      try {
        if (iframe.contentWindow) {
          (iframe.contentWindow as any).__MINIAPP_PARENT_ORIGIN__ = window.location.origin;
        }
      } catch {
        // Ignore cross-origin access failures (expected for sandboxed iframes)
      }

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
              sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
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
