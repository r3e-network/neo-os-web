/**
 * Multisig request persistence.
 *
 * Requests are stored in OS storage (ctx.os.storage) so that a request
 * created on one device can be loaded — and signed — by the other signers
 * on their own devices. Each request is keyed by `msig:<id>` and an index
 * key `msig:index` keeps the list of known request IDs so the activity feed
 * and history can be rebuilt from shared state.
 *
 * A request created here is an unsigned Neo N3 multisig transfer. Signers
 * append their witness signature (keyed by their compressed public key) and
 * the request advances to `ready` once the threshold is met, at which point
 * any participant can assemble the multisig witness and broadcast it.
 *
 * When no OS storage backend is configured (e.g. the legacy creation
 * composable that runs outside the OS context), a runtime-cache backend is
 * used as a local-only fallback so the call still resolves.
 */

import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";

const STORAGE_KEY = "multisig_requests";
const KEY_PREFIX = "msig:";
const INDEX_KEY = "msig:index";

export interface MultisigRequest {
  id: string;
  chain_id: "neo-n3-mainnet" | "neo-n3-testnet";
  script_hash: string;
  threshold: number;
  signers: string[];
  transaction_hex: string;
  signatures: Record<string, string>;
  status: "pending" | "ready" | "broadcasted" | "cancelled" | "expired";
  memo?: string;
  broadcast_txid?: string;
  created_at: string;
}

/**
 * Minimal storage contract this module needs. `ctx.os.storage` (StorageProxy)
 * satisfies it. Kept narrow so the dependency is explicit and testable.
 */
export interface MultisigStorageBackend {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<unknown>;
  list?(prefix: string, limit?: number): Promise<Record<string, unknown>>;
}

function requestKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isMultisigRequest(value: unknown): value is MultisigRequest {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.transaction_hex === "string" &&
    Array.isArray(record.signers)
  );
}

// ---------------------------------------------------------------------------
// Runtime-cache fallback backend (local-only) — used when no OS storage is
// injected. Mirrors the previous behaviour so legacy callers keep working.
// ---------------------------------------------------------------------------

function loadAllCached(): MultisigRequest[] {
  const saved = readCachedJSON<MultisigRequest[]>(STORAGE_KEY);
  return Array.isArray(saved) ? saved : [];
}

const cacheBackend: MultisigStorageBackend = {
  async get(key: string) {
    const id = key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : key;
    if (key === INDEX_KEY) {
      return loadAllCached().map((r) => r.id);
    }
    return loadAllCached().find((r) => r.id === id) ?? null;
  },
  async set(key: string, value: unknown) {
    if (key === INDEX_KEY) {
      // Index is derived from the stored list in cache mode; nothing to do.
      return value;
    }
    const id = key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : key;
    const all = loadAllCached().filter((r) => r.id !== id);
    if (isMultisigRequest(value)) {
      all.unshift(value);
    }
    writeCachedJSON(STORAGE_KEY, all.slice(0, 50));
    return value;
  },
  async list(prefix: string) {
    const out: Record<string, unknown> = {};
    for (const request of loadAllCached()) {
      const key = requestKey(request.id);
      if (key.startsWith(prefix)) out[key] = request;
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// Active backend (defaults to the local cache; replaced with OS storage when
// the app sets it up via configureStorage()).
// ---------------------------------------------------------------------------

let backend: MultisigStorageBackend = cacheBackend;

/** Point persistence at the OS storage proxy (cross-device sharing). */
export function configureStorage(storage: MultisigStorageBackend): void {
  backend = storage;
}

async function readIndex(): Promise<string[]> {
  try {
    const raw = await backend.get(INDEX_KEY);
    if (Array.isArray(raw)) {
      return raw.filter((id): id is string => typeof id === "string");
    }
    return [];
  } catch {
    return [];
  }
}

async function writeIndex(ids: string[]): Promise<void> {
  const unique = Array.from(new Set(ids)).slice(0, 200);
  await backend.set(INDEX_KEY, unique);
}

async function persist(request: MultisigRequest): Promise<void> {
  await backend.set(requestKey(request.id), request);
}

export const api = {
  async get(id: string): Promise<MultisigRequest> {
    const raw = await backend.get(requestKey(id.trim()));
    if (!isMultisigRequest(raw)) {
      throw new Error(`Request ${id} not found`);
    }
    return raw;
  },

  /** List every known request via the shared index (newest first). */
  async list(): Promise<MultisigRequest[]> {
    const ids = await readIndex();
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          return await this.get(id);
        } catch {
          return null;
        }
      }),
    );
    return results.filter(isMultisigRequest).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  },

  async create(params: {
    chainId: string;
    scriptHash: string;
    threshold: number;
    signers: string[];
    transactionHex: string;
    memo?: string;
  }): Promise<MultisigRequest> {
    const request: MultisigRequest = {
      id: generateId(),
      chain_id: params.chainId as MultisigRequest["chain_id"],
      script_hash: params.scriptHash,
      threshold: params.threshold,
      signers: params.signers,
      transaction_hex: params.transactionHex,
      signatures: {},
      status: "pending",
      memo: params.memo,
      created_at: new Date().toISOString(),
    };
    await persist(request);
    const ids = await readIndex();
    await writeIndex([request.id, ...ids]);
    return request;
  },

  /**
   * Append a signer's witness signature (keyed by compressed public key) and
   * advance the request to `ready` once the threshold is met. Re-reads the
   * shared record first so concurrent signers don't clobber each other.
   */
  async addSignature(
    id: string,
    publicKey: string,
    signature: string,
  ): Promise<MultisigRequest> {
    const request = await this.get(id);
    request.signatures = { ...request.signatures, [publicKey]: signature };

    const sigCount = Object.keys(request.signatures).length;
    if (sigCount >= request.threshold && request.status === "pending") {
      request.status = "ready";
    }

    await persist(request);
    return request;
  },

  async updateStatus(
    id: string,
    status: MultisigRequest["status"],
    broadcastTxId?: string,
  ): Promise<MultisigRequest> {
    const request = await this.get(id);
    request.status = status;
    if (broadcastTxId) request.broadcast_txid = broadcastTxId;
    await persist(request);
    return request;
  },
};
