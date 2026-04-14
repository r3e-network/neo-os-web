import React, { useEffect, useState, useCallback } from "react";
import { ExternalMiniAppFrame } from "./ExternalMiniAppFrame";
import { FederatedMiniApp } from "./FederatedMiniApp";
import { parseFederatedEntryUrl } from "../lib/miniapp";
import { isManifestMiniAppEntryUrl } from "../lib/miniapp-entry-url";
import { MiniAppInfo } from "./types";
import { getMiniAppContractHash, getRpcUrl } from "@/lib/rpc-helpers";
import { resolveMiniAppSlug } from "@/lib/miniapp-media";

export function MiniAppPlayfield({ app }: { app: MiniAppInfo }) {
  const isManifestMode = isManifestMiniAppEntryUrl(app.entry_url);
  const federated = isManifestMode ? null : parseFederatedEntryUrl(app.entry_url, app.app_id);
  const externalUrl = !isManifestMode && !federated ? app.entry_url : null;

  if (federated) {
    return (
      <div className="w-full h-[600px] rounded-2xl overflow-hidden bg-white relative border border-gray-200 shadow-sm">
        <FederatedMiniApp appId={federated.appId} view={federated.view} remote={federated.remote} />
      </div>
    );
  }

  if (externalUrl) {
    return <ExternalMiniAppFrame src={externalUrl} title={app.name} />;
  }

  return <LiveContractView app={app} />;
}

/* ── RPC helper ──────────────────────────────────────────────────────── */

async function invokeRead(rpcUrl: string, contractHash: string, method: string, params: Array<{ type: string; value: string }> = []): Promise<unknown[]> {
  const body = { jsonrpc: "2.0", id: 1, method: "invokefunction", params: [contractHash, method, params] };
  const resp = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  const data = await resp.json();
  if (data?.result?.state !== "HALT") return [];
  return data.result.stack || [];
}

function stackInt(stack: unknown[], index = 0): number {
  const item = (stack as Array<{ type: string; value: string }>)[index];
  if (!item) return 0;
  return parseInt(item.value || "0", 10);
}

function stackStr(stack: unknown[], index = 0): string {
  const item = (stack as Array<{ type: string; value: string }>)[index];
  if (!item) return "";
  if (item.type === "ByteString" && item.value) {
    try { return atob(item.value); } catch { return item.value; }
  }
  return item.value || "";
}

/* ── Stat card ───────────────────────────────────────────────────────── */

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center p-4 rounded-xl bg-gray-50 border border-gray-100">
      <div className={`text-2xl font-black ${accent ? "text-emerald-600" : "text-gray-900"}`}>{value}</div>
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

/* ── Live contract view ──────────────────────────────────────────────── */

function LiveContractView({ app }: { app: MiniAppInfo }) {
  const [stats, setStats] = useState<Array<{ label: string; value: string; accent?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const slug = resolveMiniAppSlug(app.app_id, app.entry_url);
  const logoUrl = `/miniapp-assets/${slug}/logo.svg`;
  const contractHash = getMiniAppContractHash(app.app_id);
  const rpcUrl = getRpcUrl();

  const loadContractData = useCallback(async () => {
    if (!contractHash) {
      setStats([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const appStats = await fetchAppStats(app.app_id, rpcUrl, contractHash);
      setStats(appStats);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [app.app_id, contractHash, rpcUrl]);

  useEffect(() => {
    loadContractData();
    const interval = setInterval(loadContractData, 15000);
    return () => clearInterval(interval);
  }, [loadContractData]);

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-5 border-b border-gray-100">
        <img src={logoUrl} alt="" className="w-10 h-10 rounded-xl" />
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">{app.name}</h3>
          <p className="text-xs text-gray-400">{app.description}</p>
        </div>
        {contractHash && (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
            Live on Mainnet
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="p-6">
        {loading && stats.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-50 animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">{error}</p>
            <button type="button" onClick={loadContractData} className="mt-2 text-xs font-semibold text-emerald-600 hover:underline cursor-pointer">Retry</button>
          </div>
        ) : stats.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s, i) => <Stat key={i} label={s.label} value={s.value} accent={s.accent} />)}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-gray-400">
            No contract deployed on mainnet yet. Use the operations panel to interact.
          </div>
        )}

        {contractHash && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] text-gray-300 font-mono">{contractHash}</span>
            <a
              href={`https://neotube.io/contract/${contractHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-emerald-600 hover:underline"
            >
              View on NeoTube &rarr;
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Per-app contract reads ──────────────────────────────────────────── */

async function fetchAppStats(appId: string, rpcUrl: string, contractHash: string): Promise<Array<{ label: string; value: string; accent?: boolean }>> {
  const fmtGas = (v: number) => (v / 100000000).toFixed(2);
  const fmtAddr = (v: string) => v.length > 10 ? `${v.slice(0, 6)}...${v.slice(-4)}` : v || "---";

  try {
    switch (appId) {
      case "miniapp-last-survivor": {
        const [round, pot, active, buyer, deadline] = await Promise.all([
          invokeRead(rpcUrl, contractHash, "getCurrentRound").then((s) => stackInt(s)),
          invokeRead(rpcUrl, contractHash, "getTotalPot").then((s) => stackInt(s)),
          invokeRead(rpcUrl, contractHash, "isRoundActive").then((s) => stackInt(s) !== 0),
          invokeRead(rpcUrl, contractHash, "getLastBuyer").then((s) => stackStr(s)),
          invokeRead(rpcUrl, contractHash, "getDeadline").then((s) => stackInt(s)),
        ]);
        const now = Math.floor(Date.now() / 1000);
        const remaining = Math.max(0, deadline - now);
        const hours = Math.floor(remaining / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        const secs = remaining % 60;
        const countdown = active ? `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : "Ended";
        return [
          { label: "Prize Pool", value: `${fmtGas(pot)} GAS`, accent: true },
          { label: "Countdown", value: countdown, accent: active },
          { label: "Round", value: `#${round}` },
          { label: "Current Leader", value: fmtAddr(buyer) },
          { label: "Status", value: active ? "Active" : "Ended" },
        ];
      }

      case "miniapp-gasbox": {
        const [totalPulls, machineCount] = await Promise.all([
          invokeRead(rpcUrl, contractHash, "getTotalPulls").then((s) => stackInt(s)),
          invokeRead(rpcUrl, contractHash, "getMachineCount").then((s) => stackInt(s)),
        ]);
        return [
          { label: "Total Pulls", value: totalPulls.toLocaleString(), accent: true },
          { label: "Machines", value: String(machineCount) },
        ];
      }

      case "miniapp-redenvelope": {
        const [totalCreated, totalClaimed] = await Promise.all([
          invokeRead(rpcUrl, contractHash, "getTotalCreated").then((s) => stackInt(s)),
          invokeRead(rpcUrl, contractHash, "getTotalClaimed").then((s) => stackInt(s)),
        ]);
        return [
          { label: "Envelopes Created", value: String(totalCreated), accent: true },
          { label: "Total Claimed", value: String(totalClaimed) },
          { label: "Unclaimed", value: String(Math.max(0, totalCreated - totalClaimed)) },
        ];
      }

      case "miniapp-dailycheckin": {
        const [totalCheckins, totalUsers] = await Promise.all([
          invokeRead(rpcUrl, contractHash, "getTotalCheckins").then((s) => stackInt(s)),
          invokeRead(rpcUrl, contractHash, "getTotalUsers").then((s) => stackInt(s)),
        ]);
        return [
          { label: "Total Check-ins", value: totalCheckins.toLocaleString(), accent: true },
          { label: "Active Users", value: totalUsers.toLocaleString() },
        ];
      }

      case "miniapp-fogplay": {
        const [totalGames] = await Promise.all([
          invokeRead(rpcUrl, contractHash, "getTotalGames").then((s) => stackInt(s)),
        ]);
        return [
          { label: "Total Games", value: totalGames.toLocaleString(), accent: true },
        ];
      }

      case "miniapp-self-loan": {
        const [totalLoans, totalBorrowed] = await Promise.all([
          invokeRead(rpcUrl, contractHash, "getTotalLoans").then((s) => stackInt(s)),
          invokeRead(rpcUrl, contractHash, "getTotalBorrowed").then((s) => stackInt(s)),
        ]);
        return [
          { label: "Total Loans", value: String(totalLoans), accent: true },
          { label: "Total Borrowed", value: `${fmtGas(totalBorrowed)} GAS` },
        ];
      }

      case "miniapp-neo-pay": {
        const [totalStreams] = await Promise.all([
          invokeRead(rpcUrl, contractHash, "getTotalStreams").then((s) => stackInt(s)),
        ]);
        return [
          { label: "Total Streams", value: String(totalStreams), accent: true },
        ];
      }

      default:
        return [{ label: "Contract", value: "Active" }];
    }
  } catch {
    return [{ label: "Status", value: "Online" }];
  }
}
