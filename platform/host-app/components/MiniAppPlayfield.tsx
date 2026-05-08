import React, { useEffect, useState, useCallback, useMemo } from "react";
import { MiniAppInfo, MiniAppLaunchContext } from "./types";
import {
  getMiniAppContractHash,
  getRpcNetwork,
  getRpcUrl,
} from "@/lib/rpc-helpers";
import { PlayAreaRegistry } from "./playarea/PlayAreaRegistry";

export function MiniAppPlayfield({
  app,
  launchContext = null,
}: {
  app: MiniAppInfo;
  launchContext?: MiniAppLaunchContext | null;
}) {
  return <LiveContractView app={app} launchContext={launchContext} />;
}

/* ── RPC helpers ─────────────────────────────────────────────────────── */

async function invokeRead(
  _rpcUrl: string,
  contractHash: string,
  method: string,
  params: Array<{ type: string; value: string }> = [],
  network: "mainnet" | "testnet" = getRpcNetwork(),
): Promise<unknown[]> {
  const resp = await fetch("/api/rpc/neo-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contractHash, method, params, network }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await resp.json();
  if (data?.result?.state !== "HALT") return [];
  return data.result.stack || [];
}

type StackItem = { type: string; value: unknown };

function stackInt(stack: unknown[], index = 0): number {
  const item = (stack as StackItem[])[index];
  if (!item) return 0;
  return parseInt(String(item.value || "0"), 10);
}

function stackBool(stack: unknown[], index = 0): boolean {
  const item = (stack as StackItem[])[index];
  if (!item) return false;
  if (item.type === "Boolean") return Boolean(item.value);
  return String(item.value || "0") !== "0";
}

function stackItemBool(item: StackItem | undefined): boolean {
  if (!item) return false;
  if (item.type === "Boolean") return Boolean(item.value);
  return String(item.value || "0") !== "0";
}

function stackArray(stack: unknown[], index = 0): StackItem[] {
  const item = (stack as StackItem[])[index];
  if (!item || (item.type !== "Struct" && item.type !== "Array")) return [];
  return Array.isArray(item.value) ? (item.value as StackItem[]) : [];
}

function decodeMap(stack: unknown[], index = 0): Record<string, unknown> {
  const item = (stack as StackItem[])[index];
  if (!item || item.type !== "Map") return {};
  const out: Record<string, unknown> = {};
  for (const kv of (item.value as Array<{
    key: StackItem;
    value: StackItem;
  }>) || []) {
    let key = String(kv.key?.value || "");
    if (kv.key?.type === "ByteString" && key) {
      try {
        key = atob(key);
      } catch {
        /* ignore */
      }
    }
    out[key] = kv.value?.value;
    (out as Record<string, unknown>)[`__type__${key}`] = kv.value?.type;
  }
  return out;
}

function fmtGas(units: number | string | undefined): string {
  const n = typeof units === "string" ? parseInt(units, 10) : (units ?? 0);
  if (!Number.isFinite(n)) return "0.00";
  return (n / 100000000).toFixed(2);
}

function fmtAddr(b64OrHex: string | undefined): string {
  if (!b64OrHex) return "—";
  if (b64OrHex.startsWith("0x") && b64OrHex.length === 42)
    return `${b64OrHex.slice(0, 6)}…${b64OrHex.slice(-4)}`;
  // base64 hash160 → render as 0x-prefixed scripthash (first6…last4)
  try {
    const bin = atob(b64OrHex);
    if (bin.length === 20) {
      let hex = "";
      for (let i = 0; i < bin.length; i++)
        hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
      return `0x${hex.slice(0, 6)}…${hex.slice(-4)}`;
    }
  } catch {
    /* fall through */
  }
  return `${b64OrHex.slice(0, 8)}…${b64OrHex.slice(-4)}`;
}

function resolveAnchorAppId(appId: string): string | null {
  if (appId === "miniapp-profitanchor" || appId === "miniapp-profitanchor-admin") {
    return "miniapp-profitanchor";
  }
  if (appId === "miniapp-trustanchor" || appId === "miniapp-trustanchor-admin") {
    return "miniapp-trustanchor";
  }
  return null;
}

function isZeroAddr(b64: string | undefined): boolean {
  if (!b64) return true;
  if (b64 === "0x0000000000000000000000000000000000000000") return true;
  try {
    const bin = atob(b64);
    if (bin.length !== 20) return false;
    for (let i = 0; i < bin.length; i++)
      if (bin.charCodeAt(i) !== 0) return false;
    return true;
  } catch {
    return false;
  }
}

const LAST_SURVIVOR_ROLLOVER_LABEL = "Rollover Ready";

function fmtCountdown(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0)
    return LAST_SURVIVOR_ROLLOVER_LABEL;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeAgo(msTimestamp: number): string {
  if (!Number.isFinite(msTimestamp) || msTimestamp <= 0) return "—";
  const diff = Date.now() - msTimestamp;
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/* ── Live contract view ──────────────────────────────────────────────── */

type Activity = {
  title: string;
  rows: Array<{
    icon: string;
    primary: string;
    secondary?: string;
    amount?: string;
    accent?: boolean;
  }>;
  emptyText?: string;
};

const LAST_SURVIVOR_APP_ID = "miniapp-last-survivor";

function LiveContractView({
  app,
  launchContext,
}: {
  app: MiniAppInfo;
  launchContext?: MiniAppLaunchContext | null;
}) {
  const [stats, setStats] = useState<
    Array<{ label: string; value: string; accent?: boolean }>
  >([]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestedNetwork = launchContext?.network ?? getRpcNetwork();
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
        // Only show the skeleton on the very first fetch. Subsequent
        // background refreshes swap the stats/activity in place so the
        // hero + stats grid don't flicker every 15 s.
        if (isInitial) setLoading(true);
        const [appStats, appActivity] = await Promise.all([
          fetchAppStats(app.app_id, rpcUrl, contractHash, requestedNetwork),
          fetchAppActivity(
            app.app_id,
            rpcUrl,
            contractHash,
            requestedNetwork,
          ).catch(() => null),
        ]);
        setStats(appStats);
        setActivity(appActivity);
        setError(null);
      } catch (e) {
        // Keep existing data on refresh failures — only surface errors on
        // the initial load when there's nothing to show yet.
        if (isInitial)
          setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [app.app_id, contractHash, requestedNetwork, rpcUrl],
  );

  useEffect(() => {
    loadContractData({ isInitial: true });
    const interval = setInterval(() => loadContractData(), 15000);
    return () => clearInterval(interval);
  }, [loadContractData]);

  // Flatten the stats array into a label→value map so the per-flagship hero
  // can pick the fields it cares about without duplicating the RPC reads.
  const statsMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of stats) m[s.label] = s.value;
    return m;
  }, [stats]);

  return (
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
  );
}

/* ── Per-app contract reads ──────────────────────────────────────────── */

async function fetchAppStats(
  appId: string,
  rpcUrl: string,
  contractHash: string,
  network: "mainnet" | "testnet",
): Promise<Array<{ label: string; value: string; accent?: boolean }>> {
  try {
    switch (appId) {
      case "miniapp-last-survivor": {
        if (network === "testnet") {
          const [stateStack, pausedStack] = await Promise.all([
            invokeRead(
              rpcUrl,
              contractHash,
              "getCountdownStatus",
              [{ type: "String", value: LAST_SURVIVOR_APP_ID }],
              network,
            ),
            invokeRead(
              rpcUrl,
              contractHash,
              "isPaused",
              [{ type: "String", value: LAST_SURVIVOR_APP_ID }],
              network,
            ),
          ]);
          const state = decodeMap(stateStack);
          const round = parseInt(String(state.roundId ?? "0"), 10);
          const active = Boolean(state.active);
          const paused = stackBool(pausedStack);
          const pot = parseInt(String(state.pot ?? "0"), 10);
          const totalKeys = parseInt(String(state.totalKeys ?? "0"), 10);
          const endTime = parseInt(String(state.endTime ?? "0"), 10);
          const currentKeyPrice = parseInt(
            String(state.currentKeyPrice ?? "0"),
            10,
          );
          const totalPlayers = parseInt(String(state.totalPlayers ?? "0"), 10);
          const totalDistributed = parseInt(
            String(state.totalPotDistributed ?? "0"),
            10,
          );
          const expiredButOpen =
            active &&
            (String(state.status || "").toLowerCase() === "ending" ||
              (endTime > 0 && endTime < Date.now()));
          const remainingSec =
            active && !expiredButOpen && endTime > 0
              ? Math.max(0, Math.floor((endTime - Date.now()) / 1000))
              : 0;

          const status = paused
            ? "Paused"
            : !active
              ? "Next Round Pending"
              : expiredButOpen
                ? LAST_SURVIVOR_ROLLOVER_LABEL
                : "Open for Bids";

          return [
            {
              label: "Countdown",
              value:
                active && !expiredButOpen
                  ? fmtCountdown(remainingSec)
                  : LAST_SURVIVOR_ROLLOVER_LABEL,
              accent: active && !expiredButOpen,
            },
            {
              label: "Prize Pool",
              value: `${fmtGas(pot)} GAS`,
              accent: pot > 0,
            },
            { label: "Round", value: `#${round}` },
            { label: "Keys This Round", value: String(totalKeys) },
            { label: "Total Players", value: String(totalPlayers) },
            { label: "Key Price", value: `${fmtGas(currentKeyPrice)} GAS` },
            {
              label: "Total Distributed",
              value: `${fmtGas(totalDistributed)} GAS`,
              accent: true,
            },
            {
              label: "Status",
              value: status,
              accent: !paused && active && !expiredButOpen,
            },
          ];
        }

        const stateStack = await invokeRead(
          rpcUrl,
          contractHash,
          "getRoundStateForFrontend",
          [],
          network,
        );
        const state = decodeMap(stateStack);
        const round = parseInt(String(state.roundId ?? "0"), 10);
        const active = Boolean(state.active);
        const pot = parseInt(String(state.pot ?? "0"), 10);
        const totalKeys = parseInt(String(state.totalKeys ?? "0"), 10);
        const endTime = parseInt(String(state.endTime ?? "0"), 10);
        const remainingSec =
          active && endTime > 0
            ? Math.max(0, Math.floor((endTime - Date.now()) / 1000))
            : 0;
        const expiredButOpen = active && endTime > 0 && endTime < Date.now();

        const [keyPriceStack, totalPlayersStack, totalDistStack] =
          await Promise.all([
            invokeRead(rpcUrl, contractHash, "getCurrentKeyPrice", [], network),
            invokeRead(rpcUrl, contractHash, "totalPlayers", [], network),
            invokeRead(
              rpcUrl,
              contractHash,
              "totalPotDistributed",
              [],
              network,
            ),
          ]);

        const status = !active
          ? "Next Round Pending"
          : expiredButOpen
            ? LAST_SURVIVOR_ROLLOVER_LABEL
            : "Open for Bids";

        return [
          {
            label: "Countdown",
            value:
              active && !expiredButOpen
                ? fmtCountdown(remainingSec)
                : LAST_SURVIVOR_ROLLOVER_LABEL,
            accent: active && !expiredButOpen,
          },
          { label: "Prize Pool", value: `${fmtGas(pot)} GAS`, accent: pot > 0 },
          { label: "Round", value: `#${round}` },
          { label: "Keys This Round", value: String(totalKeys) },
          {
            label: "Total Players",
            value: String(stackInt(totalPlayersStack)),
          },
          {
            label: "Key Price",
            value: `${fmtGas(stackInt(keyPriceStack))} GAS`,
          },
          {
            label: "Total Distributed",
            value: `${fmtGas(stackInt(totalDistStack))} GAS`,
            accent: true,
          },
          { label: "Status", value: status, accent: active && !expiredButOpen },
        ];
      }

      case "miniapp-gasbox": {
        const [machinesStack, pausedStack] = await Promise.all([
          invokeRead(rpcUrl, contractHash, "totalMachines", [], network),
          invokeRead(rpcUrl, contractHash, "isPaused", [], network),
        ]);
        const machines = stackInt(machinesStack);
        const paused = stackBool(pausedStack);
        return [
          {
            label: "Total Machines",
            value: String(machines),
            accent: machines > 0,
          },
          {
            label: "Status",
            value: paused ? "Paused" : "Ready to Play",
            accent: !paused,
          },
          { label: "Asset", value: "GAS" },
          { label: "Randomness", value: "VRF" },
        ];
      }

      case "miniapp-redenvelope": {
        const pausedStack = await invokeRead(
          rpcUrl,
          contractHash,
          "isPaused",
          [],
          network,
        );
        return [
          {
            label: "Status",
            value: stackBool(pausedStack) ? "Paused" : "Active",
            accent: !stackBool(pausedStack),
          },
          { label: "Asset", value: "GAS" },
          { label: "Distribution", value: "Random (VRF)" },
          { label: "Mode", value: "Lucky packets" },
        ];
      }

      case "miniapp-gas-lucky-pool": {
        const pausedStack = await invokeRead(
          rpcUrl,
          contractHash,
          "isPaused",
          [],
          network,
        );
        return [
          {
            label: "Status",
            value: stackBool(pausedStack) ? "Paused" : "Active",
            accent: !stackBool(pausedStack),
          },
          { label: "Asset", value: "GAS" },
          { label: "Claim Range", value: "Configurable" },
          { label: "Mode", value: "OneGate QR claim" },
        ];
      }

      case "miniapp-dailycheckin": {
        const [statsStack, pausedStack] = await Promise.all([
          invokeRead(rpcUrl, contractHash, "getPlatformStats", [], network),
          invokeRead(rpcUrl, contractHash, "isPaused", [], network),
        ]);
        const m = decodeMap(statsStack);
        const totalUsers = parseInt(String(m.totalUsers ?? "0"), 10);
        const totalCheckins = parseInt(String(m.totalCheckins ?? "0"), 10);
        const totalRewarded = parseInt(String(m.totalRewarded ?? "0"), 10);
        const weekReward = parseInt(String(m.weekReward ?? "0"), 10);
        return [
          {
            label: "Total Users",
            value: String(totalUsers),
            accent: totalUsers > 0,
          },
          { label: "Total Check-ins", value: String(totalCheckins) },
          {
            label: "Total Rewarded",
            value: `${fmtGas(totalRewarded)} GAS`,
            accent: true,
          },
          {
            label: "Status",
            value: stackBool(pausedStack) ? "Paused" : "Active",
            accent: !stackBool(pausedStack),
          },
          { label: "7-Day Reward", value: `${fmtGas(weekReward)} GAS` },
          { label: "Cadence", value: "1 / UTC day" },
        ];
      }

      case "miniapp-fogplay": {
        const [limitsStack, pausedStack] = await Promise.all([
          invokeRead(rpcUrl, contractHash, "getBetLimits", [], network),
          invokeRead(rpcUrl, contractHash, "isPaused", [], network),
        ]);
        const limits = limitsStack as Array<{ type: string; value: unknown }>;
        // getBetLimits returns Struct of [minBet, maxBet]
        let minBet = 0;
        let maxBet = 0;
        if (limits[0]?.type === "Struct" || limits[0]?.type === "Array") {
          const arr = limits[0].value as Array<{ value: string }>;
          minBet = parseInt(arr[0]?.value || "0", 10);
          maxBet = parseInt(arr[1]?.value || "0", 10);
        }
        return [
          {
            label: "Status",
            value: stackBool(pausedStack) ? "Paused" : "Active",
            accent: !stackBool(pausedStack),
          },
          {
            label: "Min Bet",
            value: minBet > 0 ? `${fmtGas(minBet)} GAS` : "—",
          },
          {
            label: "Max Bet",
            value: maxBet > 0 ? `${fmtGas(maxBet)} GAS` : "—",
          },
          { label: "Payout", value: "2× on win", accent: true },
        ];
      }

      case "miniapp-self-loan": {
        const [statsStack, pausedStack] = await Promise.all([
          invokeRead(
            rpcUrl,
            contractHash,
            "getLendingStats",
            [{ type: "String", value: "miniapp-self-loan" }],
            network,
          ).then((stack) => {
            const stats = decodeMap(stack);
            return Object.keys(stats).length
              ? stack
              : invokeRead(
                  rpcUrl,
                  contractHash,
                  "getPlatformStats",
                  [],
                  network,
                );
          }),
          invokeRead(rpcUrl, contractHash, "isPaused", [], network),
        ]);
        const m = decodeMap(statsStack);
        const totalLoans = parseInt(String(m.totalLoans ?? "0"), 10);
        const totalCollateral = parseInt(String(m.totalCollateral ?? "0"), 10);
        const totalDebt = parseInt(String(m.totalDebt ?? "0"), 10);
        const totalRepaid = parseInt(String(m.totalRepaid ?? "0"), 10);
        const totalBorrowers = parseInt(String(m.totalBorrowers ?? "0"), 10);
        const ltvT1 = parseInt(String(m.ltvTier1Bps ?? "0"), 10);
        const ltvT3 = parseInt(String(m.ltvTier3Bps ?? "0"), 10);
        return [
          {
            label: "Total Loans",
            value: String(totalLoans),
            accent: totalLoans > 0,
          },
          { label: "Borrowers", value: String(totalBorrowers) },
          {
            label: "Collateral Locked",
            value: `${totalCollateral} NEO`,
            accent: totalCollateral > 0,
          },
          { label: "Outstanding Debt", value: `${fmtGas(totalDebt)} GAS` },
          {
            label: "Total Repaid",
            value: `${fmtGas(totalRepaid)} GAS`,
            accent: true,
          },
          {
            label: "LTV Range",
            value: ltvT1 && ltvT3 ? `${ltvT1 / 100}% – ${ltvT3 / 100}%` : "—",
          },
          { label: "Liquidation", value: "None — yield repays" },
          {
            label: "Status",
            value: stackBool(pausedStack) ? "Paused" : "Active",
            accent: !stackBool(pausedStack),
          },
        ];
      }

      case "miniapp-trustanchor":
      case "miniapp-profitanchor":
      case "miniapp-trustanchor-admin":
      case "miniapp-profitanchor-admin": {
        const anchorAppId = resolveAnchorAppId(appId) ?? appId;
        const statsStack = await invokeRead(
          rpcUrl,
          contractHash,
          "getAnchorStats",
          [{ type: "String", value: anchorAppId }],
          network,
        );
        const m = decodeMap(statsStack);
        const totalStaked = parseInt(String(m.totalStaked ?? "0"), 10);
        const totalStakers = parseInt(String(m.totalStakers ?? "0"), 10);
        const rewardReserve = parseInt(String(m.rewardReserve ?? "0"), 10);
        const agentCount = parseInt(String(m.agentCount ?? "0"), 10);
        const selectedAgentId = parseInt(String(m.selectedAgentId ?? "0"), 10);
        const mode = parseInt(String(m.mode ?? "0"), 10);
        const paused = Boolean(m.paused);
        return [
          {
            label: "Total Staked",
            value: `${totalStaked} NEO`,
            accent: totalStaked > 0,
          },
          { label: "Stakers", value: String(totalStakers) },
          {
            label: "Agents",
            value: String(agentCount),
            accent: agentCount > 0,
          },
          {
            label: "Reward Reserve",
            value: `${fmtGas(rewardReserve)} GAS`,
            accent: rewardReserve > 0,
          },
          {
            label: "Selected Agent",
            value:
              selectedAgentId > 0
                ? `#${selectedAgentId}`
                : mode === 1
                  ? "Trust mode"
                  : mode === 2
                    ? "Profit mode"
                    : "Unregistered",
          },
          {
            label: "Status",
            value: paused ? "Paused" : "Ready",
            accent: !paused,
          },
        ];
      }

      case "miniapp-neo-pay": {
        const totalStreamsStack = await invokeRead(
          rpcUrl,
          contractHash,
          "totalStreams",
          [],
          network,
        );
        const totalStreams = stackInt(totalStreamsStack);
        return [
          {
            label: "Total Streams",
            value: String(totalStreams),
            accent: totalStreams > 0,
          },
          { label: "Assets", value: "GAS / NEO" },
          { label: "Schedule", value: "Per-second drip" },
          { label: "Live data", value: "Contract read", accent: true },
        ];
      }

      default:
        return [{ label: "Live data", value: "No binding" }];
    }
  } catch (err) {
    console.warn("[LiveContractView] fetchAppStats failed for", appId, err);
    return [{ label: "Live stats", value: "Unavailable" }];
  }
}

/* ── Activity feed (recent on-chain items) ──────────────────────────── */

async function fetchAppActivity(
  appId: string,
  rpcUrl: string,
  contractHash: string,
  network: "mainnet" | "testnet",
): Promise<Activity | null> {
  try {
    switch (appId) {
      case "miniapp-last-survivor":
        return await fetchLastSurvivorActivity(rpcUrl, contractHash, network);
      case "miniapp-redenvelope":
        return await fetchRedEnvelopeActivity(rpcUrl, contractHash, network);
      case "miniapp-gasbox":
        return await fetchGasBoxActivity(rpcUrl, contractHash, network);
      case "miniapp-self-loan":
        return await fetchSelfLoanActivity(rpcUrl, contractHash, network);
      case "miniapp-neo-pay":
        return await fetchNeoPayActivity(rpcUrl, contractHash, network);
      case "miniapp-trustanchor":
      case "miniapp-profitanchor":
      case "miniapp-trustanchor-admin":
      case "miniapp-profitanchor-admin":
        return await fetchAnchorActivity(appId, rpcUrl, contractHash, network);
      default:
        return null;
    }
  } catch (err) {
    console.warn("[LiveContractView] fetchAppActivity failed for", appId, err);
    return null;
  }
}

async function fetchAnchorActivity(
  appId: string,
  rpcUrl: string,
  contractHash: string,
  network: "mainnet" | "testnet",
): Promise<Activity> {
  const anchorAppId = resolveAnchorAppId(appId) ?? appId;
  const statsStack = await invokeRead(
    rpcUrl,
    contractHash,
    "getAnchorStats",
    [{ type: "String", value: anchorAppId }],
    network,
  );
  const stats = decodeMap(statsStack);
  const isAdminConsole = appId.endsWith("-admin");
  if (!isAdminConsole) {
    const totalStaked = parseInt(String(stats.totalStaked ?? "0"), 10);
    const rewardReserve = parseInt(String(stats.rewardReserve ?? "0"), 10);
    const paused = Boolean(stats.paused);
    return {
      title: "Anchor Status",
      rows: [
        {
          icon: "S",
          primary: `${totalStaked} NEO staked`,
          secondary: "Read from PlatformAnchor.getAnchorStats",
          accent: totalStaked > 0,
        },
        {
          icon: "G",
          primary: `${fmtGas(rewardReserve)} GAS reward reserve`,
          secondary: "Available reserve for reward accounting",
          accent: rewardReserve > 0,
        },
        {
          icon: paused ? "!" : "O",
          primary: paused ? "Anchor paused" : "Anchor ready",
          secondary: "Users can stake, redeem, and claim",
          accent: !paused,
        },
      ],
    };
  }

  const agentCount = Math.min(5, parseInt(String(stats.agentCount ?? "0"), 10));
  const selectedAgentId = parseInt(String(stats.selectedAgentId ?? "0"), 10);
  const rows: Activity["rows"] = [];

  if (selectedAgentId > 0) {
    rows.push({
      icon: "V",
      primary: `Selected manual route: #${selectedAgentId}`,
      secondary: "Route is selected by operators and signed by the AA agent",
      accent: true,
    });
  }

  const checks = [];
  for (let id = 1; id <= agentCount; id++) {
    checks.push(
      invokeRead(
        rpcUrl,
        contractHash,
        "getAgent",
        [
          { type: "String", value: anchorAppId },
          { type: "Integer", value: String(id) },
        ],
        network,
      )
        .then((s) => ({ id, map: decodeMap(s) }))
        .catch(() => ({ id, map: {} as Record<string, unknown> })),
    );
  }

  const agents = await Promise.all(checks);
  for (const agent of agents) {
    if (!agent.map.account) continue;
    rows.push({
      icon: "V",
      primary: `Route #${agent.id}: ${fmtAddr(String(agent.map.account || ""))}`,
      secondary: `Candidate ${fmtAddr(String(agent.map.candidate || ""))}`,
      accent: agent.id === selectedAgentId,
    });
  }

  return {
    title: anchorAppId === "miniapp-profitanchor" ? "Profit Routes" : "Trust Routes",
    rows,
    emptyText: "No AA agent routes registered yet.",
  };
}

async function fetchLastSurvivorActivity(
  rpcUrl: string,
  contractHash: string,
  network: "mainnet" | "testnet",
): Promise<Activity> {
  if (network === "testnet") {
    const stateStack = await invokeRead(
      rpcUrl,
      contractHash,
      "getCountdownStatus",
      [{ type: "String", value: LAST_SURVIVOR_APP_ID }],
      network,
    );
    const state = decodeMap(stateStack);
    const currentRound = parseInt(String(state.roundId ?? "0"), 10);
    const lastBuyer = String(state.lastBuyer || "");
    const active = Boolean(state.active);
    const pot = parseInt(String(state.pot ?? "0"), 10);
    const totalKeys = parseInt(String(state.totalKeys ?? "0"), 10);
    const currentKeyPrice = parseInt(String(state.currentKeyPrice ?? "0"), 10);

    const rows: Activity["rows"] = [];
    if (currentRound > 0 && active && !isZeroAddr(lastBuyer)) {
      rows.push({
        icon: "👑",
        primary: `Current leader: ${fmtAddr(lastBuyer)}`,
        secondary: `Round #${currentRound} — wins if timer hits zero`,
        amount: `${fmtGas(pot)} GAS`,
        accent: true,
      });
    }
    if (currentRound > 0) {
      rows.push({
        icon: "K",
        primary: `${totalKeys} keys sold this round`,
        secondary: "PlatformGame countdown pool",
        amount: `${fmtGas(currentKeyPrice)} GAS/key`,
      });
    }

    return {
      title: "Live Countdown",
      rows,
      emptyText: "No live key purchases yet — be the first contributor.",
    };
  }

  const stateStack = await invokeRead(
    rpcUrl,
    contractHash,
    "getRoundStateForFrontend",
    [],
    network,
  );
  const state = decodeMap(stateStack);
  const currentRound = parseInt(String(state.roundId ?? "0"), 10);
  const lastBuyer = String(state.lastBuyer || "");

  const rows: Activity["rows"] = [];

  if (currentRound > 0 && state.active && !isZeroAddr(lastBuyer)) {
    rows.push({
      icon: "👑",
      primary: `Current leader: ${fmtAddr(lastBuyer)}`,
      secondary: `Round #${currentRound} — wins if timer hits zero`,
      amount: `${fmtGas(state.pot as number | string)} GAS`,
      accent: true,
    });
  }

  // Past round winners (last 5 settled rounds)
  const start = Math.max(1, currentRound - 5);
  const historyChecks = [];
  for (let id = currentRound - 1; id >= start; id--) {
    historyChecks.push(
      invokeRead(
        rpcUrl,
        contractHash,
        "getRoundDetails",
        [{ type: "Integer", value: String(id) }],
        network,
      )
        .then((s) => ({ id, map: decodeMap(s) }))
        .catch(() => ({ id, map: {} as Record<string, unknown> })),
    );
  }
  const history = await Promise.all(historyChecks);
  for (const h of history) {
    const winner = String(h.map.winner || "");
    const prize = parseInt(String(h.map.winnerPrize ?? "0"), 10);
    if (!winner || isZeroAddr(winner)) continue;
    rows.push({
      icon: "🏆",
      primary: `Round #${h.id} winner: ${fmtAddr(winner)}`,
      secondary: timeAgo(parseInt(String(h.map.endTime ?? "0"), 10)),
      amount: prize > 0 ? `${fmtGas(prize)} GAS` : "—",
    });
  }

  return {
    title: "Live Round + Recent Winners",
    rows,
    emptyText: "No completed rounds yet — be the first contributor.",
  };
}

async function fetchRedEnvelopeActivity(
  rpcUrl: string,
  contractHash: string,
  network: "mainnet" | "testnet",
): Promise<Activity> {
  // RedEnvelope contract doesn't expose a totalEnvelopes counter, so we probe a
  // bounded range in parallel. Tuned to cover the active testnet/mainnet IDs
  // (~50–60 today) with headroom while keeping per-page-load cost predictable.
  const PROBE_MAX = 60;
  const PROBE_LIMIT = 8;
  const checks: Array<Promise<{ id: number; map: Record<string, unknown> }>> =
    [];
  for (let id = PROBE_MAX; id >= 1; id--) {
    checks.push(
      invokeRead(
        rpcUrl,
        contractHash,
        "getEnvelope",
        [{ type: "Integer", value: String(id) }],
        network,
      )
        .then((s) => ({ id, map: decodeMap(s) }))
        .catch(() => ({ id, map: {} as Record<string, unknown> })),
    );
  }
  const results = await Promise.all(checks);
  const found = results
    .filter(
      (r) =>
        r.map &&
        Object.keys(r.map).length > 0 &&
        !isZeroAddr(String(r.map.creator || "")),
    )
    .slice(0, PROBE_LIMIT);

  const rows: Activity["rows"] = found.map((env) => {
    const remaining = parseInt(String(env.map.remaining ?? "0"), 10);
    const total = parseInt(String(env.map.totalAmount ?? "0"), 10);
    const packetCount = parseInt(String(env.map.packetCount ?? "0"), 10);
    const claimed = parseInt(String(env.map.claimedCount ?? "0"), 10);
    const open = remaining > 0 && claimed < packetCount;
    return {
      icon: open ? "🧧" : "📭",
      primary: `Envelope #${env.id} from ${fmtAddr(String(env.map.creator || ""))}`,
      secondary: open
        ? `${claimed}/${packetCount} claimed · ${fmtGas(remaining)} GAS left`
        : `Sold out · ${packetCount} claimed`,
      amount: `${fmtGas(total)} GAS`,
      accent: open,
    };
  });

  return {
    title: "Recent Envelopes",
    rows,
    emptyText: "No envelopes yet — create one above and share the ID.",
  };
}

async function fetchGasBoxActivity(
  rpcUrl: string,
  contractHash: string,
  network: "mainnet" | "testnet",
): Promise<Activity> {
  const totalStack = await invokeRead(
    rpcUrl,
    contractHash,
    "totalMachines",
    [],
    network,
  );
  const total = stackInt(totalStack);
  if (total === 0)
    return { title: "Gacha Machines", rows: [], emptyText: "No machines yet." };

  const checks: Array<Promise<{ id: number; map: Record<string, unknown> }>> =
    [];
  const limit = Math.min(total, 8);
  for (let id = total; id >= total - limit + 1 && id >= 1; id--) {
    checks.push(
      invokeRead(
        rpcUrl,
        contractHash,
        "getMachine",
        [{ type: "Integer", value: String(id) }],
        network,
      )
        .then((s) => ({ id, map: decodeMap(s) }))
        .catch(() => ({ id, map: {} as Record<string, unknown> })),
    );
  }
  const results = await Promise.all(checks);
  const rows: Activity["rows"] = results
    .filter((r) => Object.keys(r.map).length > 0)
    .map((r) => {
      const name = String(r.map.name || `Machine #${r.id}`);
      const price = parseInt(String(r.map.price ?? "0"), 10);
      const plays = parseInt(String(r.map.plays ?? "0"), 10);
      const active = Boolean(r.map.active);
      return {
        icon: active ? "🎰" : "⏸",
        primary: name,
        secondary: `${plays} plays · ${active ? "ready" : "inactive"}`,
        amount: price > 0 ? `${fmtGas(price)} GAS` : "—",
        accent: active && plays > 0,
      };
    });

  return {
    title: "Gacha Machines",
    rows,
    emptyText: "No machines configured yet.",
  };
}

async function fetchSelfLoanActivity(
  rpcUrl: string,
  contractHash: string,
  network: "mainnet" | "testnet",
): Promise<Activity> {
  let platformDeFi = false;
  let totalStack = await invokeRead(
    rpcUrl,
    contractHash,
    "totalLoans",
    [],
    network,
  );
  let total = stackInt(totalStack);
  if (total === 0) {
    const statsStack = await invokeRead(
      rpcUrl,
      contractHash,
      "getLendingStats",
      [{ type: "String", value: "miniapp-self-loan" }],
      network,
    );
    const stats = decodeMap(statsStack);
    const platformTotal = parseInt(String(stats.totalLoans ?? "0"), 10);
    if (platformTotal > 0) {
      platformDeFi = true;
      total = platformTotal;
    }
  }
  if (total === 0)
    return {
      title: "Recent Loans",
      rows: [],
      emptyText: "No loans opened yet.",
    };

  const checks: Array<Promise<{ id: number; map: Record<string, unknown> }>> =
    [];
  const limit = Math.min(total, 6);
  for (let id = total; id >= total - limit + 1 && id >= 1; id--) {
    checks.push(
      (platformDeFi
        ? invokeRead(
            rpcUrl,
            contractHash,
            "getLoan",
            [
              { type: "String", value: "miniapp-self-loan" },
              { type: "Integer", value: String(id) },
            ],
            network,
          ).then((s) => {
            const loan = stackArray(s);
            return {
              id,
              map: {
                borrower: loan[0]?.value,
                collateral: loan[1]?.value,
                debt: loan[2]?.value,
                active: stackItemBool(loan[9]),
              },
            };
          })
        : invokeRead(
            rpcUrl,
            contractHash,
            "getLoanDetails",
            [{ type: "Integer", value: String(id) }],
            network,
          ).then((s) => ({ id, map: decodeMap(s) }))
      ).catch(() => ({ id, map: {} as Record<string, unknown> })),
    );
  }
  const results = await Promise.all(checks);
  const rows: Activity["rows"] = results
    .filter((r) => Object.keys(r.map).length > 0)
    .map((r) => {
      const borrower = String(r.map.borrower || "");
      const collateral = parseInt(String(r.map.collateral ?? "0"), 10);
      const debt = parseInt(String(r.map.debt ?? "0"), 10);
      const active = Boolean(r.map.active);
      return {
        icon: active ? "🏦" : "✅",
        primary: `Loan #${r.id} · ${fmtAddr(borrower)}`,
        secondary: `${collateral} NEO collateral · ${active ? "open" : "repaid"}`,
        amount: `${fmtGas(debt)} GAS`,
        accent: active,
      };
    });

  return {
    title: "Recent Loans",
    rows,
    emptyText: "No loans yet — be the first borrower.",
  };
}

async function fetchNeoPayActivity(
  rpcUrl: string,
  contractHash: string,
  network: "mainnet" | "testnet",
): Promise<Activity> {
  const totalStack = await invokeRead(
    rpcUrl,
    contractHash,
    "totalStreams",
    [],
    network,
  );
  const total = stackInt(totalStack);
  if (total === 0)
    return {
      title: "Recent Streams",
      rows: [],
      emptyText: "No streams yet — create one above.",
    };

  const checks: Array<Promise<{ id: number; map: Record<string, unknown> }>> =
    [];
  const limit = Math.min(total, 6);
  for (let id = total; id >= total - limit + 1 && id >= 1; id--) {
    checks.push(
      invokeRead(
        rpcUrl,
        contractHash,
        "getStreamDetails",
        [{ type: "Integer", value: String(id) }],
        network,
      )
        .then((s) => ({ id, map: decodeMap(s) }))
        .catch(() => ({ id, map: {} as Record<string, unknown> })),
    );
  }
  const results = await Promise.all(checks);
  const rows: Activity["rows"] = results
    .filter((r) => Object.keys(r.map).length > 0)
    .map((r) => {
      const beneficiary = String(r.map.beneficiary || "");
      const total = parseInt(String(r.map.totalAmount ?? "0"), 10);
      const released = parseInt(String(r.map.releasedAmount ?? "0"), 10);
      const status = String(r.map.status || "");
      const active = status === "active";
      return {
        icon: active ? "💸" : status === "cancelled" ? "🛑" : "✅",
        primary: `Stream #${r.id} → ${fmtAddr(beneficiary)}`,
        secondary: `${fmtGas(released)} / ${fmtGas(total)} GAS released · ${status || "active"}`,
        amount: `${fmtGas(total)} GAS`,
        accent: active,
      };
    });

  return {
    title: "Recent Streams",
    rows,
    emptyText: "No streams yet.",
  };
}
