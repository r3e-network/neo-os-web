// =============================================================================
// Header Component
// =============================================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "../../../../shared/i18n/react";
import { LanguageToggle } from "../../../../shared/i18n/LanguageSwitcher";

export function Header() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const pathname = usePathname();
  const [envLabel] = useState<string>(
    () =>
      process.env.NEXT_PUBLIC_ENV_LABEL ||
      (process.env.NODE_ENV === "production"
        ? "Production"
        : "Local Development"),
  );

  const mobileNavigation = [
    { name: tc("navigation.dashboard"), href: "/", icon: "📊" },
    { name: tc("navigation.services"), href: "/services", icon: "🔧" },
    { name: tc("navigation.miniapps"), href: "/miniapps", icon: "📱" },
    { name: tc("navigation.templateStudio"), href: "/templates", icon: "🧱" },
    { name: tc("navigation.users"), href: "/users", icon: "👥" },
    { name: tc("navigation.analytics"), href: "/analytics", icon: "📈" },
    { name: tc("navigation.contracts"), href: "/contracts", icon: "📄" },
    { name: "Feeds", href: "/pricefeeds", icon: "📈" },
    { name: "Secrets", href: "/oracle-secrets", icon: "🔑" },
    { name: "Settings", href: "/settings", icon: "⚙️" },
  ];

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200/50 dark:border-white/10 bg-white/70 dark:bg-[#0A0B10]/80 backdrop-blur-2xl">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-gray-900 dark:text-white sm:text-lg">
            {t("dashboard.title")}
          </h2>
          <p className="hidden text-sm font-medium text-gray-500 dark:text-gray-400 sm:block">
            {t("dashboard.overview")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <LanguageToggle />
          <span className="hidden px-3 py-1 text-xs font-semibold rounded-full bg-neo/10 text-neo border border-neo/20 sm:inline-flex">
            {envLabel}
          </span>
        </div>
      </div>
      <nav
        aria-label="Mobile admin navigation"
        className="border-t border-white/5 px-3 pb-3 md:hidden"
      >
        <div className="flex gap-2 overflow-x-auto pb-1">
          {mobileNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo",
                  isActive
                    ? "border-neo/30 bg-neo/15 text-neo"
                    : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
