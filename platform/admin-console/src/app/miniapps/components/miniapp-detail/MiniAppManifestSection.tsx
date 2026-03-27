"use client";

import { Badge } from "@/components/ui/Badge";
import type { MiniApp } from "@/types";

type Props = {
  selectedApp: MiniApp;
};

const FLAGSHIP_TARGETS: Record<string, string> = {
  "miniapp-last-survivor": "lastSurvivor",
  "miniapp-gasbox": "gasBox",
  "miniapp-redenvelope": "redEnvelope",
  "miniapp-dailycheckin": "dailyCheckin",
  "miniapp-fogplay": "fogPlay",
  "miniapp-self-loan": "selfLoan",
  "miniapp-neo-pay": "neoPay",
};

const SELECTED_TARGETS: Record<string, string> = {
  "miniapp-flashloan": "flashloan",
  "miniapp-exfiles": "exfiles",
  "miniapp-masqueradedao": "masqueradedao",
  "miniapp-millionpiecemap": "millionpiecemap",
  "miniapp-graveyard": "graveyard",
  "miniapp-heritagetrust": "heritagetrust",
  "miniapp-dicegame": "dicegame",
  "miniapp-gascircle": "gascircle",
  "miniapp-turtlematch": "turtlematch",
};

function getLiveSmokeCommand(appId: string): { lane: string; command: string } | null {
  const flagshipTarget = FLAGSHIP_TARGETS[appId];
  if (flagshipTarget) {
    return {
      lane: "flagship",
      command: `FLAGSHIP_LIVE_TARGETS=${flagshipTarget} npm run test:testnet:live:smoke:flagship`,
    };
  }

  const selectedTarget = SELECTED_TARGETS[appId];
  if (selectedTarget) {
    return {
      lane: "selected",
      command: `SELECTED_MINIAPP_SMOKE_TARGETS=${selectedTarget} npm run test:testnet:live:smoke:selected`,
    };
  }

  return null;
}

export function MiniAppManifestSection({ selectedApp }: Props) {
  const liveSmoke = getLiveSmokeCommand(selectedApp.app_id);
  const workflowHref = "https://github.com/r3e-network/neo-miniapps-platform/actions/workflows/live-smoke.yml";
  const reportsHref = "https://github.com/r3e-network/neo-miniapps-platform/tree/main/docs/reports/live-smoke";
  const runbookHref = "https://github.com/r3e-network/neo-miniapps-platform/blob/main/README.md#run-the-full-live-smoke-suite-with-timestamped-reports";

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
        <h4 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Live Validation</h4>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <a
              href={workflowHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:border-primary-400 hover:text-primary-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-primary-500 dark:hover:text-primary-400"
            >
              Workflow
            </a>
            <a
              href={reportsHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:border-primary-400 hover:text-primary-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-primary-500 dark:hover:text-primary-400"
            >
              Reports
            </a>
            <a
              href={runbookHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:border-primary-400 hover:text-primary-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-primary-500 dark:hover:text-primary-400"
            >
              Runbook
            </a>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Use the scoped command below to rerun live smoke for this MiniApp without triggering the whole suite.
          </p>
          {liveSmoke ? (
            <div>
              <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                Suggested lane: {liveSmoke.lane}
              </div>
              <pre className="overflow-auto rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800">
                {liveSmoke.command}
              </pre>
            </div>
          ) : (
            <pre className="overflow-auto rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800">
              npm run test:testnet:live:smoke
            </pre>
          )}
        </div>
      </div>

      <div>
        <h4 className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">Full Manifest</h4>
        <pre className="max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800">
          {JSON.stringify(selectedApp.manifest || {}, null, 2)}
        </pre>
      </div>
    </>
  );
}
