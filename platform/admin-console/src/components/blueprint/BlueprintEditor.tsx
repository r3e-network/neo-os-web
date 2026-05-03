"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";

const LAYOUT_OPTIONS = [
  {
    value: "default",
    label: "Default",
    desc: "General overview + reviews + forum",
  },
  {
    value: "trading",
    label: "Trading",
    desc: "Polymarket style - left content, right operations",
  },
  { value: "voting", label: "Voting", desc: "Proposals + vote casting" },
  { value: "gaming", label: "Gaming", desc: "Leaderboard + gameplay" },
  { value: "info", label: "Info", desc: "Documentation + support" },
];

const TAB_TYPES = [
  { value: "content", label: "Content" },
  { value: "forum", label: "Forum" },
  { value: "reviews", label: "Reviews" },
  { value: "news", label: "News" },
  { value: "custom", label: "Custom" },
];

export type BlueprintConfig = {
  layout?: "default" | "trading" | "voting" | "gaming" | "info";
  hero?: {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    disclaimer?: string;
    image?: string;
  };
  tabs?: Array<{
    id: string;
    label: string;
    type: "content" | "forum" | "reviews" | "news" | "custom";
  }>;
  operation_panel?: {
    title?: string;
    subtitle?: string;
    cta_label?: string;
    position?: "right" | "bottom";
    collapsible?: boolean;
  };
  stats_display?: {
    items: Array<{
      key: string;
      label: string;
      format?: "number" | "currency" | "percent" | "date" | "duration";
    }>;
    refresh_interval?: number;
  };
};

type BlueprintEditorProps = {
  config: BlueprintConfig;
  onChange: (config: BlueprintConfig) => void;
};

export function BlueprintEditor({ config, onChange }: BlueprintEditorProps) {
  const [activeTab, setActiveTab] = useState("layout");

  const update = (updates: Partial<BlueprintConfig>) => {
    onChange({ ...config, ...updates });
  };

  const updateHero = (updates: Partial<BlueprintConfig["hero"]>) => {
    update({ hero: { ...config.hero, ...updates } });
  };

  const updateOpPanel = (
    updates: Partial<BlueprintConfig["operation_panel"]>,
  ) => {
    update({ operation_panel: { ...config.operation_panel, ...updates } });
  };

  const addTab = () => {
    const tabs = config.tabs || [];
    update({
      tabs: [
        ...tabs,
        { id: `tab-${tabs.length + 1}`, label: "New Tab", type: "content" },
      ],
    });
  };

  const removeTab = (index: number) => {
    const tabs = (config.tabs || []).filter((_, i) => i !== index);
    update({ tabs });
  };

  const updateTab = (
    index: number,
    updates: Partial<NonNullable<BlueprintConfig["tabs"]>[number]>,
  ) => {
    const tabs = [...(config.tabs || [])];
    tabs[index] = { ...tabs[index], ...updates };
    update({ tabs });
  };

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { label: "Layout", value: "layout" },
          { label: "Hero", value: "hero" },
          { label: "Tabs", value: "tabs" },
          { label: "Operations", value: "operations" },
          { label: "Stats", value: "stats" },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {/* Layout Tab */}
      {activeTab === "layout" && (
        <div className="space-y-4">
          <div>
            <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Layout Type
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    update({ layout: opt.value as BlueprintConfig["layout"] })
                  }
                  className={`p-3 rounded-lg border text-left transition-all ${
                    config.layout === opt.value
                      ? "border-neo bg-neo/5"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-gray-500">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {config.layout === "trading" && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm">
              <strong>Trading Layout:</strong> Left panel shows content/markets,
              right panel shows operation form. Perfect for prediction markets,
              exchanges, and trading platforms.
            </div>
          )}
        </div>
      )}

      {/* Hero Tab */}
      {activeTab === "hero" && (
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Eyebrow"
            placeholder="e.g. Trading Platform"
            value={config.hero?.eyebrow || ""}
            onChange={(e) => updateHero({ eyebrow: e.target.value })}
          />
          <Input
            label="Disclaimer"
            placeholder="e.g. Trade at your own risk"
            value={config.hero?.disclaimer || ""}
            onChange={(e) => updateHero({ disclaimer: e.target.value })}
          />
          <Input
            label="Title Override"
            placeholder="Custom title"
            value={config.hero?.title || ""}
            onChange={(e) => updateHero({ title: e.target.value })}
          />
          <Input
            label="Subtitle"
            placeholder="Subtitle text"
            value={config.hero?.subtitle || ""}
            onChange={(e) => updateHero({ subtitle: e.target.value })}
          />
          <div className="col-span-2">
            <Input
              label="Hero Image URL"
              placeholder="https://..."
              value={config.hero?.image || ""}
              onChange={(e) => updateHero({ image: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Tabs Tab */}
      {activeTab === "tabs" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={addTab}>
              + Add Tab
            </Button>
          </div>
          {(config.tabs || []).map((tab, i) => (
            <div
              key={i}
              className="p-3 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Tab ID"
                  value={tab.id}
                  onChange={(e) => updateTab(i, { id: e.target.value })}
                  className="flex-1"
                />
                <Input
                  placeholder="Label"
                  value={tab.label}
                  onChange={(e) => updateTab(i, { label: e.target.value })}
                  className="flex-1"
                />
                <select
                  id={`tab-type-${i}`}
                  value={tab.type}
                  aria-label="Tab type"
                  onChange={(e) =>
                    updateTab(i, {
                      type: e.target.value as
                        | "content"
                        | "forum"
                        | "reviews"
                        | "news"
                        | "custom",
                    })
                  }
                  className="rounded-md border border-gray-300 dark:border-gray-600 px-2 text-sm"
                >
                  {TAB_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" onClick={() => removeTab(i)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {(!config.tabs || config.tabs.length === 0) && (
            <p className="text-sm text-gray-500 text-center py-4">
              No tabs configured
            </p>
          )}
        </div>
      )}

      {/* Operations Tab */}
      {activeTab === "operations" && (
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Panel Title"
            placeholder="e.g. Trade, Vote, Play"
            value={config.operation_panel?.title || ""}
            onChange={(e) => updateOpPanel({ title: e.target.value })}
          />
          <Input
            label="CTA Label"
            placeholder="e.g. Place Order"
            value={config.operation_panel?.cta_label || ""}
            onChange={(e) => updateOpPanel({ cta_label: e.target.value })}
          />
          <div className="col-span-2">
            <Input
              label="Subtitle"
              placeholder="Instructions for the user"
              value={config.operation_panel?.subtitle || ""}
              onChange={(e) => updateOpPanel({ subtitle: e.target.value })}
            />
          </div>
          <div>
            <label
              htmlFor="panel-position"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Panel Position
            </label>
            <select
              id="panel-position"
              value={config.operation_panel?.position || "right"}
              onChange={(e) =>
                updateOpPanel({
                  position: e.target.value as "right" | "bottom",
                })
              }
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2"
            >
              <option value="right">Right Side</option>
              <option value="bottom">Bottom</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="panel-collapsible"
              type="checkbox"
              checked={config.operation_panel?.collapsible || false}
              onChange={(e) => updateOpPanel({ collapsible: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="panel-collapsible" className="text-sm">
              Collapsible
            </label>
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === "stats" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Stats display is configured separately in the Operations section.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Quick Blueprint Presets
 */
export const BLUEPRINT_PRESETS: Record<string, BlueprintConfig> = {
  default: {
    layout: "default",
    hero: {},
    tabs: [
      { id: "overview", label: "Overview", type: "content" },
      { id: "reviews", label: "Reviews", type: "reviews" },
      { id: "forum", label: "Forum", type: "forum" },
    ],
    operation_panel: {
      title: "Operations",
      subtitle: "Configure and submit",
      cta_label: "Open",
    },
  },
  trading: {
    layout: "trading",
    hero: {
      eyebrow: "Trading Platform",
      disclaimer: "Trade at your own risk",
    },
    tabs: [
      { id: "markets", label: "Markets", type: "content" },
      { id: "history", label: "History", type: "content" },
      { id: "comments", label: "Comments", type: "forum" },
    ],
    operation_panel: {
      title: "Trade",
      subtitle: "Select market, set amount, trade",
      cta_label: "Place Order",
      position: "right",
    },
  },
  voting: {
    layout: "voting",
    hero: {
      eyebrow: "Voting",
      disclaimer: "One vote per address",
    },
    tabs: [
      { id: "proposals", label: "Proposals", type: "content" },
      { id: "results", label: "Results", type: "content" },
      { id: "discussion", label: "Discussion", type: "forum" },
    ],
    operation_panel: {
      title: "Cast Vote",
      subtitle: "Select option and vote",
      cta_label: "Vote",
    },
  },
  gaming: {
    layout: "gaming",
    hero: {
      eyebrow: "Gaming",
    },
    tabs: [
      { id: "play", label: "Play", type: "content" },
      { id: "leaderboard", label: "Leaderboard", type: "content" },
      { id: "rules", label: "Rules", type: "content" },
    ],
    operation_panel: {
      title: "Play",
      subtitle: "Start playing",
      cta_label: "Start",
    },
  },
};
