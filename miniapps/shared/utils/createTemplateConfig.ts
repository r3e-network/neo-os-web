import type { MiniAppTemplateConfig, TabConfig, ContentType, DocsConfig } from "@shared/types/template-config";

interface CreateTemplateConfigOptions {
  /** Custom tabs BEFORE the auto-appended docs tab */
  tabs: TabConfig[];
  /** Defaults to "two-column" */
  contentType?: ContentType;
  /** Defaults to false */
  fireworks?: boolean;
  /** Defaults to true */
  chainWarning?: boolean;
  /** Number of doc feature entries — defaults to 2 */
  docFeatureCount?: number;
  /** Number of doc step entries — defaults to 4 */
  docStepCount?: number;
  /** Prefix for step keys — defaults to "step" (produces step1, step2, ...) */
  docStepPrefix?: string;
  /** Prefix for feature keys — defaults to "feature" (produces feature1Name, feature1Desc, ...) */
  docFeaturePrefix?: string;
  /** Override for docs titleKey — defaults to "title" */
  docTitleKey?: string;
  /** Override for docs subtitleKey — defaults to "docSubtitle" */
  docSubtitleKey?: string;
  /** Full docs override — when provided, all other doc* options are ignored */
  docs?: DocsConfig;
  /** Stats config if needed */
  stats?: MiniAppTemplateConfig["stats"];
  /** Two-column config if needed */
  twoColumn?: MiniAppTemplateConfig["twoColumn"];
}

export function createTemplateConfig(options: CreateTemplateConfigOptions): MiniAppTemplateConfig {
  const {
    tabs,
    contentType = "two-column",
    fireworks = false,
    chainWarning = true,
    docFeatureCount = 2,
    docStepCount = 4,
    docStepPrefix = "step",
    docFeaturePrefix = "feature",
    docTitleKey = "title",
    docSubtitleKey = "docSubtitle",
  } = options;

  const docs: DocsConfig = options.docs ?? {
    titleKey: docTitleKey,
    subtitleKey: docSubtitleKey,
    stepKeys: Array.from({ length: docStepCount }, (_, i) => `${docStepPrefix}${i + 1}`),
    featureKeys: Array.from({ length: docFeatureCount }, (_, i) => ({
      nameKey: `${docFeaturePrefix}${i + 1}Name`,
      descKey: `${docFeaturePrefix}${i + 1}Desc`,
    })),
  };

  return {
    contentType,
    tabs: [...tabs, { key: "docs", labelKey: "docs", icon: "📖" }],
    ...(options.stats && { stats: options.stats }),
    ...(options.twoColumn && { twoColumn: options.twoColumn }),
    features: {
      ...(fireworks && { fireworks: true }),
      chainWarning,
      statusMessages: true,
      docs,
    },
  };
}
