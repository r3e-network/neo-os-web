import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { LaunchDock } from "../../components/LaunchDock";
import { FederatedMiniApp } from "../../components/FederatedMiniApp";
import { WalletState, MiniAppInfo } from "../../components/types";
import { installMiniAppSDK } from "../../lib/miniapp-sdk";
import type { MiniAppSDK } from "../../lib/miniapp-sdk";
import { coerceMiniAppInfo, parseFederatedEntryUrl } from "../../lib/miniapp";
import { logger } from "../../lib/logger";
import { resolveInternalBaseUrl } from "../../lib/edge";

/** NeoLine N3 wallet interface */
interface NeoLineN3Wallet {
  Init: new () => { getAccount: () => Promise<{ address: string }> };
}

interface WindowWithNeoLine extends Window {
  NEOLineN3?: NeoLineN3Wallet;
}

/** Window with MiniAppSDK for iframe injection */
interface WindowWithMiniAppSDK {
  MiniAppSDK?: MiniAppSDK;
}

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

// Static catalog (fallback for builtin apps)
const MINIAPP_CATALOG: MiniAppInfo[] = [
  {
    app_id: "builtin-lottery",
    name: "Neo Lottery",
    description: "Decentralized lottery with provably fair randomness",
    icon: "🎰",
    category: "gaming",
    entry_url: "mf://builtin?app=builtin-lottery",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "builtin-coin-flip",
    name: "Coin Flip",
    description: "50/50 coin flip - double your GAS",
    icon: "🪙",
    category: "gaming",
    entry_url: "mf://builtin?app=builtin-coin-flip",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "builtin-dice-game",
    name: "Dice Game",
    description: "Roll the dice and win up to 6x",
    icon: "🎲",
    category: "gaming",
    entry_url: "mf://builtin?app=builtin-dice-game",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "builtin-prediction-market",
    name: "Prediction Market",
    description: "Bet on real-world events",
    icon: "📊",
    category: "defi",
    entry_url: "mf://builtin?app=builtin-prediction-market",
    permissions: { payments: true, datafeed: true },
  },
  {
    app_id: "builtin-price-ticker",
    name: "Price Ticker",
    description: "Real-time GAS/NEO price",
    icon: "💹",
    category: "utility",
    entry_url: "mf://builtin?app=builtin-price-ticker",
    permissions: { datafeed: true },
  },
  {
    app_id: "builtin-secret-vote",
    name: "Secret Vote",
    description: "Vote on governance proposals",
    icon: "🗳️",
    category: "governance",
    entry_url: "mf://builtin?app=builtin-secret-vote",
    permissions: { governance: true },
  },
];

type LaunchPageProps = {
  app: MiniAppInfo;
};

export default function LaunchPage({ app }: LaunchPageProps) {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletState>({ connected: false, address: "", provider: null });
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const federated = parseFederatedEntryUrl(app.entry_url, app.app_id);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sdkRef = useRef<MiniAppSDK | null>(null);

  useEffect(() => {
    sdkRef.current = installMiniAppSDK({ appId: app.app_id, permissions: app.permissions });
  }, [app.app_id, app.permissions]);

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

  // Wallet connection (same logic as index.tsx)
  useEffect(() => {
    const tryConnectWallet = async () => {
      try {
        const g = window as WindowWithNeoLine;
        if (g?.NEOLineN3) {
          const inst = new g.NEOLineN3.Init();
          const acc = await inst.getAccount();
          setWallet({ connected: true, address: acc.address, provider: "neoline" });
        }
      } catch (e) {
        // Silent fail - user can connect manually from dock
      }
    };

    tryConnectWallet();
  }, []);

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

  useEffect(() => {
    if (federated) return;
    if (typeof window === "undefined") return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    const expectedOrigin = resolveIframeOrigin(app.entry_url);
    if (!expectedOrigin) return;

    const allowSameOriginInjection = expectedOrigin === window.location.origin;

    const ensureSDK = () => {
      if (!sdkRef.current) {
        sdkRef.current = installMiniAppSDK({ appId: app.app_id, permissions: app.permissions });
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
        const result = await dispatchBridgeCall(sdk, method, params, app.permissions, app.app_id);
        respond(true, result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "request failed";
        respond(false, undefined, message);
      }
    };

    const handleLoad = () => {
      if (!allowSameOriginInjection) return;
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
  }, [app.app_id, app.entry_url, app.permissions, federated]);

  const handleExit = useCallback(() => {
    // Return to app detail page (or homepage if app page doesn't exist)
    router.push(`/app/${app.app_id}`);
  }, [router, app.app_id]);

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/launch/${app.app_id}`;
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
    <div style={containerStyle}>
      <LaunchDock
        appName={app.name}
        appId={app.app_id}
        wallet={wallet}
        networkLatency={networkLatency}
        onExit={handleExit}
        onShare={handleShare}
      />
      {federated ? (
        <div style={federatedStyle}>
          <FederatedMiniApp appId={federated.appId} view={federated.view} remote={federated.remote} />
        </div>
      ) : (
        <iframe
          src={app.entry_url}
          ref={iframeRef}
          style={iframeStyle}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={`${app.name} MiniApp`}
          allowFullScreen
        />
      )}
      {toastMessage && <div style={toastStyle}>{toastMessage}</div>}
    </div>
  );
}

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
const containerStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#000",
  overflow: "hidden",
};

const iframeStyle: React.CSSProperties = {
  position: "absolute",
  top: 48,
  left: 0,
  width: "100vw",
  height: "calc(100vh - 48px)",
  border: "none",
};

const federatedStyle: React.CSSProperties = {
  position: "absolute",
  top: 48,
  left: 0,
  width: "100vw",
  height: "calc(100vh - 48px)",
  overflow: "auto",
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
