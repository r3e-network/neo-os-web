import Head from "next/head";
import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Layout } from "@/components/layout";
import type { MiniAppInfo } from "@/components/types";
import { isFlagshipMiniApp, sortMiniApps } from "@/lib/miniapp-showcase";
import { resolveMiniAppSlug } from "@/lib/miniapp-media";

/* ── Flagship card (top section) ─────────────────────────────────────── */

function FlagshipCard({ app, featured = false }: { app: MiniAppInfo; featured?: boolean }) {
  const slug = resolveMiniAppSlug(app.app_id, app.entry_url);
  const logoUrl = `/miniapp-assets/${slug}/logo.svg`;
  const bannerUrl = `/miniapp-assets/${slug}/banner.svg`;

  return (
    <Link
      href={`/miniapps/${app.app_id}`}
      className={`group relative block rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm transition-all duration-400 hover:shadow-lg hover:border-emerald-300 hover:-translate-y-1 ${featured ? "col-span-full lg:col-span-2 row-span-2" : ""}`}
    >
      <div className={`relative overflow-hidden bg-gray-50 ${featured ? "h-56 sm:h-72" : "h-40"}`}>
        <img src={bannerUrl} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent" />
        <div className="absolute top-4 right-4 z-10">
          <span className="rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">{app.category}</span>
        </div>
      </div>
      <div className="relative px-5 pb-5 -mt-8 z-10">
        <div className={`mb-3 inline-flex rounded-xl border border-gray-200 bg-white p-1.5 shadow-md ${featured ? "w-14 h-14" : "w-11 h-11"}`}>
          <img src={logoUrl} alt={app.name} className="w-full h-full rounded-lg" loading="lazy" decoding="async" />
        </div>
        <h3 className={`font-bold text-gray-900 group-hover:text-emerald-600 transition-colors duration-300 truncate ${featured ? "text-2xl sm:text-3xl" : "text-lg"}`}>{app.name}</h3>
        <p className={`mt-1.5 text-gray-500 leading-relaxed ${featured ? "text-sm line-clamp-3" : "text-xs line-clamp-2"}`}>{app.description}</p>
        <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
          <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
          Mainnet
        </div>
      </div>
    </Link>
  );
}

/* ── Compact catalog row (bottom section) ────────────────────────────── */

const categoryColors: Record<string, string> = {
  gaming: "bg-purple-50 text-purple-700 border-purple-200",
  defi: "bg-blue-50 text-blue-700 border-blue-200",
  social: "bg-pink-50 text-pink-700 border-pink-200",
  governance: "bg-emerald-50 text-emerald-700 border-emerald-200",
  utility: "bg-gray-50 text-gray-600 border-gray-200",
  oracle: "bg-violet-50 text-violet-700 border-violet-200",
  console: "bg-indigo-50 text-indigo-700 border-indigo-200",
  nft: "bg-teal-50 text-teal-700 border-teal-200",
  data: "bg-cyan-50 text-cyan-700 border-cyan-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};

function CatalogRow({ app }: { app: MiniAppInfo }) {
  const slug = resolveMiniAppSlug(app.app_id, app.entry_url);
  const logoUrl = `/miniapp-assets/${slug}/logo.svg`;

  return (
    <Link
      href={`/miniapps/${app.app_id}`}
      className="group flex items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3 transition-all hover:border-emerald-200 hover:shadow-sm"
    >
      <div className="w-9 h-9 shrink-0 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
        <img src={logoUrl} alt={app.name} className="w-full h-full rounded-md" loading="lazy" decoding="async" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">{app.name}</h4>
        <p className="text-xs text-gray-400 truncate">{app.description}</p>
      </div>
      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${categoryColors[app.category] || categoryColors.other}`}>
        {app.category}
      </span>
    </Link>
  );
}

/* ── Category filter pills ───────────────────────────────────────────── */

const ALL_CATEGORIES = [
  { key: "all", label: "All" },
  { key: "defi", label: "DeFi" },
  { key: "gaming", label: "Gaming" },
  { key: "governance", label: "Governance" },
  { key: "oracle", label: "Oracle" },
  { key: "console", label: "Console" },
  { key: "social", label: "Social" },
  { key: "utility", label: "Utility" },
  { key: "other", label: "Other" },
];

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function MiniAppsPage() {
  const [allApps, setAllApps] = useState<MiniAppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetch("/api/miniapps/catalog", { signal: AbortSignal.timeout(30000) })
      .then((r) => r.json())
      .then((data) => {
        if (!mountedRef.current) return;
        if (!data) { setFetchError(true); return; }
        const list = Array.isArray(data.apps) ? sortMiniApps(data.apps as MiniAppInfo[], "featured") : [];
        setAllApps(list);
      })
      .catch(() => { if (mountedRef.current) setFetchError(true); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, []);

  const flagshipApps = useMemo(
    () => sortMiniApps(allApps.filter((app) => isFlagshipMiniApp(app.app_id)), "featured"),
    [allApps],
  );

  const catalogApps = useMemo(() => {
    const nonFlagship = allApps.filter((app) => !isFlagshipMiniApp(app.app_id));
    if (categoryFilter === "all") return nonFlagship;
    return nonFlagship.filter((app) => app.category === categoryFilter);
  }, [allApps, categoryFilter]);

  const hero = flagshipApps[0];
  const rest = flagshipApps.slice(1);

  return (
    <Layout>
      <Head>
        <title>MiniApps - R3E Network</title>
      </Head>

      <div className="min-h-screen bg-gray-50 pt-20">
        {/* ── Flagship Hero ─────────────────────────────────────────── */}
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

        {/* ── Flagship Grid ─────────────────────────────────────────── */}
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

        {/* ── All Apps Catalog ──────────────────────────────────────── */}
        <section className="border-t border-gray-200 bg-white px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-400">Full Catalog</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
                  All MiniApps
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  {catalogApps.length} app{catalogApps.length !== 1 ? "s" : ""} across DeFi, gaming, governance, oracle, and utility categories.
                </p>
              </div>
              <p className="text-xs font-semibold text-gray-400">
                {allApps.length} total
              </p>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-6">
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategoryFilter(cat.key)}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    categoryFilter === cat.key
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Compact List */}
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : catalogApps.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 py-12 text-center">
                <p className="text-sm font-medium text-gray-400">No apps in this category.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {catalogApps.map((app) => (
                  <CatalogRow key={app.app_id} app={app} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
