"use client";

type DefinitionModeToggleProps = {
  mode: "json" | "yaml";
  onChange: (mode: "json" | "yaml") => void;
};

export function DefinitionModeToggle({
  mode,
  onChange,
}: DefinitionModeToggleProps) {
  return (
    <div className="flex gap-2">
      {(["json", "yaml"] as const).map((value) => (
        <button
          key={value}
          type="button"
          className={`rounded-md border px-2.5 py-1 text-xs ${mode === value ? "border-neo text-neo" : "border-gray-300 text-gray-600"}`}
          onClick={() => onChange(value)}
        >
          {value.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
