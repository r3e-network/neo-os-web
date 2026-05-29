"use client";

import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  jsonText: string;
  setJsonText: (value: string) => void;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onImportJson: () => void;
  loading: boolean;
};

export function JsonTab({
  jsonText,
  setJsonText,
  onFileUpload,
  onImportJson,
  loading,
}: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Paste or upload a full MiniApp definition in JSON or YAML, then import
        directly.
      </p>
      <div className="flex items-center gap-2">
        <input
          id="manifest-file-upload"
          type="file"
          accept=".json,.yaml,.yml"
          onChange={onFileUpload}
          className="rounded-lg text-sm file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          aria-label="Upload JSON or YAML manifest"
        />
      </div>
      <textarea
        className="w-full resize-none rounded-xl border border-gray-300 bg-white p-3 font-mono text-xs text-gray-900 transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:opacity-100"
        rows={16}
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        placeholder={
          '{\n "app_id": "miniapp-example",\n "name": "My App"\n}\n\n# or YAML\napp_id: miniapp-example\nname: My App'
        }
        aria-label="MiniApp manifest JSON or YAML"
        id="miniapp-manifest-textarea"
      />
      <Button onClick={onImportJson} disabled={!jsonText.trim() || loading}>
        {loading ? "Importing..." : "Import from JSON/YAML"}
      </Button>
    </div>
  );
}
