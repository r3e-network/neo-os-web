import Head from "next/head";
import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Layout } from "@/components/layout";
import { MiniAppLogo } from "@/components/features/miniapp/MiniAppLogo";
import type { MiniAppInfo } from "@/components/types";
import { isFlagshipMiniApp, sortMiniApps } from "@/lib/miniapp-showcase";

/* ── Color accents per flagship ──────────────────────────────────────── */

const flagshipAccents: Record<string, { gradient: string; text: string }> = {
  "miniapp-last-survivor": {
    gradient: "from-red-500 to-rose-600",
    text: "text-red-600",
  },
  "miniapp-fogplay": {
    gradient: "from-indigo-500 to-purple-600",
    text: "text-indigo-600",
  },
  "miniapp-gasbox": {
    gradient: "from-amber-400 to-orange-500",
    text: "text-amber-600",
  },
  "miniapp-redenvelope": {
    gradient: "from-red-400 to-pink-500",
    text: "text-red-500",
  },
  "miniapp-dailycheckin": {
    gradient: "from-emerald-400 to-teal-500",
    text: "text-emerald-600",
  },
  "miniapp-self-loan": {
    gradient: "from-blue-500 to-cyan-500",
    text: "text-blue-600",
  },
  "miniapp-profitanchor": {
    gradient: "from-emerald-500 to-lime-500",
    text: "text-emerald-600",
  },
  "miniapp-trustanchor": {
    gradient: "from-slate-600 to-teal-500",
    text: "text-teal-600",
  },
  "miniapp-neo-pay": {
    gradient: "from-green-400 to-emerald-500",
    text: "text-green-600",
  },
};
const defaultAccent = {
  gradient: "from-gray-400 to-gray-500",
  text: "text-gray-600",
};

/* ── Flagship card ───────────────────────────────────────────────────── */

function FlagshipCard({
  app,
  large = false,
}: {
  app: MiniAppInfo;
  large?: boolean;
}) {
  const accent = flagshipAccents[app.app_id] || defaultAccent;
  const live = Boolean(app.contract_hash);
  const statusLabel = live
    ? "Live"
    : app.status === "pending"
      ? "Pending"
      : "Source-ready";

  return (
    <Link
      href={`/miniapps/${app.app_id}`}
      className={`group relative flex flex-col rounded-2xl bg-white border border-gray-200/80 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${large ? "sm:flex-row col-span-full" : ""}`}
    >
      {/* Colored header band */}
      <div
        className={`relative bg-gradient-to-br ${accent.gradient} ${large ? "sm:w-2/5 min-h-[200px]" : "h-32"} flex items-center justify-center p-6`}
      >
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_50%,white,transparent_70%)]" />
        <MiniAppLogo
          appId={app.app_id}
          category={app.category}
          entryUrl={app.entry_url}
          logoUrl={app.logo_url}
          manifest={app.manifest || null}
          alt={app.name}
          size="lg"
          className={`relative drop-shadow-lg ${large ? "w-20 h-20" : "w-14 h-14"} rounded-2xl bg-white/20 backdrop-blur-sm p-2`}
        />
      </div>

      {/* Content */}
      <div
        className={`flex flex-col justify-center p-5 ${large ? "flex-1 py-8 px-8" : ""}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`flex items-center gap-1 text-[10px] font-bold uppercase ${live ? "text-emerald-600" : "text-amber-600"}`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {live && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
              )}
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-amber-500"}`}
              />
            </span>
            {statusLabel}
          </span>
          <span className="text-[10px] font-bold uppercase text-gray-300">
            |
          </span>
          <span className="text-[10px] font-bold uppercase text-gray-400">
            {app.category}
          </span>
        </div>
        <h3
          className={`font-bold text-gray-900 group-hover:${accent.text} transition-colors ${large ? "text-2xl" : "text-lg"}`}
        >
          {app.name}
        </h3>
        <p
          className={`mt-1.5 text-gray-500 leading-relaxed ${large ? "text-sm line-clamp-3 max-w-md" : "text-xs line-clamp-2"}`}
        >
          {app.description}
        </p>
        <div
          className={`mt-3 text-xs font-semibold ${accent.text} opacity-0 group-hover:opacity-100 transition-opacity`}
        >
          Open app &rarr;
        </div>
      </div>
    </Link>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function MiniAppsPage() {
  const [allApps, setAllApps] = useState<MiniAppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetch("/api/miniapps/catalog", { signal: AbortSignal.timeout(30000) })
      .then((r) => r.json())
      .then((data) => {
        if (!mountedRef.current) return;
        if (!data) {
          setFetchError(true);
          return;
        }
        setAllApps(
          Array.isArray(data.apps)
            ? sortMiniApps(data.apps as MiniAppInfo[], "featured")
            : [],
        );
      })
      .catch(() => {
        if (mountedRef.current) setFetchError(true);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const flagships = useMemo(
    () =>
      sortMiniApps(
        allApps.filter((a) => isFlagshipMiniApp(a.app_id)),
        "featured",
      ),
    [allApps],
  );

  const hero = flagships[0];
  const rest = flagships.slice(1);

  return (
    <Layout>
      <Head>
        <title>MiniApps - R3E Network</title>
      </Head>

      <div className="min-h-screen bg-[#FAFBFC] pt-20">
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="bg-white border-b border-gray-100 px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-bold text-emerald-700 uppercase">
                Neo N3 Mainnet
              </span>
            </div>
            <h1 className="text-3xl font-black text-gray-900 sm:text-5xl">
              Flagship MiniApps
            </h1>
            <p className="mt-4 mx-auto max-w-lg text-base text-gray-500 leading-relaxed">
              Nine flagship miniapps with production workflows. Pick one and
              start using it.
            </p>
          </div>
        </section>

        {fetchError && (
          <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
            >
              Failed to load. Please try again.
            </p>
          </div>
        )}

        {/* ── Flagships ─────────────────────────────────────────────── */}
        <section className="px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-5xl">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 9 }, (_, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl bg-white border border-gray-200 ${i === 0 ? "col-span-full h-52" : "h-44"}`}
                  >
                    <div className="animate-pulse h-full rounded-2xl bg-gray-50" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {hero && <FlagshipCard app={hero} large />}
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
