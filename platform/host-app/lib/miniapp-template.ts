import type {
  MiniAppContentBlock,
  MiniAppDetailTab,
  MiniAppDetailTabType,
  MiniAppDetailTemplate,
  MiniAppOperationPanel,
  OperationEntry,
  OperationParam,
} from "@/components/types";
import yaml from "js-yaml";

type Dict = Record<string, unknown>;

type DetailConfigFallback = {
  detailTemplate?: MiniAppDetailTemplate | null;
  operations?: OperationEntry[] | null;
  manifest?: Record<string, unknown> | null;
};

const OP_PARAM_TYPES = new Set<OperationParam["type"]>([
  "string",
  "integer",
  "boolean",
  "address",
  "hash160",
  "hash256",
  "amount",
  "select",
]);

const TAB_TYPES = new Set<MiniAppDetailTabType>(["content", "reviews", "forum", "news", "secrets"]);

const FRONTEND_SPEC_KEYS = [
  "frontend_spec",
  "ui_spec",
  "frontend_definition",
  "page_definition",
] as const;

const FRONTEND_TEMPLATE_KEYS = [
  "detail_template",
  "page_template",
  "page_config",
  "ui",
  "page",
  "template",
] as const;

const OPERATION_KEYS = ["operations", "operation_schema"] as const;

function firstDefined(source: Dict, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined) {
      return source[key];
    }
  }
  return undefined;
}

function isTemplateMetadataObject(value: unknown): boolean {
  const obj = asObject(value);
  if (!Object.keys(obj).length) return false;

  const hasTemplateMetaHints =
    obj.template_type !== undefined ||
    obj.frontend_template !== undefined ||
    obj.contract_template !== undefined;

  if (!hasTemplateMetaHints) return false;

  const hasDetailTemplateShape =
    obj.layout !== undefined ||
    obj.tabs !== undefined ||
    obj.operation_panel !== undefined ||
    obj.operations !== undefined ||
    obj.page_template !== undefined ||
    obj.detail_template !== undefined;

  return !hasDetailTemplateShape;
}

function pickTemplateCandidate(source: Dict): unknown {
  for (const key of FRONTEND_TEMPLATE_KEYS) {
    const candidate = source[key];
    if (candidate === undefined) continue;
    if (key === "template" && isTemplateMetadataObject(candidate)) continue;
    return candidate;
  }
  return undefined;
}

function asObject(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Dict;
}

function asString(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function asTrimmedString(value: unknown): string {
  return asString(value).trim();
}

function asOptionalString(value: unknown): string | undefined {
  const out = asTrimmedString(value);
  return out || undefined;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
  return slug || fallback;
}

function normalizeTabType(value: unknown, id: string, label: string): MiniAppDetailTabType {
  const raw = asTrimmedString(value).toLowerCase();
  if (raw === "overview") return "content";
  if (TAB_TYPES.has(raw as MiniAppDetailTabType)) return raw as MiniAppDetailTabType;

  const fingerprint = `${id} ${label}`.toLowerCase();
  if (fingerprint.includes("review") || fingerprint.includes("comment")) return "reviews";
  if (fingerprint.includes("forum") || fingerprint.includes("discussion")) return "forum";
  if (fingerprint.includes("news") || fingerprint.includes("update") || fingerprint.includes("activity")) return "news";
  if (fingerprint.includes("secret")) return "secrets";
  return "content";
}

function coerceOperationParam(raw: unknown): OperationParam | null {
  const obj = asObject(raw);
  const name = asTrimmedString(obj.name);
  if (!name) return null;

  const rawType = asTrimmedString(obj.type).toLowerCase();
  const type = OP_PARAM_TYPES.has(rawType as OperationParam["type"])
    ? (rawType as OperationParam["type"])
    : "string";

  const optionsRaw = Array.isArray(obj.options) ? obj.options : [];
  const options = optionsRaw
    .map((option) => {
      const optionObj = asObject(option);
      const value = asTrimmedString(optionObj.value);
      if (!value) return null;
      const label = asTrimmedString(optionObj.label) || value;
      return { label, value };
    })
    .filter((option): option is { label: string; value: string } => Boolean(option));

  return {
    name,
    type,
    label: asOptionalString(obj.label),
    required: asOptionalBoolean(obj.required),
    default_value: asOptionalString(obj.default_value),
    placeholder: asOptionalString(obj.placeholder),
    options: options.length > 0 ? options : undefined,
    hidden: asOptionalBoolean(obj.hidden),
    scale: typeof obj.scale === "number" && Number.isFinite(obj.scale)
      ? obj.scale
      : undefined,
  };
}

export function coerceOperationEntries(raw: unknown): OperationEntry[] {
  if (!Array.isArray(raw)) return [];

  const operations = raw
    .map((item) => {
      const obj = asObject(item);
      const method = asTrimmedString(obj.method);
      if (!method) return null;
      const name = asTrimmedString(obj.name) || method;

      const paramsRaw = Array.isArray(obj.params) ? obj.params : [];
      const params = paramsRaw
        .map(coerceOperationParam)
        .filter((param): param is OperationParam => Boolean(param));

      const buttonStyleRaw = asTrimmedString(obj.button_style).toLowerCase();
      const buttonStyle =
        buttonStyleRaw === "primary" ||
        buttonStyleRaw === "secondary" ||
        buttonStyleRaw === "danger" ||
        buttonStyleRaw === "success"
          ? buttonStyleRaw
          : undefined;

      return {
        name,
        method,
        description: asOptionalString(obj.description),
        gas_cost: asOptionalString(obj.gas_cost),
        button_style: buttonStyle,
        confirm_message: asOptionalString(obj.confirm_message),
        params: params.length ? params : undefined,
      } as OperationEntry;
    })
    .filter((entry): entry is OperationEntry => Boolean(entry));

  const deduped = new Map<string, OperationEntry>();
  for (const operation of operations) {
    if (!deduped.has(operation.method)) {
      deduped.set(operation.method, operation);
    }
  }

  return Array.from(deduped.values());
}

function coerceOperationPanel(raw: unknown): MiniAppOperationPanel | null {
  const obj = asObject(raw);
  if (!Object.keys(obj).length) return null;

  const operations = coerceOperationEntries(obj.operations);

  const title = asOptionalString(obj.title);
  const subtitle = asOptionalString(obj.subtitle);
  const ctaLabel = asOptionalString(obj.cta_label ?? obj.ctaLabel);

  if (!title && !subtitle && !ctaLabel && operations.length === 0) {
    return null;
  }

  return {
    title,
    subtitle,
    cta_label: ctaLabel,
    operations,
  };
}

function coerceKeyValueItems(raw: unknown): Array<{ key: string; value: string }> {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const obj = asObject(item);
      const key = asTrimmedString(obj.key ?? obj.label ?? obj.name);
      const value = asTrimmedString(obj.value);
      if (!key || !value) return null;
      return { key, value };
    })
    .filter((entry): entry is { key: string; value: string } => Boolean(entry));
}

function coerceLinkItems(raw: unknown): Array<{ label: string; href: string; external?: boolean }> {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const obj = asObject(item);
      const href = asTrimmedString(obj.href ?? obj.url);
      if (!href) return null;
      const label = asTrimmedString(obj.label) || href;
      const external = asOptionalBoolean(obj.external);
      if (external === undefined) {
        return { label, href };
      }
      return { label, href, external };
    })
    .filter((entry): entry is { label: string; href: string; external?: boolean } => Boolean(entry));
}

function coerceContentBlock(raw: unknown): MiniAppContentBlock | null {
  const obj = asObject(raw);
  if (!Object.keys(obj).length) return null;

  const title = asOptionalString(obj.title);
  const blockTypeRaw = asTrimmedString(obj.type).toLowerCase();

  if (blockTypeRaw === "bullet_list" || blockTypeRaw === "list") {
    const items = (Array.isArray(obj.items) ? obj.items : [])
      .map((item) => asTrimmedString(item))
      .filter(Boolean);
    if (items.length === 0) return null;
    return { type: "bullet_list", title, items };
  }

  if (blockTypeRaw === "key_value" || blockTypeRaw === "facts") {
    const items = coerceKeyValueItems(obj.items);
    if (items.length === 0) return null;
    return { type: "key_value", title, items };
  }

  if (blockTypeRaw === "links") {
    const items = coerceLinkItems(obj.items);
    if (items.length === 0) return null;
    return { type: "links", title, items };
  }

  if (blockTypeRaw === "notice") {
    const content = asTrimmedString(obj.content ?? obj.text);
    if (!content) return null;
    const toneRaw = asTrimmedString(obj.tone).toLowerCase();
    const tone = toneRaw === "info" || toneRaw === "success" || toneRaw === "warning"
      ? toneRaw
      : undefined;
    return { type: "notice", title, tone, content };
  }

  const content = asTrimmedString(obj.content ?? obj.text);
  if (!content) return null;
  return {
    type: "markdown",
    title,
    content,
  };
}

export function coerceMiniAppContentBlocks(raw: unknown): MiniAppContentBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(coerceContentBlock)
    .filter((block): block is MiniAppContentBlock => Boolean(block));
}

function coerceDetailTabs(raw: unknown): MiniAppDetailTab[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();

  return raw
    .map((item, index) => {
      const obj = asObject(item);
      const label = asTrimmedString(obj.label) || `Tab ${index + 1}`;
      const id = slugify(asTrimmedString(obj.id) || label, `tab-${index + 1}`);
      if (seen.has(id)) return null;

      const type = normalizeTabType(obj.type, id, label);
      const blocks = coerceMiniAppContentBlocks(obj.blocks ?? obj.content_blocks);

      const content = asTrimmedString(obj.content);
      const mergedBlocks =
        blocks.length > 0 ? blocks : content && type === "content" ? [{ type: "markdown", content } as MiniAppContentBlock] : [];

      seen.add(id);

      return {
        id,
        label,
        type,
        blocks: mergedBlocks.length > 0 ? mergedBlocks : undefined,
      } as MiniAppDetailTab;
    })
    .filter((tab): tab is MiniAppDetailTab => Boolean(tab));
}

export function coerceMiniAppDetailTemplate(raw: unknown): MiniAppDetailTemplate | null {
  const obj = asObject(raw);
  if (!Object.keys(obj).length) return null;

  const layoutRaw = asTrimmedString(obj.layout).toLowerCase();
  const layout = layoutRaw === "prediction" || layoutRaw === "prediction_market" || layoutRaw === "market"
    ? "prediction"
    : "default";

  const tabs = coerceDetailTabs(obj.tabs);
  const operationPanel = coerceOperationPanel(obj.operation_panel ?? obj.operationPanel);

  const heroObj = asObject(obj.hero);
  const eyebrow = asOptionalString(heroObj.eyebrow);
  const disclaimer = asOptionalString(heroObj.disclaimer);
  const hero = eyebrow || disclaimer ? { eyebrow, disclaimer } : undefined;

  if (!hero && tabs.length === 0 && !operationPanel) {
    return null;
  }

  return {
    layout,
    hero,
    tabs,
    operation_panel: operationPanel || undefined,
  };
}

function isRecordWithKeys(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value as Dict).length > 0);
}

function buildMarkdownFrontendSpec(markdown: string): Dict {
  const content = asTrimmedString(markdown);
  if (!content) return {};

  return {
    page_template: {
      layout: "default",
      tabs: [
        {
          id: "overview",
          label: "Overview",
          type: "content",
          blocks: [
            {
              type: "markdown",
              content,
            },
          ],
        },
      ],
    },
  };
}

function parseStructuredSpecString(raw: string): Dict {
  const text = asTrimmedString(raw);
  if (!text) return {};

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "string") {
      return buildMarkdownFrontendSpec(parsed);
    }
    return asObject(parsed);
  } catch {
    // Continue to YAML parsing.
  }

  const yamlLikely =
    text.startsWith("---") ||
    /^\s*[a-zA-Z0-9_-]+\s*:/m.test(text);

  if (yamlLikely) {
    try {
      const parsed = yaml.load(text);
      if (typeof parsed === "string") {
        return buildMarkdownFrontendSpec(parsed);
      }
      return asObject(parsed);
    } catch {
      // Treat as markdown when YAML parsing fails.
    }
  }

  return buildMarkdownFrontendSpec(text);
}

function normalizeFrontendSpec(raw: unknown): Dict {
  if (typeof raw === "string") {
    return parseStructuredSpecString(raw);
  }

  const obj = asObject(raw);
  if (!Object.keys(obj).length) return {};

  const format = asTrimmedString(obj.format).toLowerCase();
  const content =
    obj.content ??
    obj.value ??
    obj.source ??
    obj.spec ??
    obj.raw;

  if ((format === "json" || format === "yaml") && typeof content === "string") {
    return parseStructuredSpecString(content);
  }
  if ((format === "md" || format === "markdown") && typeof content === "string") {
    return buildMarkdownFrontendSpec(content);
  }

  return obj;
}

function mergeOperationPanel(
  template: MiniAppDetailTemplate | null,
  panel: MiniAppOperationPanel | null,
  operations: OperationEntry[],
): MiniAppDetailTemplate | null {
  if (!template && !panel && operations.length === 0) {
    return null;
  }

  if (!template) {
    return {
      layout: "default",
      tabs: [],
      operation_panel: {
        ...(panel || {}),
        operations: operations.length > 0 ? operations : panel?.operations || [],
      },
    };
  }

  const existingPanel = template.operation_panel;
  const basePanel = panel || existingPanel;
  if (!basePanel && operations.length === 0) {
    return template;
  }

  return {
    ...template,
    operation_panel: {
      ...(basePanel || {}),
      operations: operations.length > 0 ? operations : basePanel?.operations || [],
    },
  };
}

export function resolveMiniAppDetailConfig(
  raw: unknown,
  fallback: DetailConfigFallback = {},
): {
  detailTemplate: MiniAppDetailTemplate | null;
  operations: OperationEntry[];
  manifest: Record<string, unknown> | null;
} {
  const obj = asObject(raw);

  const fallbackManifest = isRecordWithKeys(fallback.manifest) ? fallback.manifest : null;
  const manifestObjRaw = obj.manifest;
  const manifest = isRecordWithKeys(manifestObjRaw)
    ? (manifestObjRaw as Record<string, unknown>)
    : fallbackManifest;

  const manifestTyped = asObject(manifest);
  const frontendSpec = normalizeFrontendSpec(
    firstDefined(obj, FRONTEND_SPEC_KEYS) ?? firstDefined(manifestTyped, FRONTEND_SPEC_KEYS),
  );

  const frontendTemplateCandidate = pickTemplateCandidate(frontendSpec) ?? (isRecordWithKeys(frontendSpec) ? frontendSpec : undefined);

  const templateCandidate =
    pickTemplateCandidate(obj) ??
    frontendTemplateCandidate ??
    pickTemplateCandidate(manifestTyped) ??
    fallback.detailTemplate;

  let detailTemplate = coerceMiniAppDetailTemplate(templateCandidate) ?? fallback.detailTemplate ?? null;

  const operationPanel =
    coerceOperationPanel(obj.operation_panel) ??
    coerceOperationPanel(frontendSpec.operation_panel) ??
    coerceOperationPanel(manifestTyped.operation_panel) ??
    null;

  const operationCandidates = [
    ...OPERATION_KEYS.map((key) => obj[key]),
    ...OPERATION_KEYS.map((key) => frontendSpec[key]),
    ...OPERATION_KEYS.map((key) => manifestTyped[key]),
    operationPanel?.operations,
    detailTemplate?.operation_panel?.operations,
    fallback.operations,
  ];

  let operations: OperationEntry[] = [];
  for (const candidate of operationCandidates) {
    const parsed = coerceOperationEntries(candidate);
    if (parsed.length > 0) {
      operations = parsed;
      break;
    }
  }

  detailTemplate = mergeOperationPanel(detailTemplate, operationPanel, operations);

  if (!operations.length && detailTemplate?.operation_panel?.operations?.length) {
    operations = detailTemplate.operation_panel.operations;
  }

  return {
    detailTemplate,
    operations,
    manifest: manifest ? manifest : null,
  };
}
