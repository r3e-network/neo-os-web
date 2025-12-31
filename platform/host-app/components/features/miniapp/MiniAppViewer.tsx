"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { MiniAppInfo } from "../../types";
import { FederatedMiniApp } from "../../FederatedMiniApp";
import { parseFederatedEntryUrl } from "../../../lib/miniapp";
import { installMiniAppSDK } from "../../../lib/miniapp-sdk";
import type { MiniAppSDK } from "../../../lib/miniapp-sdk";

interface MiniAppViewerProps {
  app: MiniAppInfo;
  locale?: string;
}

interface WindowWithMiniAppSDK {
  MiniAppSDK?: MiniAppSDK;
}

/**
 * MiniAppViewer - Renders a MiniApp in an iframe or federated module
 * Handles SDK injection and message bridging for the embedded app
 */
export function MiniAppViewer({ app, locale = "en" }: MiniAppViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sdkRef = useRef<MiniAppSDK | null>(null);
  const federated = parseFederatedEntryUrl(app.entry_url, app.app_id);

  // Build iframe URL with language parameter
  const iframeSrc = useMemo(() => {
    const supportedLocale = locale === "zh" ? "zh" : "en";
    const separator = app.entry_url.includes("?") ? "&" : "?";
    return `${app.entry_url}${separator}lang=${supportedLocale}`;
  }, [app.entry_url, locale]);

  // Initialize SDK
  useEffect(() => {
    sdkRef.current = installMiniAppSDK({
      appId: app.app_id,
      permissions: app.permissions,
    });
  }, [app.app_id, app.permissions]);

  // Setup message bridge for iframe communication
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
      if (!allowSameOriginInjection) return;
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

  if (federated) {
    return (
      <div className="w-full h-full overflow-auto bg-black">
        <FederatedMiniApp appId={federated.appId} view={federated.view} remote={federated.remote} />
      </div>
    );
  }

  return (
    <iframe
      src={iframeSrc}
      ref={iframeRef}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      title={`${app.name} MiniApp`}
      allowFullScreen
    />
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
