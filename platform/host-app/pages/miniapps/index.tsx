import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Layout } from "@/components/layout";
import type { MiniAppInfo } from "@/components/types";
import { isFlagshipMiniApp, sortMiniApps } from "@/lib/miniapp-showcase";
import { resolveMiniAppSlug } from "@/lib/miniapp-media";

function FlagshipCard({ app, featured = false }: { app: MiniAppInfo; featured?: boolean }) {
  const slug = resolveMiniAppSlug(app.app_id, app.entry_url);
  const logoUrl = `/miniapp-assets/${slug}/logo.svg`;
  const bannerUrl = `/miniapp-assets/${slug}/banner.svg`;

  return (
    <Link
      href={`/miniapps/${app.app_id}`}
      className={`group relative block rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm transition-all duration-400 hover:shadow-lg hover:border-emerald-300 hover:-translate-y-1 ${featured ? "col-span-full lg:col-span-2 row-span-2" : ""}`}
    >
      {/* Banner */}
      <div className={`relative overflow-hidden bg-gray-50 ${featured ? "h-56 sm:h-72" : "h-40"}`}>
        <img
          src={bannerUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent" />

        {/* Category pill */}
        <div className="absolute top-4 right-4 z-10">
          <span className="rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">
            {app.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="relative px-5 pb-5 -mt-8 z-10">
        {/* Logo */}
        <div className={`mb-3 inline-flex rounded-xl border border-gray-200 bg-white p-1.5 shadow-md ${featured ? "w-14 h-14" : "w-11 h-11"}`}>
          <img
            src={logoUrl}
            alt={app.name}
            className="w-full h-full rounded-lg"
            loading="lazy"
            decoding="async"
          />
        </div>

        <h3 className={`font-bold text-gray-900 group-hover:text-emerald-600 transition-colors duration-300 truncate ${featured ? "text-2xl sm:text-3xl" : "text-lg"}`}>
          {app.name}
        </h3>

        <p className={`mt-1.5 text-gray-500 leading-relaxed ${featured ? "text-sm line-clamp-3" : "text-xs line-clamp-2"}`}>
          {app.description}
        </p>

        {/* Mainnet badge */}
        <div className="mt-3 flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Mainnet
          </span>
        </div>
      </div>
    </Link>
  );
}

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

  const hero = flagshipApps[0];
  const rest = flagshipApps.slice(1);

  return (
    <Layout>
      <Head>
        <title>MiniApps - R3E Network</title>
      </Head>

      <div className="min-h-screen bg-gray-50 pt-20">
        {/* Hero */}
        <section className="relative overflow-hidden bg-white border-b border-gray-100 px-4 py-14 sm:px-6 sm:py-20">
          <div className="relative mx-auto max-w-6xl">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-600">Neo N3 Mainnet</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Flagship MiniApps
            </h1>
            <p className="mt-4 max-w-xl text-base text-gray-500 leading-relaxed">
              Seven production applications with live smart contracts on Neo N3 mainnet.
            </p>
          </div>
        </section>

        {/* Apps */}
        <section className="px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            {fetchError && (
              <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                Failed to load apps. Please try again later.
              </p>
            )}

            {loading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 7 }, (_, i) => (
                  <div key={i} className={`rounded-2xl border border-gray-200 bg-white ${i === 0 ? "col-span-full lg:col-span-2 row-span-2 h-80" : "h-64"}`}>
                    <div className="animate-pulse h-full rounded-2xl bg-gray-100" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {hero && <FlagshipCard app={hero} featured />}
                {rest.map((app) => (
                  <FlagshipCard key={app.app_id} app={app} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
