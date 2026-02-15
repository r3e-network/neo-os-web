/**
 * Shared Components Index
 *
 * Centralized exports for all shared components used across miniapps.
 *
 * @example
 * ```ts
 * // Import all components from a single path
 * import {
 *   AppLayout,
 *   NeoCard,
 *   NeoButton,
 *   NeoDoc,
 *   ChainWarning
 * } from "@shared/components";
 * ```
 */

// ============================================================================
// Vue Components - Layout
// ============================================================================
export { default as AppLayout } from "./AppLayout.vue";
export { default as MiniAppLayout } from "./MiniAppLayout.vue";
export { default as DesktopLayout } from "./DesktopLayout.vue";
export { default as DesktopSidebar } from "./DesktopSidebar.vue";
export { default as ResponsiveLayout } from "./ResponsiveLayout.vue";

// ============================================================================
// Vue Components - UI Elements
// ============================================================================
export { default as AppIcon } from "./AppIcon.vue";
export { default as NeoCard } from "./NeoCard.vue";
export { default as NeoButton } from "./NeoButton.vue";
export { default as NeoInput } from "./NeoInput.vue";
export { default as NeoModal } from "./NeoModal.vue";
export { default as NeoDoc } from "./NeoDoc.vue";
export { default as GradientCard } from "./GradientCard.vue";
export { default as ScrollReveal } from "./ScrollReveal.vue";

// ============================================================================
// Vue Components - Navigation
// ============================================================================
export { default as NavBar } from "./NavBar.vue";
export { default as TopNavBar } from "./TopNavBar.vue";

// ============================================================================
// Vue Components - Specialized
// ============================================================================
export { default as WalletPrompt } from "./WalletPrompt.vue";
export { default as ChainWarning } from "./ChainWarning.vue";

// ============================================================================
// Vue Components - Specialized
// ============================================================================

export { default as ErrorBoundary } from "./ErrorBoundary.vue";
export { default as Fireworks } from "./Fireworks.vue";
export { default as SidebarPanel } from "./SidebarPanel.vue";
export { default as ErrorToast } from "./ErrorToast.vue";

// ============================================================================
// Vue Components - Template System
// ============================================================================
export { default as MiniAppTemplate } from "./MiniAppTemplate.vue";
export { default as MiniAppShell } from "./MiniAppShell.vue";
export { default as MiniAppPage } from "./MiniAppPage.vue";

// ============================================================================
// Vue Components - Shared Primitives
// ============================================================================
export { default as StatsDisplay } from "./StatsDisplay.vue";
export { default as StatsTab } from "./StatsTab.vue";
export { default as ActionModal } from "./ActionModal.vue";
export { default as ItemList } from "./ItemList.vue";
export { default as FormCard } from "./FormCard.vue";
export { default as HeroSection } from "./HeroSection.vue";
export { default as CountdownTimer } from "./CountdownTimer.vue";
export { default as StatusBadge } from "./StatusBadge.vue";

// ============================================================================
// Type Exports
// ============================================================================
export type { NavTab } from "./NavBar.vue";
export type { CardVariant } from "./NeoCard.vue";
export type { StatsDisplayItem, StatsDisplayLayout } from "./StatsDisplay.vue";
export type { ActionModalVariant, ActionModalSize } from "./ActionModal.vue";
export type { HeroVariant } from "./HeroSection.vue";
export type { BadgeStatus } from "./StatusBadge.vue";
