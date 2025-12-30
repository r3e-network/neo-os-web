// =============================================================================
// Header Component
// =============================================================================

"use client";

import { useTranslation } from "../../../../shared/i18n/react";
import { LanguageToggle } from "../../../../shared/i18n/LanguageSwitcher";

export function Header() {
  const { t } = useTranslation("admin");

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t("dashboard.title")}</h2>
          <p className="text-sm text-gray-500">{t("dashboard.overview")}</p>
        </div>
        <div className="flex items-center gap-4">
          <LanguageToggle />
          <span className="text-sm text-gray-600">Local Development</span>
        </div>
      </div>
    </header>
  );
}
