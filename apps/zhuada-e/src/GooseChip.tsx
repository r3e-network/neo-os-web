/** Raster collection chip backed by the approved goose portraits (goose-00..goose-08.webp). */
import type { CSSProperties } from "react";
import { SCENES, type GooseVariant } from "./logic/scenes";
import { colorToCss } from "./logic/themes";
import { publicAssetUrl } from "./logic/public-asset-url";

export interface GooseChipProps {
  variant: GooseVariant;
  locked?: boolean;
  size?: number;
}

function sameVariant(left: GooseVariant, right: GooseVariant): boolean {
  return left.body === right.body
    && left.scarf === right.scarf
    && left.hat === right.hat
    && left.hatColor === right.hatColor
    && left.hatAccent === right.hatAccent;
}

export function collectionPortraitFor(variant: GooseVariant): string {
  const sceneId = SCENES.findIndex(({ goose }) => sameVariant(goose, variant));
  const id = String(sceneId >= 0 ? sceneId : 0).padStart(2, "0");
  return publicAssetUrl(`./art/geese/goose-${id}.webp`);
}

export function GooseChip({ variant, locked = false, size = 44 }: GooseChipProps) {
  const style = {
    width: size,
    height: size,
    "--goose-chip-accent": colorToCss(variant.scarf),
  } as CSSProperties;
  return (
    <span
      className="goose-collection__chip"
      data-locked={locked ? "true" : undefined}
      style={style}
      aria-hidden="true"
    >
      <img src={collectionPortraitFor(variant)} alt="" draggable={false} />
    </span>
  );
}

export default GooseChip;
