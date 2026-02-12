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
import { InfoField, MiniAppPreview, PreviewControls } from "@/components/admin/miniapps";
import { buildPreviewUrl, resolveEntryUrl } from "@/lib/miniapp-preview";
import { formatDate, truncate } from "@/lib/utils";
import type { RegistryMiniApp } from "@/types";

export default function MiniAppsPage() {
  const { data: miniappsData, isLoading, error } = useMiniApps();
  const miniapps = miniappsData?.miniapps;
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
          <h1 className="text-2xl font-bold text-foreground">MiniApps</h1>
          <p className="text-muted-foreground">Manage registered MiniApps</p>
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
            <div className="text-muted-foreground text-center">No pending submissions</div>
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
                    <TableCell className="text-sm text-foreground/80">{app.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(app.status)}>{app.status || "unknown"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {app.latest_version?.version || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {truncate(app.latest_version?.entry_url || "", 36)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {truncate(app.developer_address || "", 12)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
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
                <InfoField label="Version" value={selectedRegistryApp.latest_version?.version || ""} />
                <InfoField label="Entry URL" value={entryUrl} breakAll />
                <InfoField
                  label="Build Artifact"
                  value={selectedRegistryApp.latest_build?.storage_path || ""}
                  breakAll
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoField label="Name (EN)" value={selectedRegistryApp.name || ""} />
                <InfoField label="Name (ZH)" value={selectedRegistryApp.name_zh || ""} />
                <InfoField
                  label="Description (EN)"
                  value={selectedRegistryApp.description || ""}
                  className="md:col-span-2"
                />
                <InfoField
                  label="Description (ZH)"
                  value={selectedRegistryApp.description_zh || ""}
                  className="md:col-span-2"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <InfoField label="Category" value={selectedRegistryApp.category || ""} />
                <InfoField label="Supported Chains" value={supportedChains.length ? supportedChains.join(", ") : ""} />
                <InfoField label="Permissions" value={permissionList.length ? permissionList.join(", ") : ""} />
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

              <PreviewControls
                theme={previewTheme}
                locale={previewLocale}
                onThemeChange={setPreviewTheme}
                onLocaleChange={setPreviewLocale}
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground/80">Review Notes</label>
                <textarea
                  className="border-border/30 bg-muted/30 w-full rounded-md border p-3 text-sm text-foreground focus:border-primary-400 focus:ring-primary-400"
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
                  onClick={() => {
                    if (!confirm(`Approve & publish ${selectedRegistryApp.app_id}?`)) return;
                    selectedRegistryApp.latest_version?.id &&
                      approveMutation.mutate({
                        appId: selectedRegistryApp.app_id,
                        versionId: selectedRegistryApp.latest_version.id,
                        reviewNotes: reviewNotes || undefined,
                      });
                  }}
                >
                  Approve & Publish
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  isLoading={rejectMutation.isPending}
                  onClick={() => {
                    if (!confirm(`Reject ${selectedRegistryApp.app_id}? This cannot be undone.`)) return;
                    selectedRegistryApp.latest_version?.id &&
                      rejectMutation.mutate({
                        appId: selectedRegistryApp.app_id,
                        versionId: selectedRegistryApp.latest_version.id,
                        reviewNotes: reviewNotes || undefined,
                      });
                  }}
                >
                  Reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedRegistryApp(null)}>
                  Close
                </Button>
              </div>

              {missingBilingualDetails && (
                <div className="text-sm text-amber-400">
                  Missing Chinese name or description. Require bilingual metadata before approval.
                </div>
              )}

              <MiniAppPreview appId={selectedRegistryApp.app_id} previewUrl={previewUrl} />
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
          ) : !miniapps?.length ? (
            <div className="text-muted-foreground py-8 text-center">No registered MiniApps found</div>
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
                {miniapps.map((app) => (
                  <TableRow key={app.app_id}>
                    <TableCell className="font-medium">{app.app_id}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{truncate(app.entry_url, 40)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={app.status === "active" ? "success" : app.status === "pending" ? "warning" : "danger"}
                      >
                        {app.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {truncate(app.developer_pubkey, 12)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(app.created_at)}</TableCell>
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
              <div className="text-muted-foreground text-sm">MiniApp details unavailable.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <InfoField label="Entry URL" value={selectedMiniApp.entry_url || ""} breakAll />
                  <InfoField label="Status" value={selectedMiniApp.status || ""} />
                  <InfoField
                    label="Updated"
                    value={selectedMiniApp.updated_at ? formatDate(selectedMiniApp.updated_at) : ""}
                  />
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

                <PreviewControls
                  theme={testTheme}
                  locale={testLocale}
                  onThemeChange={setTestTheme}
                  onLocaleChange={setTestLocale}
                />

                <MiniAppPreview appId={selectedMiniApp.app_id} previewUrl={testPreviewUrl} />

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
