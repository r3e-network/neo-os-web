"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { Search, Moon, Sun, Menu, X, Globe, User, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useI18n } from "@/lib/i18n/react";
import { useWalletStore } from "@/lib/wallet/store";
import { NotificationDropdown } from "@/components/features/notifications/NotificationDropdown";
import { useUser } from "@auth0/nextjs-auth0/client";

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
    <nav className="sticky top-0 z-50 w-full border-b-4 border-black bg-white">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="/logo-icon.png" alt="NeoHub" className="h-8 w-8 transition-transform group-hover:scale-110 border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" />
            <span className="text-xl font-black text-black tracking-tight">
              Neo<span className="text-[#00E599]">Hub</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-1.5 text-sm font-bold border-2 border-transparent transition-all",
                  router.pathname.startsWith(link.href)
                    ? "border-black bg-[#00E599] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    : "text-black hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-white",
                )}
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </div>
        </div>

        {/* Search Bar - Real-time search on keystroke */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black font-bold" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t("actions.search")}
              className="w-full h-10 pl-9 pr-4 text-sm font-bold border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white text-black placeholder-gray-500 focus:outline-none focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <button
            onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            className="p-2 border-2 border-black bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1"
            aria-label="Switch language"
          >
            <Globe size={18} />
            <span className="text-xs font-black">{locale === "en" ? "EN" : "中"}</span>
          </button>

          {/* Notification Dropdown */}
          <NotificationDropdown />

          {/* User Account / Login */}
          {authLoading ? (
            <div className="w-10 h-10 border-2 border-black rounded-none bg-gray-200 animate-pulse shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" />
          ) : user ? (
            <Link
              href="/account"
              className="flex items-center gap-2 p-1 border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
              title={user?.name || "Account"}
            >
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-8 h-8 border border-black" />
              ) : (
                <div className="w-8 h-8 bg-[#00E599] flex items-center justify-center border border-black">
                  <User size={16} className="text-black" />
                </div>
              )}
            </Link>
          ) : (
            <a
              href="/api/auth/login"
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold border-2 border-black bg-[#00E599] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-black hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">{t("actions.login") || "Login"}</span>
            </a>
          )}

          <ConnectButton />

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 border-2 border-black bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t-4 border-black bg-white px-4 py-3">
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black font-bold" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t("actions.search")}
                className="w-full h-9 pl-9 pr-4 text-sm font-bold border-2 border-black bg-white text-black placeholder-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none"
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
                  "px-3 py-2 text-sm font-bold border-2 border-transparent transition-all",
                  router.pathname.startsWith(link.href)
                    ? "border-black bg-[#00E599] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    : "text-black hover:border-black hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50",
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
