import type { DocsConfig, OperationBoxConfig, OperationField, OperationButtonOption } from "@shared/types/template-config";

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

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

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
  const summaryArgType =
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
    argType: summaryArgType,
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

export function readRuntimeUIConfig(): RuntimeUIConfig | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window as Window & { MiniAppSDK?: { getConfig?: () => Record<string, unknown> } };
  const config = host.MiniAppSDK?.getConfig?.();
  const ui = asObject(config?.uiConfig);
  return Object.keys(ui).length > 0 ? (ui as RuntimeUIConfig) : undefined;
}

export function buildRuntimeTemplateOverrides() {
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
