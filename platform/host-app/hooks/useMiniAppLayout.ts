"use client";

import { useMemo } from "react";

type Layout = "web" | "mobile";

const WALLET_PROVIDERS = [
  "ReactNativeWebView",
  "NEOLineN3",
  "neo3Dapi",
  "OneGate",
  "ethereum",
  "klaytn",
  "solana",
];

function hasWalletProvider(): boolean {
  if (typeof window === "undefined") return false;
  return WALLET_PROVIDERS.some((provider) => (window as unknown as Record<string, unknown>)[provider] !== undefined);
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

function getQueryLayout(): Layout | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const layout = params.get("layout");
  if (layout === "web" || layout === "mobile") return layout;
  return null;
}

export function useMiniAppLayout(override?: Layout): Layout {
  return useMemo(() => {
    if (override) return override;

    const queryLayout = getQueryLayout();
    if (queryLayout) return queryLayout;

    if (isMobileDevice() && hasWalletProvider()) {
      return "mobile";
    }

    return "web";
  }, [override]);
}
