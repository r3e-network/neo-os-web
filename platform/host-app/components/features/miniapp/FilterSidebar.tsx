"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <aside className="w-72 flex-shrink-0 border-r border-gray-200/50 dark:border-white/5 bg-white/60 dark:bg-[#0A0B10]/60 backdrop-blur-xl overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo glass-panel" tabIndex={0}>
      <div className="p-6">
        <h2 className="text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
          Filters
          <div className="h-px bg-gray-200 dark:bg-white/10 flex-1" />
        </h2>

        {sections.map((section) => (
          <div key={section.id} className="mb-6">
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              aria-expanded={expanded[section.id]}
              className="flex items-center justify-between w-full text-left py-2 mb-2 text-sm font-bold text-gray-900 dark:text-white hover:text-neo dark:hover:text-neo transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
            >
              {section.label}
              <div className="p-1 rounded-md bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400">
                {expanded[section.id] ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
              </div>
            </button>

            <div
              className={cn(
                "grid transition-all duration-300 ease-in-out",
                expanded[section.id] ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden space-y-1.5 pt-1">
                {section.options.map((option) => {
                  const isSelected = (selected[section.id] || []).includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-all duration-300 group border",
                        isSelected
                          ? "bg-neo/10 dark:bg-neo/20 text-neo font-bold border-neo/30 shadow-[inset_0_0_10px_rgba(0,229,153,0.1)]"
                          : "border-transparent text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOption(section.id, option.value)}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <div className={cn(
                          "w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors shrink-0",
                          isSelected ? "bg-neo border-neo text-gray-900" : "border-gray-300 dark:border-gray-600 group-hover:border-neo/50"
                        )}>
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                        <span className="flex-1 truncate">{option.label}</span>
                      </div>
                      {option.count !== undefined && (
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium transition-colors",
                          isSelected ? "bg-neo/20 text-neo" : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 group-hover:text-gray-300"
                        )}>
                          {option.count}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
