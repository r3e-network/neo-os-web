"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
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
}

export function FilterSidebar({ sections, selected, onChange }: FilterSidebarProps) {
  const { t } = useTranslation("host");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(sections.map((s) => [s.id, true])),
  );

  const toggleSection = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleOption = (sectionId: string, value: string) => {
    const current = selected[sectionId] || [];
    const newValues = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange(sectionId, newValues);
  };

  return (
    <aside className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-erobo-purple/10 bg-white/80 dark:bg-[#080808]/80 backdrop-blur-xl overflow-y-auto min-h-screen">
      <div className="p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-200 dark:border-erobo-purple/20">
          {t("miniapps.filters.title")}
        </h2>

        {sections.map((section) => (
          <div key={section.id} className="mb-6">
            <button
              onClick={() => toggleSection(section.id)}
              className="flex items-center justify-between w-full text-left py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-neo dark:hover:text-neo transition-colors"
            >
              {section.label}
              {expanded[section.id] ? (
                <ChevronDown size={18} className="text-gray-500 dark:text-gray-400" strokeWidth={2} />
              ) : (
                <ChevronRight size={18} className="text-gray-500 dark:text-gray-400" strokeWidth={2} />
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
                        "flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm transition-all",
                        isSelected
                          ? "bg-erobo-purple/10 text-erobo-purple border border-erobo-purple/30"
                          : "bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-erobo-purple/10 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white",
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
                              : "border-gray-300 dark:border-erobo-purple/30 bg-transparent",
                          )}
                        >
                          {isSelected && <Check size={10} strokeWidth={3} />}
                        </div>
                        <span className="truncate">{option.label}</span>
                      </div>
                      {option.count !== undefined && (
                        <span className="text-xs font-mono text-gray-400">{option.count}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
