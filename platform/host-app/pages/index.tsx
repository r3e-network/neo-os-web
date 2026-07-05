import Head from "next/head";
import type { GetStaticProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Layout } from "@/components/layout";
import { MiniAppLogo } from "@/components/features/miniapp/MiniAppLogo";
import type { MiniAppInfo } from "@/components/types";
import {
  buildCategoryCounts,
  filterMiniAppsByCategory,
  partitionMiniApps,
  sortMiniApps,
} from "@/lib/miniapp-showcase";
import { loadMiniAppDefinitions } from "@/lib/miniapp-definitions";
import { serializeMiniAppsForCatalogProps } from "@/lib/miniapp-catalog-props";
import {
  getCategoryLabel,
  getLocalizedMiniAppDescription,
  getLocalizedMiniAppName,
  getNetworkLabel,
} from "@/lib/i18n/miniapp-display";
import type { Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/react";
import { getRpcNetwork } from "@/lib/rpc-helpers";
import { buildMiniAppDetailHref } from "@/lib/miniapp-routes";
import {
  buildMiniAppBannerSources,
  buildModernImageSources,
} from "@/lib/miniapp-media";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import {
  ArrowRight,
  ChevronRight,
  Code2,
  Coins,
  Database,
  Gamepad2,
  Image as ImageIcon,
  LayoutGrid,
  Search,
  Users,
  Vote,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import styles from "@/styles/home-sci-fi.module.css";

type HomeNetwork = "mainnet" | "testnet";

const EMPTY_INITIAL_APPS: MiniAppInfo[] = [];
const HOME_FEATURED_LIMIT = 6;
const HOME_DISCOVERY_LIMIT = 9;

const CATEGORY_CONFIG: Array<{
  id: "all" | MiniAppInfo["category"];
  icon: LucideIcon;
  swatch: string;
  dot: string;
  active: string;
}> = [
  {
    id: "all",
    icon: LayoutGrid,
    swatch: "bg-surface-secondary text-ink-secondary",
    dot: "bg-ink-muted",
    active: "border-ink bg-surface text-ink",
  },
  {
    id: "gaming",
    icon: Gamepad2,
    swatch: "bg-cat-game/10 text-cat-game",
    dot: "bg-cat-game",
    active: "border-cat-game bg-cat-game/10 text-ink",
  },
  {
    id: "defi",
    icon: Coins,
    swatch: "bg-cat-defi/10 text-cat-defi",
    dot: "bg-cat-defi",
    active: "border-cat-defi bg-cat-defi/10 text-ink",
  },
  {
    id: "social",
    icon: Users,
    swatch: "bg-cat-social/10 text-cat-social",
    dot: "bg-cat-social",
    active: "border-cat-social bg-cat-social/10 text-ink",
  },
  {
    id: "nft",
    icon: ImageIcon,
    swatch: "bg-cat-nft/10 text-cat-nft",
    dot: "bg-cat-nft",
    active: "border-cat-nft bg-cat-nft/10 text-ink",
  },
  {
    id: "governance",
    icon: Vote,
    swatch: "bg-cat-governance/10 text-cat-governance",
    dot: "bg-cat-governance",
    active: "border-cat-governance bg-cat-governance/10 text-ink",
  },
  {
    id: "utility",
    icon: Wrench,
    swatch: "bg-cat-tool/10 text-cat-tool",
    dot: "bg-cat-tool",
    active: "border-cat-tool bg-cat-tool/10 text-ink",
  },
  {
    id: "data",
    icon: Database,
    swatch: "bg-info-50 text-info-600",
    dot: "bg-info-500",
    active: "border-info-500 bg-info-50 text-ink",
  },
];

export type LandingPageProps = {
  initialApps?: MiniAppInfo[];
};

function readNetworkParam(value: string | string[] | undefined): HomeNetwork | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  return null;
}

function withNetworkQuery(href: string, network: HomeNetwork): string {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}network=${network}`;
}

function miniAppHref(app: MiniAppInfo, network: HomeNetwork): string {
  return buildMiniAppDetailHref(app.app_id, { network });
}

function getCategoryVisual(category: MiniAppInfo["category"]) {
  return CATEGORY_CONFIG.find((item) => item.id === category) || CATEGORY_CONFIG[0];
}

function isExpectedCatalogRefreshAbort(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name.toLowerCase();
  const message = err.message.toLowerCase();
  return (
    name === "aborterror" ||
    name === "timeouterror" ||
    message.includes("signal timed out") ||
    message.includes("operation was aborted")
  );
}

// ─── Scroll Reveal ──────────────────────────────────────────────────────────

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

// ─── Image/Banner Handling ──────────────────────────────────────────────────

function useBannerSource(app: MiniAppInfo | null) {
  const bannerSources = useMemo(
    () =>
      app
        ? buildMiniAppBannerSources({
            appID: app.app_id,
            entryURL: app.entry_url,
            bannerURL: app.banner_url,
            manifest: app.manifest || null,
          })
        : [],
    [app],
  );
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    setBannerIndex(0);
  }, [bannerSources]);

  const source = bannerSources[bannerIndex] || "";
  return {
    source,
    modernSources: buildModernImageSources(source),
    onError: () => {
      setBannerIndex((prev) =>
        prev + 1 < bannerSources.length ? prev + 1 : bannerSources.length,
      );
    },
  };
}

function AppArtwork({
  app,
  className,
  imageClassName,
}: {
  app: MiniAppInfo;
  className?: string;
  imageClassName?: string;
}) {
  const { source, modernSources, onError } = useBannerSource(app);

  return (
    <div
      className={cn(
        styles.artworkSurface,
        "relative overflow-hidden bg-surface-secondary",
        className,
      )}
    >
      {source ? (
        <picture className="block h-full w-full">
          {modernSources.avif && (
            <source srcSet={modernSources.avif} type="image/avif" />
          )}
          {modernSources.webp && (
            <source srcSet={modernSources.webp} type="image/webp" />
          )}
          <img
            src={source}
            alt={`${app.name} banner`}
            className={cn("h-full w-full object-cover", imageClassName)}
            loading="lazy"
            decoding="async"
            onError={onError}
          />
        </picture>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <MiniAppLogo
            appId={app.app_id}
            category={app.category}
            entryUrl={app.entry_url}
            logoUrl={app.logo_url}
            manifest={app.manifest || null}
            size="lg"
            alt={app.name}
          />
        </div>
      )}
      {source && (
        <span className={styles.artworkLogo} aria-hidden="true">
          <MiniAppLogo
            appId={app.app_id}
            category={app.category}
            entryUrl={app.entry_url}
            logoUrl={app.logo_url}
            manifest={app.manifest || null}
            size="lg"
            alt=""
          />
        </span>
      )}
    </div>
  );
}

// ─── Sci-Fi Featured Card ───────────────────────────────────────────────────

function FeatureCard({
  app,
  categoryLabel,
  locale,
  openLabel,
  targetNetwork,
  priority = false,
}: {
  app: MiniAppInfo;
  categoryLabel: string;
  locale: Locale;
  openLabel: string;
  targetNetwork: HomeNetwork;
  priority?: boolean;
}) {
  const appName = getLocalizedMiniAppName(app, locale);
  const appDescription = getLocalizedMiniAppDescription(app, locale) || app.description;

  return (
    <Link
      href={miniAppHref(app, targetNetwork)}
      className={cn(
        styles.featureCard,
        "group block text-left v4-focus",
        priority ? "lg:col-span-2" : "",
      )}
    >
      <AppArtwork
        app={app}
        className={cn(priority ? "h-64" : "h-44", "border-b border-border")}
        imageClassName="transition-transform duration-300 ease-out group-hover:scale-[1.03]"
      />
      <div className="p-6 relative">
        <div className="mb-4 flex items-center gap-3">
          <MiniAppLogo
            appId={app.app_id}
            category={app.category}
            entryUrl={app.entry_url}
            logoUrl={app.logo_url}
            manifest={app.manifest || null}
            size="md"
            alt=""
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold leading-snug text-ink">
              {appName}
            </p>
            <p className="text-sm text-ink-muted">
              {categoryLabel}
            </p>
          </div>
        </div>
        <p className="line-clamp-2 text-sm leading-6 text-ink-secondary">
          {appDescription}
        </p>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ink transition-colors group-hover:text-neo-600">
          {openLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

// ─── Sci-Fi Catalog Card ────────────────────────────────────────────────────

function CatalogCard({
  app,
  locale,
  targetNetwork,
  categoryLabel,
}: {
  app: MiniAppInfo;
  locale: Locale;
  targetNetwork: HomeNetwork;
  categoryLabel: string;
}) {
  const appName = getLocalizedMiniAppName(app, locale);
  const appDescription = getLocalizedMiniAppDescription(app, locale) || app.description;
  const categoryVisual = getCategoryVisual(app.category);

  return (
    <Link
      href={miniAppHref(app, targetNetwork)}
      className={cn(styles.catalogCard, "group text-left v4-focus")}
    >
      <div className={styles.catalogCardAccent} />
      <div className="flex items-start gap-3">
        <MiniAppLogo
          appId={app.app_id}
          category={app.category}
          entryUrl={app.entry_url}
          logoUrl={app.logo_url}
          manifest={app.manifest || null}
          size="md"
          alt=""
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold leading-snug text-ink">
            {appName}
          </h3>
          <p className="mt-1 truncate font-mono text-xs text-ink-muted">
            {app.app_id}
          </p>
        </div>
        <ArrowRight
          className="mt-1 h-4 w-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <p className="mt-4 line-clamp-2 flex-1 text-sm leading-6 text-ink-secondary">
        {appDescription}
      </p>
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <span
          className={cn("h-2 w-2 rounded-full", categoryVisual.dot)}
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-ink-muted">
          {categoryLabel}
        </span>
      </div>
    </Link>
  );
}

// ─── SSR ────────────────────────────────────────────────────────────────────

export const getStaticProps: GetStaticProps<LandingPageProps> = async () => {
  const definitions = await loadMiniAppDefinitions();
  const initialApps = sortMiniApps(
    definitions.filter((app) => app.status !== "disabled"),
    "featured",
  );

  return {
    props: {
      initialApps: serializeMiniAppsForCatalogProps(initialApps),
    },
    revalidate: 60,
  };
};

// ─── Main Landing Page ──────────────────────────────────────────────────────

export default function LandingPage({
  initialApps = EMPTY_INITIAL_APPS,
}: LandingPageProps = {}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"featured" | "recent" | "name">(
    "featured",
  );
  const [catalogLoading, setCatalogLoading] = useState(initialApps.length === 0);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [catalogApps, setCatalogApps] = useState<MiniAppInfo[]>(() =>
    sortMiniApps(initialApps, "featured"),
  );
  const [featuredApps, setFeaturedApps] = useState<MiniAppInfo[]>(() =>
    partitionMiniApps(initialApps).flagship,
  );
  const targetNetwork = useMemo(
    () => readNetworkParam(router.query.network) ?? getRpcNetwork(),
    [router.query.network],
  );
  const networkLabel = getNetworkLabel(targetNetwork, t);

  // Scroll reveal for sections
  const featuredReveal = useScrollReveal();
  const catalogReveal = useScrollReveal();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000);

    (async () => {
      try {
        const res = await fetch("/api/miniapps/catalog?scope=all", {
          signal: controller.signal,
        });
        if (!active || !res.ok) return;
        const data = await res.json();
        if (!active) return;
        const allApps = Array.isArray(data?.apps)
          ? sortMiniApps(data.apps as MiniAppInfo[], "featured")
          : [];
        setCatalogApps(allApps);
        setFeaturedApps(partitionMiniApps(allApps).flagship);
      } catch (err) {
        if (active && !isExpectedCatalogRefreshAbort(err)) {
          logger.error("Failed to fetch miniapp catalog:", err);
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (active) setCatalogLoading(false);
      }
    })();
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const categories = useMemo(() => {
    const counts = buildCategoryCounts(catalogApps);
    return CATEGORY_CONFIG.map((cfg) => ({
      ...cfg,
      label:
        cfg.id === "all"
          ? t("home.categories.all", "host")
          : getCategoryLabel(cfg.id, t),
      count: counts[cfg.id] || 0,
    })).filter((item) => item.id === "all" || item.count > 0);
  }, [catalogApps, t]);

  const filteredApps = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const filtered = filterMiniAppsByCategory(catalogApps, selectedCategory);
    return sortMiniApps(
      normalizedQuery
        ? filtered.filter((app) =>
            [
              app.name,
              getLocalizedMiniAppName(app, locale),
              app.app_id,
              app.description,
              getLocalizedMiniAppDescription(app, locale),
              app.category,
              getCategoryLabel(String(app.category), t),
            ]
              .filter(Boolean)
              .some((value) =>
                String(value).toLowerCase().includes(normalizedQuery),
              ),
          )
        : filtered,
      sortBy,
    );
  }, [selectedCategory, sortBy, catalogApps, deferredQuery, locale, t]);

  const featuredList =
    featuredApps.length > 0
      ? featuredApps
      : partitionMiniApps(initialApps).flagship;
  const heroApp = featuredList[0] || catalogApps[0] || initialApps[0] || null;
  const homepageFeaturedApps = featuredList
    .filter((app) => app.app_id !== heroApp?.app_id)
    .slice(0, HOME_FEATURED_LIMIT);
  const heroQuickApps = [heroApp, ...homepageFeaturedApps]
    .filter((app): app is MiniAppInfo => Boolean(app))
    .slice(0, 4);
  const highlightedAppIds = new Set(
    [heroApp, ...homepageFeaturedApps]
      .filter((app): app is MiniAppInfo => Boolean(app))
      .map((app) => app.app_id),
  );
  const discoveryApps = filteredApps.filter(
    (app) => !highlightedAppIds.has(app.app_id),
  );
  const catalogPreviewApps = discoveryApps.slice(0, HOME_DISCOVERY_LIMIT);
  const hiddenCatalogCount = Math.max(
    discoveryApps.length - catalogPreviewApps.length,
    0,
  );
  const fullCatalogHref = withNetworkQuery("/miniapps", targetNetwork);
  const hiddenCatalogText = t("home.catalog.moreCount", "host").replace(
    "{count}",
    hiddenCatalogCount.toLocaleString(locale),
  );

  return (
    <Layout>
      <Head>
        <title>{BRAND.title}</title>
        <meta name="description" content={BRAND.description} />
      </Head>

      <div className={styles.sciFiCanvas}>
        <section className={cn(styles.heroSection, "relative px-4 pt-24 sm:px-6 lg:pt-28 pb-10")}>
          <div className="mx-auto grid max-w-[1152px] gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center relative z-[1]">
            <div className="order-2 lg:order-1">
              <div className={cn(styles.staggerEnter, styles.stagger1)}>
                <div className={styles.glowBadge}>
                  <span className={styles.glowDot} aria-hidden="true" />
                  {networkLabel}
                </div>
              </div>

              <div className={cn(styles.staggerEnter, styles.stagger2)}>
                <h1 className={styles.heroTitle}>
                  {t("home.hero.title", "host")}
                </h1>
              </div>

              <div className={cn(styles.staggerEnter, styles.stagger3)}>
                <p className={styles.heroSubtitle}>
                  {t("home.hero.body", "host")}
                </p>
              </div>

              {heroQuickApps.length > 0 && (
                <div
                  className={cn(
                    styles.staggerEnter,
                    styles.stagger4,
                    styles.quickLaunchRail,
                  )}
                  aria-label="Featured MiniApps"
                >
                  {heroQuickApps.map((app) => (
                    <Link
                      key={app.app_id}
                      href={miniAppHref(app, targetNetwork)}
                      className={cn(styles.quickLaunchItem, "v4-focus")}
                    >
                      <MiniAppLogo
                        appId={app.app_id}
                        category={app.category}
                        entryUrl={app.entry_url}
                        logoUrl={app.logo_url}
                        manifest={app.manifest || null}
                        size="sm"
                        alt=""
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {getLocalizedMiniAppName(app, locale)}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}

              <div className={cn(styles.staggerEnter, styles.stagger5, "mt-6 flex flex-wrap gap-3")}>
                <Link
                  href={withNetworkQuery("/miniapps", targetNetwork)}
                  className={cn(styles.ctaPrimary, "v4-focus")}
                >
                  {t("home.hero.catalogCta", "host")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href={withNetworkQuery("/developer", targetNetwork)}
                  className={cn(styles.ctaGhost, "v4-focus")}
                >
                  <Code2 className="h-4 w-4" aria-hidden="true" />
                  {t("home.hero.developerCta", "host")}
                </Link>
              </div>
            </div>

            {heroApp && (
              <div className={cn(styles.staggerEnter, styles.stagger4, "order-1 lg:order-2")}>
                <div className={styles.card3D}>
                    <Link
                      href={miniAppHref(heroApp, targetNetwork)}
                      className="block v4-focus"
                    >
                      <AppArtwork
                        app={heroApp}
                        className="hidden aspect-[16/10] border-b border-border sm:block"
                        imageClassName="transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                      />
                      <div className="flex items-start gap-4 p-4 sm:p-6">
                        <MiniAppLogo
                          appId={heroApp.app_id}
                          category={heroApp.category}
                          entryUrl={heroApp.entry_url}
                          logoUrl={heroApp.logo_url}
                          manifest={heroApp.manifest || null}
                          size="lg"
                          alt=""
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink-muted">
                            {t("home.featured.eyebrow", "host")}
                          </p>
                          <h2 className="mt-1 truncate text-2xl font-semibold text-ink">
                            {getLocalizedMiniAppName(heroApp, locale)}
                          </h2>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-secondary">
                            {getLocalizedMiniAppDescription(heroApp, locale) ||
                              heroApp.description}
                          </p>
                        </div>
                        <ChevronRight
                          className="mt-2 h-5 w-5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </div>
                    </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="relative z-[1] px-4 pb-12 sm:px-6">
          <div className="mx-auto max-w-[1152px]">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div>
                <span className={styles.sectionEyebrow}>
                  {t("home.catalog.ecosystems", "host")}
                </span>
                <p className="mt-2 text-sm leading-6 text-ink-secondary max-w-[640px]">
                  {t("home.catalog.description", "host")}
                </p>
              </div>
              <Link
                href={withNetworkQuery("/miniapps", targetNetwork)}
                className="inline-flex items-center gap-1 text-sm font-semibold text-ink transition-colors hover:text-neo-600 v4-focus"
              >
                {t("actions.viewAll")}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              {categories.map((category) => {
                const Icon = category.icon;
                const selected = selectedCategory === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      styles.catPill,
                      selected && styles.catPillActive,
                      "v4-focus",
                    )}
                    aria-pressed={selected}
                  >
                    <span className={cn(styles.catPillIcon, !selected && category.swatch)}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">
                        {category.label}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {homepageFeaturedApps.length > 0 && (
          <section
            className="relative bg-canvas-alt px-4 py-16 sm:px-6 z-[1]"
            data-testid="homepage-featured-apps"
            ref={featuredReveal.ref}
          >
            <div className="mx-auto max-w-[1152px]">
              <div
                className={cn(
                  styles.revealOnScroll,
                  featuredReveal.visible && styles.revealVisible,
                  "mb-8",
                )}
              >
                <span className={styles.sectionEyebrow}>
                  {t("home.featured.eyebrow", "host")}
                </span>
                <h2 className={styles.sectionTitle}>
                  {t("home.featured.title", "host")}
                </h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {homepageFeaturedApps.map((app, index) => (
                  <div
                    key={app.app_id}
                    className={cn(
                      styles.revealOnScroll,
                      featuredReveal.visible && styles.revealVisible,
                      (styles as Record<string, string>)[`revealChild${index + 1}`],
                    )}
                  >
                    <FeatureCard
                      app={app}
                      categoryLabel={getCategoryLabel(String(app.category), t)}
                      locale={locale}
                      openLabel={t("catalog.openApp", "host")}
                      targetNetwork={targetNetwork}
                      priority={index === 0}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section
          className="relative px-4 py-16 sm:px-6 z-[1]"
          data-testid="homepage-catalog"
          ref={catalogReveal.ref}
        >
          <div className="mx-auto max-w-[1152px]">
            <div
              className={cn(
                styles.revealOnScroll,
                catalogReveal.visible && styles.revealVisible,
                "mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between",
              )}
            >
              <div>
                <span className={styles.sectionEyebrow}>
                  {t("home.catalog.previewEyebrow", "host")}
                </span>
                <h2 className={styles.sectionTitle}>
                  {t("home.catalog.previewTitle", "host")}
                </h2>
                <p className={styles.sectionDesc}>
                  {t("home.catalog.previewBody", "host")}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className={styles.sortBar}>
                  {(["featured", "recent", "name"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSortBy(option)}
                      className={cn(
                        styles.sortOption,
                        sortBy === option && styles.sortOptionActive,
                        "v4-focus",
                      )}
                    >
                      {t(`home.sort.${option}`, "host")}
                    </button>
                  ))}
                </div>

                <label className="relative block sm:w-72">
                  <span className="sr-only">
                    {t("catalog.searchLabel", "host")}
                  </span>
                  <Search
                    className={styles.searchIcon}
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    autoComplete="off"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("home.catalog.searchPlaceholder", "host")}
                    className={styles.searchInput}
                  />
                </label>
              </div>
            </div>

            {catalogLoading ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: HOME_DISCOVERY_LIMIT }, (_, index) => (
                  <div key={index} className={cn(styles.skeletonCard)} />
                ))}
              </div>
            ) : filteredApps.length > 0 ? (
              <>
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {catalogPreviewApps.map((app, index) => (
                    <div
                      key={app.app_id}
                      className={cn(
                        styles.revealOnScroll,
                        catalogReveal.visible && styles.revealVisible,
                        (styles as Record<string, string>)[`revealChild${Math.min(index + 1, 9)}`],
                      )}
                    >
                      <CatalogCard
                        app={app}
                        locale={locale}
                        targetNetwork={targetNetwork}
                        categoryLabel={getCategoryLabel(String(app.category), t)}
                      />
                    </div>
                  ))}
                </div>
                {hiddenCatalogCount > 0 && (
                  <div className={styles.catalogMore}>
                    <p className="m-0 text-sm leading-6 text-ink-secondary">
                      {hiddenCatalogText}
                    </p>
                    <Link
                      href={fullCatalogHref}
                      className={cn(styles.ctaGhost, "v4-focus")}
                    >
                      {t("home.catalog.previewCta", "host")}
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>
                  <LayoutGrid className="h-full w-full" aria-hidden="true" />
                </div>
                <p className={styles.emptyStateTitle}>
                  {t("home.catalog.emptyTitle", "host")}
                </p>
                <p className={styles.emptyStateBody}>
                  {t("home.catalog.emptyBody", "host")}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
