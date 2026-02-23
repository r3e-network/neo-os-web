// =============================================================================
// Sidebar Navigation Component
// =============================================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "../../../../shared/i18n/react";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation("common");
  const { t: ta } = useTranslation("admin");

  const navigation = [
    { name: t("navigation.dashboard"), href: "/", icon: "📊" },
    { name: t("navigation.services"), href: "/services", icon: "🔧" },
    { name: t("navigation.miniapps"), href: "/miniapps", icon: "📱" },
    { name: t("navigation.templateStudio"), href: "/templates", icon: "🧱" },
    { name: t("navigation.users"), href: "/users", icon: "👥" },
    { name: t("navigation.analytics"), href: "/analytics", icon: "📈" },
    { name: t("navigation.contracts"), href: "/contracts", icon: "📄" },
  ];

  return (
    <div className="flex h-screen w-64 flex-col bg-gray-900">
      <div className="flex h-16 items-center px-6">
        <h1 className="text-xl font-bold text-white">{ta("dashboard.title")}</h1>
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
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
                    isActive ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="text-lg" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-gray-800 p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">Neo MiniApp Platform</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">v0.1.0</p>
      </div>
    </div>
  );
}
