"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { Search, Menu, X, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n/react";
import {
  selectConnectedWalletAddress,
  useWalletStore,
} from "@/lib/wallet/store";
import { BRAND } from "@/lib/brand";

const NotificationDropdown = dynamic(
  () =>
    import("@/components/features/notifications/NotificationDropdown").then(
      (m) => m.NotificationDropdown,
    ),
  { ssr: false },
);

const ConnectButton = dynamic(
  () => import("@/components/features/wallet").then((m) => m.ConnectButton),
  {
    ssr: false,
  },
);

const navLinks = [
  { href: "/miniapps", labelKey: "navigation.miniapps" },
  { href: "/docs", labelKey: "navigation.docs" },
  { href: "/developer", labelKey: "navigation.developer" },
];

function readNetworkQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  return "";
}

function withNetworkQuery(href: string, network: string): string {
  if (!network) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}network=${encodeURIComponent(network)}`;
}

export function Navbar() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  // Subscribe to the single field this component renders so the 60s balance
  // poll does not re-render the whole navbar (logo, nav links, search).
  const walletAddress = useWalletStore(selectConnectedWalletAddress);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const nextQuery = typeof router.query.q === "string" ? router.query.q : "";
    setSearchQuery(nextQuery);
  }, [router.query.q]);

  const networkQuery = readNetworkQuery(router.query.network);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(
        withNetworkQuery(`/miniapps?q=${encodeURIComponent(searchQuery)}`, networkQuery),
      );
    }
  };

  return (
    <nav
      aria-label={t("navigation.main")}
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-surface/80 backdrop-blur-xl border-b border-border py-2 shadow-sm"
          : "bg-surface/60 backdrop-blur-md py-4 border-b border-transparent",
      )}
    >
      <div className="mx-auto flex min-w-0 max-w-[1600px] items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <div className="flex min-w-0 items-center gap-3 xl:gap-8">
          <Link
            href={withNetworkQuery("/", networkQuery)}
            prefetch={false}
            aria-label={t("navigation.home")}
            className="flex min-w-0 items-center gap-2 rounded-lg transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo-500/40"
          >
            <img
              src="/brand/yiwu-mark.svg"
              alt=""
              aria-hidden="true"
              className="h-9 w-9 rounded-xl shadow-md"
            />
            <span className="truncate text-lg font-semibold text-ink sm:text-xl">
              {BRAND.name}{" "}
              <span className="hidden text-neo-600 sm:inline">
                {t("navigation.miniapps")}
              </span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <ul className="hidden items-center gap-1 rounded-xl border border-border bg-canvas-alt p-1 md:flex">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={withNetworkQuery(link.href, networkQuery)}
                  prefetch={false}
                  aria-current={
                    router.pathname.startsWith(link.href) ? "page" : undefined
                  }
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo-500/40",
                    router.pathname.startsWith(link.href)
                      ? "text-ink bg-surface shadow-sm"
                      : "text-ink-secondary hover:text-ink hover:bg-surface/60",
                  )}
                >
                  {t(link.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Search Bar */}
        <form
          onSubmit={handleSearch}
          role="search"
          className="hidden min-w-0 flex-1 max-w-[280px] mx-4 lg:flex 2xl:mx-6 2xl:max-w-md"
        >
          <div className="relative w-full group">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint group-focus-within:text-neo-500 transition-colors"
              aria-hidden="true"
            />
            <input
              id="navbar-search"
              name="q"
              type="search"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("actions.search")}
              aria-label={t("actions.search")}
              className="w-full h-10 pl-10 pr-4 text-sm rounded-2xl border border-border-strong bg-canvas-alt text-ink placeholder-ink-faint transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo-500/50 focus-visible:border-neo-400"
            />
          </div>
        </form>

        {/* Right Actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <NotificationDropdown walletAddress={walletAddress} />

          {/* Language Switcher */}
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            className="px-2 py-2 rounded-xl border border-transparent hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo-500/50 text-ink-secondary hover:bg-canvas-alt transition-all cursor-pointer flex items-center gap-1.5 sm:px-3"
            aria-label={t("language.switch")}
          >
            <Globe size={18} aria-hidden="true" />
            <span className="hidden text-sm font-semibold sm:inline">
              {locale === "en" ? "EN" : "中"}
            </span>
          </button>

          <ConnectButton />

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo-500/50 text-ink-secondary hover:bg-canvas-alt transition-all cursor-pointer"
            aria-label={t("navigation.toggleMenu")}
            aria-controls="mobile-nav-menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="md:hidden absolute top-full left-0 w-full border-b border-border bg-surface/95 backdrop-blur-2xl px-4 py-4 shadow-lg"
          role="navigation"
          aria-label={t("navigation.mobile")}
        >
          <form onSubmit={handleSearch} role="search" className="mb-4">
            <div className="relative group">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint group-focus-within:text-neo-500"
                aria-hidden="true"
              />
              <input
                id="mobile-search"
                name="q"
                type="search"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("actions.search")}
                aria-label={t("actions.search")}
                className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border border-border-strong bg-canvas-alt text-ink placeholder-ink-faint transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo-500/50 focus-visible:border-neo-400"
              />
            </div>
          </form>
          <ul className="flex flex-col gap-1.5">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={withNetworkQuery(link.href, networkQuery)}
                  prefetch={false}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={
                    router.pathname.startsWith(link.href) ? "page" : undefined
                  }
                  className={cn(
                    "block px-4 py-3 text-sm font-semibold rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo-500/50",
                    router.pathname.startsWith(link.href)
                      ? "text-ink bg-canvas-alt"
                      : "text-ink-secondary hover:text-ink hover:bg-canvas-alt",
                  )}
                >
                  {t(link.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
