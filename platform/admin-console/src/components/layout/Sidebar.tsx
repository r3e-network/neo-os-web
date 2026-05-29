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
import { AdminNavIcon } from "./AdminNavIcon";
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
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
      <div className="flex h-20 items-center gap-3 border-b border-gray-100 px-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-700">
          N
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-black text-gray-950">
            {ta("dashboard.title")}
          </h1>
          <p className="mt-0.5 text-[11px] font-semibold uppercase text-gray-500">
            Operator OS
          </p>
        </div>
      </div>
      <nav aria-label="Admin navigation" className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40",
                    isActive
                      ? "bg-emerald-50 text-emerald-700 shadow-sm"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-950",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <AdminNavIcon active={isActive} icon={item.iconKey} />
                  <span className="truncate">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-gray-200 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase text-gray-500">
          Neo Platform
        </p>
        <p className="mt-0.5 font-mono text-xs text-gray-400">v0.1.0-alpha</p>
      </div>
    </aside>
  );
}
