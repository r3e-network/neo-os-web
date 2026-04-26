"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface Secret {
  id: string;
  name: string;
  description: string;
  value: string;
  lastUpdated?: string;
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetchSecrets()
      .catch((e: unknown) => {
        console.warn(
          "[oracle-secrets] failed to load secrets:",
          e instanceof Error ? e.message : String(e),
        );
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchSecrets = async () => {
    const res = await fetch("/api/oracle-secrets");
    const data = await res.json();
    if (mountedRef.current) setSecrets(data);
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      const res = await fetch("/api/oracle-secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to save secret");
      setIsEditing(false);
      fetchSecrets();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to remove this secret? Oracle requests using it will fail.",
      )
    )
      return;
    setDeleteError(null);
    try {
      const res = await fetch(`/api/oracle-secrets?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete secret");
      fetchSecrets();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  };

  const openNew = () => {
    setEditForm({ name: "", description: "", value: "" });
    setIsEditing(true);
  };

  if (loading)
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );

  return (
    <div className="space-y-6">
      {saveError && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">
            Failed to save secret: {saveError}
          </p>
        </div>
      )}
      {deleteError && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">
            Failed to delete secret: {deleteError}
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            NeoOracle Secrets
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage API keys and tokens injected by the TEE Oracle
          </p>
        </div>
        <Button onClick={openNew}>Add Secret</Button>
      </div>

      {isEditing && (
        <Card
          variant="glass"
          className="border-neo/50 shadow-[0_0_15px_rgba(0,229,153,0.1)]"
        >
          <CardHeader>
            <CardTitle>Configure Secret</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="secret-name"
                  className="block text-sm text-gray-400 mb-1"
                >
                  Secret Name
                </label>
                <input
                  id="secret-name"
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white"
                  placeholder="e.g. binance_api_key"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="secret-description"
                  className="block text-sm text-gray-400 mb-1"
                >
                  Description
                </label>
                <input
                  id="secret-description"
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label
                  htmlFor="secret-value"
                  className="block text-sm text-gray-400 mb-1"
                >
                  Secret Value (Token/Key)
                </label>
                <input
                  id="secret-value"
                  type="password"
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white"
                  placeholder="Will be encrypted in the TEE Vault"
                  value={editForm.value}
                  onChange={(e) =>
                    setEditForm({ ...editForm, value: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Securely</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card variant="glass">
        <CardContent className="p-0">
          <table
            className="w-full text-left text-sm text-gray-300"
            aria-label="Oracle secrets"
          >
            <caption className="sr-only">Oracle Secrets</caption>
            <thead className="bg-white/5 text-gray-400">
              <tr>
                <th className="p-4 font-medium">Secret Name</th>
                <th className="p-4 font-medium">Description</th>
                <th className="p-4 font-medium">Last Updated</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {secrets.map((secret) => (
                <tr
                  key={secret.id}
                  className="hover:bg-white/5 transition-colors"
                >
                  <td className="p-4 font-bold text-white font-mono">
                    {secret.name}
                  </td>
                  <td className="p-4">{secret.description}</td>
                  <td className="p-4">
                    {secret.lastUpdated
                      ? new Date(secret.lastUpdated).toLocaleString()
                      : "N/A"}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(secret.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {secrets.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    No secrets configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <CardTitle>Usage Example (Request-Response)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="p-4 bg-black/30 rounded-lg text-sm text-gray-300 overflow-x-auto border border-white/5">
            {`// Payload for NeoOracle /query endpoint
{
 "url": "https://api.binance.com/api/v3/account",
 "method": "GET",
 "headers": {
 "Accept": "application/json"
 },
 "secret_name": "binance_api_key",
 "secret_as_key": "X-MBX-APIKEY"
}`}
          </pre>
          <p className="text-sm text-gray-400 mt-4">
            The NeoOracle service executes this request inside the TEE and
            securely injects the actual API key mapped to{" "}
            <code>secret_name</code> into the header specified by{" "}
            <code>secret_as_key</code> before firing the HTTP request to
            Binance. This cleanly isolates PriceFeeds (data aggregation) from
            generic Oracle (request-response authenticated fetch).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
