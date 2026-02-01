// =============================================================================
// Distributed MiniApp Management Page
// New system for external submissions and internal pre-built apps
// =============================================================================

"use client";

import { useState, useEffect } from "react";
import { SubmissionList } from "@/components/admin/miniapps/submission-list";
import { Button } from "@/components/ui/Button";

type Tab = "submissions" | "registry";

export default function DistributedMiniAppsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("submissions");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Distributed MiniApps</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage Git submissions and the published registry
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("submissions")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "submissions"
              ? "border-b-2 border-primary-600 text-primary-600"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          External Submissions
        </button>
        <button
          onClick={() => setActiveTab("registry")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "registry"
              ? "border-b-2 border-primary-600 text-primary-600"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          Registry View
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "submissions" && (
        <div>
          <div className="mb-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <h3 className="mb-1 text-sm font-semibold text-blue-900 dark:text-blue-300">
              External Developer Submissions
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-400">
              Developers submit their miniapps via Git URL. Review source code, approve, and trigger builds. Submissions
              require: Git URL (GitHub/GitLab), branch, optional subfolder.
            </p>
          </div>
          <SubmissionList />
        </div>
      )}

      {activeTab === "registry" && (
        <div>
          <div className="mb-4 rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
            <h3 className="mb-1 text-sm font-semibold text-purple-900 dark:text-purple-300">Unified Registry View</h3>
            <p className="text-xs text-purple-700 dark:text-purple-400">
              Published miniapps sourced from submissions. This is what the host app queries for discovery.
            </p>
          </div>
          <RegistryView />
        </div>
      )}
    </div>
  );
}

// Registry View Component
function RegistryView() {
  const [miniapps, setMiniapps] = useState<
    Array<{
      app_id: string;
      name: string;
      entry_url: string;
      icon: string;
      banner: string;
      category: string;
      source_type: string;
      status: string;
      updated_at: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRegistry = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/miniapps/registry?${new URLSearchParams({
          limit: "100",
        }).toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to load registry");
      }

      const data = await response.json();
      setMiniapps(data.miniapps || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and filter change
  useEffect(() => {
    fetchRegistry();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={fetchRegistry}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading...</div>
      ) : error ? (
        <div className="p-8 text-center text-red-600 dark:text-red-400">{error}</div>
      ) : miniapps.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No published miniapps found.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {miniapps.map((app) => (
            <div
              key={`${app.source_type}-${app.app_id}`}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold">{app.name || app.app_id}</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{app.category}</p>
                </div>
                <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  {app.source_type}
                </span>
              </div>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <p className="truncate">
                  <span className="font-medium">Entry:</span>{" "}
                  <a
                    href={app.entry_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {app.entry_url}
                  </a>
                </p>
                {app.icon && (
                  <p className="truncate">
                    <span className="font-medium">Icon:</span>{" "}
                    <a
                      href={app.icon}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {app.icon}
                    </a>
                  </p>
                )}
                <p className="text-xs text-gray-500">Updated: {new Date(app.updated_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
