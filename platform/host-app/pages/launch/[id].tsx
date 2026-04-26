import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import { ExternalMiniAppFrame } from "../../components/ExternalMiniAppFrame";
import { LaunchDock } from "../../components/LaunchDock";
import { FederatedMiniApp } from "../../components/FederatedMiniApp";
import { WalletState, MiniAppInfo } from "../../components/types";

// Lazy-load chat component (only needed when user opens chat panel)
const LiveChat = dynamic(
  () =>
    import("../../components/features/chat").then((m) => ({
      default: m.LiveChat,
    })),
  {
    loading: () => <div className="h-64 animate-pulse bg-white/5 rounded-xl" />,
    ssr: false,
  },
);
import { coerceMiniAppInfo, parseFederatedEntryUrl } from "../../lib/miniapp";
import { isManifestMiniAppEntryUrl } from "../../lib/miniapp-entry-url";
import { logger } from "../../lib/logger";
import { resolveInternalBaseUrl } from "../../lib/edge";
import { loadBundledMiniAppById } from "../../lib/miniapp-definitions";
import { resolveMiniAppDetailConfig } from "../../lib/miniapp-template";
import { OperationPanel } from "../../components/OperationPanel";
import { DetailContentBlocks } from "../../components/features/miniapp/DetailContentBlocks";
import { isSharedModeApp } from "../../lib/chain";

/** NeoLine N3 wallet interface */
interface NeoLineN3Wallet {
  Init: new () => { getAccount: () => Promise<{ address: string }> };
}

interface WindowWithNeoLine extends Window {
  NEOLineN3?: NeoLineN3Wallet;
}

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

type LaunchPageProps = {
  app: MiniAppInfo;
};

export default function LaunchPage({ app }: LaunchPageProps) {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: "",
    provider: null,
  });
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isManifestMode = isManifestMiniAppEntryUrl(app.entry_url);
  const federated = isManifestMode
    ? null
    : parseFederatedEntryUrl(app.entry_url, app.app_id);
  const externalUrl = !isManifestMode && !federated ? app.entry_url : null;
  const runtimeLabel = isSharedModeApp(app)
    ? "Shared Runtime"
    : isManifestMode
      ? "Manifest Runtime"
      : federated
        ? "Federated Runtime"
        : "External Runtime";
  const mountedRef = useRef(true);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Network latency monitoring
  useEffect(() => {
    let active = true;
    const measureLatency = async () => {
      if (!active) return;
      try {
        const start = performance.now();
        await fetch("/api/health", {
          method: "HEAD",
          signal: AbortSignal.timeout(5000),
        });
        const end = performance.now();
        if (!active) return;
        setNetworkLatency(Math.round(end - start));
      } catch (e) {
        if (!active) return;
        console.warn(
          "[launch] network latency check failed:",
          e instanceof Error ? e.message : String(e),
        );
        setNetworkLatency(null);
      }
    };

    measureLatency();

    const interval = setInterval(measureLatency, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Wallet connection (same logic as index.tsx)
  useEffect(() => {
    const tryConnectWallet = async () => {
      try {
        const g = window as WindowWithNeoLine;
        if (g?.NEOLineN3) {
          const inst = new g.NEOLineN3.Init();
          const acc = await inst.getAccount();
          if (!mountedRef.current) return;
          setWallet({
            connected: true,
            address: acc.address,
            provider: "neoline",
          });
        }
      } catch (e) {
        console.warn(
          "[launch] NEOLineN3 auto-connect failed:",
          e instanceof Error ? e.message : String(e),
        );
      }
    };

    tryConnectWallet();
  }, []);

  const handleExit = useCallback(() => {
    // Return to app detail page
    router.push(`/miniapps/${app.app_id}`);
  }, [router, app.app_id]);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleExit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleExit]);

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/launch/${app.app_id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setToastMessage("Link copied!");
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) setToastMessage(null);
        }, 2000);
        logger.debug("Link copied:", url);
      })
      .catch((e) => {
        logger.error("Failed to copy link", e);
      });
  }, [app.app_id]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <Head>
        <title>{`${app.name} - R3E Network`}</title>
      </Head>
      <LaunchDock
        appName={app.name}
        appId={app.app_id}
        wallet={wallet}
        networkLatency={networkLatency}
        runtimeLabel={runtimeLabel}
        onExit={handleExit}
        onShare={handleShare}
      />
      {federated ? (
        <div className="absolute top-12 left-0 w-full h-[calc(100vh-48px)] overflow-auto">
          <FederatedMiniApp
            appId={federated.appId}
            view={federated.view}
            remote={federated.remote}
          />
        </div>
      ) : externalUrl ? (
        <div className="absolute top-12 left-0 w-full h-[calc(100vh-48px)] overflow-auto">
          <ExternalMiniAppFrame
            src={externalUrl}
            title={app.name}
            className="w-full h-[calc(100vh-48px)] overflow-hidden rounded-none border-0 shadow-none"
          />
        </div>
      ) : (
        <ManifestRuntime app={app} />
      )}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-neo/90 text-black px-6 py-3 rounded-lg font-semibold text-sm z-[60]"
        >
          {toastMessage}
        </div>
      )}

      {/* LiveChat for MiniApp */}
      <LiveChat
        appId={app.app_id}
        walletAddress={wallet.address}
        userName={
          wallet.address
            ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
            : undefined
        }
      />
    </div>
  );
}

function ManifestRuntime({ app }: { app: MiniAppInfo }) {
  const [invokeFeedback, setInvokeFeedback] = useState<string | null>(null);
  const config = resolveMiniAppDetailConfig({
    frontend_spec: app.manifest?.frontend_spec,
    page_template: app.manifest?.page_template,
    detail_template: app.manifest?.detail_template,
    operation_panel: app.manifest?.operation_panel,
    operations: app.manifest?.operations,
    manifest: app.manifest,
  });

  const template = config.detailTemplate;
  const operations = config.operations;
  const tabs = template?.tabs || [];
  const overviewTab =
    tabs.find((tab) => tab.type === "content") || tabs[0] || null;

  const onInvoke = useCallback(async () => {
    setInvokeFeedback(
      "Manifest runtime mode: operation schema loaded. Wallet invoke is disabled here.",
    );
  }, []);

  const panelOps = useMemo(() => {
    if (template?.operation_panel?.operations?.length)
      return template.operation_panel.operations;
    return operations;
  }, [operations, template?.operation_panel?.operations]);

  return (
    <div className="absolute top-12 left-0 w-full h-[calc(100vh-48px)] overflow-auto bg-black text-white">
      <div className="mx-auto max-w-5xl px-5 py-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase text-neo mb-1">Manifest Runtime</p>
          <h1 className="text-2xl font-bold mb-2">{app.name}</h1>
          <p className="text-sm text-white/70 mb-6">{app.description}</p>

          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <div className="rounded-xl border border-white/10 p-4 bg-black/20">
              <h2 className="text-sm font-semibold mb-2">Layout</h2>
              <p className="text-xs text-white/70">
                {template?.layout || "default"}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 p-4 bg-black/20">
              <h2 className="text-sm font-semibold mb-2">Operations</h2>
              <p className="text-xs text-white/70">{operations.length}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-xl border border-white/10 p-4 bg-black/20">
              <h3 className="text-sm font-semibold mb-2">
                {overviewTab?.label || "Overview"}
              </h3>
              {overviewTab?.blocks?.length ? (
                <DetailContentBlocks blocks={overviewTab.blocks} />
              ) : (
                <p className="text-xs text-white/70">
                  No content blocks configured.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-white/10 p-4 bg-black/20">
              <h3 className="text-sm font-semibold mb-2">
                {template?.operation_panel?.title || "Operations"}
              </h3>
              {template?.operation_panel?.subtitle && (
                <p className="text-xs text-white/60 mb-3">
                  {template.operation_panel.subtitle}
                </p>
              )}
              {panelOps.length ? (
                <OperationPanel
                  operations={panelOps}
                  onInvoke={onInvoke}
                  showTitle={false}
                />
              ) : (
                <p className="text-xs text-white/70">
                  No operation schema configured.
                </p>
              )}
              {invokeFeedback && (
                <p className="text-xs text-neo mt-3">{invokeFeedback}</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// SSR: Fetch app info from API or static catalog
export const getServerSideProps: GetServerSideProps<LaunchPageProps> = async (
  context,
) => {
  const { id } = context.params as { id: string };
  const fallback = await loadBundledMiniAppById(id);

  try {
    const baseUrl = resolveInternalBaseUrl(
      context.req as RequestLike | undefined,
    );
    const catalogRes = await fetch(
      `${baseUrl}/api/miniapps/catalog?app_id=${encodeURIComponent(id)}`,
      { signal: AbortSignal.timeout(10000) },
    );
    const catalogPayload = await catalogRes.json().catch((e: unknown) => {
      console.warn(
        "[launch] failed to parse catalog response:",
        e instanceof Error ? e.message : String(e),
      );
      return null;
    });
    const raw = catalogPayload?.app || null;
    const app =
      coerceMiniAppInfo(raw, fallback ?? undefined) ?? fallback ?? null;
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
