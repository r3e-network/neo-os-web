import React, { useCallback, useEffect, useRef, useState } from "react";
import { Hash, History, SearchCheck } from "lucide-react";

import {
  ActionBoard,
  ActivityPanel,
  ChainStateStrip,
  MetricGrid,
  PlayShell,
  PreviewStat,
  shortHash,
  useLaunchParamState,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps, PlayMetric } from "./PlayAreaShared";

type ExplorerNetworkStats = {
  height: number;
  txCount: number | null;
  txCountSource?: string;
};

type ExplorerStatsPayload = {
  mainnet?: ExplorerNetworkStats;
  testnet?: ExplorerNetworkStats;
};

type ExplorerSearchPayload = {
  type?: string;
  found?: boolean;
  network?: string;
  data?: Record<string, unknown>;
  address?: string;
  tx_count?: number;
  transactions?: Array<Record<string, unknown>>;
  contract_hash?: string;
  call_count?: number;
  calls?: Array<Record<string, unknown>>;
  source?: string;
};

type ExplorerRecentTx = {
  hash?: string;
  tx_hash?: string;
  vm_state?: string;
  vmState?: string;
  block_time?: string;
  blockTime?: string;
};

export function ExplorerPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const launchNetwork = launchContext?.network ?? network;
  const [selectedNetwork, setSelectedNetwork] = useState<"mainnet" | "testnet">(
    launchNetwork,
  );
  const [query] = useLaunchParamState(
    launchContext,
    ["query", "q", "hash", "address", "height"],
    "",
  );
  const [stats, setStats] = useState<ExplorerStatsPayload | null>(null);
  const [recent, setRecent] = useState<ExplorerRecentTx[]>([]);
  const [result, setResult] = useState<ExplorerSearchPayload | null>(null);
  const [status, setStatus] = useState("Ready");
  const [isFetching, setIsFetching] = useState(false);
  const handledSearchRef = useRef("");

  const loadExplorerData = useCallback(async () => {
    setIsFetching(true);
    setStatus("Syncing explorer APIs...");
    try {
      const [statsRes, recentRes] = await Promise.all([
        fetch("/api/explorer/stats"),
        fetch(`/api/explorer/recent?network=${selectedNetwork}&limit=5`),
      ]);

      if (!statsRes.ok) throw new Error(`stats ${statsRes.status}`);
      const statsPayload = (await statsRes.json()) as ExplorerStatsPayload;
      setStats(statsPayload);

      if (recentRes.ok) {
        const recentPayload = (await recentRes.json()) as {
          transactions?: ExplorerRecentTx[];
        };
        setRecent(
          Array.isArray(recentPayload.transactions)
            ? recentPayload.transactions
            : [],
        );
      } else {
        setRecent([]);
      }
      setStatus("Live chain data loaded");
    } catch (err) {
      setStatus(
        err instanceof Error
          ? `Explorer API unavailable: ${err.message}`
          : "Explorer API unavailable",
      );
      setRecent([]);
    } finally {
      setIsFetching(false);
    }
  }, [selectedNetwork]);

  useEffect(() => {
    setSelectedNetwork(launchContext?.network ?? network);
  }, [launchContext?.network, network]);

  useEffect(() => {
    void loadExplorerData();
  }, [loadExplorerData]);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setStatus("Enter a block height, tx hash, address, or contract hash.");
      return;
    }
    setIsFetching(true);
    setResult(null);
    setStatus("Resolving on chain...");
    try {
      const res = await fetch(
        `/api/explorer/search?q=${encodeURIComponent(trimmed)}&network=${selectedNetwork}`,
      );
      const payload = (await res.json()) as ExplorerSearchPayload & {
        error?: string;
      };
      if (!res.ok || payload.error) {
        throw new Error(payload.error || `search ${res.status}`);
      }
      setResult(payload);
      setStatus(
        payload.found
          ? "Resolved from live data"
          : "No matching live record found",
      );
    } catch (err) {
      setStatus(
        err instanceof Error
          ? `Search failed: ${err.message}`
          : "Search failed",
      );
    } finally {
      setIsFetching(false);
    }
  }, [query, selectedNetwork]);

  useEffect(() => {
    if (launchContext?.operation !== "explorerSearch") return;
    const signature = `${launchContext.signature}:${query}:${selectedNetwork}`;
    if (!query.trim() || handledSearchRef.current === signature) return;
    handledSearchRef.current = signature;
    void runSearch();
  }, [
    launchContext?.operation,
    launchContext?.signature,
    query,
    runSearch,
    selectedNetwork,
  ]);

  const selectedStats = stats?.[selectedNetwork];
  const height = selectedStats?.height
    ? selectedStats.height.toLocaleString()
    : "Unavailable";
  const txCount =
    typeof selectedStats?.txCount === "number"
      ? selectedStats.txCount.toLocaleString()
      : "Indexer unavailable";
  const resultStats: PlayMetric[] = [
    { label: "Network", value: selectedNetwork, accent: true },
    { label: "Block height", value: height, accent: true },
    { label: "Indexed tx", value: txCount },
    {
      label: "Result",
      value: result?.found ? String(result.type || "found") : "none",
    },
  ];

  return (
    <PlayShell
      app={app}
      title="Live explorer console"
      subtitle="Query Neo N3 blocks, transactions, addresses, and contracts through live RPC/indexer endpoints. Missing indexer data is shown as unavailable, never synthesized."
      tone="slate"
      side={
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
            <h3 className="m-0 flex items-center gap-2 text-sm font-black text-gray-950">
              <History className="h-4 w-4 text-slate-600" />
              Recent live transactions
            </h3>
            <div className="mt-3 space-y-2">
              {recent.length > 0 ? (
                recent.map((tx, index) => {
                  const hash = String(tx.hash || tx.tx_hash || "");
                  const state = String(tx.vmState || tx.vm_state || "");
                  return (
                    <div
                      key={`${hash}:${index}`}
                      className="block w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left"
                    >
                      <span className="block truncate font-mono text-xs font-bold text-gray-950">
                        {shortHash(hash)}
                      </span>
                      <span className="mt-1 block text-[11px] font-semibold text-gray-500">
                        {state || "state unavailable"}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="m-0 text-sm leading-6 text-gray-500">
                  Recent transaction indexer is not configured or has no rows
                  for this network.
                </p>
              )}
            </div>
          </div>
          <ActivityPanel activity={props.activity} />
        </div>
      }
      footer={
        <ChainStateStrip
          loading={loading || isFetching}
          error={error}
          contractHash={contractHash}
          network={selectedNetwork}
          onRefresh={() => {
            onRefresh();
            void loadExplorerData();
          }}
        />
      }
    >
      <div className="space-y-3">
        <MetricGrid stats={resultStats} />
        <ActionBoard
          title="Search state"
          subtitle="Enter the query and network, then inspect live chain results."
          tone="slate"
          rows={[
            {
              label: "Selected network",
              detail: "Mainnet and testnet requests are isolated",
              value: selectedNetwork,
              valueLabel: "scope",
              active: true,
              icon: <SearchCheck className="h-4 w-4" />,
            },
            {
              label: "Query",
              detail: "Block height, transaction, address, or contract",
              value: query.trim() ? shortHash(query.trim()) : "not set",
              valueLabel: "input",
            },
            {
              label: "Status",
              detail: "Live API response state",
              value: status,
              valueLabel: isFetching ? "loading" : "state",
            },
            {
              label: "Recent index",
              detail: "Latest fetched transaction rows",
              value: recent.length > 0 ? `${recent.length}` : "none",
              valueLabel: "rows",
            },
          ]}
        />
        <ExplorerResultPanel result={result} />
      </div>
    </PlayShell>
  );
}

function ExplorerResultPanel({
  result,
}: {
  result: ExplorerSearchPayload | null;
}) {
  if (!result) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-white/70 p-4 text-sm font-semibold text-gray-500">
        Search results will appear here after a live RPC or indexer response.
      </div>
    );
  }

  if (!result.found) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
        No live record found for this query on{" "}
        {result.network || "the selected network"}.
        {result.source === "indexer_unavailable"
          ? " Address history requires the indexer service."
          : ""}
      </div>
    );
  }

  const data = result.data || {};
  const rows =
    result.type === "block"
      ? [
          ["Block", String(data.index ?? "")],
          ["Hash", String(data.hash ?? "")],
          ["Transactions", String(data.tx_count ?? "")],
          ["Size", data.size == null ? "" : `${String(data.size)} bytes`],
        ]
      : result.type === "transaction"
        ? [
            ["Hash", String(data.hash ?? "")],
            ["VM state", String(data.vm_state ?? data.vmstate ?? "")],
            ["Block", String(data.block_index ?? data.blockindex ?? "")],
            ["Sender", String(data.sender ?? "")],
          ]
        : result.type === "address"
          ? [
              ["Address", String(result.address ?? "")],
              ["Transactions", String(result.tx_count ?? 0)],
              ["Source", "indexer"],
            ]
          : [
              ["Contract", String(result.contract_hash ?? "")],
              ["Calls", String(result.call_count ?? 0)],
              ["Source", String(result.source || "indexer")],
            ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Hash className="h-4 w-4 text-emerald-600" />
        <h3 className="m-0 text-sm font-black capitalize text-gray-950">
          {result.type} result
        </h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <PreviewStat
            key={label}
            label={label}
            value={value || "Unavailable"}
          />
        ))}
      </div>
    </div>
  );
}
