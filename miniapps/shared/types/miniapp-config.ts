/**
 * MiniApp Factory Configuration Types
 *
 * Defines the config schema consumed by `createMiniApp()` and `MiniAppShell.vue`.
 * These types describe what each miniapp provides to the factory; the factory
 * then wires up i18n, template config, sidebar items, error handling, etc.
 */

import type { ContentType, TabConfig, StatConfig, DocsConfig, TwoColumnConfig } from "./template-config";

// ============================================================================
// Sidebar
// ============================================================================

/** Definition for a single sidebar item in the factory config */
export interface SidebarItemDef {
  /** i18n key for the item label */
  labelKey: string;
  /** Reactive getter returning the current value */
  value: () => string | number | boolean | null | undefined;
}

// ============================================================================
// Template Options (passed through to createTemplateConfig)
// ============================================================================

/** Template configuration options accepted by the factory */
export interface MiniAppTemplateOptions {
  /** Tab definitions (excluding the auto-appended docs tab) */
  tabs: TabConfig[];
  /** Content layout type — defaults to "two-column" */
  contentType?: ContentType;
  /** Enable fireworks animation on success */
  fireworks?: boolean;
  /** Show chain warning banner — defaults to true */
  chainWarning?: boolean;
  /** Stats config for the stats tab */
  stats?: StatConfig[];
  /** Two-column layout config */
  twoColumn?: TwoColumnConfig;
  /** Full docs override */
  docs?: DocsConfig;
  /** Number of doc step entries — defaults to 4 */
  docStepCount?: number;
  /** Number of doc feature entries — defaults to 2 */
  docFeatureCount?: number;
  /** Prefix for step keys — defaults to "step" */
  docStepPrefix?: string;
  /** Prefix for feature keys — defaults to "feature" */
  docFeaturePrefix?: string;
  /** Override for docs titleKey */
  docTitleKey?: string;
  /** Override for docs subtitleKey */
  docSubtitleKey?: string;
}

// ============================================================================
// Factory Config
// ============================================================================

/** Top-level config object passed to `createMiniApp()` */
export interface MiniAppFactoryConfig {
  /** Unique miniapp identifier (e.g. "burn-league", "lottery") */
  name: string;
  /** i18n message map for the miniapp */
  messages: Record<string, unknown>;
  /** Template configuration options */
  template: MiniAppTemplateOptions;
  /** Sidebar item definitions */
  sidebarItems?: SidebarItemDef[];
  /** i18n key for the sidebar title — defaults to "overview" */
  sidebarTitleKey?: string;
  /** i18n key for the error boundary fallback message */
  fallbackMessageKey?: string;
  /** Status message auto-dismiss timeout in ms */
  statusTimeoutMs?: number;
}

// ============================================================================
// Pages.json Generation
// ============================================================================

/** Single page entry for uni-app pages.json */
export interface PageConfig {
  /** Page path relative to src (e.g. "pages/index/index") */
  path: string;
  /** Page-level style overrides */
  style?: Record<string, string>;
}

/** Global style overrides for pages.json */
export interface GlobalStyleConfig {
  navigationBarTextStyle?: string;
  navigationBarBackgroundColor?: string;
  backgroundColor?: string;
}
