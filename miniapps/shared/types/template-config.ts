/**
 * MiniApp Template Configuration Types
 *
 * Defines the declarative config schema that each miniapp exports
 * to describe its structure. The MiniAppTemplate component reads
 * this config and renders the appropriate layout.
 *
 * @example
 * ```ts
 * import type { MiniAppTemplateConfig } from "@shared/types/template-config";
 *
 * const config: MiniAppTemplateConfig = {
 *   contentType: "game-board",
 *   tabs: [
 *     { key: "play", labelKey: "play", icon: "🎮", default: true },
 *     { key: "stats", labelKey: "stats", icon: "📊" },
 *     { key: "docs", labelKey: "docs", icon: "📖" },
 *   ],
 *   stats: [
 *     { labelKey: "totalGames", valueKey: "totalGames", format: "number" },
 *   ],
 * };
 * ```
 */

/** Content slot type — determines the main area layout frame */
export type ContentType =
  | "game-board"
  | "market-list"
  | "form-panel"
  | "dashboard"
  | "swap-interface"
  | "timer-hero"
  | "two-column"
  | "custom";

/** Tab definition for the tab bar */
export interface TabConfig {
  /** Unique tab identifier */
  key: string;
  /** i18n key for the tab label */
  labelKey: string;
  /** Emoji or icon name */
  icon?: string;
  /** Whether this is the default active tab */
  default?: boolean;
}

/** Stat card configuration for StatsGrid */
export interface StatConfig {
  /** i18n key for the stat label */
  labelKey: string;
  /** Key path in the app state object to read the value from */
  valueKey: string;
  /** Display format for the value */
  format?: "number" | "currency" | "percent" | "duration";
  /** Emoji or icon */
  icon?: string;
  /** NeoStats variant for styling */
  variant?: "default" | "accent" | "success" | "danger";
}

/** Documentation section config */
export interface DocsConfig {
  /** i18n key for doc title */
  titleKey: string;
  /** i18n key for doc subtitle */
  subtitleKey?: string;
  /** i18n keys for step descriptions */
  stepKeys?: string[];
  /** i18n keys for feature name/desc pairs */
  featureKeys?: Array<{ nameKey: string; descKey: string }>;
}

// ============================================================================
// Two-Column Layout Types
// ============================================================================

/** Field definition for the operation box form */
export interface OperationField {
  /** Unique field identifier */
  key: string;
  /** Input type determining the rendered control */
  type: "amount" | "address" | "select" | "toggle" | "number" | "text";
  /** i18n key for the field label */
  labelKey: string;
  /** i18n key for placeholder text */
  placeholderKey?: string;
  /** Options for select/toggle fields */
  options?: Array<{ value: string; labelKey: string }>;
  /** Whether the field is required */
  required?: boolean;
  /** Default value */
  default?: string | number | boolean;
  /** Validation constraints */
  validation?: { min?: number; max?: number; pattern?: string };
}

/** Configuration for the sticky operation box (right panel) */
export interface OperationBoxConfig {
  /** i18n key for the panel title */
  titleKey: string;
  /** i18n key for the panel description */
  descriptionKey?: string;
  /** Form field definitions */
  fields: OperationField[];
  /** i18n key for the action button text */
  actionKey: string;
  /** Summary rows shown above the action button */
  summaryKeys?: Array<{
    labelKey: string;
    valueKey: string;
    format?: StatConfig["format"];
  }>;
}

/** Configuration for the metadata display panel */
export interface MetadataConfig {
  /** Whether to show the metadata panel */
  show: boolean;
  /** Metadata field definitions */
  fields?: Array<{
    labelKey: string;
    valueKey: string;
    type?: "text" | "address" | "link" | "badge";
  }>;
}

/** Configuration for the embedded review section */
export interface ReviewConfig {
  /** Whether to show the review section */
  show: boolean;
  /** Allow users to post comments */
  allowComments?: boolean;
  /** Allow users to submit ratings */
  allowRatings?: boolean;
}

/** Two-column layout specific configuration */
export interface TwoColumnConfig {
  /** Operation box (right panel) configuration */
  operation: OperationBoxConfig;
  /** Metadata panel configuration */
  metadata?: MetadataConfig;
  /** Review section configuration */
  reviews?: ReviewConfig;
  /** List→detail navigation labels */
  listDetail?: {
    listLabelKey?: string;
    detailBackKey?: string;
  };
}

/** Feature flags controlling universal chrome */
export interface TemplateFeatures {
  /** Show Fireworks animation on success (default: true) */
  fireworks?: boolean;
  /** Show ChainWarning banner (default: true) */
  chainWarning?: boolean;
  /** Show status message cards (default: true) */
  statusMessages?: boolean;
  /** NeoDoc configuration for the docs tab */
  docs?: DocsConfig;
}

/**
 * The main config each miniapp exports to declare its template structure.
 *
 * This drives the MiniAppTemplate component — no custom layout code needed.
 * The `contentType` selects the layout frame, `tabs` define navigation,
 * and `stats` bind reactive values to the stats grid.
 */
export interface MiniAppTemplateConfig {
  /** Which content slot layout to use for the main area */
  contentType: ContentType;
  /** Tab bar configuration */
  tabs: TabConfig[];
  /** Stats grid configuration — binds to reactive app state */
  stats?: StatConfig[];
  /** Feature flags for universal chrome */
  features?: TemplateFeatures;
  /** Two-column layout config — required when contentType === "two-column" */
  twoColumn?: TwoColumnConfig;
}
