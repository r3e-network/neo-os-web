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
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Paste or upload a full MiniApp definition in JSON or YAML, then import
        directly.
      </p>
      <div className="flex gap-2 items-center">
        <input
          id="manifest-file-upload"
          type="file"
          accept=".json,.yaml,.yml"
          onChange={onFileUpload}
          className="text-sm dark:text-gray-100 file:mr-2 file:rounded-md file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-sm file:text-white file:cursor-pointer hover:file:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md"
          aria-label="Upload JSON or YAML manifest"
        />
      </div>
      <textarea
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-3 font-mono text-xs transition-colors resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
