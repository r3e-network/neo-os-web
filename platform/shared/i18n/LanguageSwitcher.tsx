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
      {showLabel && <span className="text-sm text-gray-500">{t("language.language")}</span>}
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
        className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800"
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
      className={`px-3 py-1 text-sm border rounded hover:bg-gray-100 ${className}`}
      title="Switch Language"
    >
      {localeNames[locale]}
    </button>
  );
}
