/**
 * Admin MiniApp Review Console
 */

import Head from "next/head";
import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, RefreshCw, CheckCircle, XCircle, MessageCircle } from "lucide-react";

interface ContractConfig {
  address?: string;
}

type ReviewQueueItem = {
  app_id: string;
  app: {
    name: string;
    name_zh?: string | null;
    description?: string | null;
    description_zh?: string | null;
    category?: string | null;
    icon_url?: string | null;
    banner_url?: string | null;
    developer_address?: string | null;
    developer_name?: string | null;
    status?: string | null;
    visibility?: string | null;
  } | null;
  version: {
    id: string;
    version?: string | null;
    version_code?: number | null;
    entry_url?: string | null;
    status?: string | null;
    supported_chains?: string[] | null;
    contracts?: Record<string, ContractConfig> | null;
    release_notes?: string | null;
    release_notes_zh?: string | null;
    created_at?: string | null;
  };
  build?: {
    build_number?: number | null;
    platform?: string | null;
    storage_path?: string | null;
    storage_provider?: string | null;
    status?: string | null;
    completed_at?: string | null;
  } | null;
};

export default function AdminMiniApps() {
  const [adminKey, setAdminKey] = useState("");
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviewer, setReviewer] = useState("");

  useEffect(() => {
    const storedKey = window.localStorage.getItem("adminKey") || "";
    const storedReviewer = window.localStorage.getItem("adminReviewer") || "";
    if (storedKey) {
      setAdminKey(storedKey);
      void loadQueue(storedKey);
    }
    if (storedReviewer) {
      setReviewer(storedReviewer);
    }
  }, []);

  const loadQueue = async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/miniapps/review-queue", {
        headers: {
          "x-admin-key": key,
        },
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load review queue");
      }
      setQueue(payload.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  };

  const persistKey = () => {
    window.localStorage.setItem("adminKey", adminKey);
    if (reviewer) window.localStorage.setItem("adminReviewer", reviewer);
  };

  const handleReview = async (item: ReviewQueueItem, action: "approve" | "reject" | "request_changes") => {
    if (!adminKey) {
      setError("Admin key required");
      return;
    }
    const confirmText =
      action === "approve"
        ? "Approve and publish this MiniApp version?"
        : action === "request_changes"
          ? "Request changes for this MiniApp version?"
          : "Reject this MiniApp version?";
    if (!window.confirm(confirmText)) return;

    setBusyId(item.version.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/miniapps/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          app_id: item.app_id,
          version_id: item.version.id,
          action,
          notes: notes[item.version.id] || "",
          reviewer: reviewer || "admin",
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Review action failed");
      }
      await loadQueue(adminKey);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Review action failed");
    } finally {
      setBusyId(null);
    }
  };

  const renderContracts = (contracts?: Record<string, ContractConfig> | null) => {
    if (!contracts) return null;
    const entries = Object.entries(contracts);
    if (!entries.length) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {entries.map(([chainId, config]) => (
          <Badge key={chainId} variant="secondary" className="text-xs">
            {chainId}: {(config as ContractConfig | undefined)?.address || "no address"}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <Head>
        <title>Admin Review Console - NeoHub</title>
      </Head>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">MiniApp Review Queue</h1>
              <p className="text-gray-500">Approve community MiniApps before they go live.</p>
            </div>
            <Button
              onClick={() => loadQueue(adminKey)}
              disabled={loading || !adminKey}
              className="bg-neo text-white hover:bg-neo/90"
            >
              <RefreshCw size={18} className="mr-2" />
              Refresh
            </Button>
          </div>

          <Card className="border border-gray-200 dark:border-white/10">
            <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Admin API Key</label>
                <input
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Enter admin API key"
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Reviewer Name</label>
                <input
                  type="text"
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  placeholder="Admin"
                  className="mt-2 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <Button onClick={persistKey} className="bg-gray-900 text-white hover:bg-gray-800">
                Save
              </Button>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : queue.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 py-16 text-center text-gray-500">
              No pending reviews.
            </div>
          ) : (
            <div className="grid gap-6">
              {queue.map((item) => (
                <Card key={item.version.id} className="border border-gray-200 dark:border-white/10">
                  <CardContent className="p-6 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex items-start gap-4">
                        {item.app?.icon_url ? (
                          <img
                            src={item.app.icon_url}
                            alt={item.app?.name || item.app_id}
                            className="h-14 w-14 rounded-2xl object-cover border border-gray-200 dark:border-white/10"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-2xl bg-gray-100 dark:bg-white/10" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                              {item.app?.name || item.app_id}
                            </h2>
                            {item.app?.category && (
                              <Badge variant="secondary" className="text-xs">
                                {item.app.category}
                              </Badge>
                            )}
                          </div>
                          {item.app?.name_zh && <div className="text-sm text-gray-500">{item.app.name_zh}</div>}
                          <div className="text-sm text-gray-500 mt-1">{item.app?.description}</div>
                          {item.app?.description_zh && (
                            <div className="text-xs text-gray-400 mt-1">{item.app.description_zh}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 text-sm text-gray-500">
                        <div>
                          Developer:{" "}
                          <span className="text-gray-900 dark:text-white">{item.app?.developer_name || "Unknown"}</span>
                        </div>
                        {item.app?.developer_address && <div className="text-xs">{item.app.developer_address}</div>}
                        <div>
                          Submitted:{" "}
                          <span className="text-gray-900 dark:text-white">
                            {item.version.created_at ? new Date(item.version.created_at).toLocaleString() : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Version</div>
                        <div className="mt-1 text-sm text-gray-500">
                          {item.version.version || "1.0.0"} (code {item.version.version_code ?? "?"})
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <a
                            href={item.version.entry_url || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-neo hover:underline"
                          >
                            Entry URL <ExternalLink size={14} />
                          </a>
                        </div>
                        {item.version.release_notes && (
                          <div className="mt-2 text-xs text-gray-500">{item.version.release_notes}</div>
                        )}
                        {item.version.release_notes_zh && (
                          <div className="mt-1 text-xs text-gray-400">{item.version.release_notes_zh}</div>
                        )}
                      </div>

                      <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Build</div>
                        {item.build?.storage_path ? (
                          <div className="mt-2 flex items-center gap-2 text-sm">
                            <a
                              href={item.build.storage_path}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-neo hover:underline"
                            >
                              Download build <ExternalLink size={14} />
                            </a>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-gray-500">No build attached.</div>
                        )}
                        <div className="mt-2 text-xs text-gray-500">
                          Status: {item.build?.status || "n/a"} | Platform: {item.build?.platform || "web"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Chains & Contracts</div>
                      {item.version.supported_chains && item.version.supported_chains.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {item.version.supported_chains.map((chainId) => (
                            <Badge key={chainId} variant="outline" className="text-xs">
                              {chainId}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">No supported chains listed.</div>
                      )}
                      {renderContracts(item.version.contracts)}
                    </div>

                    <div className="flex flex-col gap-3">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Review Notes</label>
                      <textarea
                        value={notes[item.version.id] || ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [item.version.id]: e.target.value }))}
                        className="min-h-[90px] w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-3 text-sm text-gray-900 dark:text-white"
                        placeholder="Add feedback for the developer..."
                      />
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => handleReview(item, "approve")}
                        disabled={busyId === item.version.id}
                        className="bg-neo text-white hover:bg-neo/90"
                      >
                        <CheckCircle size={16} className="mr-2" />
                        Approve & Publish
                      </Button>
                      <Button
                        onClick={() => handleReview(item, "request_changes")}
                        disabled={busyId === item.version.id}
                        variant="outline"
                        className="border-amber-300 text-amber-600 hover:bg-amber-50"
                      >
                        <MessageCircle size={16} className="mr-2" />
                        Request Changes
                      </Button>
                      <Button
                        onClick={() => handleReview(item, "reject")}
                        disabled={busyId === item.version.id}
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <XCircle size={16} className="mr-2" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
