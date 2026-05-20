// =============================================================================
// Sidebar Navigation Component
// =============================================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ADMIN_NAVIGATION_ITEMS,
  resolveAdminNavigationLabel,
} from "@/lib/admin-navigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "../../../../shared/i18n/react";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation("common");
  const { t: ta } = useTranslation("admin");

  const navigation = ADMIN_NAVIGATION_ITEMS.map((item) => ({
    ...item,
    name: resolveAdminNavigationLabel(item, t),
  }));

  return (
    <div className="hidden h-screen w-64 shrink-0 flex-col bg-white border-r border-gray-200 md:flex">
      <div className="flex h-16 items-center px-5">
        <h1 className="text-base font-bold text-gray-900">
          {ta("dashboard.title")}
        </h1>
      </div>
      <nav
        aria-label="Admin navigation"
        className="flex-1 px-3 py-4"
      >
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/40",
                    isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="text-base" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-gray-200 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Neo Platform
        </p>
        <p className="text-xs text-gray-400 font-mono mt-0.5">v0.1.0-alpha</p>
      </div>
    </div>
  );
}
