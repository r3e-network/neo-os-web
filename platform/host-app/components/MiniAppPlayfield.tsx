import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MiniAppInfo, MiniAppLaunchContext } from "./types";
import {
  getMiniAppContractHash,
  getRpcNetwork,
  getRpcUrl,
} from "@/lib/rpc-helpers";
import type { NeoNetwork } from "@/lib/neo-network";
import { ErrorBoundary } from "./ErrorBoundary";
import { PlayAreaRegistry } from "./playarea/PlayAreaRegistry";
import {
  fetchAppActivity,
  fetchAppStats,
  type Activity,
} from "./playfield/MiniAppLiveData";

export function MiniAppPlayfield({
  app,
  launchContext = null,
  targetNetwork = null,
}: {
  app: MiniAppInfo;
  launchContext?: MiniAppLaunchContext | null;
  targetNetwork?: NeoNetwork | null;
}) {
  return (
    <LiveContractView
      app={app}
      launchContext={launchContext}
      targetNetwork={targetNetwork}
    />
  );
}

function LiveContractView({
  app,
  launchContext,
  targetNetwork,
}: {
  app: MiniAppInfo;
  launchContext?: MiniAppLaunchContext | null;
  targetNetwork?: NeoNetwork | null;
}) {
  const [stats, setStats] = useState<
    Array<{ label: string; value: string; accent?: boolean }>
  >([]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestedNetwork = launchContext?.network ?? targetNetwork ?? getRpcNetwork();
  const contractHash =
    getMiniAppContractHash(app.app_id, requestedNetwork) ||
    app.contract_hash ||
    null;
  const rpcUrl = getRpcUrl(requestedNetwork);

  const loadContractData = useCallback(
    async ({ isInitial = false } = {}) => {
      if (!contractHash) {
        setStats([]);
        setActivity(null);
        setLoading(false);
        return;
      }

      try {
        if (isInitial) setLoading(true);
        const [appStats, appActivity] = await Promise.all([
          fetchAppStats(
            app.app_id,
            rpcUrl,
            contractHash,
            requestedNetwork,
            launchContext,
          ),
          fetchAppActivity(
            app.app_id,
            rpcUrl,
            contractHash,
            requestedNetwork,
            launchContext,
          ).catch(() => null),
        ]);
        setStats(appStats);
        setActivity(appActivity);
        setError(null);
      } catch (e) {
        if (isInitial) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [app.app_id, contractHash, launchContext, requestedNetwork, rpcUrl],
  );

  // Poll chain state every 15s, but pause while the document is hidden so a
  // backgrounded tab does not keep re-reading the contract forever. A single
  // refresh fires when the tab becomes visible again (mirrors useActivityFeed).
  useEffect(() => {
    loadContractData({ isInitial: true });

    const isHidden = () =>
      typeof document !== "undefined" && document.visibilityState === "hidden";

    const interval = setInterval(() => {
      if (isHidden()) return;
      loadContractData();
    }, 15000);

    const handleVisibilityChange = () => {
      if (isHidden()) return;
      loadContractData();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
    };
  }, [loadContractData]);

  const statsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const stat of stats) map[stat.label] = stat.value;
    return map;
  }, [stats]);

  return (
    <ErrorBoundary
      componentName={`playarea:${app.app_id}`}
      fallback={<PlayAreaErrorFallback />}
    >
      <PlayAreaRegistry
        app={app}
        stats={stats}
        statsMap={statsMap}
        activity={activity}
        loading={loading}
        error={error}
        contractHash={contractHash}
        network={requestedNetwork}
        launchContext={launchContext}
        onRefresh={() => loadContractData({ isInitial: true })}
      />
    </ErrorBoundary>
  );
}

// Compact fallback so a playarea render crash degrades to a refresh card
// instead of taking down the whole miniapp detail page (operations, tabs).
function PlayAreaErrorFallback() {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-semibold text-gray-900">
        This play area failed to render
      </p>
      <p className="mt-1 text-xs text-gray-600">
        The rest of the page is still available. Refresh to try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
      >
        Refresh
      </button>
    </div>
  );
}
