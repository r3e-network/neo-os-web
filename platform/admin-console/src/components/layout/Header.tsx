// =============================================================================
// Header Component — Neo v3
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
import { AdminNavIcon } from "./AdminNavIcon";
import { useTranslation } from "../../../../shared/i18n/react";
import { LanguageToggle } from "../../../../shared/i18n/LanguageSwitcher";

const ADMIN_ROUTE_CONTEXT: Record<string, string> = {
  "/": "Monitor and manage your MiniApp platform",
  "/analytics": "Usage and adoption signals",
  "/contracts": "Mainnet contract readiness",
  "/miniapps": "Registry and publish control",
  "/oracle-secrets": "Oracle credential operations",
  "/pricefeeds": "Oracle feed health",
  "/services": "Service health and configuration",
  "/settings": "Platform configuration",
  "/simulations": "Scenario runner",
  "/templates": "Template Studio",
  "/users": "User operations",
};

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return href === "/";
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const pathname = usePathname();
  const [envLabel] = useState<string>(
    () =>
      process.env.NEXT_PUBLIC_ENV_LABEL ||
      (process.env.NODE_ENV === "production" ? "Production" : "Local Development"),
  );

  const mobileNavigation = ADMIN_NAVIGATION_ITEMS.map((item) => ({
    ...item,
    name: resolveAdminNavigationLabel(item, tc),
  }));
  const activeNavigationItem =
    mobileNavigation.find((item) => isActivePath(pathname, item.href)) ??
    mobileNavigation[0];
  const sectionTitle =
    activeNavigationItem?.href === "/"
      ? t("dashboard.title")
      : activeNavigationItem?.name || t("dashboard.title");
  const sectionContext =
    ADMIN_ROUTE_CONTEXT[activeNavigationItem?.href ?? "/"] ||
    t("dashboard.overview");

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black tracking-tight text-ink sm:text-base">
            {sectionTitle}
          </h2>
          <p className="hidden text-xs font-medium text-ink-muted sm:block">
            {sectionContext}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <LanguageToggle />
          <span className="hidden items-center gap-1.5 rounded-full border border-neo-200 bg-neo-50 px-2.5 py-1 text-[11px] font-bold text-neo-700 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-neo-500 animate-pulse-dot" />
            {envLabel}
          </span>
        </div>
      </div>

      {/* Mobile navigation */}
      <nav aria-label="Mobile admin navigation" className="border-t border-border px-3 pb-3 md:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {mobileNavigation.map((item) => {
            const isActive = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo-500/40",
                  isActive
                    ? "border-neo-200 bg-neo-50 text-neo-700"
                    : "border-border bg-surface text-ink-secondary hover:bg-canvas-alt hover:text-ink",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <AdminNavIcon
                  active={isActive}
                  className="h-6 w-6 rounded-lg border-0 bg-transparent shadow-none"
                  icon={item.iconKey}
                  testIdPrefix="admin-mobile-nav-icon"
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
