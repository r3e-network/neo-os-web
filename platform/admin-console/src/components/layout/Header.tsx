// =============================================================================
// Header Component
// =============================================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ADMIN_NAVIGATION_ITEMS,
  resolveAdminNavigationLabel,
} from "@/lib/admin-navigation";
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

  const mobileNavigation = ADMIN_NAVIGATION_ITEMS.map((item) => ({
    ...item,
    name: resolveAdminNavigationLabel(item, tc),
  }));

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-gray-900 sm:text-base">
            {t("dashboard.title")}
          </h2>
          <p className="hidden text-xs font-medium text-gray-500 sm:block">
            {t("dashboard.overview")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageToggle />
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {envLabel}
          </span>
        </div>
      </div>
      <nav
        aria-label="Mobile admin navigation"
        className="border-t border-gray-200 px-3 pb-3 md:hidden"
      >
        <div className="flex gap-2 overflow-x-auto pb-1">
          {mobileNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/40",
                  isActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900",
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
