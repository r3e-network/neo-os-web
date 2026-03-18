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
export { default as MiniAppPage } from "./MiniAppPage.vue";

// ── UI Elements ──
export { default as AppIcon } from "./AppIcon.vue";
export { default as NeoCard } from "./NeoCard.vue";
export { default as NeoButton } from "./NeoButton.vue";
export { default as NeoInput } from "./NeoInput.vue";
export { default as NeoModal } from "./NeoModal.vue";
export { default as NeoDoc } from "./NeoDoc.vue";

// ── Feedback ──
export { default as ErrorBoundary } from "./ErrorBoundary.vue";
export { default as ErrorToast } from "./ErrorToast.vue";
export { default as Fireworks } from "./Fireworks.vue";

// ── Specialized ──
export { default as WalletPrompt } from "./WalletPrompt.vue";
export { default as ChainWarning } from "./ChainWarning.vue";
export { default as SidebarPanel } from "./SidebarPanel.vue";
export { default as HeroSection } from "./HeroSection.vue";
export { default as HeroStatsStrip } from "./HeroStatsStrip.vue";
export { default as CountdownTimer } from "./CountdownTimer.vue";

// ── Data Display ──
export { default as StatsDisplay } from "./StatsDisplay.vue";
export { default as StatsTab } from "./StatsTab.vue";
export { default as ActionModal } from "./ActionModal.vue";
export { default as ItemList } from "./ItemList.vue";
export { default as StatusBadge } from "./StatusBadge.vue";

// ── Type Exports ──
export type { CardVariant } from "./NeoCard.vue";
export type { StatsDisplayItem, StatsDisplayLayout } from "./StatsDisplay.vue";
export type { ActionModalVariant, ActionModalSize } from "./ActionModal.vue";
export type { HeroVariant } from "./HeroSection.vue";
export type { HeroStatsStripItem } from "./HeroStatsStrip.vue";
export type { BadgeStatus } from "./StatusBadge.vue";

// ── Restored ──
export { default as FormCard } from "./FormCard.vue";
export { default as ConfiguredOperationPanel } from "./ConfiguredOperationPanel.vue";
export { default as ScrollReveal } from "./ScrollReveal.vue";
