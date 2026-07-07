import gasTokenUrl from "../assets/tokens/gas-icon.svg?url";
import gasTokenPngUrl from "../assets/tokens/gas-icon.png?url";
import neoTokenUrl from "../assets/tokens/neo-icon.svg?url";
import neoTokenPngUrl from "../assets/tokens/neo-icon.png?url";

/**
 * Official Neo Press Kit token artwork URLs for renderers that need image
 * sources instead of React components (for example Phaser preloaders).
 */
export const officialGasTokenUrl = gasTokenUrl;
export const officialNeoTokenUrl = neoTokenUrl;

export const officialTokenUrls = {
  gas: officialGasTokenUrl,
  neo: officialNeoTokenUrl,
} as const;

/**
 * Phaser canvas rendering is more reliable with raster token textures than
 * class-styled SVG sources, so the Phaser URLs point at PNGs generated from the
 * official SVGs in this same shared token folder.
 */
export const officialGasTokenPhaserUrl = gasTokenPngUrl;
export const officialNeoTokenPhaserUrl = neoTokenPngUrl;

export const officialTokenPhaserUrls = {
  gas: officialGasTokenPhaserUrl,
  neo: officialNeoTokenPhaserUrl,
} as const;
