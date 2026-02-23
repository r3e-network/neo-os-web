"use client";

import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { MiniAppMediaAssetKind } from "@/lib/hooks/useMiniApps";

type AssetVariantSettings = {
  theme: "" | "light" | "dark" | "any";
  density: "" | "1x" | "2x" | "3x";
  locale: string;
  applyAsPrimary: boolean;
};

type Props = {
  form: any;
  categories: string[];
  update: (key: string, value: string | boolean) => void;
  assetFiles: Partial<Record<MiniAppMediaAssetKind, File>>;
  assetVariantSettings: Record<"logo" | "banner", AssetVariantSettings>;
  updateAssetVariantSettings: (kind: "logo" | "banner", next: Partial<AssetVariantSettings>) => void;
  handleAssetFileSelect: (assetType: MiniAppMediaAssetKind, event: ChangeEvent<HTMLInputElement>) => void;
  onUploadMediaAsset: (assetType: MiniAppMediaAssetKind, file: File, options?: any) => Promise<void>;
  mediaUploadPending: boolean;
  mediaUploadError: string;
  mediaUploadInfo: string;
};

export function ContentTab({
  form,
  categories,
  update,
  assetFiles,
  assetVariantSettings,
  updateAssetVariantSettings,
  handleAssetFileSelect,
  onUploadMediaAsset,
  mediaUploadPending,
  mediaUploadError,
  mediaUploadInfo,
}: Props) {
  return (
    <div className="space-y-4">
      <textarea className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm transition-colors resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed" rows={3} placeholder="App description" value={form.content_description} onChange={e => update("content_description", e.target.value)} aria-label="App description" />
      <textarea className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm transition-colors resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed" rows={3} placeholder="App description (ZH)" value={form.description_zh} onChange={e => update("description_zh", e.target.value)} aria-label="App description zh" />
      <div className="grid grid-cols-3 gap-4">
        <Input label="Icon URL" placeholder="https://..." value={form.content_icon_url} onChange={e => update("content_icon_url", e.target.value)} />
        <Input label="Logo URL" placeholder="https://..." value={form.content_logo_url} onChange={e => update("content_logo_url", e.target.value)} />
        <Input label="Banner URL" placeholder="https://..." value={form.content_banner_url} onChange={e => update("content_banner_url", e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input label="Docs URL" placeholder="https://docs.example.com" value={form.content_docs_url} onChange={e => update("content_docs_url", e.target.value)} />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
          <select className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm cursor-pointer transition-colors dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50" value={form.content_category} onChange={e => update("content_category", e.target.value)} aria-label="Category">
            <option value="">Select...</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <Input label="Tags (comma-separated)" placeholder="game,defi" value={form.content_tags} onChange={e => update("content_tags", e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Logo Variants JSON</label>
          <textarea
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-xs font-mono transition-colors resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            rows={5}
            value={form.content_logo_variants_json}
            onChange={e => update("content_logo_variants_json", e.target.value)}
            placeholder={`[\n  { "url": "https://cdn/logo-dark.png", "theme": "dark" },\n  { "url": "https://cdn/logo-light.png", "theme": "light" }\n]`}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Banner Variants JSON</label>
          <textarea
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-xs font-mono transition-colors resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            rows={5}
            value={form.content_banner_variants_json}
            onChange={e => update("content_banner_variants_json", e.target.value)}
            placeholder={`[\n  { "url": "https://cdn/banner-dark.png", "theme": "dark" },\n  { "url": "https://cdn/banner-light.png", "theme": "light" }\n]`}
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload Media to Cloudflare R2 CDN</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Enter `app_id` first. Upload can update primary URL fields and variant JSON.
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {(["icon", "logo", "banner"] as MiniAppMediaAssetKind[]).map((assetType) => {
            const variantAssetType: "logo" | "banner" | null =
              assetType === "logo" || assetType === "banner" ? assetType : null;
            const variantSettings = variantAssetType ? assetVariantSettings[variantAssetType] : null;
            return (
              <div key={assetType} className="rounded border border-gray-200 dark:border-gray-700 p-2 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">{assetType}</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleAssetFileSelect(assetType, event)}
                  className="block w-full text-xs dark:text-gray-100 file:mr-2 file:rounded-md file:border-0 file:bg-primary-600 file:px-2 file:py-1 file:text-xs file:text-white file:cursor-pointer hover:file:bg-primary-700"
                />
                {variantAssetType && variantSettings ? (
                  <div className="space-y-2 rounded border border-gray-200 dark:border-gray-700 p-2">
                    <p className="text-[11px] text-gray-600 dark:text-gray-300">Optional Variant Metadata</p>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        className="rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-[11px] dark:bg-gray-800 dark:text-gray-100"
                        value={variantSettings.theme}
                        onChange={(event) => updateAssetVariantSettings(variantAssetType, {
                          theme: event.target.value as AssetVariantSettings["theme"],
                        })}
                        aria-label={`${assetType} theme`}
                      >
                        <option value="">theme:auto</option>
                        <option value="light">light</option>
                        <option value="dark">dark</option>
                        <option value="any">any</option>
                      </select>
                      <select
                        className="rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-[11px] dark:bg-gray-800 dark:text-gray-100"
                        value={variantSettings.density}
                        onChange={(event) => updateAssetVariantSettings(variantAssetType, {
                          density: event.target.value as AssetVariantSettings["density"],
                        })}
                        aria-label={`${assetType} density`}
                      >
                        <option value="">density:auto</option>
                        <option value="1x">1x</option>
                        <option value="2x">2x</option>
                        <option value="3x">3x</option>
                      </select>
                      <input
                        type="text"
                        className="rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-[11px] dark:bg-gray-800 dark:text-gray-100"
                        value={variantSettings.locale}
                        maxLength={16}
                        placeholder="locale"
                        onChange={(event) => updateAssetVariantSettings(variantAssetType, {
                          locale: event.target.value,
                        })}
                        aria-label={`${assetType} locale`}
                      />
                    </div>
                    <label className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={variantSettings.applyAsPrimary}
                        onChange={(event) => updateAssetVariantSettings(variantAssetType, {
                          applyAsPrimary: event.target.checked,
                        })}
                        className="rounded accent-primary-600"
                      />
                      Apply uploaded URL as primary {assetType} URL
                    </label>
                  </div>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!assetFiles[assetType] || mediaUploadPending}
                  onClick={() => {
                    const selectedFile = assetFiles[assetType];
                    if (!selectedFile) return;

                    if (assetType === "logo" || assetType === "banner") {
                      const settings = assetVariantSettings[assetType];
                      const hasVariant =
                        Boolean(settings.theme) ||
                        Boolean(settings.density) ||
                        Boolean(settings.locale.trim());
                      const variant = hasVariant
                        ? {
                            theme: settings.theme || undefined,
                            density: settings.density || undefined,
                            locale: settings.locale.trim() || undefined,
                          }
                        : undefined;
                      void onUploadMediaAsset(assetType, selectedFile, {
                        variant,
                        applyAsPrimary: settings.applyAsPrimary,
                      });
                      return;
                    }

                    void onUploadMediaAsset(assetType, selectedFile, {
                      applyAsPrimary: true,
                    });
                  }}
                >
                  {mediaUploadPending ? "Uploading..." : `Upload ${assetType}`}
                </Button>
              </div>
            );
          })}
        </div>

        {mediaUploadError ? <p className="text-xs text-danger-600 dark:text-danger-400">{mediaUploadError}</p> : null}
        {mediaUploadInfo ? <p className="text-xs text-gray-600 dark:text-gray-300">{mediaUploadInfo}</p> : null}
      </div>
    </div>
  );
}
