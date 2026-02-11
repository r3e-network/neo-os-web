import React from "react";
import { CopyIcon } from "./CopyIcon";
import type { ThemeColors } from "./types";

export function InfoRow({
  label,
  value,
  fullValue,
  onCopy,
  copied,
  link,
  indicator,
  muted,
  themeColors,
}: {
  label: string;
  value: string;
  fullValue?: string;
  onCopy?: () => void;
  copied?: boolean;
  link?: string;
  indicator?: "green" | "amber" | "red";
  muted?: boolean;
  themeColors: ThemeColors;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs shrink-0" style={{ color: themeColors.textMuted }}>
        {label}
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        {indicator && (
          <span
            className={`w-2 h-2 rounded-full ${
              indicator === "green" ? "bg-emerald-500" : indicator === "amber" ? "bg-amber-500" : "bg-red-500"
            }`}
          />
        )}
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono truncate transition-colors"
            style={{ color: muted ? themeColors.textMuted : themeColors.text }}
            title={fullValue || value}
          >
            {value}
          </a>
        ) : (
          <span
            className="text-sm font-mono truncate"
            style={{ color: muted ? themeColors.textMuted : themeColors.text }}
            title={fullValue || value}
          >
            {value}
          </span>
        )}
        {onCopy && (
          <button
            onClick={onCopy}
            className="p-1 rounded transition-colors shrink-0"
            title={copied ? "Copied!" : "Copy"}
          >
            {copied ? (
              <span style={{ color: themeColors.primary }} className="text-xs">
                ✓
              </span>
            ) : (
              <CopyIcon color={themeColors.textMuted} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
