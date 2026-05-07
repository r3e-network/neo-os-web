import Head from "next/head";
import type { GetStaticProps } from "next";
import {
  useDeferredValue,
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowUpRight, Search, SlidersHorizontal } from "lucide-react";
import { Layout } from "@/components/layout";
import { MiniAppLogo } from "@/components/features/miniapp/MiniAppLogo";
import type { MiniAppInfo } from "@/components/types";
import { loadMiniAppDefinitions } from "@/lib/miniapp-definitions";
import {
  compactMiniAppManifestForCatalog,
  getMiniAppCatalogAvailability,
} from "@/lib/miniapp-catalog-view";
import { sortMiniApps } from "@/lib/miniapp-showcase";
import { getRpcNetwork } from "@/lib/rpc-helpers";
import { BRAND } from "@/lib/brand";

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

function getStatusFilterKey(app: MiniAppInfo, targetNetwork: string): string {
  const availability = getMiniAppCatalogAvailability(app, targetNetwork);
  return availability.tone === "unsupported"
    ? "other-network"
    : availability.tone;
}

/* ── Flagship card ───────────────────────────────────────────────────── */

function MiniAppListingCard({
  app,
  large = false,
  targetNetwork,
}: {
  app: MiniAppInfo;
  large?: boolean;
  targetNetwork: string;
}) {
  const accent = flagshipAccents[app.app_id] || defaultAccent;
  const availability = getMiniAppCatalogAvailability(app, targetNetwork);
  const statusClass =
    availability.tone === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : availability.tone === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : availability.tone === "unsupported"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-gray-200 bg-gray-50 text-gray-600";
  const statusDotClass =
    availability.tone === "live"
      ? "bg-emerald-500"
      : availability.tone === "pending"
        ? "bg-amber-500"
        : availability.tone === "unsupported"
          ? "bg-sky-500"
          : "bg-gray-400";

  return (
    <Link
      href={`/miniapps/${app.app_id}`}
      className={`group relative overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 hover:border-emerald-300 hover:shadow-md ${large ? "col-span-full" : ""}`}
    >
      <div
        className={`h-1.5 bg-gradient-to-r ${accent.gradient}`}
        aria-hidden="true"
      />

      <div className={`flex gap-4 p-4 ${large ? "sm:p-5" : ""}`}>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-1.5">
          <MiniAppLogo
            appId={app.app_id}
            category={app.category}
            entryUrl={app.entry_url}
            logoUrl={app.logo_url}
            manifest={app.manifest || null}
            alt={app.name}
            size="lg"
            className="h-full w-full rounded-lg"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass}`}
            >
              <span className="relative flex h-1.5 w-1.5">
                {availability.tone === "live" && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                )}
                <span
                  className={`relative inline-flex h-1.5 w-1.5 rounded-full ${statusDotClass}`}
                />
              </span>
              {availability.label}
            </span>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">
              {app.category}
            </span>
          </div>

          <div className="flex items-start justify-between gap-3">
            <h3
              className={`m-0 truncate font-bold text-gray-900 transition-colors group-hover:text-gray-950 ${large ? "text-xl" : "text-base"}`}
            >
              {app.name}
            </h3>
            <ArrowUpRight
              className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-emerald-600"
              aria-hidden="true"
            />
          </div>

          <p
            className={`mt-1.5 text-gray-500 leading-relaxed ${large ? "max-w-3xl text-sm line-clamp-2" : "text-xs line-clamp-2"}`}
          >
            {app.description}
          </p>

          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700">
            Open app
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

type MiniAppsPageProps = {
  initialApps?: MiniAppInfo[];
};

const EMPTY_INITIAL_APPS: MiniAppInfo[] = [];

function toSerializablePermissions(
  value: MiniAppInfo["permissions"] | null | undefined,
): MiniAppInfo["permissions"] {
  return JSON.parse(JSON.stringify(value ?? {})) as MiniAppInfo["permissions"];
}

function serializeMiniApps(apps: MiniAppInfo[]): MiniAppInfo[] {
  return apps.map((app) => ({
    app_id: app.app_id,
    name: app.name,
    description: app.description,
    icon: app.icon,
    logo_url: app.logo_url ?? null,
    banner_url: app.banner_url ?? null,
    category: app.category,
    entry_url: app.entry_url,
    contract_hash: app.contract_hash ?? null,
    status: app.status ?? null,
    source: app.source ?? "miniapp",
    permissions: toSerializablePermissions(app.permissions),
    manifest: compactMiniAppManifestForCatalog(app.manifest),
  }));
}

export const getStaticProps: GetStaticProps<MiniAppsPageProps> = async () => {
  const definitions = await loadMiniAppDefinitions();
  const initialApps = sortMiniApps(
    definitions.filter((app) => app.status !== "disabled"),
    "featured",
  );

  return {
    props: {
      initialApps: serializeMiniApps(initialApps),
    },
    revalidate: 60,
  };
};

export default function MiniAppsPage({
  initialApps = EMPTY_INITIAL_APPS,
}: MiniAppsPageProps = {}) {
  const router = useRouter();
  const sortedInitialApps = useMemo(
    () => sortMiniApps(initialApps, "featured"),
    [initialApps],
  );
  const hasInitialApps = sortedInitialApps.length > 0;
  const [allApps, setAllApps] = useState<MiniAppInfo[]>(sortedInitialApps);
  const [loading, setLoading] = useState(!hasInitialApps);
  const [fetchError, setFetchError] = useState(false);
  const mountedRef = useRef(true);
  const targetNetwork = getRpcNetwork();

  useEffect(() => {
    mountedRef.current = true;
    if (!hasInitialApps) setLoading(true);
    setFetchError(false);
    fetch("/api/miniapps/catalog?scope=all", {
      signal: AbortSignal.timeout(10_000),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Catalog request failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!mountedRef.current) return;
        if (!data) {
          if (!hasInitialApps) setFetchError(true);
          return;
        }
        const nextApps = Array.isArray(data.apps)
          ? sortMiniApps(data.apps as MiniAppInfo[], "featured")
          : [];
        if (nextApps.length > 0 || !hasInitialApps) setAllApps(nextApps);
        setFetchError(false);
      })
      .catch(() => {
        if (mountedRef.current && !hasInitialApps) {
          setFetchError(true);
        }
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, [hasInitialApps, targetNetwork]);

  useEffect(() => {
    if (!hasInitialApps) return;
    setAllApps((current) => (current.length > 0 ? current : sortedInitialApps));
  }, [hasInitialApps, sortedInitialApps]);

  const listedApps = useMemo(
    () =>
      sortMiniApps(
        allApps.filter((a) => a.status !== "disabled"),
        "featured",
      ),
    [allApps],
  );
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const routeQuery = typeof router.query.q === "string" ? router.query.q : "";
    setQuery(routeQuery);
  }, [router.query.q]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(listedApps.map((app) => app.category).filter(Boolean)),
      ).sort(),
    [listedApps],
  );
  const filteredApps = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return listedApps.filter((app) => {
      const statusLabel = getStatusFilterKey(app, targetNetwork);
      const matchesStatus =
        statusFilter === "all" || statusFilter === statusLabel;
      const matchesCategory =
        categoryFilter === "all" || app.category === categoryFilter;
      const matchesQuery =
        !normalizedQuery ||
        [app.name, app.app_id, app.description, app.category]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedQuery),
          );
      return matchesStatus && matchesCategory && matchesQuery;
    });
  }, [categoryFilter, listedApps, deferredQuery, statusFilter, targetNetwork]);

  const hero = filteredApps[0];
  const rest = filteredApps.slice(1);
  const networkLabel =
    targetNetwork === "testnet" ? "Neo N3 Testnet" : "Neo N3 Mainnet";

  return (
    <Layout>
      <Head>
        <title>MiniApps - {BRAND.productName}</title>
        <meta name="description" content={BRAND.description} />
      </Head>

      <div className="min-h-screen bg-[#f6f8fb] pt-20">
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="border-b border-gray-200 bg-white px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-xs font-bold uppercase text-emerald-700">
                    {networkLabel}
                  </span>
                </div>
                <h1 className="m-0 text-3xl font-black text-gray-900 sm:text-4xl">
                  Yiwu MiniApps
                </h1>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-gray-500">
                  Browse small, focused MiniApps for Neo N3. Pick one, open
                  the play area, and operate from the shared action console.
                </p>
              </div>

              <div className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm sm:min-w-[360px]">
                <label className="relative block">
                  <span className="sr-only">Search MiniApps</span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by name, category, app ID"
                    className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-neo focus:ring-2 focus:ring-neo/20"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <SlidersHorizontal
                    className="h-4 w-4 text-gray-400"
                    aria-hidden="true"
                  />
                  {[
                    ["all", "All"],
                    ["live", "Live"],
                    ["tool", "Tool"],
                    ["other-network", "Other network"],
                    ["pending", "Pending"],
                  ].map(([value, label]) => {
                    const active = statusFilter === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setStatusFilter(value)}
                        className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${
                          active
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-white text-gray-500 hover:text-gray-800"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
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

        {/* ── MiniApps ──────────────────────────────────────────────── */}
        <section className="px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="m-0 text-base font-bold text-gray-900">
                  Catalog
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {filteredApps.length} of {listedApps.length} MiniApps shown
                </p>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {["all", ...categories].map((category) => {
                  const active = categoryFilter === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setCategoryFilter(category)}
                      className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${
                        active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 bg-white text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 9 }, (_, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border border-gray-200 bg-white ${i === 0 ? "col-span-full h-32" : "h-36"}`}
                  >
                    <div className="h-full animate-pulse rounded-lg bg-gray-50" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {hero ? (
                  <>
                    <MiniAppListingCard app={hero} targetNetwork={targetNetwork} large />
                    {rest.map((app) => (
                      <MiniAppListingCard
                        key={app.app_id}
                        app={app}
                        targetNetwork={targetNetwork}
                      />
                    ))}
                  </>
                ) : (
                  <div className="col-span-full rounded-lg border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
                    No MiniApps match the current filters.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
