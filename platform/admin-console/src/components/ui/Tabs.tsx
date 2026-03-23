"use client";

interface Tab { label: string; value: string }

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (v: string) => void;
  "aria-label"?: string;
}

export function Tabs({ tabs, value, onChange, "aria-label": ariaLabel = "Tab navigation" }: TabsProps) {
  const activeIndex = tabs.findIndex((t) => t.value === value);

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    let nextIdx = idx;
    if (e.key === "ArrowRight") {
      nextIdx = (idx + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      nextIdx = (idx - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = tabs.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    onChange(tabs[nextIdx].value);
  }

  return (
    <div role="tablist" aria-label={ariaLabel} className="flex border-b border-gray-200 dark:border-gray-700 gap-0">
      {tabs.map((t, idx) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/50 focus-visible:ring-offset-1 ${
            value === t.value
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
