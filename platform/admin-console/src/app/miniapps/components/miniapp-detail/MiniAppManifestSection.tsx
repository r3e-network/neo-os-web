"use client";

import { Badge } from "@/components/ui/Badge";
import type { MiniApp } from "@/types";

type Props = {
  selectedApp: MiniApp;
};

export function MiniAppManifestSection({ selectedApp }: Props) {
  return (
    <>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-medium text-gray-500 dark:text-gray-400">Entry URL</dt>
          <dd>{selectedApp.entry_url}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500 dark:text-gray-400">Status</dt>
          <dd>
            <Badge variant={selectedApp.status === "active" ? "success" : "danger"}>{selectedApp.status}</Badge>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500 dark:text-gray-400">Developer Pubkey</dt>
          <dd className="font-mono break-all text-xs">{selectedApp.developer_pubkey || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500 dark:text-gray-400">Assets Allowed</dt>
          <dd>{selectedApp.assets_allowed?.join(", ") || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500 dark:text-gray-400">Permissions</dt>
          <dd>
            {Object.entries(selectedApp.permissions || {})
              .filter(([, value]) => value)
              .map(([key]) => key)
              .join(", ") || "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500 dark:text-gray-400">Limits</dt>
          <dd>
            <pre className="overflow-auto text-xs">{JSON.stringify(selectedApp.limits, null, 2)}</pre>
          </dd>
        </div>
      </dl>

      {(() => {
        const manifest = selectedApp.manifest as Record<string, unknown> | null;
        const contracts = Array.isArray(manifest?.contracts) ? (manifest.contracts as Array<{ name: string; hash: string }>) : [];
        const operations = Array.isArray(manifest?.operations)
          ? (manifest.operations as Array<{ name: string; method: string; description?: string; gas_cost?: string }>)
          : [];
        const content = manifest?.content && typeof manifest.content === "object" ? (manifest.content as Record<string, unknown>) : null;

        return (
          <>
            {contracts.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Contracts</h4>
                <div className="divide-y rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                  {contracts.map((contract, idx) => (
                    <div key={idx} className="flex justify-between px-3 py-2 text-sm">
                      <span className="shrink-0 font-medium">{contract.name}</span>
                      <span
                        className="ml-2 min-w-0 truncate font-mono text-xs text-gray-500 dark:text-gray-400"
                        title={contract.hash}
                      >
                        {contract.hash}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {operations.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Operations</h4>
                <div className="divide-y rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                  {operations.map((operation, idx) => (
                    <div key={idx} className="flex items-center gap-4 px-3 py-2 text-sm">
                      <span className="w-32 font-medium">{operation.name}</span>
                      <span className="font-mono text-xs">{operation.method}</span>
                      {operation.gas_cost && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{operation.gas_cost} GAS</span>
                      )}
                      {operation.description && (
                        <span
                          className="ml-auto min-w-0 truncate text-xs text-gray-500 dark:text-gray-400"
                          title={operation.description}
                        >
                          {operation.description}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {content && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Content</h4>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {!!content.description && (
                    <div className="col-span-2">
                      <dt className="font-medium text-gray-500 dark:text-gray-400">Description</dt>
                      <dd>{String(content.description)}</dd>
                    </div>
                  )}
                  {!!content.category && (
                    <div>
                      <dt className="font-medium text-gray-500 dark:text-gray-400">Category</dt>
                      <dd>{String(content.category)}</dd>
                    </div>
                  )}
                  {Array.isArray(content.tags) && content.tags.length > 0 && (
                    <div>
                      <dt className="font-medium text-gray-500 dark:text-gray-400">Tags</dt>
                      <dd>{(content.tags as string[]).join(", ")}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </>
        );
      })()}

      <div>
        <h4 className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">Full Manifest</h4>
        <pre className="max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800">
          {JSON.stringify(selectedApp.manifest || {}, null, 2)}
        </pre>
      </div>
    </>
  );
}
