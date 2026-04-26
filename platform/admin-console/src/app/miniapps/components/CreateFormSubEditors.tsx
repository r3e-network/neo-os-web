"use client";

import { Input } from "@/components/ui/Input";

type OperationParam = {
  name: string;
  type: string;
  label: string;
  required: boolean;
  default_value: string;
  placeholder: string;
  options: string;
};

type ContentBlock = {
  type: string;
  title?: string;
  content?: string;
  items?: string[];
  tone?: string;
  entries?: Array<{ key: string; value: string }>;
  links?: Array<{ label: string; href: string }>;
};

const PARAM_TYPES = [
  "string",
  "integer",
  "boolean",
  "address",
  "hash256",
  "amount",
  "select",
];
const BLOCK_TYPES = [
  "markdown",
  "bullet_list",
  "key_value",
  "notice",
  "links",
] as const;

export function OperationParamsEditor({
  params,
  onChange,
}: {
  params: OperationParam[];
  onChange: (p: OperationParam[]) => void;
}) {
  const add = () =>
    onChange([
      ...params,
      {
        name: "",
        type: "string",
        label: "",
        required: true,
        default_value: "",
        placeholder: "",
        options: "",
      },
    ]);
  const remove = (i: number) => onChange(params.filter((_, idx) => idx !== i));
  const update = (
    i: number,
    field: keyof OperationParam,
    val: string | boolean,
  ) => {
    const next = [...params];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="pl-4 border-l-2 border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Parameters
        </span>
        <button
          type="button"
          onClick={add}
          className="text-xs cursor-pointer text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md"
        >
          + Add Param
        </button>
      </div>
      {params.map((p, i) => (
        <div key={i} className="flex gap-1.5 mb-1.5 items-center">
          <Input
            id={`param-name-${i}`}
            placeholder="name"
            value={p.name}
            onChange={(e) => update(i, "name", e.target.value)}
            aria-label="Parameter name"
          />
          <select
            id={`param-type-${i}`}
            className="rounded-md border border-gray-300 dark:border-gray-600 p-1.5 text-xs cursor-pointer transition-colors dark:bg-gray-800 dark:text-gray-100 w-28 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            value={p.type}
            onChange={(e) => update(i, "type", e.target.value)}
            aria-label="Parameter type"
          >
            {PARAM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Input
            id={`param-label-${i}`}
            placeholder="Label"
            value={p.label}
            onChange={(e) => update(i, "label", e.target.value)}
            aria-label="Parameter label"
          />
          <Input
            id={`param-placeholder-${i}`}
            placeholder="Placeholder"
            value={p.placeholder}
            onChange={(e) => update(i, "placeholder", e.target.value)}
            aria-label="Parameter placeholder"
          />
          <label
            htmlFor={`param-required-${i}`}
            className="flex items-center gap-1 text-xs shrink-0 cursor-pointer"
          >
            <input
              id={`param-required-${i}`}
              type="checkbox"
              checked={p.required}
              onChange={(e) => update(i, "required", e.target.checked)}
              className="rounded accent-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            />
            Req
          </label>
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-red-500 dark:text-red-400 text-xs px-1 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-lg"
            aria-label={`Remove parameter ${i + 1}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function ContentBlocksEditor({
  blocks,
  onChange,
}: {
  blocks: ContentBlock[];
  onChange: (b: ContentBlock[]) => void;
}) {
  const updateBlock = (i: number, updates: Partial<ContentBlock>) => {
    const next = [...blocks];
    next[i] = { ...next[i], ...updates };
    onChange(next);
  };
  return (
    <div className="pl-4 border-l-2 border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Content Blocks
        </span>
        <select
          id="block-type-select"
          className="text-xs cursor-pointer text-primary-600 border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              onChange([...blocks, { type: e.target.value, title: "" }]);
              e.target.value = "";
            }
          }}
          aria-label="Add block type"
        >
          <option value="" disabled>
            + Add Block
          </option>
          {BLOCK_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {blocks.map((b, i) => (
        <div
          key={i}
          className="rounded border border-gray-100 dark:border-gray-700 p-2 mb-2 space-y-1"
        >
          <div className="flex gap-2 items-center">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 shrink-0">
              {b.type}
            </span>
            <Input
              id={`block-title-${i}`}
              placeholder="Title"
              value={b.title || ""}
              onChange={(e) => updateBlock(i, { title: e.target.value })}
              aria-label="Block title"
            />
            <button
              type="button"
              aria-label={`Remove ${b.type} block ${i + 1}`}
              onClick={() => onChange(blocks.filter((_, idx) => idx !== i))}
              className="text-red-500 dark:text-red-400 text-xs px-1 shrink-0 cursor-pointer rounded-lg"
            >
              ×
            </button>
          </div>
          <BlockFields
            blockIndex={i}
            block={b}
            onChange={(updates) => updateBlock(i, updates)}
          />
        </div>
      ))}
    </div>
  );
}

function BlockFields({
  blockIndex,
  block,
  onChange,
}: {
  blockIndex: number;
  block: ContentBlock;
  onChange: (u: Partial<ContentBlock>) => void;
}) {
  const t = block.type;
  if (t === "markdown")
    return (
      <textarea
        id={`content-block-markdown-${blockIndex}`}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-xs resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
        rows={3}
        placeholder="Markdown content"
        value={block.content || ""}
        onChange={(e) => onChange({ content: e.target.value })}
        aria-label={`Markdown content for block ${blockIndex + 1}`}
      />
    );
  if (t === "bullet_list")
    return (
      <Input
        id={`content-block-bullet-list-${blockIndex}`}
        placeholder="Items (comma-separated)"
        value={(block.items || []).join(", ")}
        onChange={(e) =>
          onChange({
            items: e.target.value
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean),
          })
        }
        aria-label={`Bullet list items for block ${blockIndex + 1}`}
      />
    );
  if (t === "notice")
    return (
      <div className="flex gap-2">
        <select
          id={`notice-tone-${blockIndex}`}
          className="rounded-md border border-gray-300 dark:border-gray-600 p-1.5 text-xs cursor-pointer dark:bg-gray-800 dark:text-gray-100 w-28 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          value={block.tone || "info"}
          onChange={(e) => onChange({ tone: e.target.value })}
          aria-label={`Notice tone for block ${blockIndex + 1}`}
        >
          {["info", "success", "warning"].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <Input
          id={`content-block-notice-${blockIndex}`}
          placeholder="Content"
          value={block.content || ""}
          onChange={(e) => onChange({ content: e.target.value })}
          aria-label={`Notice content for block ${blockIndex + 1}`}
        />
      </div>
    );
  if (t === "key_value")
    return (
      <KVEditor
        entries={block.entries || []}
        onChange={(entries) => onChange({ entries })}
      />
    );
  if (t === "links")
    return (
      <LinksEditor
        links={block.links || []}
        onChange={(links) => onChange({ links })}
      />
    );
  return null;
}

function KVEditor({
  entries,
  onChange,
}: {
  entries: Array<{ key: string; value: string }>;
  onChange: (e: Array<{ key: string; value: string }>) => void;
}) {
  return (
    <div>
      {entries.map((e, i) => (
        <div key={i} className="flex gap-1.5 mb-1">
          <Input
            id={`kv-key-${i}`}
            placeholder="Key"
            value={e.key}
            onChange={(ev) => {
              const n = [...entries];
              n[i] = { ...n[i], key: ev.target.value };
              onChange(n);
            }}
            aria-label="Key"
          />
          <Input
            id={`kv-value-${i}`}
            placeholder="Value"
            value={e.value}
            onChange={(ev) => {
              const n = [...entries];
              n[i] = { ...n[i], value: ev.target.value };
              onChange(n);
            }}
            aria-label="Value"
          />
          <button
            type="button"
            aria-label={`Remove pair ${i + 1}`}
            onClick={() => onChange(entries.filter((_, idx) => idx !== i))}
            className="text-red-500 dark:text-red-400 text-xs px-1 shrink-0 cursor-pointer rounded-lg"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        aria-label="Add pair"
        onClick={() => onChange([...entries, { key: "", value: "" }])}
        className="text-xs cursor-pointer text-primary-600 hover:underline rounded-md"
      >
        + Add pair
      </button>
    </div>
  );
}

function LinksEditor({
  links,
  onChange,
}: {
  links: Array<{ label: string; href: string }>;
  onChange: (l: Array<{ label: string; href: string }>) => void;
}) {
  return (
    <div>
      {links.map((l, i) => (
        <div key={i} className="flex gap-1.5 mb-1">
          <Input
            id={`link-label-${i}`}
            placeholder="Label"
            value={l.label}
            onChange={(e) => {
              const n = [...links];
              n[i] = { ...n[i], label: e.target.value };
              onChange(n);
            }}
            aria-label="Link label"
          />
          <Input
            id={`link-url-${i}`}
            placeholder="https://..."
            value={l.href}
            onChange={(e) => {
              const n = [...links];
              n[i] = { ...n[i], href: e.target.value };
              onChange(n);
            }}
            aria-label="Link URL"
          />
          <button
            type="button"
            aria-label={`Remove link ${i + 1}`}
            onClick={() => onChange(links.filter((_, idx) => idx !== i))}
            className="text-red-500 dark:text-red-400 text-xs px-1 shrink-0 cursor-pointer rounded-lg"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        aria-label="Add link"
        onClick={() => onChange([...links, { label: "", href: "" }])}
        className="text-xs cursor-pointer text-primary-600 hover:underline rounded-md"
      >
        + Add link
      </button>
    </div>
  );
}
