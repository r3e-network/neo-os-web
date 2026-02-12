// =============================================================================
// Header Component
// =============================================================================

"use client";

import { useTranslation } from "@shared/i18n/react";
import { LanguageToggle } from "@shared/i18n/LanguageSwitcher";

export function Header() {
  const { t } = useTranslation("admin");

  return (
    <header className="border-border/20 sticky top-0 z-10 border-b bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("dashboard.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("dashboard.overview")}</p>
        </div>
        <div className="flex items-center gap-4">
          <LanguageToggle />
          <span className="text-muted-foreground text-sm">
            {process.env.NODE_ENV === "production" ? "Production" : "Local Development"}
          </span>
        </div>
      </div>
    </header>
  );
}
