/**
 * createMiniApp — Unified factory for miniapp page initialization
 *
 * Eliminates the repeated boilerplate found in every miniapp's index.vue:
 *   - i18n setup (createUseI18n)
 *   - Template config (createTemplateConfig)
 *   - Sidebar items (createSidebarItems)
 *   - Error boundary handler binding
 *   - Status message (useStatusMessage)
 *
 * Each miniapp provides a declarative config; the factory returns
 * all the reactive refs and helpers the template needs.
 *
 * @example
 * ```ts
 * const {
 *   t, templateConfig, sidebarItems, sidebarTitle,
 *   status, setStatus, clearStatus,
 *   handleBoundaryError, fallbackMessage,
 * } = createMiniApp({
 *   name: "burn-league",
 *   messages,
 *   template: {
 *     tabs: [{ key: "game", labelKey: "game", icon: "🎮", default: true }],
 *     fireworks: true,
 *   },
 *   sidebarItems: [
 *     { labelKey: "totalBurned", value: () => totalBurned.value },
 *   ],
 * });
 * ```
 */

import type { MiniAppFactoryConfig } from "@shared/types/miniapp-config";
import type {
  ContentType,
  DocsConfig,
  MiniAppTemplateConfig,
  OperationBoxConfig,
  OperationButtonOption,
  OperationField,
  TabConfig,
} from "@shared/types/template-config";
import type { ComputedRef } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { useStatusMessage, type StatusMessage } from "@shared/composables/useStatusMessage";
import { createSidebarItems } from "./createSidebarItems";

type SidebarValue = string | number | boolean | null | undefined;

type RuntimeDocsConfig = {
  title?: string;
  subtitle?: string;
  steps?: string[];
  features?: Array<{ name?: string; description?: string; desc?: string }>;
};

type RuntimeOperationConfig = {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionMethod?: string;
  fields?: Array<{
    key?: string;
    type?: string;
    label?: string;
    placeholder?: string;
    required?: boolean;
    default?: string | number | boolean;
    validation?: { min?: number; max?: number; pattern?: string };
    argType?: string;
    options?: Array<{ value?: string; label?: string }>;
  }>;
  summary?: Array<{ label?: string; valueKey?: string; format?: string }>;
};

type RuntimeOperationField = NonNullable<RuntimeOperationConfig["fields"]>[number];

type RuntimeButtonConfig = {
  id?: string;
  label?: string;
  variant?: string;
  action?: {
    type?: string;
    method?: string;
    href?: string;
    copyText?: string;
    args?: Array<string | number | boolean>;
    openInNewTab?: boolean;
  };
};

type RuntimeUIConfig = {
  docs?: RuntimeDocsConfig;
  operation?: RuntimeOperationConfig;
  buttons?: RuntimeButtonConfig[];
};

const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const toString = (v: unknown): string => (v == null ? "" : String(v).trim());

function parseDocs(raw: RuntimeDocsConfig | undefined): DocsConfig | undefined {
  if (!raw || !toString(raw.title)) return undefined;
  return {
    title: toString(raw.title),
    subtitle: toString(raw.subtitle) || undefined,
    steps: Array.isArray(raw.steps) ? raw.steps.map((step) => toString(step)).filter(Boolean) : undefined,
    features: Array.isArray(raw.features)
      ? raw.features
          .map((feature) => {
            const name = toString(feature?.name);
            if (!name) return null;
            return {
              name,
              desc: toString(feature?.description ?? feature?.desc),
            };
          })
          .filter((feature): feature is { name: string; desc: string } => Boolean(feature))
      : undefined,
  };
}

function parseField(raw: RuntimeOperationField): OperationField | null {
  const key = toString(raw?.key);
  const label = toString(raw?.label);
  if (!key || !label) return null;

  const allowedType = toString(raw?.type).toLowerCase();
  const type = ["amount", "address", "select", "toggle", "number", "text"].includes(allowedType)
    ? (allowedType as OperationField["type"])
    : "text";
  const argType = toString(raw?.argType);
  const normalizedArgType =
    argType === "String" || argType === "Integer" || argType === "Boolean" || argType === "Hash160" || argType === "Any"
      ? argType
      : undefined;

  return {
    key,
    type,
    label,
    placeholder: toString(raw?.placeholder) || undefined,
    required: raw?.required === true,
    default: raw?.default,
    validation: raw?.validation,
    argType: normalizedArgType,
    options: Array.isArray(raw?.options)
      ? raw.options
          .map((option) => {
            const value = toString(option?.value);
            const optionLabel = toString(option?.label);
            if (!value || !optionLabel) return null;
            return { value, label: optionLabel };
          })
          .filter((option): option is { value: string; label: string } => Boolean(option))
      : undefined,
  };
}

function parseButtons(raw: RuntimeButtonConfig[] | undefined): OperationButtonOption[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;

  const buttons = raw
    .map((button) => {
      const id = toString(button.id);
      const label = toString(button.label);
      const action = asObject(button.action);
      const actionType = toString(action.type).toLowerCase();

      if (!id || !label || !["invoke", "link", "copy"].includes(actionType)) {
        return null;
      }

      const variant = toString(button.variant).toLowerCase();
      return {
        id,
        label,
        variant: ["primary", "secondary", "danger"].includes(variant)
          ? (variant as OperationButtonOption["variant"])
          : undefined,
        action: {
          type: actionType as OperationButtonOption["action"]["type"],
          method: toString(action.method) || undefined,
          href: toString(action.href) || undefined,
          copyText: toString(action.copyText) || undefined,
          args: Array.isArray(action.args) ? (action.args as Array<string | number | boolean>) : undefined,
          openInNewTab: action.openInNewTab === true,
        },
      } satisfies OperationButtonOption;
    })
    .filter((button): button is OperationButtonOption => Boolean(button));

  return buttons.length > 0 ? buttons : undefined;
}

function parseOperation(raw: RuntimeOperationConfig | undefined, buttons: OperationButtonOption[] | undefined): OperationBoxConfig | undefined {
  if (!raw || !toString(raw.title)) return undefined;

  const fields = Array.isArray(raw.fields) ? raw.fields.map(parseField).filter((field): field is OperationField => Boolean(field)) : [];
  const actionLabel = toString(raw.actionLabel) || undefined;
  const actionMethod = toString(raw.actionMethod) || undefined;
  const summaryKeys = Array.isArray(raw.summary)
    ? raw.summary
        .map((summary) => {
          const label = toString(summary.label);
          const valueKey = toString(summary.valueKey);
          if (!label || !valueKey) return null;
          const format = toString(summary.format).toLowerCase();
          return {
            label,
            valueKey,
            format: ["number", "currency", "percent", "duration"].includes(format)
              ? (format as "number" | "currency" | "percent" | "duration")
              : undefined,
          };
        })
        .filter(
          (
            summary
          ): summary is {
            label: string;
            valueKey: string;
            format?: "number" | "currency" | "percent" | "duration";
          } => Boolean(summary)
        )
    : undefined;
  const description = toString(raw.description) || undefined;

  if (
    fields.length === 0 &&
    (!buttons || buttons.length === 0) &&
    !actionMethod &&
    (!summaryKeys || summaryKeys.length === 0) &&
    !description
  ) {
    return undefined;
  }

  return {
    title: toString(raw.title),
    description,
    fields,
    actionLabel,
    actionMethod,
    summaryKeys,
    buttons,
  };
}

function readRuntimeUIConfig(): RuntimeUIConfig | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window as Window & { MiniAppSDK?: { getConfig?: () => Record<string, unknown> } };
  const config = host.MiniAppSDK?.getConfig?.();
  const ui = asObject(config?.uiConfig);
  return Object.keys(ui).length > 0 ? (ui as RuntimeUIConfig) : undefined;
}

function buildRuntimeTemplateOverrides() {
  const runtime = readRuntimeUIConfig();
  if (!runtime) {
    return { docs: undefined, operation: undefined as OperationBoxConfig | undefined };
  }

  const buttons = parseButtons(runtime.buttons);
  const docs = parseDocs(runtime.docs);
  const operation = parseOperation(runtime.operation, buttons);

  return {
    docs,
    operation,
  };
}

type TemplateOptions = {
  tabs: TabConfig[];
  contentType?: ContentType;
  fireworks?: boolean;
  chainWarning?: boolean;
  docFeatureCount?: number;
  docStepCount?: number;
  docStepPrefix?: string;
  docFeaturePrefix?: string;
  docTitleKey?: string;
  docSubtitleKey?: string;
  docs?: DocsConfig;
  stats?: MiniAppTemplateConfig["stats"];
  twoColumn?: MiniAppTemplateConfig["twoColumn"];
};

function buildTemplateConfig(options: TemplateOptions): MiniAppTemplateConfig {
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

export interface MiniAppFactoryResult {
  /** i18n translation function */
  t: (key: string, args?: Record<string, string | number>) => string;
  /** Resolved template config for MiniAppShell / MiniAppTemplate */
  templateConfig: MiniAppTemplateConfig;
  /** Reactive sidebar items array */
  sidebarItems: ComputedRef<Array<{ label: string; value: SidebarValue }>>;
  /** Translated sidebar title */
  sidebarTitle: string;
  /** Translated fallback message for ErrorBoundary */
  fallbackMessage: string;
  /** Reactive status message ref */
  status: ReturnType<typeof useStatusMessage>["status"];
  /** Set a status message with type */
  setStatus: (msg: string, type: StatusMessage["type"]) => void;
  /** Clear the current status message */
  clearStatus: () => void;
  /** Error boundary handler scoped to this miniapp */
  handleBoundaryError: (error: Error) => void;
}

export function createMiniApp(config: MiniAppFactoryConfig): MiniAppFactoryResult {
  // --- i18n ---
  const { t } = createUseI18n(config.messages as Record<string, Record<string, string>>)();

  // --- Template config ---
  const { tabs, contentType, fireworks, chainWarning, stats, twoColumn, docs, ...docOptions } = config.template;
  const runtimeOverrides = buildRuntimeTemplateOverrides();
  const mergedOperation =
    runtimeOverrides.operation && twoColumn?.operation
      ? {
          ...twoColumn.operation,
          ...runtimeOverrides.operation,
          fields:
            runtimeOverrides.operation.fields && runtimeOverrides.operation.fields.length > 0
              ? runtimeOverrides.operation.fields
              : twoColumn.operation.fields,
          buttons: runtimeOverrides.operation.buttons ?? twoColumn.operation.buttons,
        }
      : runtimeOverrides.operation ?? twoColumn?.operation;
  const mergedTwoColumn =
    twoColumn || mergedOperation
      ? {
          ...(twoColumn ?? {}),
          ...(mergedOperation ? { operation: mergedOperation } : {}),
        }
      : undefined;
  const templateConfig = buildTemplateConfig({
    tabs,
    contentType,
    fireworks,
    chainWarning,
    stats,
    twoColumn: mergedTwoColumn,
    docs: runtimeOverrides.docs ?? docs,
    ...docOptions,
  });

  // --- Sidebar ---
  const sidebarItems = createSidebarItems(t as (key: string) => string, config.sidebarItems ?? []);
  const sidebarTitleKey = config.sidebarTitleKey ?? "overview";
  const sidebarTitle = (t as (key: string) => string)(sidebarTitleKey);

  // --- Status message ---
  const { status, setStatus, clearStatus } = useStatusMessage(config.statusTimeoutMs);

  // --- Error boundary ---
  const handleBoundaryError = (error: Error) => {
    console.error(`[${config.name}] boundary error:`, error);
  };
  const fallbackMessageKey = config.fallbackMessageKey ?? "errorFallback";
  const fallbackMessage = (t as (key: string) => string)(fallbackMessageKey);

  return {
    t: t as (key: string, args?: Record<string, string | number>) => string,
    templateConfig,
    sidebarItems,
    sidebarTitle,
    fallbackMessage,
    status,
    setStatus,
    clearStatus,
    handleBoundaryError,
  };
}
