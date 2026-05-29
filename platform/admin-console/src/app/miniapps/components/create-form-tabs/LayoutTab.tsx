"use client";

import { Input } from "@/components/ui/Input";
import { ContentBlocksEditor } from "../CreateFormSubEditors";
import type { MiniAppFormState } from "../../lib/form-types";

type FrontendSpecFormat = "markdown" | "yaml" | "json";

type ContentBlock = {
  type: string;
  title?: string;
  content?: string;
  items?: string[];
  tone?: string;
  entries?: Array<{ key: string; value: string }>;
  links?: Array<{ label: string; href: string }>;
};

type Props = {
  form: MiniAppFormState;
  update: (key: string, value: string | boolean) => void;
  dtTabs: Array<{
    id: string;
    label: string;
    type: string;
    blocks?: ContentBlock[];
  }>;
  dtHero: Record<string, string>;
  dtOp: Record<string, string>;
  updateDT: (updates: Record<string, unknown>) => void;
};

export function LayoutTab({
  form,
  update,
  dtTabs,
  dtHero,
  dtOp,
  updateDT,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="block text-sm font-medium text-gray-700 mb-2">
          Hero
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Eyebrow"
            placeholder="e.g. Prediction Market"
            value={dtHero.eyebrow || ""}
            onChange={(e) =>
              updateDT({ hero: { ...dtHero, eyebrow: e.target.value } })
            }
          />
          <Input
            label="Disclaimer"
            placeholder="e.g. Probabilities are market-implied."
            value={dtHero.disclaimer || ""}
            onChange={(e) =>
              updateDT({ hero: { ...dtHero, disclaimer: e.target.value } })
            }
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-700">
            Tabs
          </div>
          <button
            type="button"
            onClick={() =>
              updateDT({
                tabs: [
                  ...dtTabs,
                  {
                    id: `tab-${dtTabs.length}`,
                    label: "New Tab",
                    type: "content",
                    blocks: [],
                  },
                ],
              })
            }
            className="cursor-pointer rounded-lg text-xs text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          >
            + Add Tab
          </button>
        </div>
        {dtTabs.map((t, i) => (
          <div
            key={i}
            className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={`tab-id-${i}`}
                placeholder="ID"
                value={t.id}
                onChange={(e) => {
                  const next = [...dtTabs];
                  next[i] = { ...next[i], id: e.target.value };
                  updateDT({ tabs: next });
                }}
                aria-label="Tab ID"
              />
              <Input
                id={`tab-label-${i}`}
                placeholder="Label"
                value={t.label}
                onChange={(e) => {
                  const next = [...dtTabs];
                  next[i] = { ...next[i], label: e.target.value };
                  updateDT({ tabs: next });
                }}
                aria-label="Tab label"
              />
              <select
                id={`tab-type-${i}`}
                className="w-32 shrink-0 cursor-pointer rounded-xl border border-gray-300 bg-white p-1.5 text-xs text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                value={t.type}
                onChange={(e) => {
                  const next = [...dtTabs];
                  next[i] = { ...next[i], type: e.target.value };
                  updateDT({ tabs: next });
                }}
                aria-label="Tab type"
              >
                {["content", "reviews", "forum", "news", "secrets"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  updateDT({ tabs: dtTabs.filter((_, idx) => idx !== i) })
                }
                className="shrink-0 cursor-pointer rounded-lg px-2 text-xs text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
              >
                Remove
              </button>
            </div>
            {t.type === "content" && (
              <ContentBlocksEditor
                blocks={t.blocks || []}
                onChange={(blocks) => {
                  const next = [...dtTabs];
                  next[i] = { ...next[i], blocks };
                  updateDT({ tabs: next });
                }}
              />
            )}
          </div>
        ))}
        {!dtTabs.length && (
          <p className="text-xs text-gray-500">
            No tabs added
          </p>
        )}
      </div>

      <div>
        <div className="block text-sm font-medium text-gray-700 mb-2">
          Operation Panel
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input
            label="Title"
            placeholder="Operations"
            value={dtOp.title || ""}
            onChange={(e) =>
              updateDT({ operation_panel: { ...dtOp, title: e.target.value } })
            }
          />
          <Input
            label="Subtitle"
            placeholder="Configure and submit."
            value={dtOp.subtitle || ""}
            onChange={(e) =>
              updateDT({
                operation_panel: { ...dtOp, subtitle: e.target.value },
              })
            }
          />
          <Input
            label="CTA Label"
            placeholder="Open App"
            value={dtOp.cta_label || ""}
            onChange={(e) =>
              updateDT({
                operation_panel: { ...dtOp, cta_label: e.target.value },
              })
            }
          />
        </div>
      </div>

      <div>
        <div className="block text-sm font-medium text-gray-700 mb-2">
          Frontend Spec (Optional)
        </div>
        <div className="mb-2 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label
              htmlFor="frontend-spec-format"
              className="block text-xs text-gray-500 mb-1"
            >
              Format
            </label>
            <select
              id="frontend-spec-format"
              className="w-full cursor-pointer rounded-xl border border-gray-300 bg-white p-2 text-sm text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              value={form.frontend_spec_format}
              onChange={(e) =>
                update(
                  "frontend_spec_format",
                  e.target.value as FrontendSpecFormat,
                )
              }
            >
              <option value="markdown">markdown</option>
              <option value="yaml">yaml</option>
              <option value="json">json</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <div className="block text-xs text-gray-500 mb-1">
              Spec Content
            </div>
            <textarea
              id="frontend-spec-content"
              className="w-full resize-none rounded-xl border border-gray-300 bg-white p-2 font-mono text-xs text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              rows={6}
              placeholder={
                form.frontend_spec_format === "markdown"
                  ? "# Overview\n\nDescribe app details..."
                  : form.frontend_spec_format === "yaml"
                    ? "page_template:\n layout: prediction"
                    : '{\n "page_template": { "layout": "default" }\n}'
              }
              value={form.frontend_spec_content}
              onChange={(e) => update("frontend_spec_content", e.target.value)}
              aria-label="Frontend spec content"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Supports `markdown`, `yaml`, or `json`. Host app will render
          tabs/operation panel from this definition.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="logic-json"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Logic JSON (Optional)
          </label>
          <textarea
            id="logic-json"
            className="w-full resize-none rounded-xl border border-gray-300 bg-white p-2 font-mono text-xs text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            rows={6}
            value={form.logic_json}
            onChange={(e) => update("logic_json", e.target.value)}
            placeholder={`{\n "triggers": [],\n "callbacks": {}\n}`}
          />
        </div>
        <div>
          <label
            htmlFor="marketplace-json"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Marketplace JSON (Optional)
          </label>
          <textarea
            id="marketplace-json"
            className="w-full resize-none rounded-xl border border-gray-300 bg-white p-2 font-mono text-xs text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            rows={6}
            value={form.marketplace_json}
            onChange={(e) => update("marketplace_json", e.target.value)}
            placeholder={`{\n "publishable": true,\n "pricing": { "model": "free" }\n}`}
          />
        </div>
      </div>
    </div>
  );
}
