"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatDate, truncate } from "@/lib/utils";
import type { MiniApp } from "@/types";

type Props = {
  miniapps: MiniApp[] | undefined;
  isLoading: boolean;
  error: unknown;
  onEdit: (app: MiniApp) => void;
  onClone: (app: MiniApp) => void;
  onView: (app: MiniApp) => void;
  onExport: (app: MiniApp) => void;
  onToggleStatus: (app: MiniApp) => void;
  onDisable: (app: MiniApp) => void;
  statusPending: boolean;
  deletePending: boolean;
};

export function MiniAppsTableCard({
  miniapps,
  isLoading,
  error,
  onEdit,
  onClone,
  onView,
  onExport,
  onToggleStatus,
  onDisable,
  statusPending,
  deletePending,
}: Props) {
  const apps = miniapps ?? [];
  const statusCounts = apps.reduce(
    (counts, app) => {
      counts.total += 1;
      counts[app.status] += 1;
      return counts;
    },
    {
      active: 0,
      beta: 0,
      disabled: 0,
      pending: 0,
      total: 0,
    },
  );
  const summaryItems = [
    { label: "Active", value: statusCounts.active },
    { label: "Pending", value: statusCounts.pending },
    { label: "Beta", value: statusCounts.beta },
    { label: "Disabled", value: statusCounts.disabled },
  ];

  return (
    <Card
      className="miniapps-table-card miniapps-table-shell overflow-hidden"
      variant="default"
    >
      <CardHeader className="space-y-4">
        <div className="miniapps-table-toolbar flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Registered MiniApps ({statusCounts.total})</CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              Review fleet state, inspect definitions, and make scoped changes
              without losing row context.
            </p>
          </div>
        </div>
        <div
          aria-label="MiniApps table summary"
          className="miniapps-table-summary grid gap-2 sm:grid-cols-4"
        >
          {summaryItems.map((item) => (
            <div
              key={item.label}
              aria-label={`${item.label} MiniApps`}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <p className="text-xs font-semibold uppercase text-gray-500">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-black text-gray-900">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <div className="text-center text-danger-600">
            Failed to load MiniApps
          </div>
        ) : !apps.length ? (
          <p className="py-8 text-center text-gray-500">
            No MiniApps registered yet
          </p>
        ) : (
          <Table aria-label="MiniApps list">
            <TableHeader>
              <TableRow>
                <TableHead>App ID</TableHead>
                <TableHead>Entry URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((app) => (
                <TableRow key={app.app_id}>
                  <TableCell className="font-medium">{app.app_id}</TableCell>
                  <TableCell
                    className="text-sm text-gray-500"
                    title={app.entry_url}
                  >
                    {truncate(app.entry_url, 35)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        app.status === "active"
                          ? "success"
                          : app.status === "pending"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {app.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {Object.entries(app.permissions || {})
                      .filter(([, value]) => value)
                      .map(([key]) => key)
                      .join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDate(app.created_at)}
                  </TableCell>
                  <TableCell>
                    <div
                      aria-label={`MiniApp row actions for ${app.app_id}`}
                      className="miniapps-row-actions flex min-w-[20rem] max-w-[28rem] flex-col gap-2"
                    >
                      <div
                        aria-label="Primary actions"
                        className="miniapps-primary-actions grid grid-cols-2 gap-1 sm:grid-cols-5"
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2"
                          onClick={() =>
                            (window.location.href = `/miniapps/${app.app_id}`)
                          }
                        >
                          Configure
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2"
                          onClick={() => onEdit(app)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2"
                          onClick={() => onClone(app)}
                        >
                          Clone
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2"
                          onClick={() => onView(app)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2"
                          onClick={() => onExport(app)}
                        >
                          Export
                        </Button>
                      </div>
                      <div
                        aria-label="Safety actions"
                        className="miniapps-secondary-actions grid grid-cols-2 gap-1"
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          className="px-2"
                          onClick={() => onToggleStatus(app)}
                          disabled={statusPending}
                        >
                          {app.status === "active" ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDisable(app)}
                          disabled={deletePending}
                          className="miniapps-danger-action px-2 text-danger-600"
                        >
                          Hide
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
