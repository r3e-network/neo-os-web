"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/react";

interface FilterSection {
  id: string;
  label: string;
  options: { value: string; label: string; count?: number }[];
}

interface FilterSidebarProps {
  sections: FilterSection[];
  selected: Record<string, string[]>;
  onChange: (sectionId: string, values: string[]) => void;
  /** Mobile overlay mode */
  isOpen?: boolean;
  onClose?: () => void;
}

export function FilterSidebar({ sections, selected, onChange, isOpen, onClose }: FilterSidebarProps) {
  const { t } = useTranslation("host");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(sections.map((s) => [s.id, true])),
  );

  // Close mobile overlay on Escape
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, handleEscape]);

  const toggleSection = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleOption = (sectionId: string, value: string) => {
    const current = selected[sectionId] || [];
    const newValues = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange(sectionId, newValues);
  };

  const filterContent = (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/60 dark:border-erobo-purple/20">
        <h2 className="text-lg font-bold text-erobo-ink dark:text-white">{t("miniapps.filters.title")}</h2>
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X size={20} className="text-erobo-ink-soft dark:text-slate-400" />
          </button>
        )}
      </div>

      {sections.map((section) => (
        <div key={section.id} className="mb-6">
          <button
            onClick={() => toggleSection(section.id)}
            className="flex items-center justify-between w-full text-left py-2 text-sm font-semibold text-erobo-ink-soft dark:text-slate-300 hover:text-erobo-purple dark:hover:text-erobo-purple transition-colors"
          >
            {section.label}
            {expanded[section.id] ? (
              <ChevronDown size={18} className="text-erobo-ink-soft dark:text-slate-400" strokeWidth={2} />
            ) : (
              <ChevronRight size={18} className="text-erobo-ink-soft dark:text-slate-400" strokeWidth={2} />
            )}
          </button>

          {expanded[section.id] && (
            <div className="mt-2 space-y-1.5">
              {section.options.map((option) => {
                const isSelected = (selected[section.id] || []).includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex items-center justify-between gap-3 px-3 py-2 rounded-xl cursor-pointer text-sm transition-all border",
                      isSelected
                        ? "bg-erobo-purple/10 text-erobo-purple border-erobo-purple/30"
                        : "bg-white/70 dark:bg-white/5 text-erobo-ink-soft dark:text-slate-400 border-white/60 dark:border-erobo-purple/10 hover:bg-erobo-peach/30 dark:hover:bg-white/10 hover:text-erobo-ink dark:hover:text-white",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOption(section.id, option.value)}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                          isSelected
                            ? "border-erobo-purple bg-erobo-purple text-white"
                            : "border-erobo-purple/30 dark:border-erobo-purple/30 bg-transparent",
                        )}
                      >
                        {isSelected && <Check size={10} strokeWidth={3} />}
                      </div>
                      <span className="truncate">{option.label}</span>
                    </div>
                    {option.count !== undefined && (
                      <span className="text-xs font-mono text-erobo-ink-soft/60">{option.count}</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Desktop: static sidebar */}
      <aside className="hidden lg:block w-72 flex-shrink-0 border-r border-white/60 dark:border-erobo-purple/10 bg-white/70 dark:bg-erobo-bg-dark/80 backdrop-blur-xl overflow-y-auto min-h-screen">
        {filterContent}
      </aside>

      {/* Mobile: slide-over overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white/95 dark:bg-erobo-bg-dark/95 backdrop-blur-xl border-r border-white/60 dark:border-erobo-purple/10 overflow-y-auto animate-in slide-in-from-left duration-200">
            {filterContent}
          </aside>
        </div>
      )}
    </>
  );
}
