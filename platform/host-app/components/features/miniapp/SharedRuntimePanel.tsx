import { Activity } from "lucide-react";
import type { SharedModeRuntimeInfo } from "../../../lib/chain";

export function SharedRuntimePanel({
  runtime,
}: {
  runtime: SharedModeRuntimeInfo;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <Activity className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        Shared Runtime
      </h3>
      <p className="my-1.5 text-xs text-gray-500">
        Instance ID:{" "}
        <code className="break-all rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">
          {runtime.instance.instanceId}
        </code>
      </p>
      <p className="my-1.5 text-xs text-gray-500">
        Recipe:{" "}
        <code className="break-all rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">
          {runtime.instance.recipeId}@{runtime.instance.recipeVersion}
        </code>
      </p>
      <p className="my-1.5 text-xs text-gray-500">
        Mode:{" "}
        <span className="rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">
          {runtime.instance.runtimeMode}
        </span>
      </p>
      <p className="my-1.5 text-xs text-gray-500">
        Status:{" "}
        <span className="rounded bg-neo/10 px-1.5 py-0.5 font-mono text-[11px] text-neo">
          {runtime.instance.status === 1
            ? "active"
            : String(runtime.instance.status)}
        </span>
      </p>
      <div className="mt-4 space-y-3">
        {runtime.modules.map((module) => (
          <div
            key={`${module.binding}:${module.moduleId}:${module.version}`}
            className="rounded-lg border border-gray-200 bg-gray-50 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase text-gray-500">
                {module.binding}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${module.active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
              >
                {module.active ? "active" : "inactive"}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-700">
              {module.moduleId}@{module.version}
            </p>
            {module.contractHash && (
              <p className="mt-1 break-all text-[11px] text-gray-500">
                {module.contractHash}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
