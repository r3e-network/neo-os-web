import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { MiniAppFrame } from "@/components/features/miniapp";
import { installMiniAppSDK } from "@/lib/miniapp-sdk";
import { resolveIframeOrigin } from "@/lib/miniapp-sdk-bridge";
import { buildMiniAppEntryUrl, coerceMiniAppInfo } from "@/lib/miniapp";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useWalletStore } from "@/lib/wallet/store";
import { getMiniappLocale } from "@neo/shared/i18n";
import { resolveInternalBaseUrl } from "@/lib/edge";
import { useMiniAppLayout } from "@/hooks/useMiniAppLayout";

interface ContainerPageProps {
    appId: string;
    app: Record<string, unknown> | null;
}

export default function ContainerPage({ appId, app }: ContainerPageProps) {
    const router = useRouter();
    const { locale } = { locale: router.query.locale as string || "en" };
    const { theme } = useTheme();
    const { address, connected, provider, chainId: storeChainId } = useWalletStore();
    const layout = useMiniAppLayout(router.query.layout);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const sdkRef = useRef<ReturnType<typeof installMiniAppSDK> | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const appInfo = useMemo(() => app ? coerceMiniAppInfo(app) : null, [app]);
    const entryUrl = useMemo(() => appInfo?.entry_url, [appInfo]);

    const iframeSrc = useMemo(() => {
        if (!entryUrl) return null;
        return buildMiniAppEntryUrl(entryUrl, { lang: getMiniappLocale(locale), theme, embedded: "1", container: "true", layout });
    }, [entryUrl, locale, theme, layout]);

    useEffect(() => {
        if (!appInfo) {
            setError("App not found");
            return;
        }
        sdkRef.current = installMiniAppSDK({
            appId: appInfo.app_id,
            chainId: storeChainId || appInfo.supportedChains?.[0],
            permissions: appInfo.permissions,
            supportedChains: appInfo.supportedChains,
            chainContracts: appInfo.chainContracts,
            layout,
        });
    }, [appInfo, storeChainId, layout]);

    useEffect(() => {
        if (!iframeRef.current?.contentWindow || !sdkRef.current || !entryUrl) return;

        const origin = resolveIframeOrigin(entryUrl);
        if (!origin) return;

        const handleMessage = async (event: MessageEvent) => {
            if (event.source !== iframeRef.current?.contentWindow) return;
            if (event.origin !== origin) return;

            const data = event.data as Record<string, unknown> | null;
            if (!data || typeof data !== "object") return;

            if (data.type === "miniapp_ready") {
                setIsLoaded(true);
                const sdk = sdkRef.current;
                if (sdk?.getConfig) {
                    iframeRef.current.contentWindow?.postMessage(
                        { type: "miniapp_config", config: sdk.getConfig() },
                        origin
                    );
                }
                return;
            }

            if (data.type !== "miniapp_sdk_request") return;

            const id = String(data.id ?? "").trim();
            if (!id) return;

            try {
                const method = String(data.method ?? "").trim();
                const params = Array.isArray(data.params) ? data.params : [];
                const result = await dispatchBridgeCall(sdkRef.current, method, params);
                iframeRef.current.contentWindow?.postMessage({ type: "miniapp_sdk_response", id, ok: true, result }, origin);
            } catch (err) {
                iframeRef.current.contentWindow?.postMessage(
                    { type: "miniapp_sdk_response", id, ok: false, error: err instanceof Error ? err.message : "request failed" },
                    origin
                );
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [entryUrl, appInfo]);

    const handleClose = useCallback(() => {
        router.back();
    }, [router]);

    if (error) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-black">
                <div className="text-center text-white">
                    <div className="text-xl font-bold mb-2">Error</div>
                    <div className="text-gray-400">{error}</div>
                    <button onClick={handleClose} className="mt-4 px-4 py-2 bg-neo text-white rounded">Close</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black overflow-hidden">
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white via-[#f5f6ff] to-[#ffece4] dark:from-[#05060d] dark:via-[#090a14] dark:to-[#050a0d] z-10">
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full border-4 border-neo-purple/30 border-t-neo-purple animate-spin mb-4 mx-auto" />
                        <div className="text-xl font-bold text-neo-ink dark:text-white">Loading...</div>
                    </div>
                </div>
            )}
            <iframe
                ref={iframeRef}
                src={iframeSrc || undefined}
                className={`w-full h-full border-0 bg-white dark:bg-[#0a0f1a] transition-opacity duration-500 ${isLoaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setIsLoaded(true)}
                sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                title={`${appId} Container`}
                allowFullScreen
                referrerPolicy="no-referrer"
            />
        </div>
    );
}

async function dispatchBridgeCall(sdk: ReturnType<typeof installMiniAppSDK>, method: string, params: unknown[], _permissions?: Record<string, boolean>, _appId?: string) {
    const handler = (sdk as Record<string, unknown>)[method];
    if (typeof handler === "function") {
        return handler.apply(sdk, params);
    }
    throw new Error(`Unknown method: ${method}`);
}

type RequestLike = { headers?: Record<string, string | string[] | undefined> };

export const getServerSideProps: GetServerSideProps<ContainerPageProps> = async (context) => {
    const appId = context.query.appId as string;
    if (!appId) return { notFound: true };

    const baseUrl = resolveInternalBaseUrl((context.req as unknown as RequestLike) || undefined);

    try {
        const res = await fetch(`${baseUrl}/api/miniapp-stats?app_id=${encodeURIComponent(appId)}`);
        const payload = await res.json();
        const statsList = Array.isArray(payload?.stats) ? payload.stats : Array.isArray(payload) ? payload : payload ? [payload] : [];
        const raw = statsList.find((item: Record<string, unknown>) => item?.app_id === appId) ?? statsList[0];
        const app = raw || null;

        if (!app) return { notFound: true };
        return { props: { appId, app } };
    } catch {
        return { notFound: true };
    }
};
