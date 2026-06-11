"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getAdminAuthHeaders,
  getAdminFetchOptions,
} from "@/lib/admin-client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  DemoDataBanner,
  isMockDataResponse,
} from "@/components/ui/DemoDataBanner";
import { Spinner } from "@/components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

interface Secret {
  id: string;
  name: string;
  description: string;
  lastUpdated?: string;
}

const inputClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const labelClass = "mb-1 block text-sm font-semibold text-gray-700";

function formatSecretDate(value?: string) {
  if (!value) return "Not rotated";
  return new Date(value).toLocaleString();
}

export default function OracleSecretsPage() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    value: "",
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDemoData, setIsDemoData] = useState(false);
  const mountedRef = useRef(true);

  const mostRecentRotation = secrets
    .map((secret) => secret.lastUpdated)
    .filter(Boolean)
    .sort()
    .at(-1);
  const summaryItems = [
    {
      label: "Configured Secrets",
      value: String(secrets.length),
      helper: "Oracle credential handles",
    },
    {
      label: "Protected Values",
      value: "Hidden",
      helper: "Values never render back",
    },
    {
      label: "Latest Rotation",
      value: mostRecentRotation ? formatSecretDate(mostRecentRotation) : "None",
      helper: "Metadata only",
    },
  ];

  useEffect(() => {
    mountedRef.current = true;
    fetchSecrets()
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("[oracle-secrets] failed to load secrets:", message);
        if (mountedRef.current) {
          setSecrets([]);
          setLoadError(message);
        }
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchSecrets = async () => {
    const res = await fetch("/api/oracle-secrets", {
      ...getAdminFetchOptions(),
      headers: getAdminAuthHeaders(),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        data && typeof data === "object" && "error" in data
          ? String(data.error)
          : "Failed to load oracle secrets";
      throw new Error(message);
    }
    if (!Array.isArray(data)) {
      throw new Error("Invalid oracle secrets payload");
    }
    if (mountedRef.current) {
      setSecrets(data);
      setIsDemoData(isMockDataResponse(res));
      setLoadError(null);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      const res = await fetch("/api/oracle-secrets", {
        ...getAdminFetchOptions(),
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to save secret");
      await fetchSecrets();
      setEditForm({ name: "", description: "", value: "" });
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to remove this secret? Oracle requests using it will fail.",
      )
    ) {
      return;
    }

    setDeleteError(null);
    try {
      const res = await fetch(`/api/oracle-secrets?id=${encodeURIComponent(id)}`, {
        ...getAdminFetchOptions(),
        method: "DELETE",
        headers: getAdminAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete secret");
      await fetchSecrets();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  };

  const openNew = () => {
    setEditForm({ name: "", description: "", value: "" });
    setIsEditing(true);
  };

  return (
    <div className="space-y-6">
      {isDemoData && <DemoDataBanner />}
      {saveError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-700">
            Failed to save secret: {saveError}
          </p>
        </div>
      )}
      {deleteError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-700">
            Failed to delete secret: {deleteError}
          </p>
        </div>
      )}
      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            Failed to load oracle secrets: {loadError}
          </p>
        </div>
      )}

      <div className="oracle-secrets-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="NeoOracle Secrets"
          description="Manage metadata for TEE-injected API keys without exposing secret values."
          highlightLastWord
        />
        <Button onClick={openNew} disabled={loading}>
          Add Secret
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      )}

      {!loading && (
        <div
          aria-label="Oracle secret inventory summary"
          className="oracle-secrets-summary-grid grid gap-3 lg:grid-cols-3"
        >
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase text-gray-500">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-black text-gray-950">
                {item.value}
              </p>
              <p className="mt-1 text-xs font-medium text-gray-500">
                {item.helper}
              </p>
            </div>
          ))}
        </div>
      )}

      {!loading && !loadError && isEditing && (
        <Card
          aria-label="Oracle secret editor"
          className="oracle-secrets-editor-card"
          variant="default"
        >
          <CardHeader>
            <CardTitle>Configure Secret</CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              Values are write-only from this console; the table only shows
              metadata needed for operator audit.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="secret-name" className={labelClass}>
                  Secret Name
                </label>
                <input
                  id="secret-name"
                  className={inputClass}
                  placeholder="binance_api_key"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label htmlFor="secret-description" className={labelClass}>
                  Description
                </label>
                <input
                  id="secret-description"
                  className={inputClass}
                  placeholder="Market data provider credential"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="secret-value" className={labelClass}>
                  Secret Value
                </label>
                <input
                  id="secret-value"
                  type="password"
                  className={inputClass}
                  placeholder="Encrypted by the configured vault backend"
                  value={editForm.value}
                  onChange={(e) =>
                    setEditForm({ ...editForm, value: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Secret values are submitted once and are not displayed in API
              responses, logs, tables, or screenshots.
            </div>
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Securely</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !loadError && (
        <>
          <Card className="oracle-secrets-table-card" variant="default">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle>Secret Registry</CardTitle>
                <p className="mt-1 text-sm text-gray-500">
                  Review credential handles and rotation metadata without
                  exposing provider tokens.
                </p>
              </div>
              <Badge variant="info">{secrets.length} secrets</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {secrets.length > 0 ? (
                <Table aria-label="Oracle secrets">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Secret Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {secrets.map((secret) => (
                      <TableRow key={secret.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-700">
                              {secret.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="font-mono text-sm font-bold text-gray-950">
                              {secret.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {secret.description || "No description"}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {formatSecretDate(secret.lastUpdated)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="success">Metadata only</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDelete(secret.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="px-6 py-10 text-center text-sm text-gray-500">
                  No secrets configured.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="oracle-secrets-usage-card" variant="default">
            <CardHeader>
              <CardTitle>Usage Example</CardTitle>
              <p className="mt-1 text-sm text-gray-500">
                Request-response oracle calls reference a secret by name; the
                raw value stays outside the browser.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                {`{
  "url": "https://api.binance.com/api/v3/account",
  "method": "GET",
  "headers": { "Accept": "application/json" },
  "secret_name": "binance_api_key",
  "secret_as_key": "X-MBX-APIKEY"
}`}
              </pre>
              <p className="text-sm leading-6 text-gray-600">
                NeoOracle injects the named credential inside the trusted
                execution path before firing the upstream request. PriceFeeds
                remain focused on aggregation, while generic Oracle handles
                authenticated fetches.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
