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
    { name: t("navigation.simulations"), href: "/simulations", icon: "🤖" },
    { name: t("navigation.miniapps"), href: "/miniapps", icon: "📱" },
    { name: t("navigation.templateStudio"), href: "/templates", icon: "🧱" },
    { name: t("navigation.users"), href: "/users", icon: "👥" },
    { name: t("navigation.analytics"), href: "/analytics", icon: "📈" },
    { name: t("navigation.contracts"), href: "/contracts", icon: "📄" },
    { name: "Price Feeds", href: "/pricefeeds", icon: "📈" },
    { name: "Oracle Secrets", href: "/oracle-secrets", icon: "🔑" },
    { name: "Settings", href: "/settings", icon: "⚙️" },
  ];

  return (
    <div className="flex h-screen w-64 flex-col bg-[#05050A] border-r border-white/5 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-neo/5 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#7000FF]/5 blur-[80px] rounded-full pointer-events-none" />
      <div className="flex h-16 items-center px-6 relative z-10">
        <h1 className="text-xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 drop-shadow-sm">{ta("dashboard.title")}</h1>
      </div>
      <nav aria-label="Admin navigation" className="flex-1 px-4 py-6 relative z-10">
        <ul className="space-y-1.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo",
                    isActive 
                      ? "bg-neo/15 text-neo shadow-[inset_0_0_15px_rgba(0,229,153,0.1)] border border-neo/20" 
                      : "text-gray-400 hover:bg-white/5 hover:text-white border border-transparent",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className={cn("text-lg", isActive ? "drop-shadow-[0_0_8px_rgba(0,229,153,0.5)]" : "")} aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-white/5 p-5 bg-black/20 backdrop-blur-md relative z-10">
        <p className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-1">Neo Platform</p>
        <p className="text-xs text-gray-600 font-mono">v0.1.0-alpha</p>
      </div>
    </div>
  );
}
