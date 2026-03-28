/**
 * Manifest-to-TemplateConfig Conversion
 *
 * Converts a MiniAppManifest into the MiniAppTemplateConfig that
 * MiniAppPage expects. This bridges the new declarative manifest
 * API with the existing component infrastructure.
 *
 * Extracted into its own module to avoid circular dependencies
 * between defineMiniApp (which imports MiniAppRoot) and MiniAppRoot
 * (which needs this conversion).
 */

import type { MiniAppManifest, StatDefinition } from "../types/miniapp-manifest";
import type { MiniAppTemplateConfig, TabConfig, StatConfig, ContentType, DocsConfig } from "../types/template-config";

// ============================================================================
// Tab Conversion
// ============================================================================

function manifestToTabs(manifest: MiniAppManifest): TabConfig[] {
  if (!manifest.tabs || manifest.tabs.length === 0) {
    return [{ key: "main", labelKey: "main", icon: manifest.icon, default: true }];
  }
  return manifest.tabs.map((tab) => ({
    key: tab.key,
    labelKey: tab.labelKey,
    icon: tab.icon,
    default: tab.default,
  }));
}

// ============================================================================
// Stats Conversion
// ============================================================================

function manifestToStats(manifest: MiniAppManifest): StatConfig[] | undefined {
  if (!manifest.stats || manifest.stats.length === 0) return undefined;
  return manifest.stats.map((stat: StatDefinition) => ({
    labelKey: stat.labelKey,
    valueKey: stat.valueKey,
    // Map extended stat formats to the subset MiniAppTemplateConfig supports
    format: stat.format === "gas" || stat.format === "text"
      ? "number" as const
      : stat.format,
    icon: stat.icon,
    // Map "warning" variant to "danger" for legacy compatibility
    variant: stat.variant === "warning" ? "danger" as const : stat.variant,
  }));
}

// ============================================================================
// Docs Conversion
// ============================================================================

function manifestToDocs(manifest: MiniAppManifest): DocsConfig | undefined {
  if (!manifest.docs || manifest.docs.length === 0) return undefined;

  const stepsSection = manifest.docs.find((d) => d.type === "steps");
  const featuresSection = manifest.docs.find((d) => d.type === "features");
  const textSection = manifest.docs.find((d) => !d.type || d.type === "text");

  return {
    titleKey: textSection?.titleKey ?? manifest.docs[0]?.titleKey,
    subtitleKey: textSection?.contentKey,
    stepKeys: stepsSection ? [stepsSection.contentKey] : undefined,
    featureKeys: featuresSection
      ? [{ nameKey: featuresSection.titleKey, descKey: featuresSection.contentKey }]
      : undefined,
  };
}

// ============================================================================
// Content Type Resolution
// ============================================================================

function resolveContentType(manifest: MiniAppManifest): ContentType {
  if (manifest.operations && manifest.operations.length > 0) return "two-column";
  if (manifest.shell === "game") return "game-board";
  if (manifest.shell === "market") return "market-list";
  if (manifest.shell === "console") return "dashboard";
  return "two-column";
}

// ============================================================================
// Main Conversion
// ============================================================================

/**
 * Convert a MiniAppManifest into the MiniAppTemplateConfig that
 * MiniAppPage expects.
 *
 * This automatically:
 * - Maps manifest tabs to TabConfig (appending a docs tab)
 * - Maps manifest stats to StatConfig
 * - Maps manifest docs to DocsConfig
 * - Resolves the content type from shell/operations config
 * - Sets feature flags from manifest.features
 */
export function manifestToTemplateConfig(manifest: MiniAppManifest): MiniAppTemplateConfig {
  const tabs = manifestToTabs(manifest);
  const stats = manifestToStats(manifest);
  const docs = manifestToDocs(manifest);
  const contentType = resolveContentType(manifest);

  // Append a docs tab (matching createMiniApp behavior)
  const allTabs: TabConfig[] = [
    ...tabs,
    { key: "docs", labelKey: "docs", icon: "book" },
  ];

  const config: MiniAppTemplateConfig = {
    contentType,
    tabs: allTabs,
    features: {
      fireworks: manifest.features?.fireworks ?? false,
      chainWarning: manifest.features?.chainWarning ?? true,
      statusMessages: true,
      docs,
    },
  };

  if (stats) {
    config.stats = stats;
  }

  return config;
}
