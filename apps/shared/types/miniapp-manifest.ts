/**
 * MiniApp Manifest Types
 *
 * The manifest is the declarative config that drives all platform-rendered
 * sections of a miniapp. Instead of writing custom layout code, miniapps
 * declare their structure via the manifest and `defineMiniApp()` wires
 * everything up automatically.
 *
 * @example
 * ```ts
 * const manifest: MiniAppManifest = {
 *   name: "Daily Check-in",
 *   category: "game",
 *   theme: { family: "gaming", accentColor: "#fbbf24" },
 *   tabs: [
 *     { key: "checkin", labelKey: "checkin", icon: "check-circle", default: true },
 *     { key: "stats", labelKey: "stats", icon: "bar-chart" },
 *   ],
 *   stats: [
 *     { labelKey: "currentStreak", valueKey: "currentStreak", format: "number", icon: "flame" },
 *   ],
 *   features: { fireworks: true, walletRequired: true },
 * };
 * ```
 */

// ============================================================================
// Shell Types
// ============================================================================

/** Top-level shell type determining the app frame chrome */
export type ShellType = "launcher" | "console" | "market" | "game";

/** MiniApp category for discovery and classification */
export type MiniAppCategory =
  | "game"
  | "defi"
  | "social"
  | "tool"
  | "governance"
  | "oracle"
  | "console";

// ============================================================================
// Theme
// ============================================================================

/** Theme family presets available in the design system */
export type ThemeFamily = "default" | "finance" | "gaming" | "social";

/** Layout density levels */
export type ThemeDensity = "compact" | "default" | "comfortable";

export interface MiniAppTheme {
  /** Theme family preset — determines base tokens and palette */
  family?: ThemeFamily;
  /** Primary accent color override (hex, e.g. "#00e599") */
  accentColor?: string;
  /** Layout density — affects spacing and padding */
  density?: ThemeDensity;
}

// ============================================================================
// Hero Section
// ============================================================================

export interface HeroConfig {
  /** Small text above the title (e.g. "Neo N3 DeFi") */
  eyebrow?: string;
  /** Main hero title override (falls back to manifest.name) */
  title?: string;
  /** Descriptive subtitle below the title */
  subtitle?: string;
  /** CSS background value or image URL */
  background?: string;
}

// ============================================================================
// Tabs
// ============================================================================

export interface TabDefinition {
  /** Unique tab identifier used in slot names and routing */
  key: string;
  /** i18n key for the tab label */
  labelKey: string;
  /** Emoji or icon identifier */
  icon?: string;
  /** Whether this tab is active by default */
  default?: boolean;
}

// ============================================================================
// Stats
// ============================================================================

/** Display format for stat values */
export type StatFormat =
  | "number"
  | "currency"
  | "gas"
  | "percent"
  | "duration"
  | "text";

/** Visual variant for stat cards */
export type StatVariant =
  | "default"
  | "accent"
  | "success"
  | "danger"
  | "warning";

export interface StatDefinition {
  /** i18n key for the stat label */
  labelKey: string;
  /** Key into the reactive state object returned by the setup function */
  valueKey: string;
  /** Display format for the value */
  format?: StatFormat;
  /** Emoji or icon identifier */
  icon?: string;
  /** Visual variant for styling */
  variant?: StatVariant;
}

// ============================================================================
// Operation Panel
// ============================================================================

/** Field types available in operation forms */
export type OperationFieldType =
  | "amount"
  | "address"
  | "select"
  | "toggle"
  | "number"
  | "text";

export interface OperationFieldDefinition {
  /** Unique field identifier — used as key in form data */
  key: string;
  /** Input type determining the rendered control */
  type: OperationFieldType;
  /** i18n key for the field label */
  labelKey?: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Keep the field in submitted data but do not render an input for it */
  hidden?: boolean;
  /** Default value */
  default?: string | number | boolean;
  /** Options for select fields — each entry has a value and an i18n label key */
  options?: Array<{ value: string; labelKey?: string; label?: string }>;
  /** Validation constraints */
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface OperationDefinition {
  /** Unique operation identifier */
  key: string;
  /** i18n key for the operation panel title */
  titleKey?: string;
  /** i18n key for the operation description */
  descriptionKey?: string;
  /** i18n key for the action button label */
  actionKey?: string;
  /** Method name for the action handler (matches registerAction key) */
  actionMethod?: string;
  /** Keeps secondary/operator flows folded away from the primary user action */
  priority?: "primary" | "secondary" | "operator";
  /** Form fields rendered before the action button */
  fields?: OperationFieldDefinition[];
}

// ============================================================================
// Sidebar
// ============================================================================

/** Display format for sidebar values */
export type SidebarFormat = "number" | "currency" | "gas" | "percent" | "text";

export interface SidebarItemDefinition {
  /** i18n key for the sidebar item label */
  labelKey: string;
  /** Key into the reactive state object */
  valueKey: string;
  /** Display format for the value */
  format?: SidebarFormat;
}

export interface SidebarConfig {
  /** i18n key for the sidebar section title */
  titleKey?: string;
  /** Sidebar item definitions */
  items?: SidebarItemDefinition[];
}

// ============================================================================
// Documentation
// ============================================================================

/** Documentation section type determining rendered layout */
export type DocsSectionType = "steps" | "faq" | "features" | "text";

export interface DocsSection {
  /** i18n key for the section title */
  titleKey: string;
  /** i18n key for the section content */
  contentKey: string;
  /** Section type — determines rendering layout */
  type?: DocsSectionType;
}

// ============================================================================
// Feature Flags
// ============================================================================

export interface MiniAppFeatures {
  /** Show fireworks animation on success actions */
  fireworks?: boolean;
  /** Enable the comments section below content */
  comments?: boolean;
  /** Enable the reviews/ratings section */
  reviews?: boolean;
  /** Show live activity feed */
  activityFeed?: boolean;
  /** Show chain warning banner when on wrong network */
  chainWarning?: boolean;
  /** Require wallet connection before interaction */
  walletRequired?: boolean;
}

// ============================================================================
// Contract Binding
// ============================================================================

/** Contract binding mode */
export type ContractMode = "custom" | "shared" | "template";

export interface ContractBinding {
  /** Contract script hash (for custom contracts) */
  hash?: string;
  /** Shared module identifier (for shared contracts) */
  moduleId?: string;
  /** Recipe identifier (for template-based contracts) */
  recipeId?: string;
  /** Binding mode — determines how the contract is resolved */
  mode?: ContractMode;
}

// ============================================================================
// Platform Permissions
// ============================================================================

export interface PlatformPermissions {
  /** Access to payment processing */
  payments?: boolean;
  /** Access to governance features */
  governance?: boolean;
  /** Access to VRF / randomness services */
  randomness?: boolean;
  /** Access to oracle data feeds */
  datafeed?: boolean;
  /** Access to abstract account operations */
  aa?: boolean;
  /** Access to off-chain compute */
  compute?: boolean;
  /** Access to Morpheus confidential payload handling */
  confidential?: boolean;
  /** Access to Morpheus oracle request/callback services */
  oracle?: boolean;
  /** Access to platform storage services */
  storage?: boolean;
  /** Access to bridge/cross-chain services */
  cross_chain?: boolean;
  /** Access to keeper/automation services */
  automation?: boolean;
}

// ============================================================================
// MiniApp Manifest (Top-Level)
// ============================================================================

/**
 * The full manifest type that drives all platform-rendered sections.
 *
 * This is the single declarative config a miniapp provides to describe
 * its identity, layout, features, and platform integrations. The platform
 * reads this manifest and renders the appropriate chrome automatically.
 */
export interface MiniAppManifest {
  // ── Identity ──

  /** Display name of the miniapp */
  name: string;
  /** Short description for discovery and SEO */
  description?: string;
  /** Icon identifier or emoji for the miniapp */
  icon?: string;
  /** Category for platform discovery */
  category?: MiniAppCategory;

  // ── Shell ──

  /** Top-level shell type determining the app frame chrome */
  shell?: ShellType;

  // ── Theme ──

  /** Theme configuration for visual customization */
  theme?: MiniAppTheme;

  // ── Layout ──

  /** Hero section at the top of the page */
  hero?: HeroConfig;

  /** Tab navigation definitions — platform renders the tab bar */
  tabs?: TabDefinition[];

  /** Stats display definitions — binds to reactive state */
  stats?: StatDefinition[];

  /** Operation panel definitions — right sidebar forms and actions */
  operations?: OperationDefinition[];

  /** Left sidebar configuration — displays reactive state */
  sidebar?: SidebarConfig;

  /** Documentation sections — rendered in the docs tab */
  docs?: DocsSection[];

  // ── Capabilities ──

  /** Feature flags controlling universal chrome */
  features?: MiniAppFeatures;

  /** Contract binding configuration */
  contract?: ContractBinding;

  /** Platform permission declarations */
  permissions?: PlatformPermissions;
}
