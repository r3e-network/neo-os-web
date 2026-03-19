"use client";

import { Database, Rocket, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type DefinitionActionBarProps = {
  previewLoading: boolean;
  onGenerate: () => void;
  onPreview: () => void;
  onImport: (file: File) => void;
};

export function DefinitionActionBar({
  previewLoading,
  onGenerate,
  onPreview,
  onImport,
}: DefinitionActionBarProps) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <Button type="button" variant="secondary" size="sm" className="text-xs" onClick={onGenerate}>
        <Database size={14} className="mr-1" />
        Generate From Form
      </Button>
      <Button type="button" variant="secondary" size="sm" className="text-xs" onClick={onPreview}>
        <Rocket size={14} className="mr-1" />
        {previewLoading ? "Previewing..." : "Schema + Runtime Preview"}
      </Button>
      <label className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-3 py-2 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-white/10">
        <Upload size={14} className="mr-1" />
        Import File
        <input
          type="file"
          accept=".json,.yaml,.yml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            e.currentTarget.value = "";
          }}
        />
      </label>
    </div>
  );
}
