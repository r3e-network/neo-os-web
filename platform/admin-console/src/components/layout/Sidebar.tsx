// =============================================================================
// Sidebar Navigation Component
// =============================================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "@shared/i18n/react";
import { LayoutDashboard, Settings, Smartphone, Globe, Users, BarChart3, FileText } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation("common");
  const { t: ta } = useTranslation("admin");

  const navigation = [
    { name: t("navigation.dashboard"), href: "/", icon: LayoutDashboard },
    { name: t("navigation.services"), href: "/services", icon: Settings },
    { name: t("navigation.miniapps"), href: "/miniapps", icon: Smartphone },
    { name: ta("navigation.distributedApps"), href: "/admin/miniapps", icon: Globe },
    { name: t("navigation.users"), href: "/users", icon: Users },
    { name: t("navigation.analytics"), href: "/analytics", icon: BarChart3 },
    { name: t("navigation.contracts"), href: "/contracts", icon: FileText },
  ];

  return (
    <div className="flex h-screen w-64 flex-col bg-card">
      <div className="flex h-16 items-center px-6">
        <h1 className="text-xl font-bold text-white">{ta("dashboard.title")}</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-muted text-white" : "text-muted-foreground hover:bg-muted hover:text-white"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-border/20 border-t p-4">
        <p className="text-muted-foreground/60 text-xs">Neo MiniApp Platform</p>
        <p className="text-muted-foreground/40 text-xs">{process.env.NEXT_PUBLIC_APP_VERSION || "v0.1.0"}</p>
      </div>
    </div>
  );
}
