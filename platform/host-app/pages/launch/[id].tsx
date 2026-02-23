import React, { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { LaunchDock } from "../../components/LaunchDock";
import { FederatedMiniApp } from "../../components/FederatedMiniApp";
import { LiveChat } from "../../components/features/chat";
import { WalletState, MiniAppInfo } from "../../components/types";
import { coerceMiniAppInfo, parseFederatedEntryUrl } from "../../lib/miniapp";
import { logger } from "../../lib/logger";
import { resolveInternalBaseUrl } from "../../lib/edge";
import { getMiniApp } from "../../lib/miniapp-registry";
import { resolveMiniAppDetailConfig } from "../../lib/miniapp-template";
import { OperationPanel } from "../../components/OperationPanel";
import { DetailContentBlocks } from "../../components/features/miniapp/DetailContentBlocks";

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
  const [wallet, setWallet] = useState<WalletState>({ connected: false, address: "", provider: null });
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isManifestMode = app.entry_url.startsWith("mf://manifest?");
  const federated = isManifestMode ? null : parseFederatedEntryUrl(app.entry_url, app.app_id);

  // Network latency monitoring
  useEffect(() => {
    const measureLatency = async () => {
      try {
        const start = performance.now();
        // Ping a lightweight endpoint (using /api/health or Supabase REST endpoint)
        await fetch("/api/health", { method: "HEAD", signal: AbortSignal.timeout(5000) });
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
        setTimeout(() => setToastMessage(null), 2000);
        logger.debug("Link copied:", url);
      })
      .catch((e) => {
        logger.error("Failed to copy link", e);
      });
  }, [app.app_id]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <Head><title>{`${app.name} - R3E Network`}</title></Head>
      <LaunchDock
        appName={app.name}
        appId={app.app_id}
        wallet={wallet}
        networkLatency={networkLatency}
        onExit={handleExit}
        onShare={handleShare}
      />
      {federated ? (
        <div className="absolute top-12 left-0 w-screen h-[calc(100vh-48px)] overflow-auto">
          <FederatedMiniApp appId={federated.appId} view={federated.view} remote={federated.remote} />
        </div>
      ) : (
        <ManifestRuntime app={app} />
      )}
      {toastMessage && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-neo/90 text-black px-6 py-3 rounded-lg font-semibold text-sm z-[60]">{toastMessage}</div>}

      {/* LiveChat for MiniApp */}
      <LiveChat
        appId={app.app_id}
        walletAddress={wallet.address}
        userName={wallet.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : undefined}
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
  const overviewTab = tabs.find((tab) => tab.type === "content") || tabs[0] || null;

  const onInvoke = useCallback(async () => {
    setInvokeFeedback("Manifest runtime mode: operation schema loaded. Wallet invoke is disabled here.");
  }, []);

  const panelOps = useMemo(() => {
    if (template?.operation_panel?.operations?.length) return template.operation_panel.operations;
    return operations;
  }, [operations, template?.operation_panel?.operations]);

  return (
    <div className="absolute top-12 left-0 w-screen h-[calc(100vh-48px)] overflow-auto bg-black text-white">
      <div className="mx-auto max-w-5xl px-5 py-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-wider text-neo mb-1">Manifest Runtime</p>
          <h1 className="text-2xl font-bold mb-2">{app.name}</h1>
          <p className="text-sm text-white/70 mb-6">{app.description}</p>

          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <div className="rounded-xl border border-white/10 p-4 bg-black/20">
              <h2 className="text-sm font-semibold mb-2">Layout</h2>
              <p className="text-xs text-white/70">{template?.layout || "default"}</p>
            </div>
            <div className="rounded-xl border border-white/10 p-4 bg-black/20">
              <h2 className="text-sm font-semibold mb-2">Operations</h2>
              <p className="text-xs text-white/70">{operations.length}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-xl border border-white/10 p-4 bg-black/20">
              <h3 className="text-sm font-semibold mb-2">{overviewTab?.label || "Overview"}</h3>
              {overviewTab?.blocks?.length ? (
                <DetailContentBlocks blocks={overviewTab.blocks} />
              ) : (
                <p className="text-xs text-white/70">No content blocks configured.</p>
              )}
            </section>

            <section className="rounded-xl border border-white/10 p-4 bg-black/20">
              <h3 className="text-sm font-semibold mb-2">{template?.operation_panel?.title || "Operations"}</h3>
              {template?.operation_panel?.subtitle && (
                <p className="text-xs text-white/60 mb-3">{template.operation_panel.subtitle}</p>
              )}
              {panelOps.length ? (
                <OperationPanel
                  operations={panelOps}
                  onInvoke={onInvoke}
                  showTitle={false}
                />
              ) : (
                <p className="text-xs text-white/70">No operation schema configured.</p>
              )}
              {invokeFeedback && <p className="text-xs text-neo mt-3">{invokeFeedback}</p>}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// SSR: Fetch app info from API or static catalog
export const getServerSideProps: GetServerSideProps<LaunchPageProps> = async (context) => {
  const { id } = context.params as { id: string };
  const fallback = getMiniApp(id);
  const baseUrl = resolveInternalBaseUrl(context.req as RequestLike | undefined);

  try {
    const catalogRes = await fetch(`${baseUrl}/api/miniapps/catalog?app_id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(10000) });
    const catalogPayload = await catalogRes.json().catch(() => null);
    const raw = catalogPayload?.app || null;
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
