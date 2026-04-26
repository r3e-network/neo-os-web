"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import {
  useSimulationStatus,
  useStartSimulation,
  useStopSimulation,
} from "@/lib/hooks/useSimulation";

export default function SimulationsPage() {
  const { data: status, isLoading, error } = useSimulationStatus();
  const startSimulation = useStartSimulation();
  const stopSimulation = useStopSimulation();

  const [config, setConfig] = useState({
    min_interval_ms: 1000,
    max_interval_ms: 5000,
    mini_apps: "",
  });

  const handleStart = () => {
    const apps = config.mini_apps
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    startSimulation.mutate({
      min_interval_ms: config.min_interval_ms,
      max_interval_ms: config.max_interval_ms,
      ...(apps.length > 0 ? { mini_apps: apps } : {}),
    });
  };

  const handleStop = () => {
    stopSimulation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Simulations
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Control and monitor platform transaction simulations
        </p>
      </div>

      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Simulation Control</CardTitle>
          <div className="flex items-center space-x-2">
            Status:{" "}
            {isLoading ? (
              <Spinner />
            ) : status?.running ? (
              <Badge variant="success">Running</Badge>
            ) : (
              <Badge variant="default">Stopped</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-danger-600 mb-4">
              Error loading simulation status:{" "}
              {error instanceof Error ? error.message : String(error)}
            </div>
          )}

          <div className="flex flex-col space-y-4 mb-8">
            {!status?.running && (
              <div className="flex space-x-4 items-center">
                <div>
                  <label
                    htmlFor="min_interval_ms"
                    className="block text-sm font-medium mb-1"
                  >
                    Min Interval (ms)
                  </label>
                  <input
                    id="min_interval_ms"
                    type="number"
                    value={config.min_interval_ms}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        min_interval_ms: parseInt(e.target.value),
                      })
                    }
                    className="border rounded p-2 text-sm w-32 bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="max_interval_ms"
                    className="block text-sm font-medium mb-1"
                  >
                    Max Interval (ms)
                  </label>
                  <input
                    id="max_interval_ms"
                    type="number"
                    value={config.max_interval_ms}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        max_interval_ms: parseInt(e.target.value),
                      })
                    }
                    className="border rounded p-2 text-sm w-32 bg-white dark:bg-gray-900"
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="mini_apps"
                    className="block text-sm font-medium mb-1"
                  >
                    Target MiniApps (comma separated, empty for all)
                  </label>
                  <input
                    id="mini_apps"
                    type="text"
                    value={config.mini_apps}
                    onChange={(e) =>
                      setConfig({ ...config, mini_apps: e.target.value })
                    }
                    placeholder="app1, app2..."
                    className="border rounded p-2 text-sm w-full bg-white dark:bg-gray-900"
                  />
                </div>
              </div>
            )}
            <div className="flex space-x-4">
              <button
                onClick={handleStart}
                disabled={
                  isLoading || status?.running || startSimulation.isPending
                }
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {startSimulation.isPending ? "Starting..." : "Start Simulation"}
              </button>
              <button
                onClick={handleStop}
                disabled={
                  isLoading || !status?.running || stopSimulation.isPending
                }
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {stopSimulation.isPending ? "Stopping..." : "Stop Simulation"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="text-sm text-gray-500">Active MiniApps</div>
                <div className="text-xl font-bold">
                  {status?.active_miniapps?.length || 0}
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="text-sm text-gray-500">Workers per App</div>
                <div className="text-xl font-bold">
                  {status?.workers_per_app || 0}
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="text-sm text-gray-500">Uptime (s)</div>
                <div className="text-xl font-bold">
                  {status?.uptime_seconds || 0}
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="text-sm text-gray-500">
                  Transactions Simulated
                </div>
                <div className="text-xl font-bold">{status?.tx_count || 0}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
