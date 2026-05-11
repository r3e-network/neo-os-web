"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { Search, Menu, X, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n/react";
import { useWalletStore } from "@/lib/wallet/store";
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

export function Navbar() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const { address: walletAddress } = useWalletStore();
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/miniapps?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <nav
      aria-label={t("navigation.main")}
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-white/80 backdrop-blur-xl border-b border-gray-200 py-2 shadow-sm"
          : "bg-white/60 backdrop-blur-md py-4 border-b border-transparent",
      )}
    >
      <div className="mx-auto flex min-w-0 max-w-[1600px] items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <div className="flex min-w-0 items-center gap-3 xl:gap-8">
          <Link
            href="/"
            prefetch={false}
            aria-label={t("navigation.home")}
            className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-transform hover:scale-105"
          >
            <img
              src="/brand/yiwu-mark.svg"
              alt=""
              aria-hidden="true"
              className="h-9 w-9 rounded-xl shadow-md"
            />
            <span className="truncate text-lg font-bold text-gray-900 sm:text-xl">
              {BRAND.name}{" "}
              <span className="hidden text-emerald-600 sm:inline">
                {t("navigation.miniapps")}
              </span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <ul className="hidden md:flex items-center gap-1.5 p-1 bg-gray-100/60 rounded-2xl border border-gray-200/60">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  prefetch={false}
                  aria-current={
                    router.pathname.startsWith(link.href) ? "page" : undefined
                  }
                  className={cn(
                    "px-4 py-1.5 text-sm font-semibold rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                    router.pathname.startsWith(link.href)
                      ? "text-gray-900 bg-white shadow-sm"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/60",
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
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("actions.search")}
              aria-label={t("actions.search")}
              className="w-full h-10 pl-10 pr-4 text-sm rounded-2xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder-gray-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 hover:border-emerald-300"
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
            className="px-2 py-2 rounded-xl border border-transparent hover:border-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 text-gray-600 hover:bg-gray-100/60 transition-all cursor-pointer flex items-center gap-1.5 sm:px-3"
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
            className="md:hidden p-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 text-gray-600 hover:bg-gray-100/60 transition-all cursor-pointer"
            aria-label={t("navigation.toggleMenu")}
            aria-haspopup="true"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className="md:hidden absolute top-full left-0 w-full border-b border-gray-200 bg-white/95 backdrop-blur-2xl px-4 py-4 shadow-xl"
          role="navigation"
          aria-label={t("navigation.mobile")}
        >
          <form onSubmit={handleSearch} role="search" className="mb-4">
            <div className="relative group">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-emerald-500"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("actions.search")}
                aria-label={t("actions.search")}
                className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
          </form>
          <ul className="flex flex-col gap-1.5">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  prefetch={false}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={
                    router.pathname.startsWith(link.href) ? "page" : undefined
                  }
                  className={cn(
                    "block px-4 py-3 text-sm font-semibold rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                    router.pathname.startsWith(link.href)
                      ? "text-gray-900 bg-gray-100"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
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
