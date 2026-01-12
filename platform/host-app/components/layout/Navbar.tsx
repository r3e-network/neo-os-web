"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { Search, Moon, Sun, Menu, X, Globe, User, LogIn, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useI18n } from "@/lib/i18n/react";
import { useWalletStore } from "@/lib/wallet/store";
import { NotificationDropdown } from "@/components/features/notifications/NotificationDropdown";
import { useUser } from "@auth0/nextjs-auth0/client";

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
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const { address: walletAddress } = useWalletStore();
  const { user, isLoading: authLoading } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const handleLogoClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (router.pathname === "/" || router.pathname === "/home") {
        event.preventDefault();
        // Force scroll to absolute top immediately
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        // Then smooth scroll as backup
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
        });
      }
    },
    [router.pathname],
  );

  // Real-time search with debounce (300ms delay)
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);

      // Clear previous timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce the route change
      debounceRef.current = setTimeout(() => {
        if (value.trim()) {
          router.push(`/miniapps?q=${encodeURIComponent(value.trim())}`, undefined, { shallow: true });
        } else if (router.pathname === "/miniapps" && router.query.q) {
          // Clear search when input is empty
          router.push("/miniapps", undefined, { shallow: true });
        }
      }, 300);
    },
    [router],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Sync search query with URL on mount/route change
  useEffect(() => {
    const urlQuery = (router.query.q as string) || "";
    if (urlQuery !== searchQuery) {
      setSearchQuery(urlQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.q]);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#0b0c16]/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group" onClick={handleLogoClick}>
            <div className="relative">
              <div className="absolute inset-0 bg-erobo-purple/50 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <img
                src="/logo-icon.svg"
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

        {/* Search Bar - Real-time search on keystroke */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <div className="relative w-full group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-erobo-purple transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t("actions.search")}
              className="w-full h-10 pl-10 pr-4 text-sm bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-full focus:bg-white dark:focus:bg-black focus:border-erobo-purple/50 focus:ring-4 focus:ring-erobo-purple/10 transition-all outline-none text-erobo-ink dark:text-white placeholder-gray-500"
            />
          </div>
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

          {/* User Account / Login */}
          {authLoading ? (
            <div className="w-10 h-10 rounded-full bg-white/70 dark:bg-white/10 animate-pulse" />
          ) : user ? (
            <Link
              href="/account"
              className="flex items-center gap-2 p-1 rounded-full hover:bg-erobo-peach/30 dark:hover:bg-white/5 transition-all"
              title={user?.name || "Account"}
            >
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt=""
                  className="w-8 h-8 rounded-full border border-white/60 dark:border-white/10"
                />
              ) : (
                <div className="w-8 h-8 bg-erobo-purple/20 text-erobo-purple flex items-center justify-center rounded-full border border-erobo-purple/30">
                  <User size={16} />
                </div>
              )}
            </Link>
          ) : walletAddress ? (
            /* Wallet connected - show disabled social login */
            <div
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-white/60 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 text-gray-400 rounded-full cursor-not-allowed"
              title={t("wallet.socialDisabledWhenConnected") || "Social login disabled (wallet connected)"}
            >
              <LogIn size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">{t("actions.login") || "Login"}</span>
            </div>
          ) : (
            <a
              href="/api/auth/login"
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-erobo-ink text-white hover:brightness-110 transition-all rounded-full shadow-[0_18px_45px_rgba(27,27,47,0.35)] hover:shadow-[0_24px_60px_rgba(27,27,47,0.45)]"
            >
              <LogIn size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">{t("actions.login") || "Login"}</span>
            </a>
          )}

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
        <div className="md:hidden border-t border-white/60 dark:border-white/10 bg-white/90 dark:bg-[#0b0c16] px-4 py-4 shadow-lg">
          <div className="mb-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-erobo-purple transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t("actions.search")}
                className="w-full h-10 pl-10 pr-4 text-sm bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-full focus:bg-white dark:focus:bg-black focus:border-erobo-purple/50 focus:ring-4 focus:ring-erobo-purple/10 transition-all outline-none text-erobo-ink dark:text-white placeholder-gray-500"
              />
            </div>
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
