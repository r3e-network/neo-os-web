// =============================================================================
// Internal MiniApps List Component
// Lists pre-built internal miniapps
// =============================================================================

"use client";

import { useEffect, useState } from "react";
import { InternalMiniApp } from "./types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { InternalSync } from "./internal-sync";

export function InternalList() {
  const [miniapps, setMiniapps] = useState<InternalMiniApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInternal = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/miniapps/internal");

      if (!response.ok) {
        throw new Error("Failed to load internal miniapps");
      }

      const data = await response.json();
      setMiniapps(data.miniapps || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInternal();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Button className="mt-4" onClick={fetchInternal}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Internal MiniApps</h2>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-sm">{miniapps.length} apps</span>
          <InternalSync onSuccess={fetchInternal} />
        </div>
      </div>

      {miniapps.length === 0 ? (
        <div className="text-muted-foreground p-8 text-center">
          No internal miniapps found. Sync from repository to populate.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {miniapps.map((app) => (
            <Card key={app.id} className="p-4">
              <div className="mb-2 flex items-start justify-between">
                <h3 className="font-semibold">{app.app_id}</h3>
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">{app.status}</Badge>
              </div>
              <div className="text-muted-foreground space-y-1 text-sm">
                <p>
                  <span className="font-medium">Path:</span> {app.subfolder}
                </p>
                <p>
                  <span className="font-medium">Category:</span> {app.category}
                </p>
                <p>
                  <span className="font-medium">Version:</span> {app.current_version}
                </p>
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
                {app.icon_url && (
                  <p>
                    <span className="font-medium">Icon:</span>{" "}
                    <a
                      href={app.icon_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View
                    </a>
                  </p>
                )}
                {app.banner_url && (
                  <p>
                    <span className="font-medium">Banner:</span>{" "}
                    <a
                      href={app.banner_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View
                    </a>
                  </p>
                )}
                <p className="text-muted-foreground/70 text-xs">Updated: {new Date(app.updated_at).toLocaleString()}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
