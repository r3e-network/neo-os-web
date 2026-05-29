"use client";

interface Tab {
  label: string;
  value: string;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (v: string) => void;
  "aria-label"?: string;
}

export function Tabs({
  tabs,
  value,
  onChange,
  "aria-label": ariaLabel = "Tab navigation",
}: TabsProps) {
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
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1"
    >
      {tabs.map((t, idx) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/50 focus-visible:ring-offset-1 ${
            value === t.value
              ? "bg-gray-900 text-white shadow-sm"
              : "text-gray-600 hover:bg-white hover:text-gray-900"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
