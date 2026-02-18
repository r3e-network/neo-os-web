// Runtime-configurable miniapp UI schema.
// Stored by admin tools and injected into MiniAppSDK.getConfig().uiConfig.

export type MiniAppOperationFieldType = "amount" | "address" | "select" | "toggle" | "number" | "text";

export type MiniAppOperationArgType = "String" | "Integer" | "Boolean" | "Hash160" | "Any";

export interface MiniAppOperationFieldOption {
  value: string;
  label: string;
}

export interface MiniAppOperationFieldConfig {
  key: string;
  type: MiniAppOperationFieldType;
  label: string;
  placeholder?: string;
  options?: MiniAppOperationFieldOption[];
  required?: boolean;
  default?: string | number | boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  argType?: MiniAppOperationArgType;
}

export interface MiniAppOperationSummaryRow {
  label: string;
  valueKey: string;
  format?: "number" | "currency" | "percent" | "duration";
}

export interface MiniAppOperationConfig {
  title: string;
  description?: string;
  fields: MiniAppOperationFieldConfig[];
  actionLabel?: string;
  actionMethod?: string;
  summary?: MiniAppOperationSummaryRow[];
}

export interface MiniAppDocsFeature {
  name: string;
  description: string;
}

export interface MiniAppDocsConfig {
  title: string;
  subtitle?: string;
  steps?: string[];
  features?: MiniAppDocsFeature[];
}

export type MiniAppButtonActionType = "invoke" | "link" | "copy";

export interface MiniAppButtonActionConfig {
  type: MiniAppButtonActionType;
  method?: string;
  href?: string;
  copyText?: string;
  args?: Array<string | number | boolean>;
  openInNewTab?: boolean;
}

export interface MiniAppButtonOption {
  id: string;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  action: MiniAppButtonActionConfig;
}

export interface MiniAppDisplayConfig {
  name?: string;
  description?: string;
  icon?: string;
  banner?: string;
}

export interface MiniAppRuntimeConfig {
  docs?: MiniAppDocsConfig;
  operation?: MiniAppOperationConfig;
  buttons?: MiniAppButtonOption[];
}

