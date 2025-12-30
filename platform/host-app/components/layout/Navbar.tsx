"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { Search, Moon, Sun, Menu, X, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useI18n } from "../../../shared/i18n/react";
import { useWalletStore } from "@/lib/wallet/store";
import { NotificationDropdown } from "@/components/features/notifications/NotificationDropdown";

const ConnectButton = dynamic(() => import("@/components/features/wallet").then((m) => m.ConnectButton), {
  ssr: false,
});

const navLinks = [
  { href: "/miniapps", labelKey: "navigation.miniapps" },
  { href: "/stats", labelKey: "navigation.stats" },
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/miniapps?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
              <span className="text-sm font-bold text-white">N</span>
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              Neo<span className="text-emerald-500">Hub</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  router.pathname.startsWith(link.href)
                    ? "text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50",
                )}
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("actions.search")}
              className="w-full h-9 pl-9 pr-4 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </form>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Notification Bell */}
          <NotificationDropdown walletAddress={walletAddress} />

          {/* Language Switcher */}
          <button
            onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1"
            aria-label="Switch language"
          >
            <Globe size={18} />
            <span className="text-xs font-medium">{locale === "en" ? "EN" : "中"}</span>
          </button>

          <ConnectButton />

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3">
          <form onSubmit={handleSearch} className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("actions.search")}
                className="w-full h-9 pl-9 pr-4 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500"
              />
            </div>
          </form>
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md",
                  router.pathname.startsWith(link.href)
                    ? "text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800"
                    : "text-gray-600 dark:text-gray-400",
                )}
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
