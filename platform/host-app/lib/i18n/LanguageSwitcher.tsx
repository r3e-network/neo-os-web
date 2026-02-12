"use client";

import React from "react";
import { useI18n } from "./react";

interface LanguageSwitcherProps {
  className?: string;
  showLabel?: boolean;
}

export function LanguageSwitcher({ className = "", showLabel = true }: LanguageSwitcherProps) {
  const { locale, locales, localeNames, setLocale, t } = useI18n();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && <span className="text-sm text-erobo-ink-soft dark:text-slate-400">{t("language.language")}</span>}
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
        className="px-2 py-1 text-sm border rounded bg-white dark:bg-erobo-bg-card border-erobo-purple/20 dark:border-white/10 text-erobo-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-erobo-purple/40"
        aria-label={t("language.language")}
      >
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {localeNames[loc]}
          </option>
        ))}
      </select>
    </div>
  );
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, locales, localeNames, setLocale } = useI18n();

  const toggle = () => {
    const currentIndex = locales.indexOf(locale);
    const nextIndex = (currentIndex + 1) % locales.length;
    setLocale(locales[nextIndex]);
  };

  return (
    <button
      onClick={toggle}
      className={`px-3 py-1 text-sm border rounded border-erobo-purple/20 dark:border-white/10 text-erobo-ink dark:text-white hover:bg-erobo-purple/10 dark:hover:bg-white/10 transition-colors ${className}`}
      title="Switch Language"
    >
      {localeNames[locale]}
    </button>
  );
}
