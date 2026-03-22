// =============================================================================
// Header Component
// =============================================================================

"use client";

import { useState } from "react";
import { useTranslation } from "../../../../shared/i18n/react";
import { LanguageToggle } from "../../../../shared/i18n/LanguageSwitcher";

export function Header() {
  const { t } = useTranslation("admin");
  const [envLabel] = useState<string>(
    () => process.env.NEXT_PUBLIC_ENV_LABEL || (process.env.NODE_ENV === "production" ? "Production" : "Local Development")
  );

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200/50 dark:border-white/10 bg-white/70 dark:bg-[#0A0B10]/80 backdrop-blur-2xl">
      <div className="flex h-16 items-center justify-between px-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t("dashboard.title")}</h2>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("dashboard.overview")}</p>
        </div>
        <div className="flex items-center gap-4">
          <LanguageToggle />
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-neo/10 text-neo border border-neo/20">
            {envLabel}
          </span>
        </div>
      </div>
    </header>
  );
}
