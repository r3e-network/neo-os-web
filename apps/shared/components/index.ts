/**
 * Shared Components Index
 *
 * Centralized exports for all shared components used across miniapps.
 *
 * @example
 * ```ts
 * import { MiniAppPage, NeoCard, NeoButton, HeroSection } from "@shared/components";
 * ```
 */

// ── Core Layout ──
export { MiniAppPage } from "./MiniAppPage";
export { MiniAppOperationPanel } from "./MiniAppOperationPanel";

// ── UI Elements ──
export { AppIcon } from "./AppIcon";
export { NeoButton, NeoCard, NeoInput } from "../components-react";

// ── Feedback ──
export { ErrorBoundary } from "./ErrorBoundary";
export { ErrorToast } from "./ErrorToast";
export { Fireworks } from "./Fireworks";

// ── Specialized ──
export { WalletPrompt } from "./WalletPrompt";
export { HeroSection } from "./HeroSection";
export { HeroStatsStrip } from "./HeroStatsStrip";
export { ContractAvailabilityCard } from "./ContractAvailabilityCard";

// ── Data Display ──
export { StatsDisplay } from "./StatsDisplay";
export { StatsTab } from "./StatsTab";
export { ActionModal } from "./ActionModal";
export { ItemList } from "./ItemList";
export { StatusBadge } from "./StatusBadge";

// ── Forms ──
export { FormCard } from "./FormCard";
export { ScrollReveal } from "./ScrollReveal";

// ── Console ──
export { ConsoleMiniApp } from "./ConsoleMiniApp";
export { DetailCardGrid } from "./DetailCardGrid";

// ── Type Exports ──
export type { CardVariant } from "../components-react";
export type { StatsDisplayItem, StatsDisplayLayout } from "./StatsDisplay";
export type { ActionModalVariant, ActionModalSize } from "./ActionModal";
export type { HeroVariant } from "./HeroSection";
export type { HeroStatsStripItem } from "./HeroStatsStrip";
export type { BadgeStatus } from "./StatusBadge";
