// =============================================================================
// MiniApps Page
// =============================================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useMiniApps } from "@/lib/hooks/useMiniApps";
import { useApproveMiniAppVersion, useRegistryMiniApps, useRejectMiniAppVersion } from "@/lib/hooks/useMiniAppRegistry";
import { buildPreviewUrl, resolveEntryUrl } from "@/lib/miniapp-preview";
import { formatDate, truncate } from "@/lib/utils";
import type { RegistryMiniApp } from "@/types";

export default function MiniAppsPage() {
  const { data: miniapps, isLoading, error } = useMiniApps();
  const { data: registryApps, isLoading: registryLoading, error: registryError } = useRegistryMiniApps();
  const approveMutation = useApproveMiniAppVersion();
  const rejectMutation = useRejectMiniAppVersion();
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [selectedRegistryApp, setSelectedRegistryApp] = useState<RegistryMiniApp | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [previewTheme, setPreviewTheme] = useState<"dark" | "light">("dark");
  const [previewLocale, setPreviewLocale] = useState<"en" | "zh">("en");
  const [testTheme, setTestTheme] = useState<"dark" | "light">("dark");
  const [testLocale, setTestLocale] = useState<"en" | "zh">("en");

  useEffect(() => {
    setReviewNotes("");
    setPreviewTheme("dark");
    setPreviewLocale("en");
  }, [selectedRegistryApp?.app_id]);

  useEffect(() => {
    setTestTheme("dark");
    setTestLocale("en");
  }, [selectedApp]);

  const pendingApps = useMemo(
    () => (registryApps || []).filter((app) => app.status === "pending_review"),
    [registryApps]
  );
  const permissionList = useMemo(() => {
    const perms = selectedRegistryApp?.permissions;
    if (!perms || typeof perms !== "object") return [];
    return Object.entries(perms)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);
  }, [selectedRegistryApp?.permissions]);
  const supportedChains =
    selectedRegistryApp?.latest_version?.supported_chains || selectedRegistryApp?.supported_chains || [];
  const selectedMiniApp = useMemo(
    () => (miniapps || []).find((app) => app.app_id === selectedApp) || null,
    [miniapps, selectedApp]
  );

  const resolveBuildUrl = (storagePath?: string | null) => {
    if (!storagePath) return "";
    if (storagePath.startsWith("http")) return storagePath;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (!base) return storagePath;
    return `${base.replace(/\/$/, "")}/storage/v1/object/${storagePath.replace(/^\//, "")}`;
  };

  const resolveBuildDownloadUrl = (storagePath?: string | null) => {
    const url = resolveBuildUrl(storagePath);
    if (!url) return "";
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}download=1`;
  };

  const statusVariant = (status?: string | null) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "pending_review") return "warning";
    if (normalized === "approved" || normalized === "published") return "success";
    if (normalized === "draft" || normalized === "suspended" || normalized === "archived") return "danger";
    return "default";
  };

  const entryUrl = selectedRegistryApp?.latest_version?.entry_url || "";
  const buildUrl = resolveBuildUrl(selectedRegistryApp?.latest_build?.storage_path || null);
  const buildDownloadUrl = resolveBuildDownloadUrl(selectedRegistryApp?.latest_build?.storage_path || null);
  const previewUrl = buildPreviewUrl(entryUrl, previewLocale, previewTheme);
  const testEntryUrl = selectedMiniApp?.entry_url || "";
  const canTestPreview = Boolean(testEntryUrl) && !testEntryUrl.startsWith("mf://");
  const testPreviewUrl = canTestPreview ? buildPreviewUrl(testEntryUrl, testLocale, testTheme) : "";
  const missingBilingualDetails = Boolean(
    selectedRegistryApp && (!selectedRegistryApp.name_zh || !selectedRegistryApp.description_zh)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MiniApps</h1>
          <p className="text-gray-600">Manage registered MiniApps</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Review Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {registryLoading ? (
            <Spinner />
          ) : registryError ? (
            <div className="text-center text-danger-600">Failed to load registry submissions</div>
          ) : pendingApps.length === 0 ? (
            <div className="text-center text-gray-500">No pending submissions</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Entry URL</TableHead>
                  <TableHead>Developer</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApps.map((app) => (
                  <TableRow key={app.app_id}>
                    <TableCell className="font-medium">{app.app_id}</TableCell>
                    <TableCell className="text-sm text-gray-700">{app.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(app.status)}>{app.status || "unknown"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{app.latest_version?.version || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {truncate(app.latest_version?.entry_url || "", 36)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{truncate(app.developer_address || "", 12)}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {app.updated_at ? formatDate(app.updated_at) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="secondary" onClick={() => setSelectedRegistryApp(app)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedRegistryApp && (
        <Card>
          <CardHeader>
            <CardTitle>Review: {selectedRegistryApp.app_id}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">Version</div>
                  <div className="text-sm font-medium text-gray-900">
                    {selectedRegistryApp.latest_version?.version || "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">Entry URL</div>
                  <div className="break-all text-sm text-gray-700">{entryUrl || "—"}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">Build Artifact</div>
                  <div className="break-all text-sm text-gray-700">
                    {selectedRegistryApp.latest_build?.storage_path || "—"}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">Name (EN)</div>
                  <div className="text-sm font-medium text-gray-900">{selectedRegistryApp.name || "—"}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">Name (ZH)</div>
                  <div className="text-sm font-medium text-gray-900">{selectedRegistryApp.name_zh || "—"}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 md:col-span-2">
                  <div className="text-xs text-gray-500">Description (EN)</div>
                  <div className="text-sm text-gray-700">{selectedRegistryApp.description || "—"}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 md:col-span-2">
                  <div className="text-xs text-gray-500">Description (ZH)</div>
                  <div className="text-sm text-gray-700">{selectedRegistryApp.description_zh || "—"}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">Category</div>
                  <div className="text-sm text-gray-700">{selectedRegistryApp.category || "—"}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">Supported Chains</div>
                  <div className="text-sm text-gray-700">
                    {supportedChains.length ? supportedChains.join(", ") : "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">Permissions</div>
                  <div className="text-sm text-gray-700">{permissionList.length ? permissionList.join(", ") : "—"}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => entryUrl && window.open(resolveEntryUrl(entryUrl), "_blank", "noopener,noreferrer")}
                  disabled={!entryUrl}
                >
                  Open Entry URL
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => previewUrl && window.open(previewUrl, "_blank", "noopener,noreferrer")}
                  disabled={!previewUrl}
                >
                  Open Preview
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => buildUrl && window.open(buildUrl, "_blank", "noopener,noreferrer")}
                  disabled={!buildUrl}
                >
                  Open Build Artifact
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => buildDownloadUrl && window.open(buildDownloadUrl, "_blank", "noopener,noreferrer")}
                  disabled={!buildDownloadUrl}
                >
                  Download Build
                </Button>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3 text-sm font-medium text-gray-700">Preview Controls</div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Theme</span>
                    <Button
                      size="sm"
                      variant={previewTheme === "dark" ? "primary" : "secondary"}
                      onClick={() => setPreviewTheme("dark")}
                    >
                      Dark
                    </Button>
                    <Button
                      size="sm"
                      variant={previewTheme === "light" ? "primary" : "secondary"}
                      onClick={() => setPreviewTheme("light")}
                    >
                      Light
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Locale</span>
                    <Button
                      size="sm"
                      variant={previewLocale === "en" ? "primary" : "secondary"}
                      onClick={() => setPreviewLocale("en")}
                    >
                      EN
                    </Button>
                    <Button
                      size="sm"
                      variant={previewLocale === "zh" ? "primary" : "secondary"}
                      onClick={() => setPreviewLocale("zh")}
                    >
                      ZH
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Review Notes</label>
                <textarea
                  className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-primary-500 focus:ring-primary-500"
                  rows={3}
                  placeholder="Notes for developer (optional)"
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  isLoading={approveMutation.isPending}
                  disabled={missingBilingualDetails}
                  onClick={() =>
                    selectedRegistryApp.latest_version?.id &&
                    approveMutation.mutate({
                      appId: selectedRegistryApp.app_id,
                      versionId: selectedRegistryApp.latest_version.id,
                      reviewNotes: reviewNotes || undefined,
                    })
                  }
                >
                  Approve & Publish
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  isLoading={rejectMutation.isPending}
                  onClick={() =>
                    selectedRegistryApp.latest_version?.id &&
                    rejectMutation.mutate({
                      appId: selectedRegistryApp.app_id,
                      versionId: selectedRegistryApp.latest_version.id,
                      reviewNotes: reviewNotes || undefined,
                    })
                  }
                >
                  Reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedRegistryApp(null)}>
                  Close
                </Button>
              </div>

              {missingBilingualDetails && (
                <div className="text-sm text-amber-600">
                  Missing Chinese name or description. Require bilingual metadata before approval.
                </div>
              )}

              {previewUrl ? (
                <div className="rounded-lg border border-gray-200">
                  <iframe
                    title={`preview-${selectedRegistryApp.app_id}`}
                    src={previewUrl}
                    className="h-[520px] w-full"
                    sandbox="allow-scripts allow-forms allow-popups"
                    referrerPolicy="no-referrer"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  Preview unavailable (missing entry URL or non-iframe entry).
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registered MiniApps</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Spinner />
          ) : error ? (
            <div className="text-center text-danger-600">Failed to load MiniApps</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App ID</TableHead>
                  <TableHead>Entry URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Developer</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {miniapps?.map((app) => (
                  <TableRow key={app.app_id}>
                    <TableCell className="font-medium">{app.app_id}</TableCell>
                    <TableCell className="text-sm text-gray-500">{truncate(app.entry_url, 40)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={app.status === "active" ? "success" : app.status === "pending" ? "warning" : "danger"}
                      >
                        {app.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{truncate(app.developer_pubkey, 12)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(app.created_at)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedApp(app.app_id)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* MiniApp Test Harness */}
      {selectedApp && (
        <Card>
          <CardHeader>
            <CardTitle>MiniApp Test Harness: {selectedApp}</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedMiniApp ? (
              <div className="text-sm text-gray-500">MiniApp details unavailable.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="text-xs text-gray-500">Entry URL</div>
                    <div className="break-all text-sm text-gray-700">{selectedMiniApp.entry_url || "—"}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="text-xs text-gray-500">Status</div>
                    <div className="text-sm text-gray-700">{selectedMiniApp.status || "—"}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="text-xs text-gray-500">Updated</div>
                    <div className="text-sm text-gray-700">
                      {selectedMiniApp.updated_at ? formatDate(selectedMiniApp.updated_at) : "—"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      selectedMiniApp.entry_url &&
                      window.open(resolveEntryUrl(selectedMiniApp.entry_url), "_blank", "noopener,noreferrer")
                    }
                    disabled={!selectedMiniApp.entry_url}
                  >
                    Open Entry URL
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => testPreviewUrl && window.open(testPreviewUrl, "_blank", "noopener,noreferrer")}
                    disabled={!testPreviewUrl}
                  >
                    Open Preview
                  </Button>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 text-sm font-medium text-gray-700">Preview Controls</div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Theme</span>
                      <Button
                        size="sm"
                        variant={testTheme === "dark" ? "primary" : "secondary"}
                        onClick={() => setTestTheme("dark")}
                      >
                        Dark
                      </Button>
                      <Button
                        size="sm"
                        variant={testTheme === "light" ? "primary" : "secondary"}
                        onClick={() => setTestTheme("light")}
                      >
                        Light
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Locale</span>
                      <Button
                        size="sm"
                        variant={testLocale === "en" ? "primary" : "secondary"}
                        onClick={() => setTestLocale("en")}
                      >
                        EN
                      </Button>
                      <Button
                        size="sm"
                        variant={testLocale === "zh" ? "primary" : "secondary"}
                        onClick={() => setTestLocale("zh")}
                      >
                        ZH
                      </Button>
                    </div>
                  </div>
                </div>

                {canTestPreview ? (
                  <div className="rounded-lg border border-gray-200">
                    <iframe
                      title={`test-${selectedMiniApp.app_id}`}
                      src={testPreviewUrl}
                      className="h-[520px] w-full"
                      sandbox="allow-scripts allow-forms allow-popups"
                      referrerPolicy="no-referrer"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    Preview unavailable (entry URL missing or non-iframe entry).
                  </div>
                )}

                <Button size="sm" variant="ghost" onClick={() => setSelectedApp(null)}>
                  Close
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
