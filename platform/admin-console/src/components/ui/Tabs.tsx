"use client";

interface Tab { label: string; value: string }

export function Tabs({ tabs, value, onChange }: { tabs: Tab[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex border-b border-gray-200 dark:border-gray-700 gap-0">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600/50 ${
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
