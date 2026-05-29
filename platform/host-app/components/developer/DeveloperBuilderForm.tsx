"use client";

import { SelectField, TextAreaField, TextField } from "@/components/forms";
import { Alert } from "@/components/ui/alert";
import { DefinitionActionBar } from "./DefinitionActionBar";
import { DefinitionModeToggle } from "./DefinitionModeToggle";
import { DeveloperDrawerFooter } from "./DeveloperDrawerFooter";
import type { FormData } from "./types";

type DeveloperBuilderFormProps = {
  form: FormData;
  onFormChange: (next: FormData) => void;
  categories: readonly FormData["category"][];
  templateTypes: readonly FormData["template_type"][];
  frontendTemplateOptions: string[];
  contractTemplateOptions: string[];
  definitionMode: "json" | "yaml";
  onDefinitionModeChange: (mode: "json" | "yaml") => void;
  definitionText: string;
  onDefinitionTextChange: (text: string) => void;
  previewLoading: boolean;
  previewResult: { ok: boolean; message: string } | null;
  result: { success: boolean; message: string } | null;
  submitting: boolean;
  onGenerate: () => void;
  onPreview: () => void;
  onImport: (file: File) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
};

export function DeveloperBuilderForm({
  form,
  onFormChange,
  categories,
  templateTypes,
  frontendTemplateOptions,
  contractTemplateOptions,
  definitionMode,
  onDefinitionModeChange,
  definitionText,
  onDefinitionTextChange,
  previewLoading,
  previewResult,
  result,
  submitting,
  onGenerate,
  onPreview,
  onImport,
  onSubmit,
  onCancel,
}: DeveloperBuilderFormProps) {
  return (
    <form onSubmit={onSubmit} className="p-6 space-y-6">
      <TextField
        id="submit-app-id"
        type="text"
        label="App ID"
        placeholder="miniapp-my-app"
        value={form.app_id}
        onChange={(e) => onFormChange({ ...form, app_id: e.target.value })}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField
          id="submit-app-name"
          type="text"
          required
          label="Name *"
          placeholder="My MiniApp"
          value={form.name}
          onChange={(e) => onFormChange({ ...form, name: e.target.value })}
        />
        <TextField
          id="submit-app-name-zh"
          type="text"
          label="Name (中文)"
          placeholder="可选"
          value={form.name_zh}
          onChange={(e) =>
            onFormChange({ ...form, name_zh: e.target.value })
          }
        />
      </div>

      <TextAreaField
        id="submit-app-desc"
        required
        rows={3}
        label="Description *"
        placeholder="Describe what your app does..."
        value={form.description}
        onChange={(e) =>
          onFormChange({ ...form, description: e.target.value })
        }
      />

      <TextAreaField
        id="submit-app-desc-zh"
        rows={2}
        label="Description (中文)"
        placeholder="可选"
        value={form.description_zh}
        onChange={(e) =>
          onFormChange({ ...form, description_zh: e.target.value })
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TextField
          id="submit-app-icon"
          type="text"
          label="Icon"
          placeholder="app-window"
          className="text-center"
          value={form.icon}
          onChange={(e) => onFormChange({ ...form, icon: e.target.value })}
        />
        <SelectField
          id="submit-app-category"
          label="Category"
          value={form.category}
          onChange={(e) =>
            onFormChange({
              ...form,
              category: e.target.value as FormData["category"],
            })
          }
        >
          {categories.map((c) => (
            <option key={c} value={c} className="bg-white">
              {c}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="submit-template-type"
          label="Template Type"
          value={form.template_type}
          onChange={(e) =>
            onFormChange({
              ...form,
              template_type: e.target
                .value as FormData["template_type"],
            })
          }
        >
          {templateTypes.map((t) => (
            <option key={t} value={t} className="bg-white">
              {t}
            </option>
          ))}
        </SelectField>
        <TextField
          id="submit-contract-hash"
          type="text"
          label="Contract Hash"
          placeholder="0x..."
          className="font-mono text-sm"
          value={form.contract_hash}
          onChange={(e) =>
            onFormChange({ ...form, contract_hash: e.target.value })
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <TextField
            id="submit-frontend-template-id"
            type="text"
            list="frontend-template-options"
            label="Frontend Template ID"
            placeholder="default"
            value={form.frontend_template_id}
            onChange={(e) =>
              onFormChange({
                ...form,
                frontend_template_id: e.target.value,
              })
            }
          />
          <datalist id="frontend-template-options">
            {frontendTemplateOptions.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
        </div>
        <div>
          <TextField
            id="submit-contract-template-id"
            type="text"
            list="contract-template-options"
            label="Contract Template ID"
            placeholder="prediction-binary"
            value={form.contract_template_id}
            onChange={(e) =>
              onFormChange({
                ...form,
                contract_template_id: e.target.value,
              })
            }
          />
          <datalist id="contract-template-options">
            {contractTemplateOptions.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
        </div>
      </div>

      <TextField
        id="submit-entry-url"
        type="url"
        required
        label="Entry URL *"
        placeholder="https://your-app.com/miniapp"
        value={form.entry_url}
        onChange={(e) =>
          onFormChange({ ...form, entry_url: e.target.value })
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TextField
          id="submit-logo-url"
          type="url"
          label="Logo URL"
          placeholder="https://cdn/logo.png"
          value={form.logo_url}
          onChange={(e) =>
            onFormChange({ ...form, logo_url: e.target.value })
          }
        />
        <TextField
          id="submit-banner-url"
          type="url"
          label="Banner URL"
          placeholder="https://cdn/banner.png"
          value={form.banner_url}
          onChange={(e) =>
            onFormChange({ ...form, banner_url: e.target.value })
          }
        />
        <TextField
          id="submit-docs-url"
          type="url"
          label="Docs URL"
          placeholder="https://docs.example.com"
          value={form.docs_url}
          onChange={(e) =>
            onFormChange({ ...form, docs_url: e.target.value })
          }
        />
      </div>

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Developer Metadata
        </h3>
        <div className="space-y-4">
          <TextField
            id="submit-dev-name"
            type="text"
            label="Developer Name"
            placeholder="Your name or team"
            value={form.developer_name}
            onChange={(e) =>
              onFormChange({ ...form, developer_name: e.target.value })
            }
          />
          <TextField
            id="submit-dev-user-id"
            type="text"
            required
            label="Developer User ID (UUID) *"
            placeholder="123e4567-e89b-12d3-a456-426614174000"
            className="font-mono text-sm"
            value={form.developer_user_id}
            onChange={(e) =>
              onFormChange({ ...form, developer_user_id: e.target.value })
            }
          />
          <TextField
            id="submit-dev-pubkey"
            type="text"
            label="Developer PubKey"
            placeholder="03ab..."
            className="font-mono text-sm"
            value={form.developer_pubkey}
            onChange={(e) =>
              onFormChange({ ...form, developer_pubkey: e.target.value })
            }
          />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            JSON / YAML Definition
          </h3>
          <DefinitionModeToggle
            mode={definitionMode}
            onChange={onDefinitionModeChange}
          />
        </div>

        <DefinitionActionBar
          previewLoading={previewLoading}
          onGenerate={onGenerate}
          onPreview={onPreview}
          onImport={onImport}
        />

        <TextAreaField
          rows={10}
          placeholder={
            definitionMode === "json"
              ? "Paste miniapp definition JSON..."
              : "Paste miniapp definition YAML..."
          }
          value={definitionText}
          onChange={(e) => onDefinitionTextChange(e.target.value)}
          className="font-mono text-xs"
        />

        {previewResult && (
          <Alert
            variant={previewResult.ok ? "success" : "error"}
            className="mt-3 text-xs"
          >
            {previewResult.message}
          </Alert>
        )}
      </div>

      {result && (
        <Alert variant={result.success ? "success" : "error"}>
          {result.message}
        </Alert>
      )}

      <DeveloperDrawerFooter submitting={submitting} onCancel={onCancel} />
    </form>
  );
}
