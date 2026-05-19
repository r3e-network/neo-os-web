export type ExplorerCouncilProposal = {
  id?: string;
  number?: number;
  title?: string;
  status?: string;
  type?: string;
  createdAt?: string;
  endTime?: string;
  proposerName?: string;
  proposerOrganizationId?: string;
  councilVotes?: {
    for?: number;
    against?: number;
    neutral?: number;
  };
  communityVotes?: {
    for?: number;
    against?: number;
    neutral?: number;
  };
  messageCount?: number;
};

export type ExplorerCouncilCandidate = {
  id?: string;
  candidate?: string;
  displayName?: string;
  logoUrl?: string;
  location?: string;
  website?: string;
  profileSource?: string;
  rank?: number;
  status?: string;
  votes?: number;
  supplySharePercent?: number;
};

export type ExplorerCouncilGovernance = {
  source?: string;
  network?: "mainnet" | "testnet";
  totalCount?: number;
  totalVotes?: number;
  candidates?: ExplorerCouncilCandidate[];
  proposals?: ExplorerCouncilProposal[];
  warnings?: string[];
};

const CACHE_MS = 15_000;

const responseCache = new Map<
  string,
  {
    expiresAt: number;
    promise: Promise<ExplorerCouncilGovernance | null>;
  }
>();

function browserTimeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal === "undefined") return undefined;
  const timeout = (
    AbortSignal as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal }
  ).timeout;
  return typeof timeout === "function" ? timeout(ms) : undefined;
}

export function clearCouncilGovernanceClientCache() {
  responseCache.clear();
}

export function fetchCouncilGovernanceSnapshot(
  network: "mainnet" | "testnet",
  limit = 21,
): Promise<ExplorerCouncilGovernance | null> {
  const fetcher = globalThis.fetch;
  if (typeof fetcher !== "function") return Promise.resolve(null);

  const params = new URLSearchParams({
    network,
    limit: String(limit),
  });
  const url = `/api/explorer/council-governance?${params.toString()}`;
  const now = Date.now();
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = fetcher(url, {
    headers: { Accept: "application/json" },
    signal: browserTimeoutSignal(10_000),
  })
    .then((response) => (response.ok ? response.json() : null))
    .catch((error) => {
      responseCache.delete(url);
      throw error;
    });

  responseCache.set(url, {
    expiresAt: now + CACHE_MS,
    promise,
  });
  return promise;
}
