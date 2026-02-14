import type { ContentType, DocsConfig, MiniAppTemplateConfig } from "@shared/types/template-config";
import { createTemplateConfig, type CreateTemplateConfigOptions } from "./createTemplateConfig";

type PresetConfigOptions = Omit<CreateTemplateConfigOptions, "tabs" | "contentType">;

export interface TemplatePresetDefinition {
  contentType: ContentType;
  config?: PresetConfigOptions;
}

export const TEMPLATE_PRESETS = {
  "game-board": { contentType: "game-board" },
  "market-list": { contentType: "market-list" },
  "form-panel": { contentType: "form-panel" },
  dashboard: { contentType: "dashboard" },
  "swap-interface": { contentType: "swap-interface" },
  "timer-hero": { contentType: "timer-hero" },
  "two-column": { contentType: "two-column" },
  custom: { contentType: "custom" },
} as const satisfies Record<ContentType, TemplatePresetDefinition>;

export type TemplatePresetType = keyof typeof TEMPLATE_PRESETS;

export const TEMPLATE_PRESET_TYPES = Object.keys(TEMPLATE_PRESETS) as TemplatePresetType[];

export type CreateTemplateConfigFromPresetOptions = Omit<CreateTemplateConfigOptions, "contentType">;

function createScaffoldDocsConfig(): DocsConfig {
  return {
    titleKey: "title",
    subtitleKey: "description",
    stepKeys: [],
    featureKeys: [],
  };
}

export function resolveTemplatePreset(templateType: string): TemplatePresetDefinition {
  return TEMPLATE_PRESETS[templateType as TemplatePresetType] ?? TEMPLATE_PRESETS.custom;
}

export function createTemplateConfigFromPreset(
  templateType: string,
  options: CreateTemplateConfigFromPresetOptions,
): MiniAppTemplateConfig {
  const preset = resolveTemplatePreset(templateType);
  const presetDocs = preset.config?.docs ?? createScaffoldDocsConfig();

  return createTemplateConfig({
    ...(preset.config ?? {}),
    ...options,
    contentType: preset.contentType,
    docs: options.docs ?? presetDocs,
  });
}
