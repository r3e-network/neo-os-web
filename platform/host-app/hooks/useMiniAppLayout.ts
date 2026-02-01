"use client";

import { useEffect, useState } from "react";
import { parseLayoutParam, resolveMiniAppLayout, type MiniAppLayout } from "@/lib/miniapp-layout";

type LayoutOverride = string | string[] | null | undefined;

const WALLET_PROVIDERS = [
  "ReactNativeWebView",
  "NEOLineN3",
  "NEOLine",
  "neo3Dapi",
  "OneGate",
];

function hasWalletProvider(): boolean {
  if (typeof window === "undefined") return false;
  return WALLET_PROVIDERS.some((provider) => (window as unknown as Record<string, unknown>)[provider] !== undefined);
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  const uaMobile = typeof nav.userAgentData === "object" && nav.userAgentData?.mobile;
  if (uaMobile) return true;
  const ua = navigator.userAgent || "";
  return /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

function getQueryLayout(): MiniAppLayout | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return parseLayoutParam(params.get("layout"));
}

function resolveOverride(override: LayoutOverride): MiniAppLayout | null {
  return parseLayoutParam(override) ?? getQueryLayout();
}

export function useMiniAppLayout(override?: LayoutOverride): MiniAppLayout {
  const [layout, setLayout] = useState<MiniAppLayout>(() => resolveOverride(override) ?? "web");

  useEffect(() => {
    const resolved = resolveMiniAppLayout({
      override: resolveOverride(override),
      isMobileDevice: isMobileDevice(),
      hasWalletProvider: hasWalletProvider(),
    });
    setLayout(resolved);
  }, [override]);

  return layout;
}
