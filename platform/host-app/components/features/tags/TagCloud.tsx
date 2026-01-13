/**
 * TagCloud Component
 * Displays tags for an app with click-to-filter
 */

"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/react";
import { PREDEFINED_TAGS, APP_TAGS } from "./types";

interface Props {
  appId: string;
  onTagClick?: (tagId: string) => void;
  className?: string;
}

export function TagCloud({ appId, onTagClick, className }: Props) {
  const { locale } = useTranslation("host");
  const tagIds = APP_TAGS[appId] || [];

  if (tagIds.length === 0) return null;

  const tags = tagIds.map((id) => PREDEFINED_TAGS.find((t) => t.id === id)).filter(Boolean);

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {tags.map((tag) => {
        if (!tag) return null;
        const name = locale === "zh" && tag.name_zh ? tag.name_zh : tag.name;
        return (
          <button
            key={tag.id}
            onClick={() => onTagClick?.(tag.id)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-full transition-all",
              "bg-erobo-purple/10 text-erobo-purple border border-erobo-purple/20",
              "hover:bg-erobo-purple/20 hover:border-erobo-purple/40",
            )}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
