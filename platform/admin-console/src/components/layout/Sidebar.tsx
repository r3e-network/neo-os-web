// =============================================================================
// Sidebar Navigation Component — Neo v3
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
import packageJson from "../../../package.json";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation("common");
  const { t: ta } = useTranslation("admin");

  const navigation = ADMIN_NAVIGATION_ITEMS.map((item) => ({
    ...item,
    name: resolveAdminNavigationLabel(item, t),
  }));

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      {/* Logo */}
      <div className="flex h-20 items-center gap-3 border-b border-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neo-500 text-sm font-black text-white shadow-brand-sm">
          N
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-black tracking-tight text-ink">
            {ta("dashboard.title")}
          </h1>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-neo-600">
            Admin Console
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo-500/40",
                    isActive
                      ? "bg-neo-50 text-neo-700"
                      : "text-ink-secondary hover:bg-canvas-alt hover:text-ink",
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

      {/* Footer */}
      <div className="border-t border-border px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          Neo Platform
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-ink-faint">v{packageJson.version}</p>
      </div>
    </aside>
  );
}
