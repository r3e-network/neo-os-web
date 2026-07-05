/**
 * Miniapp OS v2 — Hand-built SVG Art Atlas.
 *
 * Every entry is a self-contained React SVG component (no binary files), tinted
 * by the active category theme. Add new game/defi/nft/tool props here so the
 * whole ecosystem draws from one atlas.
 */
export { DiceArt, PipDot } from "./DiceArt";
export type { DiceFace, DiceArtProps } from "./DiceArt";

export { ChipArt } from "./ChipArt";
export type { ChipArtProps } from "./ChipArt";

export { CoinArt, ParticleBurst } from "./CoinArt";
export type { CoinArtProps, ParticleBurstProps } from "./CoinArt";

export { CardFrame } from "./CardArt";
export type { CardFrameProps } from "./CardArt";
