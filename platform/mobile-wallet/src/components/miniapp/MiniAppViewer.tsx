/**
 * MiniAppViewer - Main component for rendering MiniApps
 * Uses WebView with SDK bridge for communication
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import type { ChainId, MiniAppInfo } from "@/types/miniapp";
import { MiniAppLoader } from "./MiniAppLoader";
import {
  createMiniAppSDK,
  dispatchBridgeCall,
  buildMiniAppEntryUrlForWallet,
  resolveChainIdForApp,
  getEntryUrlForChain,
  getContractForChain,
} from "@/lib/miniapp";
import type { BridgeConfig, BridgeMessage } from "@/lib/miniapp";
import { resolveChainType } from "@/lib/chains";
import { getMiniappLocale } from "@neo/shared/i18n";
import { useWalletStore } from "@/stores/wallet";
import { EDGE_BASE_URL, MINIAPP_BASE_URL } from "@/lib/config";

interface MiniAppViewerProps {
  app: MiniAppInfo;
  locale?: string;
  theme?: "light" | "dark";
  chainId?: ChainId | null;
  getAddress: () => Promise<string>;
  invokeIntent: (requestId: string) => Promise<{ tx_hash: string }>;
  invokeFunction?: (params: Record<string, unknown>) => Promise<unknown>;
  switchChain?: (chainId: ChainId) => Promise<void>;
  signMessage?: (message: string) => Promise<unknown>;
  onReady?: () => void;
  onError?: (error: Error) => void;
}


/**
 * JavaScript to inject into WebView for SDK bridge
 */
const buildInjectedJS = (configJson: string) => `
(function() {
  if (window.MiniAppSDK) return;

  const initialConfig = ${configJson || "null"};
  if (initialConfig && typeof initialConfig === "object") {
    window.__MINIAPP_CONFIG__ = initialConfig;
  }

  const pending = new Map();
  let reqId = 0;

  function request(method, params) {
    return new Promise((resolve, reject) => {
      const id = String(++reqId);
      pending.set(id, { resolve, reject });
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'miniapp_sdk_request',
        id,
        method,
        params: params || []
      }));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  function invoke(method) {
    const args = Array.prototype.slice.call(arguments, 1);
    return request(method, args);
  }

  function getConfig() {
    if (window.__MINIAPP_CONFIG__ && typeof window.__MINIAPP_CONFIG__ === "object") {
      return window.__MINIAPP_CONFIG__;
    }
    return initialConfig || {
      appId: "",
      chainId: null,
      chainType: undefined,
      contractAddress: null,
      supportedChains: [],
      chainContracts: {},
      uiConfig: null,
      display: null,
      debug: false,
    };
  }

  window.MiniAppSDK = {
    invoke,
    getConfig,
    getAddress: () => request('wallet.getAddress'),
    wallet: {
      getAddress: () => request('wallet.getAddress'),
      invokeIntent: (requestId) => request('wallet.invokeIntent', [requestId]),
      switchChain: (chainId) => request('wallet.switchChain', [chainId]),
      signMessage: (message) => request('wallet.signMessage', [message])
    },
    payments: {
      payGAS: (appId, amount, memo) => request('payments.payGAS', [appId, amount, memo]),
      payGASAndInvoke: (appId, amount, memo) => request('payments.payGASAndInvoke', [appId, amount, memo])
    },
    governance: {
      vote: (appId, proposalId, neoAmount, support) =>
        request('governance.vote', [appId, proposalId, neoAmount, support]),
      voteAndInvoke: (appId, proposalId, neoAmount, support) =>
        request('governance.voteAndInvoke', [appId, proposalId, neoAmount, support]),
      getCandidates: () => request('governance.getCandidates', [])
    },
    rng: {
      requestRandom: (appId) => request('rng.requestRandom', [appId])
    },
    datafeed: {
      getPrice: (symbol) => request('datafeed.getPrice', [symbol]),
      getPrices: () => request('datafeed.getPrices', []),
      getNetworkStats: () => request('datafeed.getNetworkStats', []),
      getRecentTransactions: (limit) => request('datafeed.getRecentTransactions', [limit])
    },
    stats: {
      getMyUsage: (appId, date) => request('stats.getMyUsage', [appId, date])
    },
    events: {
      list: (params) => request('events.list', [params])
    },
    transactions: {
      list: (params) => request('transactions.list', [params])
    }
  };

  window.addEventListener('message', function(e) {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data && data.type === 'miniapp_config' && data.config && typeof data.config === 'object') {
        window.__MINIAPP_CONFIG__ = data.config;
        return;
      }
      if (data.type === 'miniapp_sdk_response' && data.id) {
        const p = pending.get(data.id);
        if (p) {
          pending.delete(data.id);
          if (data.ok) p.resolve(data.result);
          else p.reject(new Error(data.error || 'Request failed'));
        }
      }
    } catch {}
  });

  window.dispatchEvent(new Event('miniapp-sdk-ready'));
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'miniapp_ready' }));
  if (initialConfig && typeof initialConfig === "object") {
    window.postMessage({ type: "miniapp_config", config: initialConfig }, "*");
  }
})();
true;
`;

export function MiniAppViewer({
  app,
  locale = "en",
  theme = "dark",
  chainId,
  getAddress,
  invokeIntent,
  invokeFunction,
  switchChain,
  signMessage,
  onReady,
  onError,
}: MiniAppViewerProps) {
  const webViewRef = useRef<WebView>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const effectiveChainId = useMemo(() => resolveChainIdForApp(app, chainId), [app, chainId]);
  const chainType = useMemo(() => resolveChainType(effectiveChainId || null), [effectiveChainId]);
  const contractAddress = useMemo(
    () => getContractForChain(app, effectiveChainId),
    [app, effectiveChainId],
  );
  const displayConfig = useMemo(
    () =>
      app.display ?? {
        name: app.name,
        description: app.description,
        icon: app.icon,
        banner: app.banner,
      },
    [app.display, app.name, app.description, app.icon, app.banner],
  );
  const miniappConfig = useMemo(
    () => ({
      appId: app.app_id,
      chainId: effectiveChainId,
      chainType: chainType ?? null,
      contractAddress: contractAddress ?? null,
      supportedChains: app.supportedChains || [],
      chainContracts: app.chainContracts || {},
      uiConfig: app.ui_config ?? null,
      display: displayConfig,
      layout: "mobile",
      debug: false,
    }),
    [app.app_id, app.chainContracts, app.supportedChains, app.ui_config, chainType, contractAddress, effectiveChainId, displayConfig],
  );
  const serializedConfig = useMemo(() => JSON.stringify(miniappConfig), [miniappConfig]);
  const injectedJS = useMemo(() => buildInjectedJS(serializedConfig), [serializedConfig]);

  // Create SDK instance
  const sdk = useMemo(
    () =>
      createMiniAppSDK({
        edgeBaseUrl: EDGE_BASE_URL,
        appId: app.app_id,
        chainId: effectiveChainId,
        chainType: chainType || undefined,
        contractAddress,
        supportedChains: app.supportedChains,
        chainContracts: app.chainContracts,
        uiConfig: app.ui_config,
        display: displayConfig,
        layout: "mobile",
      }),
    [app.app_id, app.chainContracts, app.supportedChains, app.ui_config, chainType, contractAddress, effectiveChainId, displayConfig],
  );

  // Build bridge config
  const bridgeConfig: BridgeConfig = useMemo(
    () => ({
      appId: app.app_id,
      permissions: app.permissions,
      sdk,
      getAddress,
      invokeIntent,
      invokeFunction,
      switchChain,
      signMessage,
    }),
    [app.app_id, app.permissions, sdk, getAddress, invokeIntent, invokeFunction, switchChain, signMessage],
  );

  // Build entry URL with params
  const entryUrl = useMemo(() => {
    const supportedLocale = getMiniappLocale(locale);
    const baseUrl = resolveEntryUrl(app, getEntryUrlForChain(app, effectiveChainId));
    return buildMiniAppEntryUrlForWallet(baseUrl, {
      lang: supportedLocale,
      theme,
      embedded: "1",
    });
  }, [app, effectiveChainId, locale, theme]);

  const postToWebView = useCallback((payload: unknown) => {
    const message = JSON.stringify(payload);
    webViewRef.current?.injectJavaScript(`
        window.postMessage(${message}, '*');
        true;
      `);
  }, []);

  const sendConfig = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
        (function() {
          window.__MINIAPP_CONFIG__ = ${serializedConfig};
          window.postMessage({ type: "miniapp_config", config: ${serializedConfig} }, "*");
        })();
        true;
      `);
  }, [serializedConfig]);

  const sendWalletState = useCallback(async () => {
    let address: string | null = null;
    let connected = false;
    try {
      address = await getAddress();
      connected = true;
    } catch {
      connected = false;
      address = null;
    }

    postToWebView({
      type: "miniapp_wallet_state_change",
      connected,
      address,
      chainId: effectiveChainId,
      chainType: chainType ?? null,
      balance: null,
      balances: {},
    });
  }, [chainType, effectiveChainId, getAddress, postToWebView]);

  useEffect(() => {
    if (!isLoaded) return;
    const unsubscribe = useWalletStore.subscribe(() => {
      void sendWalletState();
    });
    void sendWalletState();
    const delayedSend = setTimeout(() => {
      void sendWalletState();
    }, 500);
    return () => {
      unsubscribe();
      clearTimeout(delayedSend);
    };
  }, [isLoaded, sendWalletState]);

  // Handle messages from WebView
  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const data: BridgeMessage = JSON.parse(event.nativeEvent.data);

        if (data.type === "miniapp_ready") {
          setIsLoaded(true);
          onReady?.();
          sendConfig();
          void sendWalletState();
          return;
        }

        if (data.type !== "miniapp_sdk_request" || !data.id) return;

        const method = data.method || "";
        const params = data.params || [];

        try {
          const result = await dispatchBridgeCall(bridgeConfig, method, params);
          sendResponse(data.id, true, result);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Request failed";
          sendResponse(data.id, false, undefined, message);
        }
      } catch {
        // Ignore parse errors
      }
    },
    [bridgeConfig, onReady, sendConfig, sendWalletState],
  );

  // Send response back to WebView
  const sendResponse = useCallback((id: string, ok: boolean, result?: unknown, error?: string) => {
    const response = JSON.stringify({
      type: "miniapp_sdk_response",
      id,
      ok,
      result,
      error,
    });
    webViewRef.current?.injectJavaScript(`
        window.postMessage(${response}, '*');
        true;
      `);
  }, []);

  return (
    <View style={styles.container}>
      {!isLoaded && <MiniAppLoader app={app} />}
      <WebView
        ref={webViewRef}
        source={{ uri: entryUrl }}
        style={[styles.webview, !isLoaded && styles.hidden]}
        injectedJavaScript={injectedJS}
        onMessage={handleMessage}
        onError={(e) => onError?.(new Error(e.nativeEvent.description))}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
      />
    </View>
  );
}

function resolveEntryUrl(app: MiniAppInfo, rawUrl: string): string {
  const trimmed = String(rawUrl || app.entry_url || "").trim();
  if (!trimmed) return "";

  let resolved = trimmed;
  if (resolved.startsWith("mf://")) {
    const fallback = resolveStaticFallbackUrl(app);
    if (fallback) {
      resolved = fallback;
    }
  }

  if (resolved.startsWith("/")) {
    return `${MINIAPP_BASE_URL}${resolved}`;
  }
  return resolved;
}

function resolveStaticFallbackUrl(app: MiniAppInfo): string | null {
  const candidates = [app.icon, app.banner, app.entry_url].filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (!candidate.startsWith("/miniapps/")) continue;
    const parts = candidate.split("/").filter(Boolean);
    if (parts.length >= 2 && parts[0] === "miniapps" && parts[1]) {
      return `/miniapps/${parts[1]}/index.html`;
    }
  }

  const fallbackId = app.app_id?.replace(/^miniapp-/, "");
  return fallbackId ? `/miniapps/${fallbackId}/index.html` : null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  hidden: {
    opacity: 0,
  },
});
