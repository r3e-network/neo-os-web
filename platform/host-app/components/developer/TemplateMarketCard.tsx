"use client";

import { Button } from "@/components/ui/button";

type TemplateMarketCardProps = {
  templateKind: "frontend" | "contract";
  templateId: string;
  version: string;
  name: string;
  description: string;
  category: string;
  sourceType: string;
  isVerified: boolean;
  usageCount: number;
  ratingAvg: number | null;
  ratingCount: number;
  tags: string[];
  onInstall: () => void;
};

export function TemplateMarketCard({
  templateKind,
  templateId,
  version,
  name,
  description,
  category,
  sourceType,
  isVerified,
  usageCount,
  ratingAvg,
  ratingCount,
  tags,
  onInstall,
}: TemplateMarketCardProps) {
  return (
    <div className="rounded-3xl border border-gray-200/50 bg-white/60 p-5 backdrop-blur-xl transition-all hover:border-neo/40 hover:shadow-[0_10px_30px_rgba(0,229,153,0.1)] dark:border-white/10 dark:bg-[#0C0D14]/70">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 ${templateKind === "contract" ? "bg-orange-500/20 text-orange-300" : "bg-neo/20 text-neo"}`}>
          {templateKind}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-white/10 dark:text-gray-300">
          {sourceType}
        </span>
        {isVerified ? (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300">verified</span>
        ) : null}
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{name || templateId}</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        <code>{templateId}</code> · v{version}
      </p>
      <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
        {description || "No description"}
      </p>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {category} · usage {usageCount} · rating {ratingAvg ?? "-"} ({ratingCount})
      </p>
      {tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.slice(0, 4).map((tag) => (
            <span key={`${templateId}-${tag}`} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-white/10 dark:text-gray-300">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-3">
        <Button size="sm" onClick={onInstall}>
          Install To Builder
        </Button>
      </div>
    </div>
  );
}
