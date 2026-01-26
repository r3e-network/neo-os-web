import { useEffect, useState } from "react";
import { parseLayoutParam, resolveMiniAppLayout, type MiniAppLayout } from "@/lib/miniapp-layout";

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaMobile = typeof navigator.userAgentData === "object" && navigator.userAgentData?.mobile;
  if (uaMobile) return true;
  const ua = navigator.userAgent || "";
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
}

function hasWalletProvider(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as any).ReactNativeWebView ||
      (window as any).NEOLineN3 ||
      (window as any).NEOLine ||
      (window as any).neo3Dapi ||
      (window as any).OneGate ||
      (window as any).ethereum,
  );
}

export function useMiniAppLayout(override?: string | string[] | null): MiniAppLayout {
  const [layout, setLayout] = useState<MiniAppLayout>(() => parseLayoutParam(override) ?? "web");

  useEffect(() => {
    const resolved = resolveMiniAppLayout({
      override,
      isMobileDevice: isMobileDevice(),
      hasWalletProvider: hasWalletProvider(),
    });
    setLayout(resolved);
  }, [override]);

  return layout;
}
