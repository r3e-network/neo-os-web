"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registered MiniApps ({miniapps?.length ?? 0})</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <div className="text-center text-danger-600 dark:text-danger-400">Failed to load MiniApps</div>
        ) : !miniapps?.length ? (
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">No MiniApps registered yet</p>
        ) : (
          <div className="overflow-x-auto">
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
                {miniapps.map((app) => (
                  <TableRow key={app.app_id}>
                    <TableCell className="font-medium">{app.app_id}</TableCell>
                    <TableCell className="text-sm text-gray-500 dark:text-gray-400" title={app.entry_url}>
                      {truncate(app.entry_url, 35)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={app.status === "active" ? "success" : app.status === "pending" ? "warning" : "danger"}>
                        {app.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 dark:text-gray-400">
                      {Object.entries(app.permissions || {})
                        .filter(([, value]) => value)
                        .map(([key]) => key)
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 dark:text-gray-400">{formatDate(app.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onEdit(app)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onClone(app)}>
                          Clone
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onView(app)}>
                          View
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onExport(app)}>
                          Export
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onToggleStatus(app)} disabled={statusPending}>
                          {app.status === "active" ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDisable(app)}
                          disabled={deletePending}
                          className="text-danger-600 dark:text-danger-400"
                        >
                          Disable
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
