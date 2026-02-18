"use client";

import { useState } from "react";

interface Tab { label: string; value: string }

export function Tabs({ tabs, value, onChange }: { tabs: Tab[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex border-b border-gray-200 gap-0">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            value === t.value
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
