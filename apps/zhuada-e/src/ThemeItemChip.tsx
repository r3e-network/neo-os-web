import type { CSSProperties } from "react";
import {
  THEME_ITEM_ASSET_COUNT,
  THEME_ITEM_COUNT,
  themeItem,
  type GameThemeId,
} from "./logic/themes";
import { publicAssetUrl } from "./logic/public-asset-url";

export interface ThemeItemChipProps {
  themeId: GameThemeId;
  kind: number;
  className?: string;
}

/** A dedicated transparent production asset for tray and temporary shelf. */
export function ThemeItemChip({ themeId, kind, className }: ThemeItemChipProps) {
  const safeKind = Math.max(0, Math.min(THEME_ITEM_COUNT - 1, Math.floor(kind)));
  const item = themeItem(themeId, safeKind);
  const style = {
    "--goose-item-hue": `${item.chipHueDeg ?? 0}deg`,
  } as CSSProperties;
  const variantIndex = item.modelKind === undefined
    ? undefined
    : Math.floor(safeKind / THEME_ITEM_ASSET_COUNT);
  return (
    <img
      className={["goose-theme-item", className].filter(Boolean).join(" ")}
      src={publicAssetUrl(`./art/items/${themeId}/item-${String(safeKind).padStart(2, "0")}.webp`)}
      style={style}
      data-color-variant={item.assetKind !== undefined ? "true" : undefined}
      data-variant-index={variantIndex}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
