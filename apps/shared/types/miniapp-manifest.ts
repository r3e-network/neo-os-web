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
  /** Icon identifier */
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

/**
 * A stat card in the DESIGN-TIME contract — not a runtime surface.
 *
 * Read this before adding one: `manifest.stats` is not rendered by the shell.
 * `manifestToTemplateConfig` carries it to `templateConfig.stats`, which
 * `MiniAppPage` receives and never reads; `MiniAppHomeShell` does have a
 * `stats` prop, but its only caller (`GameHomePage`) passes a hardcoded `[]`.
 * The plumbing exists and dead-ends at the last inch. Its live consumers are
 * design-time: the admin-console blueprint preview, `docs.tsx`, and the SDK
 * example.
 *
 * What the shell actually renders is `sidebar.items` — and that one binding
 * feeds BOTH the sidebar rail and the "stats" tab, which is why apps see stat
 * cards at all and why this field looks live when it is not.
 *
 * So: anything a user must see belongs in `sidebar.items`. A binding declared
 * only here renders nowhere — a self-loan stat published a fabricated zero for
 * months precisely because nobody could see it to notice. Keep it truthful
 * anyway (it is a declared contract, and it is what the blueprint shows), but
 * do not reach for it expecting pixels.
 */
export interface StatDefinition {
  /** i18n key for the stat label */
  labelKey: string;
  /** Key into the reactive state object returned by the setup function */
  valueKey: string;
  /** Display format for the value */
  format?: StatFormat;
  /** Icon identifier */
  icon?: string;
  /** Visual variant for styling */
  variant?: StatVariant;
  /**
   * i18n key for the copy the chrome shows while this value is UNREAD —
   * i.e. while the bound observable still holds `undefined`. See
   * `SidebarItemDefinition.pendingKey` for the full contract; the two fields
   * are the same mechanism declared on the two binding surfaces.
   */
  pendingKey?: string;
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
  /** Asset unit for amount fields. NEO is indivisible; GAS allows decimals. */
  asset?: "GAS" | "NEO";
  /** Validation constraints */
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    /** Require a whole-number amount; implied for NEO amount fields. */
    integer?: boolean;
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
  /**
   * i18n key for the copy the chrome shows while this value is UNREAD.
   *
   * Manifest bindings are an ungated render path: the shell formats whatever
   * the observable holds at first paint, so an app's DataPhase gating inside
   * its own PlayArea does not reach the chrome. Without a declared pending
   * phase the chrome publishes the app's rest-state fallback as if it were a
   * reading — a void ("Total USD —") or, worse, a fabricated number
   * ("Founders 0") that asserts something false.
   *
   * Bindings are string-valued (the formatter returns a string), so the shell
   * structurally cannot mount a skeleton element here. Honest words are the
   * only truthful option, and they are declared here rather than hand-written
   * as a parallel display-only observable in every app.
   *
   * The trigger is `undefined` specifically, and only `undefined`: `null` and
   * `""` are values an app may legitimately hold and report, whereas
   * `undefined` uniquely means "nothing has been set yet". An app opts in by
   * leaving the observable `undefined` until its read settles.
   *
   * Omit this field to keep the pre-existing behaviour exactly: with no
   * `pendingKey`, `undefined` formats as it always has.
   *
   * Pick copy that matches the actual phase — "Reading…" while a read is in
   * flight, "Connect wallet" where there is no wallet to read from. A settled
   * read of zero is a real reading and must still render as 0.
   */
  pendingKey?: string;
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
  /** PlatformRegistry hash supplying the shared binding. */
  registry?: string;
  /** Shared engine hash resolved for this app. */
  engine?: string;
}

/**
 * Optional per-module shared contract hashes. Unlike `contract`, this map
 * lets one miniapp compose several platform engines without changing its
 * primary contract binding.
 */
export interface MiniAppPlatformBindings {
  registry?: string;
  game?: string;
  social?: string;
  anchor?: string;
  defi?: string;
  vesting?: string;
  escrow?: string;
  factory?: {
    "neo-n3-mainnet"?: string;
    "neo-n3-testnet"?: string;
  };
}

// ============================================================================
// Platform Permissions
// ============================================================================

export interface PlatformPermissions {
  /** Invoke the app's standalone primary contract. */
  "invoke:primary"?: boolean;
  /** Invoke tenant operations on the shared PlatformRegistry. */
  "invoke:platform-registry"?: boolean;
  /** Invoke tenant operations on the shared PlatformGame engine. */
  "invoke:platform-game"?: boolean;
  /** Invoke tenant operations on the shared PlatformSocial engine. */
  "invoke:platform-social"?: boolean;
  /** Invoke tenant operations on the shared PlatformAnchor engine. */
  "invoke:platform-anchor"?: boolean;
  /** Invoke tenant operations on the shared PlatformDeFi engine. */
  "invoke:platform-defi"?: boolean;
  /** Invoke tenant operations on the shared PlatformVesting engine. */
  "invoke:platform-vesting"?: boolean;
  /** Invoke tenant operations on the shared PlatformEscrow engine. */
  "invoke:platform-escrow"?: boolean;
  /** Invoke tenant deployment operations on MiniAppFactory. */
  "invoke:platform-factory"?: boolean;
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
// Game Page (focused launch page for game-type miniapps)
// ============================================================================

/**
 * Two-mode opt-in for game-type miniapps. When `guest` is true the launcher
 * renders a two-choice entry — a primary "Earn GAS" (GameFi) CTA and a
 * secondary "Play free" (Guest) CTA — instead of the single start button.
 */
export interface MiniAppGameModes {
  /** Opt into the guest (free, local, off-chain) play mode. */
  guest?: boolean;
  /**
   * Whether the wallet-backed GameFi path is currently safe to expose.
   * Defaults to true. Set false while contracts, reward pools, or oracle
   * infrastructure are unavailable; the launcher will offer free play only.
   */
  gamefi?: boolean;
}

/** Feature card definition for the game page features section */
export interface GamePageFeature {
  /** Optional icon identifier; rendered only when a concrete icon component exists. */
  icon?: string;
  /** i18n key for feature title */
  titleKey: string;
  /** i18n key for feature description */
  descKey: string;
  /** Render as a large hero card (gradient background, bigger) */
  large?: boolean;
  /** CSS gradient for the large card's visual area */
  gradient?: string;
}

/**
 * Declarative configuration for the focused launch page shown
 * to users when they first enter a game-type miniapp. The platform
 * renders a default launch page for every `shell: "game"` app and
 * uses this config only to customize copy, features, and accent color.
 *
 * All text fields reference i18n keys — the actual strings come from
 * the miniapp's messages.
 */
export interface GamePageConfig {
  /** Category badge text (e.g. "On-Chain Challenge") — i18n key */
  heroBadgeKey: string;
  /** Hero title — i18n key */
  heroTitleKey: string;
  /** Word within the hero title to apply accent styling to; accepts a literal or i18n key. */
  heroTitleAccent?: string;
  /** Hero description paragraph — i18n key */
  heroDescKey: string;
  /** Primary action button label — i18n key */
  primaryLabelKey: string;
  /** Secondary button label (e.g. "How to Play") — i18n key */
  ghostLabelKey?: string;
  /** Features section eyebrow — i18n key */
  featuresEyebrowKey?: string;
  /** Features section title — i18n key */
  featuresTitleKey?: string;
  /** Feature cards (large + small grid) */
  features?: GamePageFeature[];
  /** Leaderboard section eyebrow — i18n key */
  lbEyebrowKey?: string;
  /** Leaderboard section title — i18n key */
  lbTitleKey?: string;
  /** Leaderboard score column label — i18n key */
  lbScoreLabelKey?: string;
  /** Bottom CTA section title — i18n key */
  ctaTitleKey: string;
  /** Bottom CTA section description — i18n key */
  ctaDescKey: string;
  /** CTA button label — i18n key (falls back to primaryLabelKey) */
  ctaLabelKey?: string;
  /** Trust badge texts — i18n keys */
  trustBadgeKeys?: string[];
  /** Category accent color override (hex, e.g. "#10B981") */
  categoryColor?: string;
  /** Optional icon identifier for future concrete icon rendering. Prefer app logo assets. */
  appIcon?: string;
  /** Two-mode (guest/gamefi) opt-in — enables the two-CTA launcher entry. */
  modes?: MiniAppGameModes;
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
  /** Icon identifier for the miniapp */
  icon?: string;
  /** Category for platform discovery */
  category?: MiniAppCategory;

  // ── Shell ──

  /** Top-level shell type determining the app frame chrome */
  shell?: ShellType;

  /**
   * Open a game shell directly on its playable surface instead of rendering
   * the generic launch card first. Use this only when the play area itself is
   * a deliberately designed, self-explanatory entry experience.
   */
  directPlay?: boolean;

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

  /** Composable shared platform contract bindings by module. */
  platformBindings?: MiniAppPlatformBindings;

  /** Platform permission declarations */
  permissions?: PlatformPermissions;

  /** Optional launch page config for game-type miniapps.
   *  Every `shell: "game"` miniapp gets a focused launch page before
   *  entering the game; this config customizes that default. */
  gamePage?: GamePageConfig;

  /**
   * Two-mode (guest/gamefi) opt-in for apps without a full `gamePage` block.
   * Equivalent to `gamePage.modes.guest`; either enables the two-CTA launcher
   * entry ("Earn GAS" + "Play free").
   */
  supportsGuest?: boolean;

  /** Top-level equivalent of `gamePage.modes.gamefi` for apps without gamePage. */
  supportsGameFi?: boolean;
}
