type RequestLike = {
  method(): string;
  url(): string;
  postDataJSON(): unknown;
};

const READ_ONLY_POST_ENDPOINTS = new Set([
  "/api/rpc/neo-read",
  "/api/edge/os-badge-get-stat",
  "/api/edge/os-badge-list",
  "/api/edge/os-checkin-streak",
  "/api/edge/os-escrow-get",
  "/api/edge/os-game-status",
  "/api/edge/os-leaderboard-get",
  "/api/edge/os-nft-list",
  "/api/edge/os-payment-balance",
  "/api/edge/os-storage-get",
  "/api/edge/os-storage-list",
  "/api/edge/os-storage-read-shared",
  "/api/edge/os-vesting-get",
  "/api/edge/os-vesting-list",
]);

const READ_ONLY_NEO_RPC_METHODS = new Set([
  "getblockcount",
  "getversion",
  "invokefunction",
  "invokescript",
  "calculatenetworkfee",
]);

export function isReadOnlyPostRequest(request: RequestLike): boolean {
  if (request.method().toUpperCase() !== "POST") return false;

  let pathname: string;
  try {
    pathname = new URL(request.url()).pathname;
  } catch {
    return false;
  }

  if (READ_ONLY_POST_ENDPOINTS.has(pathname)) return true;
  if (pathname !== "/api/rpc/neo") return false;

  try {
    const body = request.postDataJSON();
    if (!body || typeof body !== "object" || Array.isArray(body)) return false;
    const method = String((body as { method?: unknown }).method || "")
      .trim()
      .toLowerCase();
    return READ_ONLY_NEO_RPC_METHODS.has(method);
  } catch {
    return false;
  }
}
