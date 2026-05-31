/**
 * Neo Soft illustration & icon library.
 *
 * Original, self-contained inline-SVG React components in the "Neo Soft"
 * visual language (soft, friendly fintech). All components are accessible
 * (role="img" + aria-label via the `title` prop) and take a numeric `size`
 * plus an optional `className`. No external assets, fonts or emojis.
 *
 * Usage:
 *   import {
 *     NeoMascot, EmptyStateArt, SuccessArt, ErrorArt, CoinArt, CategoryIcon,
 *   } from "@shared/components-react";
 *
 *   <NeoMascot variant="brand" size={140} title="Welcome" />
 *   <EmptyStateArt size={220} />
 *   <SuccessArt size={120} title="Swap complete" />
 *   <CoinArt kind="neo" size={64} />
 *   <CategoryIcon name="finance" size={40} />
 */

export * from "./NeoMascot";
export * from "./EmptyStateArt";
export * from "./StatusArt";
export * from "./CoinArt";
export * from "./CategoryIcon";
