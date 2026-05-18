import type { MiniAppLaunchContext } from "../types";
import {
  decodeMap,
  fmtAddr,
  fmtGas,
  invokeRead,
  isCouncilProposalActive,
  isZeroAddr,
  LAST_SURVIVOR_APP_ID,
  resolveAnchorAppId,
  stackArray,
  stackInt,
  stackItemBool,
  timeAgo,
} from "./MiniAppLiveDataShared";

export type Activity = {
  title: string;
  rows: Array<{
    id?: string | number;
    icon: string;
    primary: string;
    secondary?: string;
    description?: string;
    status?: string;
    metadata?: Record<string, string>;
    amount?: string;
    accent?: boolean;
  }>;
  emptyText?: string;
  councilCandidates?: Array<{
    id: string;
    candidate: string;
    publicKey?: string;
    displayName?: string;
    logoUrl?: string;
    location?: string;
    website?: string;
    profileSource?: "neo-community" | "unverified";
    rank: number;
    status: "consensus" | "committee" | "candidate";
    votes: number;
    supplySharePercent: number;
  }>;
  councilTotalVotes?: number;
  councilCandidateTotalCount?: number;
  councilGovernanceSource?: string;
};

/* ── Activity feed (recent on-chain items) ──────────────────────────── */

function browserTimeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal === "undefined") return undefined;
  const timeout = (AbortSignal as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal }).timeout;
  return typeof timeout === "function" ? timeout(ms) : undefined;
}

export async function fetchAppActivity(
  appId: string,
  rpcUrl: string,
  contractHash: string,
  network: "mainnet" | "testnet",
  launchContext?: MiniAppLaunchContext | null,
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
      case "miniapp-council-governance":
        return await fetchCouncilGovernanceActivity(
          rpcUrl,
          contractHash,
          network,
        );
      case "miniapp-trustanchor":
      case "miniapp-profitanchor":
      case "miniapp-trustanchor-admin":
      case "miniapp-profitanchor-admin":
      case "miniapp-custom-anchor":
        return await fetchAnchorActivity(
          appId,
          rpcUrl,
          contractHash,
          network,
          launchContext,
        );
      default:
        return null;
    }
  } catch (err) {
    console.warn("[LiveContractView] fetchAppActivity failed for", appId, err);
    return null;
  }
}

function councilStatusLabel(map: Record<string, unknown>): string {
  const text = String(map.statusString || "").trim();
  if (text) return text;
  const status = parseInt(String(map.status ?? "0"), 10);
  if (status === 1) return "active";
  if (status === 2) return "passed";
  if (status === 3) return "rejected";
  if (status === 4) return "revoked";
  if (status === 5) return "expired";
  if (status === 6) return "executed";
  return "pending";
}

function councilTimestamp(value: unknown): number {
  const text = String(value ?? "").trim();
  if (/[tT:-]/.test(text)) {
    const parsedDate = Date.parse(text);
    if (Number.isFinite(parsedDate)) return parsedDate;
  }
  const raw = parseInt(text || "0", 10);
  if (!Number.isFinite(raw) || raw <= 0) {
    const parsedDate = Date.parse(text);
    return Number.isFinite(parsedDate) ? parsedDate : 0;
  }
  return raw < 10_000_000_000 ? raw * 1000 : raw;
}

function councilDateLabel(value: unknown): string {
  const ms = councilTimestamp(value);
  if (!ms) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

async function fetchCouncilGovernanceActivity(
  rpcUrl: string,
  contractHash: string,
  network: "mainnet" | "testnet",
): Promise<Activity> {
  const sharedCouncilDataResult =
    await fetchCouncilGovernanceSharedData(network).catch(() => null);
  const { proposalRows: sharedProposalRows, ...sharedCouncilData } =
    sharedCouncilDataResult ?? { proposalRows: [] as Activity["rows"] };
  let total = 0;
  try {
    const countStack = await invokeRead(
      rpcUrl,
      contractHash,
      "getProposalCount",
      [],
      network,
    );
    total = stackInt(countStack);
  } catch {
    return {
      title: "Council Proposals",
      rows: sharedProposalRows,
      emptyText: "No proposals returned by the shared governance backend.",
      ...sharedCouncilData,
    };
  }
  if (total <= 0) {
    return {
      title: "Council Proposals",
      rows: sharedProposalRows,
      emptyText: "No proposals returned by the shared governance backend.",
      ...sharedCouncilData,
    };
  }

  const checks: Array<Promise<{ id: number; map: Record<string, unknown> }>> =
    [];
  const limit = Math.min(total, 8);
  for (let id = total; id >= total - limit + 1 && id >= 1; id -= 1) {
    checks.push(
      invokeRead(
        rpcUrl,
        contractHash,
        "getProposalDetails",
        [{ type: "Integer", value: String(id) }],
        network,
      )
        .then((stack) => ({ id, map: decodeMap(stack) }))
        .catch(() => ({ id, map: {} as Record<string, unknown> })),
    );
  }
  const proposals = await Promise.all(checks);
  const rows: Activity["rows"] = proposals
    .filter((proposal) => Object.keys(proposal.map).length > 0)
    .map((proposal) => {
      const title = String(proposal.map.title || "Untitled proposal");
      const description = String(proposal.map.description || "");
      const status = councilStatusLabel(proposal.map);
      const yesVotes = parseInt(String(proposal.map.yesVotes ?? "0"), 10);
      const noVotes = parseInt(String(proposal.map.noVotes ?? "0"), 10);
      const totalVotes = parseInt(
        String(proposal.map.totalVotes ?? yesVotes + noVotes),
        10,
      );
      const quorumRequired = parseInt(
        String(proposal.map.quorumRequired ?? "0"),
        10,
      );
      const active = isCouncilProposalActive(proposal.map);
      return {
        id: proposal.id,
        icon: active ? "V" : "C",
        primary: `#${proposal.id} ${title}`,
        secondary: `${status} · for ${yesVotes} / against ${noVotes}`,
        description,
        status,
        metadata: {
          "Proposal ID": `#${proposal.id}`,
          Type:
            parseInt(String(proposal.map.type ?? "0"), 10) === 1
              ? "Policy"
              : "Text",
          Status: status,
          Creator: fmtAddr(String(proposal.map.creator || "")),
          Created: councilDateLabel(proposal.map.createTime),
          "Voting ends": councilDateLabel(proposal.map.expiryTime),
          "For votes": String(yesVotes),
          "Against votes": String(noVotes),
          Quorum:
            quorumRequired > 0
              ? `${totalVotes}/${quorumRequired}`
              : `${totalVotes} votes`,
          "Quorum reached": String(Boolean(proposal.map.quorumReached)),
        },
        amount:
          quorumRequired > 0
            ? `${totalVotes}/${quorumRequired} quorum`
            : `${totalVotes} votes`,
        accent: active,
      };
    });

  return {
    title: "Council Proposals",
    rows: rows.length > 0 ? rows : sharedProposalRows,
    emptyText: "No readable proposals found in the recent contract range.",
    ...sharedCouncilData,
  };
}

type CouncilGovernanceSharedData = Pick<
  Activity,
  | "councilCandidates"
  | "councilTotalVotes"
  | "councilCandidateTotalCount"
  | "councilGovernanceSource"
> & {
  proposalRows: Activity["rows"];
};

async function fetchCouncilGovernanceSharedData(
  network: "mainnet" | "testnet",
): Promise<CouncilGovernanceSharedData> {
  const response = await fetch(
    `/api/explorer/council-governance?network=${network}&limit=21`,
    {
      headers: { Accept: "application/json" },
      signal: browserTimeoutSignal(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Council governance backend ${response.status}`);
  }
  const data = await response.json();
  const rawCandidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const rawProposals = Array.isArray(data?.proposals) ? data.proposals : [];
  return {
    councilCandidates: rawCandidates.map((item: Record<string, unknown>, index: number) => ({
      id: String(item.id || item.candidate || `candidate-${index + 1}`),
      candidate: String(item.candidate || ""),
      publicKey: item.publicKey ? String(item.publicKey) : undefined,
      displayName: item.displayName ? String(item.displayName) : undefined,
      logoUrl: item.logoUrl ? String(item.logoUrl) : undefined,
      location: item.location ? String(item.location) : undefined,
      website: item.website ? String(item.website) : undefined,
      profileSource:
        item.profileSource === "neo-community" ? "neo-community" : "unverified",
      rank: Number(item.rank || index + 1),
      status:
        item.status === "committee" || item.status === "candidate"
          ? item.status
          : "consensus",
      votes: Number(item.votes || item.votesOfCandidate || 0),
      supplySharePercent: Number(item.supplySharePercent || 0),
    })),
    councilTotalVotes: Number(data?.totalVotes || 0),
    councilCandidateTotalCount: Number(data?.totalCount || rawCandidates.length),
    councilGovernanceSource: String(data?.source || "neo-explorer-ui"),
    proposalRows: rawProposals.map((item: Record<string, unknown>) => {
      const councilVotes = (item.councilVotes || {}) as Record<string, unknown>;
      const communityVotes = (item.communityVotes || {}) as Record<string, unknown>;
      const forVotes = Number(councilVotes.for || 0);
      const againstVotes = Number(councilVotes.against || 0);
      const neutralVotes = Number(councilVotes.neutral || 0);
      const status = String(item.status || "unknown");
      const proposalNumber = Number(item.number || 0);
      return {
        id: String(item.id || proposalNumber || item.title || "proposal"),
        icon: status === "active" ? "V" : "C",
        primary: `#${proposalNumber || "—"} ${String(item.title || "Untitled proposal")}`,
        secondary: `${status} · council for ${forVotes} / against ${againstVotes} / neutral ${neutralVotes}`,
        description: `Community votes: for ${Number(communityVotes.for || 0)}, against ${Number(communityVotes.against || 0)}, neutral ${Number(communityVotes.neutral || 0)}.`,
        status,
        metadata: {
          "Proposal ID": String(item.id || "—"),
          Type: String(item.type || "governance"),
          Status: status,
          Proposer: String(item.proposerName || "Unknown proposer"),
          Created: councilDateLabel(item.createdAt),
          "Voting ends": councilDateLabel(item.endTime),
          "Council for": String(forVotes),
          "Council against": String(againstVotes),
          "Council neutral": String(neutralVotes),
          Messages: String(item.messageCount || 0),
          Source: "neo.community",
        },
        amount: `${forVotes}/${againstVotes}/${neutralVotes}`,
        accent: status === "active",
      };
    }),
  };
}

async function fetchAnchorActivity(
  appId: string,
  rpcUrl: string,
  contractHash: string,
  network: "mainnet" | "testnet",
  launchContext?: MiniAppLaunchContext | null,
): Promise<Activity> {
  const anchorAppId = resolveAnchorAppId(appId, launchContext);
  if (!anchorAppId) {
    return {
      title: "Custom Anchor Setup",
      rows: [
        {
          icon: "A",
          primary: "Register a new Anchor",
          secondary:
            "Creates the Anchor app plus 21 AA agents in one NEP-21 batch",
          accent: true,
        },
        {
          icon: "Q",
          primary: "Share anchorAppId after registration",
          secondary:
            "OneGate QR can pass anchorAppId directly to the user staking flow",
        },
      ],
    };
  }
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
    title:
      anchorAppId === "miniapp-profitanchor"
        ? "Profit Routes"
        : anchorAppId === "miniapp-trustanchor"
          ? "Trust Routes"
          : "Custom Routes",
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
