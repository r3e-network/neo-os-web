"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * MiniApp Live Preview
 * Shows a preview of how the miniapp will look based on configuration
 */

export type PreviewConfig = {
  layout?: "default" | "trading" | "voting" | "gaming" | "info";
  hero?: {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    disclaimer?: string;
  };
  tabs?: Array<{
    id: string;
    label: string;
    type: string;
  }>;
  operation_panel?: {
    title?: string;
    subtitle?: string;
    cta_label?: string;
  };
  stats?: Array<{
    key: string;
    label: string;
    value: string;
    icon?: string;
  }>;
  hasMarkets?: boolean;
  hasOperation?: boolean;
};

type LivePreviewProps = {
  config: PreviewConfig;
  className?: string;
  scale?: number;
};

export function LivePreview({ config, className, scale = 0.5 }: LivePreviewProps) {
  const [activeTab, setActiveTab] = useState(0);

  const layout = config.layout || "default";
  const tabs = config.tabs || [];
  const hero = config.hero || {};
  const opPanel = config.operation_panel || {};

  return (
    <div 
      className={cn(
        "border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900",
        className
      )}
      style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
    >
      {/* Preview Header */}
      <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-xs text-gray-500">Preview</span>
      </div>

      {/* Preview Content */}
      <div className="min-h-[400px]">
        {/* Hero */}
        {layout === "trading" && (
          <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 p-4 border-b border-gray-200 dark:border-gray-700">
            {hero.eyebrow && (
              <p className="text-[8px] uppercase tracking-wider text-neo font-semibold mb-1">
                {hero.eyebrow}
              </p>
            )}
            <h1 className="text-sm font-bold">{hero.title || "App Title"}</h1>
            <p className="text-[8px] text-gray-500 mt-1 line-clamp-2">{hero.subtitle || "App description will appear here"}</p>
            {hero.disclaimer && (
              <p className="text-[7px] text-gray-400 mt-1">{hero.disclaimer}</p>
            )}
          </div>
        )}

        {/* Stats */}
        {config.stats && config.stats.length > 0 && (
          <div className="grid grid-cols-4 gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
            {config.stats.slice(0, 4).map((stat, i) => (
              <div key={i} className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <p className="text-[8px] text-gray-500">{stat.label}</p>
                <p className="text-[10px] font-bold">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className={cn("flex", layout === "trading" ? "flex-row" : "flex-col")}>
          {/* Main Content */}
          <div className="flex-1 p-3">
            {/* Tabs */}
            {tabs.length > 0 && (
              <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-3">
                {tabs.slice(0, 4).map((tab, i) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(i)}
                    className={cn(
                      "px-2 py-1 text-[9px] font-medium border-b-2 transition-colors",
                      activeTab === i
                        ? "border-neo text-neo"
                        : "border-transparent text-gray-500"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {/* Content Area */}
            <div className="space-y-2">
              {layout === "trading" && config.hasMarkets ? (
                // Market cards
                [1, 2].map((i) => (
                  <div key={i} className="border border-gray-200 dark:border-gray-700 rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] font-medium">Market {i}</span>
                      <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700">Active</span>
                    </div>
                    <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-neo w-[60%]" />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[7px] text-gray-500">Yes 60%</span>
                      <span className="text-[7px] text-gray-500">No 40%</span>
                    </div>
                  </div>
                ))
              ) : (
                // Default content
                <div className="border border-gray-200 dark:border-gray-700 rounded p-2">
                  <p className="text-[8px] text-gray-500">Content will appear here based on selected tab</p>
                </div>
              )}
            </div>
          </div>

          {/* Operation Panel */}
          {layout === "trading" && config.hasOperation && (
            <div className="w-[120px] border-l border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800">
              <h3 className="text-[10px] font-bold mb-1">{opPanel.title || "Operations"}</h3>
              <p className="text-[7px] text-gray-500 mb-2">{opPanel.subtitle || "Configure and submit"}</p>
              
              <div className="space-y-1">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded" />
                <button className="w-full h-6 bg-neo text-black text-[8px] font-medium rounded" aria-hidden="true" tabIndex={-1}>
                  {opPanel.cta_label || "Submit"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Split View: Editor + Preview
 */
type SplitPreviewProps = {
  children: React.ReactNode;
  config: PreviewConfig;
  className?: string;
};

export function SplitPreview({ children, config, className }: SplitPreviewProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-4", className)}>
      <div className="overflow-auto">
        {children}
      </div>
      <div className="sticky top-4">
        <LivePreview config={config} />
      </div>
    </div>
  );
}

export default LivePreview;
