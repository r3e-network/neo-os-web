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
  "miniapp-gascircle": "gascircle",
  "miniapp-turtlematch": "turtlematch",
};

function getLiveSmokeCommand(
  appId: string,
): { lane: string; command: string } | null {
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
  const workflowHref =
    "https://github.com/r3e-network/neo-miniapps-platform/actions/workflows/live-smoke.yml";
  const reportsHref =
    "https://github.com/r3e-network/neo-miniapps-platform/tree/main/docs/reports/live-smoke";
  const runbookHref =
    "https://github.com/r3e-network/neo-miniapps-platform/blob/main/README.md#run-the-full-live-smoke-suite-with-timestamped-reports";

  return (
    <>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-gray-500">Entry URL</dt>
          <dd>{selectedApp.entry_url}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Status</dt>
          <dd>
            <Badge
              variant={selectedApp.status === "active" ? "success" : "danger"}
            >
              {selectedApp.status}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Developer Pubkey</dt>
          <dd className="font-mono break-all text-xs">
            {selectedApp.developer_pubkey || "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Assets Allowed</dt>
          <dd>{selectedApp.assets_allowed?.join(", ") || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Permissions</dt>
          <dd>
            {Object.entries(selectedApp.permissions || {})
              .filter(([, value]) => value)
              .map(([key]) => key)
              .join(", ") || "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Limits</dt>
          <dd>
            <pre className="overflow-auto text-xs">
              {JSON.stringify(selectedApp.limits, null, 2)}
            </pre>
          </dd>
        </div>
      </dl>

      {(() => {
        const manifest = selectedApp.manifest as Record<string, unknown> | null;
        const contracts = Array.isArray(manifest?.contracts)
          ? (manifest.contracts as Array<{ name: string; hash: string }>)
          : [];
        const operations = Array.isArray(manifest?.operations)
          ? (manifest.operations as Array<{
              name: string;
              method: string;
              description?: string;
              gas_cost?: string;
            }>)
          : [];
        const content =
          manifest?.content && typeof manifest.content === "object"
            ? (manifest.content as Record<string, unknown>)
            : null;

        return (
          <>
            {contracts.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700">
                  Contracts
                </h4>
                <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
                  {contracts.map((contract, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:justify-between"
                    >
                      <span className="shrink-0 font-medium">
                        {contract.name}
                      </span>
                      <span
                        className="min-w-0 truncate font-mono text-xs text-gray-500 sm:ml-2"
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
                <h4 className="mb-2 text-sm font-semibold text-gray-700">
                  Operations
                </h4>
                <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
                  {operations.map((operation, idx) => (
                    <div
                      key={idx}
                      className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[8rem_minmax(0,1fr)_auto_minmax(0,1.4fr)] sm:items-center"
                    >
                      <span className="font-medium">{operation.name}</span>
                      <span className="font-mono text-xs">
                        {operation.method}
                      </span>
                      {operation.gas_cost && (
                        <span className="text-xs text-gray-500">
                          {operation.gas_cost} GAS
                        </span>
                      )}
                      {operation.description && (
                        <span
                          className="min-w-0 truncate text-xs text-gray-500"
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
                <h4 className="mb-2 text-sm font-semibold text-gray-700">
                  Content
                </h4>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {!!content.description && (
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-gray-500">
                        Description
                      </dt>
                      <dd>{String(content.description)}</dd>
                    </div>
                  )}
                  {!!content.category && (
                    <div>
                      <dt className="font-medium text-gray-500">Category</dt>
                      <dd>{String(content.category)}</dd>
                    </div>
                  )}
                  {Array.isArray(content.tags) && content.tags.length > 0 && (
                    <div>
                      <dt className="font-medium text-gray-500">Tags</dt>
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
        <h4 className="mb-2 text-sm font-semibold text-gray-700">
          Live Validation
        </h4>
        <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap gap-2">
            <a
              href={workflowHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-primary-400 hover:text-primary-600"
            >
              Workflow
            </a>
            <a
              href={reportsHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-primary-400 hover:text-primary-600"
            >
              Reports
            </a>
            <a
              href={runbookHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-primary-400 hover:text-primary-600"
            >
              Runbook
            </a>
          </div>
          <p className="text-xs text-gray-500">
            Use the scoped command below to rerun live smoke for this MiniApp
            without triggering the whole suite.
          </p>
          {liveSmoke ? (
            <div>
              <div className="mb-1 text-xs font-medium text-gray-500">
                Suggested lane: {liveSmoke.lane}
              </div>
              <pre className="overflow-auto rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-700">
                {liveSmoke.command}
              </pre>
            </div>
          ) : (
            <pre className="overflow-auto rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-700">
              npm run test:testnet:live:smoke
            </pre>
          )}
        </div>
      </div>

      <div>
        <h4 className="mb-1 text-sm font-semibold text-gray-700">
          Full Manifest
        </h4>
        <pre className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
          {JSON.stringify(selectedApp.manifest || {}, null, 2)}
        </pre>
      </div>
    </>
  );
}
