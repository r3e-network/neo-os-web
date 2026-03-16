"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { Search, Moon, Sun, Menu, X, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useI18n } from "@/lib/i18n/react";
import { useWalletStore } from "@/lib/wallet/store";
import { NotificationDropdown } from "@/components/features/notifications/NotificationDropdown";

const ConnectButton = dynamic(() => import("@/components/features/wallet").then((m) => m.ConnectButton), {
  ssr: false,
});

const navLinks = [
  { href: "/miniapps", labelKey: "navigation.miniapps" },
  { href: "/docs", labelKey: "navigation.docs" },
  { href: "/developer", labelKey: "navigation.developer" },
];

export function Navbar() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const { address: walletAddress } = useWalletStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/miniapps?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-white/70 dark:bg-[#0A0B10]/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5 py-2 shadow-sm"
          : "bg-transparent py-4 border-transparent"
      )}
    >
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo transition-transform hover:scale-105">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#00E599] to-[#00A3FF] shadow-[0_0_15px_rgba(0,229,153,0.4)]">
              <span className="text-base font-black text-white">R3E</span>
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              R3E <span className="text-neo">Network</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <ul className="hidden md:flex items-center gap-1.5 p-1 bg-gray-100/50 dark:bg-[#12131C]/60 rounded-2xl border border-gray-200/50 dark:border-white/5">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={router.pathname.startsWith(link.href) ? "page" : undefined}
                  className={cn(
                    "px-4 py-1.5 text-sm font-semibold rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo",
                    router.pathname.startsWith(link.href)
                      ? "text-gray-900 dark:text-white bg-white dark:bg-[#20222D] shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5",
                  )}
                >
                  {t(link.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} role="search" className="hidden lg:flex flex-1 max-w-md mx-6">
          <div className="relative w-full group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400 group-focus-within:text-neo transition-colors" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("actions.search")}
              aria-label={t("actions.search")}
              className="w-full h-10 pl-10 pr-4 text-sm rounded-2xl border border-gray-200/80 dark:border-white/10 bg-gray-50/50 dark:bg-[#12131C]/80 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo hover:border-neo/30"
            />
          </div>
        </form>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-transparent hover:border-gray-200/50 dark:hover:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-white/5 transition-all cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Notification Bell */}
          <NotificationDropdown walletAddress={walletAddress} />

          {/* Language Switcher */}
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            className="px-3 py-2 rounded-xl border border-transparent hover:border-gray-200/50 dark:hover:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-white/5 transition-all cursor-pointer flex items-center gap-1.5"
            aria-label="Switch language"
          >
            <Globe size={18} aria-hidden="true" />
            <span className="text-sm font-semibold">{locale === "en" ? "EN" : "中"}</span>
          </button>

          <ConnectButton />

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-white/5 transition-all cursor-pointer"
            aria-label="Toggle navigation menu"
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
          className="md:hidden absolute top-full left-0 w-full border-b border-gray-200/50 dark:border-white/5 bg-white/95 dark:bg-[#0A0B10]/95 backdrop-blur-2xl px-4 py-4 shadow-xl"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <form onSubmit={handleSearch} role="search" className="mb-4">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400 group-focus-within:text-neo" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("actions.search")}
                aria-label={t("actions.search")}
                className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo"
              />
            </div>
          </form>
          <ul className="flex flex-col gap-1.5">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={router.pathname.startsWith(link.href) ? "page" : undefined}
                  className={cn(
                    "block px-4 py-3 text-sm font-semibold rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo",
                    router.pathname.startsWith(link.href)
                      ? "text-gray-900 dark:text-white bg-gray-100/80 dark:bg-white/10"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5",
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
