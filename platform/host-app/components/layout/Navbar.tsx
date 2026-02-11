"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { Menu, X, Globe, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n/react";
import { useWalletStore } from "@/lib/wallet/store";
import { NotificationDropdown } from "@/components/features/notifications/NotificationDropdown";
import { SearchAutocomplete } from "@/components/features/search";

import { ThemeToggle } from "@/components/ui/ThemeToggle";

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
  const { locale, setLocale, t } = useI18n();
  const { address: walletAddress } = useWalletStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogoClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (router.pathname === "/" || router.pathname === "/home") {
        event.preventDefault();
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
        });
      }
    },
    [router.pathname],
  );

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/20 dark:border-white/5 bg-white/10 dark:bg-black/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/5">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group" onClick={handleLogoClick}>
            <div className="relative">
              <div className="absolute inset-0 bg-erobo-purple/50 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <img
                src="/logo.png"
                alt="NeoHub"
                className="relative h-8 w-8 transition-transform group-hover:scale-105"
              />
            </div>
            <span className="text-xl font-bold text-erobo-ink dark:text-white tracking-tight">
              Neo<span className="text-erobo-purple">Hub</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-full transition-all duration-200",
                  router.pathname.startsWith(link.href)
                    ? "bg-erobo-purple/10 text-erobo-purple"
                    : "text-erobo-ink-soft dark:text-gray-300 hover:text-erobo-ink dark:hover:text-white hover:bg-erobo-peach/30 dark:hover:bg-white/5",
                )}
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </div>
        </div>

        {/* Search Bar - Steam-style autocomplete */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <SearchAutocomplete className="w-full" />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Language Switcher */}
          <button
            onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            className="p-2 text-erobo-ink-soft dark:text-gray-300 hover:bg-erobo-peach/30 dark:hover:bg-white/5 rounded-full transition-all flex items-center gap-1"
            aria-label="Switch language"
          >
            <Globe size={18} strokeWidth={2.5} />
            <span className="text-xs font-bold">{locale === "en" ? "EN" : "中"}</span>
          </button>

          {/* Wishlist */}
          <Link
            href="/wishlist"
            className="p-2 text-erobo-ink-soft dark:text-gray-300 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
            aria-label="Wishlist"
          >
            <Heart size={18} strokeWidth={2.5} />
          </Link>

          {/* Notification Dropdown */}
          <NotificationDropdown />

          {/* Wallet Connect Button */}
          <ConnectButton />

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-erobo-ink-soft dark:text-gray-300 hover:bg-erobo-peach/30 dark:hover:bg-white/5 rounded-full transition-all"
          >
            {mobileMenuOpen ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/60 dark:border-white/10 bg-white/90 dark:bg-erobo-bg-dark px-4 py-4 shadow-lg">
          <div className="mb-4">
            <SearchAutocomplete className="w-full" />
          </div>
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "px-4 py-3 text-sm font-medium rounded-xl transition-all",
                  router.pathname.startsWith(link.href)
                    ? "bg-erobo-purple/10 text-erobo-purple"
                    : "text-erobo-ink-soft dark:text-gray-300 hover:bg-erobo-peach/30 dark:hover:bg-white/5",
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
