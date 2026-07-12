import type { GameThemeId } from "./logic/themes";

export interface ThemeItemChipProps {
  themeId: GameThemeId;
  kind: number;
  className?: string;
}

/** A dedicated transparent production asset for tray and temporary shelf. */
export function ThemeItemChip({ themeId, kind, className }: ThemeItemChipProps) {
  const safeKind = Math.max(0, Math.min(11, Math.floor(kind)));
  return (
    <img
      className={["goose-theme-item", className].filter(Boolean).join(" ")}
      src={`./art/items/${themeId}/item-${String(safeKind).padStart(2, "0")}.webp`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
