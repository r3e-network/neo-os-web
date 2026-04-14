import Head from "next/head";
import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Layout } from "@/components/layout";
import type { MiniAppInfo } from "@/components/types";
import { isFlagshipMiniApp, sortMiniApps } from "@/lib/miniapp-showcase";
import { resolveMiniAppSlug } from "@/lib/miniapp-media";

/* ── Color accents per flagship ──────────────────────────────────────── */

const flagshipAccents: Record<string, { gradient: string; glow: string; text: string }> = {
  "miniapp-last-survivor":  { gradient: "from-red-500 to-rose-600",    glow: "shadow-red-200",    text: "text-red-600" },
  "miniapp-fogplay":        { gradient: "from-indigo-500 to-purple-600", glow: "shadow-indigo-200", text: "text-indigo-600" },
  "miniapp-gasbox":         { gradient: "from-amber-400 to-orange-500", glow: "shadow-amber-200",  text: "text-amber-600" },
  "miniapp-redenvelope":    { gradient: "from-red-400 to-pink-500",    glow: "shadow-red-200",    text: "text-red-500" },
  "miniapp-dailycheckin":   { gradient: "from-emerald-400 to-teal-500", glow: "shadow-emerald-200", text: "text-emerald-600" },
  "miniapp-self-loan":      { gradient: "from-blue-500 to-cyan-500",   glow: "shadow-blue-200",   text: "text-blue-600" },
  "miniapp-neo-pay":        { gradient: "from-green-400 to-emerald-500", glow: "shadow-green-200", text: "text-green-600" },
};
const defaultAccent = { gradient: "from-gray-400 to-gray-500", glow: "shadow-gray-200", text: "text-gray-600" };

/* ── Flagship card ───────────────────────────────────────────────────── */

function FlagshipCard({ app, large = false }: { app: MiniAppInfo; large?: boolean }) {
  const slug = resolveMiniAppSlug(app.app_id, app.entry_url);
  const logoUrl = `/miniapp-assets/${slug}/logo.svg`;
  const accent = flagshipAccents[app.app_id] || defaultAccent;

  return (
    <Link
      href={`/miniapps/${app.app_id}`}
      className={`group relative flex flex-col rounded-2xl bg-white border border-gray-200/80 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:${accent.glow} ${large ? "sm:flex-row col-span-full" : ""}`}
    >
      {/* Colored header band */}
      <div className={`relative bg-gradient-to-br ${accent.gradient} ${large ? "sm:w-2/5 min-h-[200px]" : "h-32"} flex items-center justify-center p-6`}>
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_50%,white,transparent_70%)]" />
        <img
          src={logoUrl}
          alt={app.name}
          className={`relative drop-shadow-lg ${large ? "w-20 h-20" : "w-14 h-14"} rounded-2xl bg-white/20 backdrop-blur-sm p-2`}
          loading="lazy"
          decoding="async"
        />
      </div>

      {/* Content */}
      <div className={`flex flex-col justify-center p-5 ${large ? "flex-1 py-8 px-8" : ""}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
            Live
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">|</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{app.category}</span>
        </div>
        <h3 className={`font-bold text-gray-900 group-hover:${accent.text} transition-colors ${large ? "text-2xl" : "text-lg"}`}>{app.name}</h3>
        <p className={`mt-1.5 text-gray-500 leading-relaxed ${large ? "text-sm line-clamp-3 max-w-md" : "text-xs line-clamp-2"}`}>{app.description}</p>
        <div className={`mt-3 text-xs font-semibold ${accent.text} opacity-0 group-hover:opacity-100 transition-opacity`}>
          Open app &rarr;
        </div>
      </div>
    </Link>
  );
}

/* ── Category colors ─────────────────────────────────────────────────── */

const catBg: Record<string, string> = {
  gaming: "bg-purple-50 text-purple-700 border-purple-200",
  defi: "bg-blue-50 text-blue-700 border-blue-200",
  social: "bg-pink-50 text-pink-700 border-pink-200",
  governance: "bg-emerald-50 text-emerald-700 border-emerald-200",
  utility: "bg-gray-100 text-gray-600 border-gray-200",
  oracle: "bg-violet-50 text-violet-700 border-violet-200",
  console: "bg-indigo-50 text-indigo-700 border-indigo-200",
  nft: "bg-teal-50 text-teal-700 border-teal-200",
  data: "bg-cyan-50 text-cyan-700 border-cyan-200",
  other: "bg-gray-100 text-gray-600 border-gray-200",
};

const catGradient: Record<string, string> = {
  gaming: "from-purple-500 to-indigo-500",
  defi: "from-blue-500 to-cyan-500",
  social: "from-pink-500 to-rose-500",
  governance: "from-emerald-500 to-teal-500",
  utility: "from-gray-400 to-gray-500",
  oracle: "from-violet-500 to-purple-500",
  console: "from-indigo-500 to-blue-500",
  nft: "from-teal-500 to-emerald-500",
  data: "from-cyan-500 to-sky-500",
  other: "from-gray-400 to-gray-500",
};

/* ── Catalog mini-card ───────────────────────────────────────────────── */

function CatalogCard({ app }: { app: MiniAppInfo }) {
  const slug = resolveMiniAppSlug(app.app_id, app.entry_url);
  const logoUrl = `/miniapp-assets/${slug}/logo.svg`;
  const gradient = catGradient[app.category] || catGradient.other;

  return (
    <Link
      href={`/miniapps/${app.app_id}`}
      className="group flex items-center gap-3.5 rounded-xl border border-gray-200/80 bg-white p-3 transition-all hover:border-emerald-200 hover:shadow-md"
    >
      <div className={`w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br ${gradient} p-1.5 shadow-sm`}>
        <img src={logoUrl} alt="" className="w-full h-full rounded-md" loading="lazy" decoding="async" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">{app.name}</h4>
        <p className="text-[11px] text-gray-400 truncate">{app.description}</p>
      </div>
      <span className={`shrink-0 hidden sm:inline rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${catBg[app.category] || catBg.other}`}>
        {app.category}
      </span>
    </Link>
  );
}

/* ── Category filter pills ───────────────────────────────────────────── */

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "defi", label: "DeFi" },
  { key: "gaming", label: "Gaming" },
  { key: "governance", label: "Governance" },
  { key: "oracle", label: "Oracle" },
  { key: "console", label: "Console" },
  { key: "social", label: "Social" },
  { key: "utility", label: "Utility" },
];

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function MiniAppsPage() {
  const [allApps, setAllApps] = useState<MiniAppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [filter, setFilter] = useState("all");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetch("/api/miniapps/catalog", { signal: AbortSignal.timeout(30000) })
      .then((r) => r.json())
      .then((data) => {
        if (!mountedRef.current) return;
        if (!data) { setFetchError(true); return; }
        setAllApps(Array.isArray(data.apps) ? sortMiniApps(data.apps as MiniAppInfo[], "featured") : []);
      })
      .catch(() => { if (mountedRef.current) setFetchError(true); })
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, []);

  const flagships = useMemo(() => sortMiniApps(allApps.filter((a) => isFlagshipMiniApp(a.app_id)), "featured"), [allApps]);
  const catalog = useMemo(() => {
    const rest = allApps.filter((a) => !isFlagshipMiniApp(a.app_id));
    return filter === "all" ? rest : rest.filter((a) => a.category === filter);
  }, [allApps, filter]);

  return (
    <Layout>
      <Head><title>MiniApps - R3E Network</title></Head>

      <div className="min-h-screen bg-[#FAFBFC] pt-20">
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="bg-white border-b border-gray-100 px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 mb-6">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Neo N3 Mainnet</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 sm:text-5xl">
              Flagship MiniApps
            </h1>
            <p className="mt-4 mx-auto max-w-lg text-base text-gray-500 leading-relaxed">
              Seven production apps with live smart contracts. Pick one and start using it.
            </p>
          </div>
        </section>

        {fetchError && (
          <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">Failed to load. Please try again.</p>
          </div>
        )}

        {/* ── Flagships ─────────────────────────────────────────────── */}
        <section className="px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-5xl">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 7 }, (_, i) => (
                  <div key={i} className={`rounded-2xl bg-white border border-gray-200 ${i === 0 ? "col-span-full h-52" : "h-44"}`}>
                    <div className="animate-pulse h-full rounded-2xl bg-gray-50" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {flagships[0] && <FlagshipCard app={flagships[0]} large />}
                {flagships.slice(1).map((app) => (
                  <FlagshipCard key={app.app_id} app={app} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Catalog ───────────────────────────────────────────────── */}
        <section className="border-t border-gray-200 bg-white px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">All Apps</h2>
                <p className="text-xs text-gray-400 mt-0.5">{catalog.length} app{catalog.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setFilter(c.key)}
                    className={`cursor-pointer rounded-full px-3 py-1 text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      filter === c.key
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-16 rounded-xl bg-gray-50 animate-pulse" />)}
              </div>
            ) : catalog.length === 0 ? (
              <div className="rounded-xl border border-gray-100 bg-gray-50 py-10 text-center text-sm text-gray-400">No apps in this category.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {catalog.map((app) => <CatalogCard key={app.app_id} app={app} />)}
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
