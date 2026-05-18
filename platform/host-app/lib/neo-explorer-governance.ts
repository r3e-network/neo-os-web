export type NeoExplorerGovernanceNetwork = "mainnet" | "testnet";

export type NeoExplorerCouncilStatus =
  | "consensus"
  | "committee"
  | "candidate";

export type NeoExplorerCouncilCandidate = {
  id: string;
  candidate: string;
  publicKey?: string;
  displayName: string;
  logoUrl?: string;
  location?: string;
  website?: string;
  description?: string;
  profileSource?: "neo-community" | "unverified";
  rank: number;
  status: NeoExplorerCouncilStatus;
  isCommittee: boolean;
  state: boolean;
  votesOfCandidate: string;
  votes: number;
  supplySharePercent: number;
};

export type NeoExplorerCouncilGovernance = {
  source: "neo-explorer-ui" | "neo-explorer-ui+neo-community";
  network: NeoExplorerGovernanceNetwork;
  limit: number;
  skip: number;
  totalCount: number;
  totalVotes: number;
  candidates: NeoExplorerCouncilCandidate[];
  proposals: NeoExplorerCouncilProposal[];
  warnings?: string[];
};

export type NeoExplorerCouncilProposal = {
  id: string;
  number: number;
  title: string;
  status: string;
  type: string;
  createdAt: string;
  endTime: string;
  proposerName: string;
  proposerOrganizationId?: string;
  councilVotes: {
    for: number;
    against: number;
    neutral: number;
  };
  communityVotes: {
    for: number;
    against: number;
    neutral: number;
  };
  messageCount: number;
};

type RpcPayload = {
  result?: unknown;
  error?: unknown;
};

const DEFAULT_ENDPOINTS: Record<NeoExplorerGovernanceNetwork, string> = {
  mainnet: "https://neofura.ngd.network",
  testnet: "https://testmagnet.ngd.network",
};

const DEFAULT_PROFILE_RPC_ENDPOINTS: Partial<
  Record<NeoExplorerGovernanceNetwork, string>
> = {
  mainnet: "https://mainnet1.neo.coz.io:443",
};

const NEO_COUNCIL_PROFILE_CONTRACT =
  "0xb776afb6ad0c11565e70f8ee1dd898da43e51be1";
const NEO_COUNCIL_PROFILE_IMAGE_GATEWAY =
  "https://filesend.ngd.network/gate/get/CeeroywT8ppGE4HGjhpzocJkdb2yu3wD5qCGFTjkw1Cc";
const DEFAULT_NEO_COMMUNITY_GOVERNANCE_API =
  "https://neo-governance-api.flamingo.finance";

type NeoCouncilProfile = {
  scriptHash: string;
  publicKey?: string;
  displayName: string;
  logoUrl?: string;
  location?: string;
  website?: string;
  description?: string;
};

function cleanEndpoint(value: string) {
  return value.replace(/\/+$/, "");
}

export function resolveNeoExplorerGovernanceEndpoint(
  network: NeoExplorerGovernanceNetwork,
) {
  return resolveNeoExplorerGovernanceEndpoints(network)[0];
}

function uniqueEndpoints(endpoints: Array<string | undefined>) {
  const seen = new Set<string>();
  return endpoints
    .map((endpoint) => (endpoint ? cleanEndpoint(endpoint) : ""))
    .filter((endpoint) => {
      if (!endpoint || seen.has(endpoint)) return false;
      seen.add(endpoint);
      return true;
    });
}

function resolveNeoExplorerGovernanceEndpoints(
  network: NeoExplorerGovernanceNetwork,
) {
  const networkSpecific =
    network === "mainnet"
      ? process.env.NEO_EXPLORER_API_MAINNET
      : process.env.NEO_EXPLORER_API_TESTNET;
  const shared = process.env.NEO_EXPLORER_API_URL;
  return uniqueEndpoints([networkSpecific, shared, DEFAULT_ENDPOINTS[network]]);
}

export function resolveNeoCouncilProfileRpcEndpoint(
  network: NeoExplorerGovernanceNetwork,
) {
  const networkSpecific =
    network === "mainnet"
      ? process.env.NEO_COUNCIL_PROFILE_RPC_MAINNET ||
        process.env.NEO_RPC_MAINNET
      : process.env.NEO_COUNCIL_PROFILE_RPC_TESTNET ||
        process.env.NEO_RPC_TESTNET;
  const shared =
    process.env.NEO_COUNCIL_PROFILE_RPC_URL || process.env.NEO_RPC_URL;
  const fallback = DEFAULT_PROFILE_RPC_ENDPOINTS[network];
  const endpoint = networkSpecific || shared || fallback;
  return endpoint ? cleanEndpoint(endpoint) : "";
}

function resolveNeoCommunityGovernanceApiEndpoint() {
  return cleanEndpoint(
    process.env.NEO_COMMUNITY_GOVERNANCE_API_URL ||
      DEFAULT_NEO_COMMUNITY_GOVERNANCE_API,
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asString(value: unknown, fallback = ""): string {
  const text = String(value ?? fallback).trim();
  return text || fallback;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(Math.trunc(value), max));
}

async function explorerRpc(
  network: NeoExplorerGovernanceNetwork,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    params,
    method,
  });
  let lastError: Error | null = null;

  for (const endpoint of resolveNeoExplorerGovernanceEndpoints(network)) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        throw new Error(`Neo Explorer governance HTTP ${response.status}`);
      }

      const payload = (await response.json()) as RpcPayload;
      if (payload.error) {
        const error = asRecord(payload.error);
        throw new Error(
          asString(error.message, asString(error.code, "Neo Explorer governance RPC error")),
        );
      }

      return payload.result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("Neo Explorer governance endpoint unavailable");
}

async function standardRpc(
  endpoint: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      params,
      method,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Neo Council profile HTTP ${response.status}`);
  }

  const payload = (await response.json()) as RpcPayload;
  if (payload.error) {
    const error = asRecord(payload.error);
    throw new Error(
      asString(error.message, asString(error.code, "Neo Council profile RPC error")),
    );
  }

  return payload.result;
}

function councilStatus(rank: number, isCommittee: boolean): NeoExplorerCouncilStatus {
  if (isCommittee && rank <= 7) return "consensus";
  if (isCommittee) return "committee";
  return "candidate";
}

function normalizeHash160(value: string) {
  const text = value.trim().toLowerCase();
  if (!text) return "";
  return text.startsWith("0x") ? text : `0x${text}`;
}

function decodeBase64Utf8(value: unknown) {
  const text = asString(value);
  if (!text) return "";
  return Buffer.from(text, "base64").toString("utf8").trim();
}

function decodeBase64ReversedHash160(value: unknown) {
  const text = asString(value);
  if (!text) return "";
  return normalizeHash160(Buffer.from(text, "base64").reverse().toString("hex"));
}

function normalizeProfileImage(value: string) {
  const image = value.trim();
  if (!image) return undefined;
  if (/^https?:\/\//i.test(image)) return image;
  return `${NEO_COUNCIL_PROFILE_IMAGE_GATEWAY}/${encodeURIComponent(image)}`;
}

function parseCouncilProfile(raw: unknown): NeoCouncilProfile | null {
  const values = asArray(asRecord(raw).value);
  if (values.length < 10) return null;

  const scriptHash = decodeBase64ReversedHash160(asRecord(values[0]).value);
  const displayName = decodeBase64Utf8(asRecord(values[1]).value);
  if (!scriptHash || !displayName) return null;

  const image = decodeBase64Utf8(asRecord(values[9]).value);
  return {
    scriptHash,
    displayName,
    location: decodeBase64Utf8(asRecord(values[2]).value) || undefined,
    website: decodeBase64Utf8(asRecord(values[3]).value) || undefined,
    description: decodeBase64Utf8(asRecord(values[8]).value) || undefined,
    logoUrl: normalizeProfileImage(image),
  };
}

async function fetchCouncilProfiles(
  network: NeoExplorerGovernanceNetwork,
): Promise<Map<string, NeoCouncilProfile>> {
  const endpoint = resolveNeoCouncilProfileRpcEndpoint(network);
  if (!endpoint) return new Map();

  const result = await standardRpc(endpoint, "invokefunction", [
    NEO_COUNCIL_PROFILE_CONTRACT,
    "getAllInfo",
    [],
  ]);
  const stack = asArray(asRecord(result).stack);
  const profiles = new Map<string, NeoCouncilProfile>();
  for (const row of asArray(asRecord(stack[0]).value)) {
    const profile = parseCouncilProfile(row);
    if (profile) profiles.set(profile.scriptHash, profile);
  }
  return profiles;
}

function parseVoteCounts(value: unknown) {
  const data = asRecord(value);
  return {
    for: asNumber(data.for, 0),
    against: asNumber(data.against, 0),
    neutral: asNumber(data.neutral, 0),
  };
}

function normalizeProposal(raw: unknown): NeoExplorerCouncilProposal | null {
  const data = asRecord(raw);
  const id = asString(data.proposal_id);
  const number = asNumber(data.proposal_number, 0);
  const title = asString(data.title);
  if (!id || !title) return null;

  return {
    id,
    number,
    title,
    status: asString(data.status, "unknown"),
    type: asString(data.proposal_type, "governance"),
    createdAt: asString(data.created_at),
    endTime: asString(data.end_time),
    proposerName: asString(data.proposer_username, "Unknown proposer"),
    proposerOrganizationId: asString(data.proposer_org_id) || undefined,
    councilVotes: parseVoteCounts(data.council_vote_counts),
    communityVotes: parseVoteCounts(data.community_vote_counts),
    messageCount: asNumber(data.message_count, 0),
  };
}

async function fetchNeoCommunityProposals(): Promise<NeoExplorerCouncilProposal[]> {
  const response = await fetch(
    `${resolveNeoCommunityGovernanceApiEndpoint()}/proposal/get/all`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Neo community proposals HTTP ${response.status}`);
  }
  return asArray(await response.json())
    .map(normalizeProposal)
    .filter((proposal): proposal is NeoExplorerCouncilProposal => Boolean(proposal));
}

function normalizeCandidate(
  raw: unknown,
  rank: number,
  profile?: NeoCouncilProfile,
): NeoExplorerCouncilCandidate {
  const item = asRecord(raw);
  const votesOfCandidate = asString(item.votesOfCandidate, "0");
  const votes = asNumber(votesOfCandidate, 0);
  const isCommittee = asBoolean(item.isCommittee);
  const candidate = normalizeHash160(asString(item.candidate));
  const displayName =
    profile?.displayName ||
    (rank <= 21 ? `Council node #${rank}` : `Candidate node #${rank}`);

  return {
    id: asString(item._id, candidate || `candidate-${rank}`),
    candidate,
    publicKey: profile?.publicKey,
    displayName,
    logoUrl: profile?.logoUrl,
    location: profile?.location,
    website: profile?.website,
    description: profile?.description,
    profileSource: profile ? "neo-community" : "unverified",
    rank,
    status: councilStatus(rank, isCommittee),
    isCommittee,
    state: asBoolean(item.state),
    votesOfCandidate,
    votes,
    supplySharePercent: votes > 0 ? (votes / 100_000_000) * 100 : 0,
  };
}

export async function fetchNeoExplorerCouncilGovernance({
  network,
  limit = 21,
  skip = 0,
}: {
  network: NeoExplorerGovernanceNetwork;
  limit?: number;
  skip?: number;
}): Promise<NeoExplorerCouncilGovernance> {
  const safeLimit = clampInteger(limit, 1, 100);
  const safeSkip = clampInteger(skip, 0, 100_000);
  const warnings: string[] = [];

  const [candidateOutcome, totalVotesOutcome, profilesOutcome, proposalsOutcome] =
    await Promise.allSettled([
      explorerRpc(network, "GetCandidate", {
        Limit: safeLimit,
        Skip: safeSkip,
        Sort: "votesOfCandidate = -1",
      }),
      explorerRpc(network, "GetTotalVotes", {}),
      fetchCouncilProfiles(network),
      network === "mainnet" ? fetchNeoCommunityProposals() : Promise.resolve([]),
    ]);

  if (candidateOutcome.status === "rejected") {
    warnings.push("candidates_unavailable");
  }
  if (totalVotesOutcome.status === "rejected") {
    warnings.push("total_votes_unavailable");
  }
  if (profilesOutcome.status === "rejected") {
    warnings.push("candidate_profiles_unavailable");
  }
  if (proposalsOutcome.status === "rejected") {
    warnings.push("proposals_unavailable");
  }

  const candidateResultMap =
    candidateOutcome.status === "fulfilled" ? asRecord(candidateOutcome.value) : {};
  const totalVotesMap =
    totalVotesOutcome.status === "fulfilled" ? asRecord(totalVotesOutcome.value) : {};
  const profiles =
    profilesOutcome.status === "fulfilled" ? profilesOutcome.value : new Map();
  const candidates = asArray(candidateResultMap.result).map((candidate, index) => {
    const rawCandidate = normalizeHash160(asString(asRecord(candidate).candidate));
    return normalizeCandidate(
      candidate,
      safeSkip + index + 1,
      profiles.get(rawCandidate),
    );
  });
  const source =
    candidates.some((candidate) => candidate.profileSource === "neo-community")
      ? "neo-explorer-ui+neo-community"
      : "neo-explorer-ui";
  const proposals =
    proposalsOutcome.status === "fulfilled" ? proposalsOutcome.value : [];

  return {
    source,
    network,
    limit: safeLimit,
    skip: safeSkip,
    totalCount: asNumber(candidateResultMap.totalCount, candidates.length),
    totalVotes: asNumber(totalVotesMap.totalvotes, 0),
    candidates,
    proposals,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
