import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { MiniAppGrid } from "@/components/features/miniapp";
import type { MiniAppInfo } from "@/components/types";
import { Skeleton } from "@/components/ui/skeleton";
import { isFlagshipMiniApp, sortMiniApps } from "@/lib/miniapp-showcase";

export default function MiniAppsPage() {
  const [flagshipApps, setFlagshipApps] = useState<MiniAppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetch("/api/miniapps/catalog", { signal: AbortSignal.timeout(30000) })
      .then((r) => r.json())
      .then((data) => {
        if (!mountedRef.current) return;
        if (!data) { setFetchError(true); return; }
        const all = Array.isArray(data.apps) ? (data.apps as MiniAppInfo[]) : [];
        const flagships = sortMiniApps(all.filter((app) => isFlagshipMiniApp(app.app_id)), "featured");
        setFlagshipApps(flagships);
      })
      .catch(() => { if (mountedRef.current) setFetchError(true); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, []);

  return (
    <Layout>
      <Head>
        <title>MiniApps - R3E Network</title>
      </Head>

      <div className="pt-20">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-white/5 bg-[#05050A] px-4 py-16 sm:px-6 lg:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,229,153,0.08),transparent_60%)]" />
          <div className="relative mx-auto max-w-5xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#00E599]">Neo N3 MiniApps</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">
              Seven Flagship Apps
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-400">
              Production miniapps running on Neo N3 mainnet. Each one is a self-contained
              application with its own smart contract, UI, and on-chain state.
            </p>
          </div>
        </section>

        {/* Flagship Grid */}
        <section className="bg-[#05050A] px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-[1400px]">
            {fetchError && (
              <p role="alert" className="mb-6 text-center text-sm text-red-400">
                Failed to load apps. Please try again later.
              </p>
            )}

            {loading ? (
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 7 }, (_, i) => (
                  <div key={i} className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
                    <Skeleton className="h-44 w-full rounded-2xl bg-white/5 animate-pulse" />
                    <Skeleton className="h-6 w-3/4 rounded-lg bg-white/5 animate-pulse" />
                    <Skeleton className="h-4 w-1/2 rounded-lg bg-white/5 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <MiniAppGrid apps={flagshipApps} columns={3} />
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
