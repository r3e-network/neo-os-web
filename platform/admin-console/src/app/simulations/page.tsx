"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/layout/PageHeader";
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
    min_interval_ms: "1000",
    max_interval_ms: "5000",
    mini_apps: "",
  });

  const running = Boolean(status?.running);
  const activeMiniApps = status?.active_miniapps ?? [];
  const workerCount = status?.workers_per_app ?? 0;
  const uptimeSeconds = status?.uptime_seconds ?? 0;
  const txCount = status?.tx_count ?? 0;
  const isStartDisabled = isLoading || running || startSimulation.isPending;
  const isStopDisabled = isLoading || !running || stopSimulation.isPending;
  const controlsDisabled = isLoading || running || startSimulation.isPending;
  const mutationError = startSimulation.error || stopSimulation.error;
  const statusItems = [
    {
      label: "Mode",
      value: isLoading ? "Loading" : running ? "Running" : "Stopped",
      helper: running ? "Scenario runner active" : "Ready for scoped testing",
    },
    {
      label: "Active MiniApps",
      value: activeMiniApps.length,
      helper: `${workerCount} workers per app`,
    },
    {
      label: "Uptime",
      value: `${uptimeSeconds}s`,
      helper: "Current run duration",
    },
    {
      label: "Transactions",
      value: txCount,
      helper: "Simulated operations",
    },
  ];

  const parseInterval = (value: string, fallback: number) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const handleStart = () => {
    const apps = config.mini_apps
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    startSimulation.mutate({
      min_interval_ms: parseInterval(config.min_interval_ms, 1000),
      max_interval_ms: parseInterval(config.max_interval_ms, 5000),
      ...(apps.length > 0 ? { mini_apps: apps } : {}),
    });
  };

  const handleStop = () => {
    stopSimulation.mutate();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transaction Simulations"
        description="Control dry-run transaction load before exposing contract flows."
        highlightLastWord
      />

      <div
        aria-label="Simulation status summary"
        className="simulation-summary-grid grid gap-3 lg:grid-cols-4"
      >
        {statusItems.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase text-gray-500">
              {item.label}
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-2xl font-black text-gray-950">
                {item.value}
              </p>
              <p className="text-right text-xs font-medium text-gray-500">
                {item.helper}
              </p>
            </div>
          </div>
        ))}
      </div>

      {(error || mutationError) && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4">
          {error && (
            <p className="text-sm font-semibold text-danger-700">
              Error loading simulation status:{" "}
              {error instanceof Error ? error.message : String(error)}
            </p>
          )}
          {mutationError && (
            <p className="text-sm font-semibold text-danger-700">
              Error updating simulation:{" "}
              {mutationError instanceof Error
                ? mutationError.message
                : String(mutationError)}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <Card
          aria-label="Simulation control panel"
          className="simulation-control-card"
          variant="default"
        >
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Scenario Runner</CardTitle>
              <p className="mt-1 text-sm text-gray-500">
                Scope synthetic transaction traffic by interval and MiniApp
                before wiring production flows.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-gray-500">
                Status
              </span>
              {isLoading ? (
                <Spinner />
              ) : running ? (
                <Badge variant="success">Running</Badge>
              ) : (
                <Badge variant="default">Stopped</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              No deploys, upgrades, or fund transfers are executed here.
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(15rem,1.4fr)]">
              <Input
                id="min_interval_ms"
                label="Minimum interval"
                type="number"
                min={0}
                value={config.min_interval_ms}
                disabled={controlsDisabled}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    min_interval_ms: e.target.value,
                  })
                }
              />
              <Input
                id="max_interval_ms"
                label="Maximum interval"
                type="number"
                min={0}
                value={config.max_interval_ms}
                disabled={controlsDisabled}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    max_interval_ms: e.target.value,
                  })
                }
              />
              <Input
                id="mini_apps"
                label="Target MiniApps"
                type="text"
                value={config.mini_apps}
                disabled={controlsDisabled}
                placeholder="oracle-price-console, aa-market-hub"
                onChange={(e) =>
                  setConfig({ ...config, mini_apps: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="danger"
                onClick={handleStop}
                disabled={isStopDisabled}
                isLoading={stopSimulation.isPending}
              >
                Stop Simulation
              </Button>
              <Button
                onClick={handleStart}
                disabled={isStartDisabled}
                isLoading={startSimulation.isPending}
              >
                Start Simulation
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card
          aria-label="Active MiniApps"
          className="simulation-active-apps"
          variant="default"
        >
          <CardHeader>
            <CardTitle>Active MiniApps</CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              Current synthetic traffic scope.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activeMiniApps.length > 0 ? (
                activeMiniApps.map((appId) => (
                  <span
                    key={appId}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                  >
                    {appId}
                  </span>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  No scoped MiniApps reported.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
