import { getRpcUrl } from "@shared/constants/rpc";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { addressToScriptHash } from "@shared/utils/neo";
import { NEO_X_CONFIG } from "@shared/utils/evm-chain";

export type BridgeDirection = "n3-to-neox" | "neox-to-n3";
export type BridgeKind = "asset";
export type BridgeAsset = "GAS" | "NEO";
export type TimelineState = "done" | "active" | "waiting" | "error" | "unknown";
/** Which official bridge deployment the prepared intent targets. */
export type BridgeEnvironment = "mainnet" | "testnet";
export type BridgeEvidenceState = "verified" | "unverified" | "not-applicable";
export type SourceTransactionState =
  | "idle"
  | "checking"
  | "pending"
  | "confirmed"
  | "faulted"
  | "unknown";
export type RpcBoundaryState = "checking" | "ready" | "blocked";

const HASH256_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const GAS_AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/;
const NEO_AMOUNT_PATTERN = /^[1-9]\d{0,15}$/;
const LOCAL_ASSET_REQUEST_PATTERN = /^N3X-ASSET-[A-F0-9]{8}$/;
const LOCAL_DIGEST_PATTERN = /^0x[0-9a-f]{16}$/;
const HANDOFF_TTL_MS = 10 * 60 * 1000;

export const BRIDGE_ASSETS: Record<
  BridgeAsset,
  { symbol: BridgeAsset; n3Decimals: 0 | 8; neoXDecimals: 0 | 18 }
> = {
  GAS: { symbol: "GAS", n3Decimals: 8, neoXDecimals: 18 },
  // The official bridge constrains NEO input to whole units in both directions.
  NEO: { symbol: "NEO", n3Decimals: 0, neoXDecimals: 0 },
};

export interface BoundBridgeNetwork {
  key: "neo-n3" | "neo-x";
  label: string;
  network: string;
  chainId: string;
}

/**
 * Facts that this miniapp can bind before handing the user to the official
 * bridge. Quote/fee fields stay explicitly unavailable because the official
 * bridge does not publish a supported public quote API for this console.
 */
export interface AssetBridgeHandoff {
  version: 2;
  requestId: string;
  idempotencyKey: string;
  digest: string;
  environment: BridgeEnvironment;
  direction: BridgeDirection;
  source: BoundBridgeNetwork;
  destination: BoundBridgeNetwork;
  token: {
    symbol: BridgeAsset;
    sourceDecimals: 0 | 8 | 18;
    destinationDecimals: 0 | 8 | 18;
  };
  sourceAccount: string;
  amount: string;
  recipient: string;
  quote: {
    status: "official-bridge-required";
    amountOut: null;
    bridgeFee: null;
    networkFee: null;
    slippageBps: null;
    expiresAt: null;
    estimatedMinutes: { min: 1; max: 2 };
  };
  createdAt: string;
  snapshotExpiresAt: string;
  officialBridgeUrl: string;
}

export interface BridgeVerificationEvidence {
  requestId: string;
  fingerprint: string;
  environment: BridgeEnvironment;
  direction: BridgeDirection;
  source: BoundBridgeNetwork;
  destination: BoundBridgeNetwork;
  sourceTx: string;
  sourceTransaction: SourceTransactionState;
  sourceBlock: string;
  sourceEvent: BridgeEvidenceState;
  destinationEvent: BridgeEvidenceState;
  destinationReadback: BridgeEvidenceState;
  checkedAt: string;
  retryable: boolean;
  reason:
    | "confirmed-source-only"
    | "source-pending"
    | "source-faulted"
    | "source-unavailable";
}

/**
 * Persisted read-only verification input. Unlike the old bare tx-hash cache,
 * this record binds the hash to its environment and source-chain direction so
 * a reload can never query a Neo N3 transaction against Neo X (or vice versa).
 * When a local handoff exists, requestId + intentDigest are both required.
 */
export interface BridgeVerificationRequest {
  version: 2;
  environment: BridgeEnvironment;
  direction: BridgeDirection;
  sourceTx: string;
  requestId: string;
  intentDigest: string;
  createdAt: string;
}

export interface BridgeServiceBoundary {
  environment: BridgeEnvironment;
  n3Rpc: RpcBoundaryState;
  neoXRpc: RpcBoundaryState;
  quoteService: "official-app-only";
  destinationStatusService: "unavailable";
  checkedAt: string;
}

export interface BridgeWalletSnapshot {
  environment: BridgeEnvironment;
  chain: BoundBridgeNetwork["key"];
  network: string;
  address: string;
  checkedAt: string;
  balances: Record<BridgeAsset, {
    units: string | null;
    display: string | null;
    decimals: 0 | 8 | 18;
  }>;
}

export interface RpcRequest {
  (url: string, method: string, params?: unknown[]): Promise<unknown>;
}

export interface AssetBridgeForm {
  direction?: string;
  asset?: string;
  amount?: string | number;
  recipient?: string;
  sourceAccount?: string;
}

export interface StatusProbeForm {
  bridgeKind?: string;
  direction?: string;
  operationId?: string;
  sourceTx?: string;
  sourceTransaction?: SourceTransactionState;
  sourceEvent?: BridgeEvidenceState;
  destinationEvent?: BridgeEvidenceState;
  destinationReadback?: BridgeEvidenceState;
  asset?: BridgeAsset;
}

export interface BridgeOperation {
  id: string;
  kind: BridgeKind;
  direction: BridgeDirection;
  route: string;
  title: string;
  digest: string;
  createdAt: string;
  /** English status label (fallback / non-localized contexts). */
  status: string;
  /** i18n key for the status, translated at render time. */
  statusKey: string;
  sourceTx?: string;
  payload: Record<string, unknown>;
}

export interface TimelineStep {
  key: string;
  /** English step label (fallback). */
  label: string;
  /** English step detail (fallback). */
  detail: string;
  /** i18n key for the step label, translated at render time. */
  labelKey: string;
  /**
   * i18n key for the step detail, translated at render with interpolation
   * params (operation id, route, source tx, object noun) in {@link detailParams}.
   */
  detailKey: string;
  /** Interpolation params for {@link detailKey} (e.g. {operation}, {route}). */
  detailParams: Record<string, string>;
  state: TimelineState;
}

export interface BuiltBridgeIntent {
  operation: BridgeOperation;
  payloadText: string;
  timeline: TimelineStep[];
  handoff?: AssetBridgeHandoff;
}

export const BRIDGE_RESOURCES = {
  bridgeAppMainnet: "https://xbridge.neo.org/",
  bridgeAppTestnet: "https://testnet.bridge.banelabs.org/",
  bridgeIndexer: "https://indexer.xbridge.neo.org/",
  assetBridgeDocs: "https://xdocs.ngd.network/bridge/quick-start-bridging-assets",
  tokenBridgeDocs: "https://xdocs.ngd.network/bridge/token-bridge",
  messageBridgeDocs: "https://xdocs.ngd.network/bridge/messaging-bridge",
} as const;

/** Resolve both Neo N3 and Neo X network spellings to one bridge environment. */
export function resolveBridgeEnvironment(value?: unknown): BridgeEnvironment {
  let raw = String(value ?? "").trim().toLowerCase();
  if (!raw && typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    raw = String(params.get("network") ?? params.get("chain") ?? "").trim().toLowerCase();
  }
  if (raw === "mainnet" ||
    raw === "neo-n3-mainnet" ||
    raw === "neo-x-mainnet" ||
    raw === "47763" ||
    raw === "860833102" ||
    raw === "0xba93") {
    return "mainnet";
  }
  // Every known testnet spelling, plus an absent or malformed launch value,
  // follows the manifest's non-production default. Never silently promote an
  // unknown host value to a mainnet bridge route.
  return "testnet";
}

/** The official bridge app URL for the given environment. */
export function bridgeAppUrl(environment: BridgeEnvironment): string {
  return environment === "mainnet"
    ? BRIDGE_RESOURCES.bridgeAppMainnet
    : BRIDGE_RESOURCES.bridgeAppTestnet;
}

const SOURCE_EXPLORERS: Record<
  BridgeDirection,
  Record<BridgeEnvironment, string>
> = {
  // n3-to-neox: the source tx is signed on Neo N3.
  "n3-to-neox": {
    mainnet: "https://explorer.onegate.space/transactionInfo/",
    testnet: "https://testnet.explorer.onegate.space/transactionInfo/",
  },
  // neox-to-n3: the source tx is signed on Neo X (EVM).
  "neox-to-n3": {
    mainnet: "https://xexplorer.neo.org/tx/",
    testnet: "https://xt4scan.ngd.network/tx/",
  },
};

/**
 * Canonical explorer URL for the SOURCE-chain transaction of a bridge op. The
 * source chain depends on direction (Neo N3 for n3-to-neox, Neo X for
 * neox-to-n3); the only fact this console can truly surface is that one source
 * tx, so let the user open it on the right explorer.
 */
export function sourceExplorerUrl(
  direction: BridgeDirection,
  environment: BridgeEnvironment,
  sourceTx: string,
): string {
  const base = SOURCE_EXPLORERS[direction][environment];
  return `${base}${String(sourceTx ?? "").trim()}`;
}

const DIRECTION_META: Record<
  BridgeDirection,
  {
    route: string;
    source: string;
    target: string;
    action: "depositAsset" | "withdrawAsset";
    wallet: string;
  }
> = {
  "n3-to-neox": {
    route: "Neo N3 -> Neo X",
    source: "neo-n3",
    target: "neo-x",
    action: "depositAsset",
    wallet: "NeoLine / NEP-21",
  },
  "neox-to-n3": {
    route: "Neo X -> Neo N3",
    source: "neo-x",
    target: "neo-n3",
    action: "withdrawAsset",
    wallet: "MetaMask / EVM wallet",
  },
};

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const NEO_N3_ADDRESS_PATTERN = /^N[1-9A-HJ-NP-Za-km-z]{33}$/;

/** True when `value` is an EVM (Neo X) `0x...` address. */
export function isNeoXAddress(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return EVM_ADDRESS_PATTERN.test(text) && !/^0x0{40}$/i.test(text);
}

/** True when `value` is a Neo N3 base58 `N...` address. */
export function isNeoN3Address(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return NEO_N3_ADDRESS_PATTERN.test(text) && Boolean(addressToScriptHash(text));
}

export function isBridgeTransactionHash(value: unknown): boolean {
  return HASH256_PATTERN.test(String(value ?? "").trim());
}

export function buildBridgeVerificationRequest(
  input: {
    environment: BridgeEnvironment;
    direction: BridgeDirection;
    sourceTx: string;
    requestId?: string;
    intentDigest?: string;
  },
  createdAt = new Date().toISOString(),
): BridgeVerificationRequest {
  const sourceTx = String(input.sourceTx ?? "").trim().toLowerCase();
  if (!isBridgeTransactionHash(sourceTx)) {
    throw new Error("Enter a 0x-prefixed 32-byte transaction hash (64 hex characters).");
  }
  const requestId = String(input.requestId ?? "").trim().toUpperCase();
  const intentDigest = String(input.intentDigest ?? "").trim().toLowerCase();
  if (Boolean(requestId) !== Boolean(intentDigest)) {
    throw new Error("A handoff request id and intent digest must be provided together.");
  }
  if (requestId && !LOCAL_ASSET_REQUEST_PATTERN.test(requestId)) {
    throw new Error("The local handoff request id is invalid.");
  }
  if (intentDigest && !LOCAL_DIGEST_PATTERN.test(intentDigest)) {
    throw new Error("The local handoff digest is invalid.");
  }
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) throw new Error("Invalid verification creation time.");
  return {
    version: 2,
    environment: input.environment,
    direction: input.direction,
    sourceTx,
    requestId,
    intentDigest,
    createdAt: new Date(timestamp).toISOString(),
  };
}

export function restoreBridgeVerificationRequest(
  value: unknown,
  environment: BridgeEnvironment,
  handoff?: AssetBridgeHandoff | null,
): BridgeVerificationRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const stored = value as Partial<BridgeVerificationRequest>;
  if (
    stored.version !== 2 ||
    stored.environment !== environment ||
    (stored.direction !== "n3-to-neox" && stored.direction !== "neox-to-n3") ||
    typeof stored.sourceTx !== "string" ||
    typeof stored.requestId !== "string" ||
    typeof stored.intentDigest !== "string" ||
    typeof stored.createdAt !== "string"
  ) {
    return null;
  }
  try {
    const canonical = buildBridgeVerificationRequest({
      environment,
      direction: stored.direction,
      sourceTx: stored.sourceTx,
      requestId: stored.requestId,
      intentDigest: stored.intentDigest,
    }, stored.createdAt);
    if (handoff && (
      canonical.direction !== handoff.direction ||
      canonical.requestId !== handoff.requestId ||
      canonical.intentDigest !== handoff.digest
    )) {
      return null;
    }
    return canonical;
  } catch {
    return null;
  }
}

export function normalizeBridgeAsset(value: unknown): BridgeAsset {
  const asset = clean(value, "GAS").toUpperCase();
  if (asset === "GAS" || asset === "NEO") return asset;
  throw new Error("The official Neo X bridge currently exposes GAS and NEO.");
}

export function bridgeAssetDecimals(
  asset: BridgeAsset,
  chain: BoundBridgeNetwork["key"],
): 0 | 8 | 18 {
  return chain === "neo-x"
    ? BRIDGE_ASSETS[asset].neoXDecimals
    : BRIDGE_ASSETS[asset].n3Decimals;
}

export function normalizeBridgeAmount(assetValue: unknown, value: unknown): string {
  const asset = normalizeBridgeAsset(assetValue);
  const text = clean(value, "");
  if (asset === "NEO") {
    if (!NEO_AMOUNT_PATTERN.test(text)) {
      throw new Error("NEO must be a positive whole number.");
    }
    return BigInt(text).toString();
  }
  if (!GAS_AMOUNT_PATTERN.test(text)) {
    throw new Error("Amount must be a positive GAS decimal with at most 8 decimal places.");
  }
  const parts = text.split(".");
  const whole = parts[0] ?? "0";
  const fraction = parts[1] ?? "";
  const normalizedFraction = fraction.replace(/0+$/, "");
  const normalized = normalizedFraction ? `${whole}.${normalizedFraction}` : whole;
  const baseUnits = BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, "0"));
  if (baseUnits <= 0n) throw new Error("Amount must be greater than zero.");
  return normalized;
}

/** Back-compatible fixed8 helper used by existing consumers and migration tests. */
export function normalizeGasBridgeAmount(value: unknown): string {
  return normalizeBridgeAmount("GAS", value);
}

export function bridgeAmountToBaseUnits(amount: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("Unsupported bridge token precision.");
  }
  const text = String(amount ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error("Invalid bridge amount.");
  const [whole = "0", fraction = ""] = text.split(".");
  if (fraction.length > decimals) throw new Error("Amount exceeds the source token precision.");
  return BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(fraction.padEnd(decimals, "0") || "0");
}

export function formatBridgeBaseUnits(units: bigint, decimals: number): string {
  if (units < 0n) throw new Error("Bridge balances cannot be negative.");
  if (decimals === 0) return units.toString();
  const base = 10n ** BigInt(decimals);
  const whole = units / base;
  const fraction = (units % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/**
 * Validates that `value` is a well-formed address for the *target* chain of the
 * given direction: Neo X (`0x...`) for `n3-to-neox`, Neo N3 (`N...`) for
 * `neox-to-n3`. Guards against wrong-chain addresses being embedded verbatim
 * into a finalized-looking bridge handoff.
 */
export function isValidTargetAddress(
  direction: BridgeDirection,
  value: unknown,
): boolean {
  return DIRECTION_META[direction].target === "neo-x"
    ? isNeoXAddress(value)
    : isNeoN3Address(value);
}

export function normalizeDirection(value: unknown): BridgeDirection {
  const text = clean(value, "").toLowerCase();
  return text === "neox-to-n3" ||
    text === "neo x -> neo n3" ||
    text === "neo x → neo n3"
    ? "neox-to-n3"
    : "n3-to-neox";
}

export function bridgeRoute(direction: BridgeDirection): string {
  return DIRECTION_META[direction].route;
}

export function bridgeNetworks(
  direction: BridgeDirection,
  environment: BridgeEnvironment,
): { source: BoundBridgeNetwork; destination: BoundBridgeNetwork } {
  // `network` is display copy on the chain cards. The "T5"/"T4" net numbers
  // read as cryptic staleness markers to a store visitor and add nothing a
  // wallet cannot confirm — the exact network is still carried unambiguously
  // by `chainId`, which is what every attestation and comparison uses.
  const n3: BoundBridgeNetwork = {
    key: "neo-n3",
    label: "Neo N3",
    network: environment === "testnet" ? "Neo N3 TestNet" : "Neo N3 MainNet",
    chainId: environment === "testnet" ? "magic:894710606" : "magic:860833102",
  };
  const neoX: BoundBridgeNetwork = {
    key: "neo-x",
    label: "Neo X",
    network: environment === "testnet" ? "Neo X TestNet" : "Neo X MainNet",
    chainId: environment === "testnet" ? "12227332" : "47763",
  };
  return direction === "n3-to-neox"
    ? { source: n3, destination: neoX }
    : { source: neoX, destination: n3 };
}

export function stableDigest(parts: readonly unknown[]): string {
  const input = parts
    .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
    .join("|");
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ code, 0x5bd1e995);
  }

  const left = (h1 >>> 0).toString(16).padStart(8, "0");
  const right = (h2 >>> 0).toString(16).padStart(8, "0");
  return `0x${left}${right}`;
}

export function operationId(digest: string): string {
  return `N3X-ASSET-${digest.slice(2, 10).toUpperCase()}`;
}

export function buildAssetBridgeHandoff(
  form: AssetBridgeForm,
  createdAt = new Date().toISOString(),
  environment: BridgeEnvironment = "testnet",
): AssetBridgeHandoff {
  const direction = normalizeDirection(form.direction);
  const asset = normalizeBridgeAsset(form.asset);
  const amount = normalizeBridgeAmount(asset, form.amount);
  const recipient = clean(form.recipient, "");
  const sourceAccount = clean(form.sourceAccount, "");
  if (!recipient) throw new Error("Recipient address is required.");
  if (!isValidTargetAddress(direction, recipient)) {
    throw new Error(
      direction === "n3-to-neox"
        ? "Recipient must be a Neo X (0x...) address for this direction."
        : "Recipient must be a checksum-valid Neo N3 (N...) address for this direction.",
    );
  }
  const networks = bridgeNetworks(direction, environment);
  const sourceAccountReady = networks.source.key === "neo-x"
    ? isNeoXAddress(sourceAccount)
    : isNeoN3Address(sourceAccount);
  if (!sourceAccountReady) {
    throw new Error(
      networks.source.key === "neo-x"
        ? "Connect and verify a Neo X source wallet for this route."
        : "Connect and verify a Neo N3 source wallet for this route.",
    );
  }
  const boundSourceAccount = networks.source.key === "neo-x"
    ? sourceAccount.toLowerCase()
    : sourceAccount;
  const digest = stableDigest([
    "asset-handoff-v2",
    environment,
    direction,
    networks.source.chainId,
    networks.destination.chainId,
    asset,
    amount,
    boundSourceAccount,
    recipient,
  ]);
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) throw new Error("Invalid handoff creation time.");
  return {
    version: 2,
    requestId: operationId(digest),
    idempotencyKey: digest,
    digest,
    environment,
    direction,
    source: networks.source,
    destination: networks.destination,
    token: {
      symbol: asset,
      sourceDecimals: bridgeAssetDecimals(asset, networks.source.key),
      destinationDecimals: bridgeAssetDecimals(asset, networks.destination.key),
    },
    sourceAccount,
    amount,
    recipient,
    quote: {
      status: "official-bridge-required",
      amountOut: null,
      bridgeFee: null,
      networkFee: null,
      slippageBps: null,
      expiresAt: null,
      estimatedMinutes: { min: 1, max: 2 },
    },
    createdAt: new Date(timestamp).toISOString(),
    snapshotExpiresAt: new Date(timestamp + HANDOFF_TTL_MS).toISOString(),
    officialBridgeUrl: bridgeAppUrl(environment),
  };
}

/**
 * Rebuild a locally persisted handoff from its user-controlled fields and only
 * accept it when every derived binding still matches. The returned object is a
 * fresh canonical value rather than the stored object, so extra or modified
 * fields can never be trusted after a reload. Expired tickets are intentionally
 * recoverable: the UI shows them as expired and lets the user renew them.
 */
export function restoreAssetBridgeHandoff(
  value: unknown,
  environment: BridgeEnvironment,
): AssetBridgeHandoff | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const stored = value as Partial<AssetBridgeHandoff>;
  if (
    stored.version !== 2 ||
    stored.environment !== environment ||
    (stored.direction !== "n3-to-neox" && stored.direction !== "neox-to-n3") ||
    (stored.token?.symbol !== "GAS" && stored.token?.symbol !== "NEO") ||
    typeof stored.sourceAccount !== "string" ||
    typeof stored.amount !== "string" ||
    typeof stored.recipient !== "string" ||
    typeof stored.createdAt !== "string"
  ) {
    return null;
  }

  try {
    const canonical = buildAssetBridgeHandoff(
      {
        direction: stored.direction,
        asset: stored.token.symbol,
        amount: stored.amount,
        recipient: stored.recipient,
        sourceAccount: stored.sourceAccount,
      },
      stored.createdAt,
      environment,
    );
    if (
      stored.requestId !== canonical.requestId ||
      stored.idempotencyKey !== canonical.idempotencyKey ||
      stored.digest !== canonical.digest ||
      stored.snapshotExpiresAt !== canonical.snapshotExpiresAt ||
      stored.officialBridgeUrl !== canonical.officialBridgeUrl
    ) {
      return null;
    }
    return canonical;
  } catch {
    return null;
  }
}

export function buildAssetBridgeIntent(
  form: AssetBridgeForm,
  createdAt = new Date().toISOString(),
  environment: BridgeEnvironment = "testnet",
): BuiltBridgeIntent {
  const handoff = buildAssetBridgeHandoff(form, createdAt, environment);
  const direction = handoff.direction;
  const meta = DIRECTION_META[direction];
  const { amount, recipient, digest } = handoff;
  const payload = {
    kind: "neo.nativeBridge.reviewIntent",
    provider: "Neo Native Bridge",
    environment,
    execution: "intent_only",
    fundsMoved: false,
    nextStep: bridgeAppUrl(environment),
    requestId: handoff.requestId,
    idempotencyKey: handoff.idempotencyKey,
    route: meta.route,
    source: handoff.source,
    destination: handoff.destination,
    action: meta.action,
    token: handoff.token,
    sourceAccount: handoff.sourceAccount,
    amount,
    recipient,
    quote: handoff.quote,
    localSnapshotExpiresAt: handoff.snapshotExpiresAt,
    settlementStatus: "not-observed-by-this-miniapp",
    walletRequirement: meta.wallet,
    resources: {
      bridgeApp: bridgeAppUrl(environment),
      docs: BRIDGE_RESOURCES.assetBridgeDocs,
    },
    digestKind: "local-reference",
    digest,
  };
  const operation: BridgeOperation = {
    id: handoff.requestId,
    kind: "asset",
    direction,
    route: meta.route,
    title: `Review ${amount} ${handoff.token.symbol} ${meta.route}`,
    digest,
    createdAt: handoff.createdAt,
    status: "Review ticket prepared",
    statusKey: "statusIntentPrepared",
    payload,
  };

  return {
    operation,
    payloadText: stringifyPayload(payload),
    timeline: buildStatusTimeline({ bridgeKind: "asset", direction, operationId: operation.id }),
    handoff,
  };
}

export function buildStatusTimeline(form: StatusProbeForm): TimelineStep[] {
  const operation = clean(form.operationId, "");
  const sourceTx = clean(form.sourceTx || (form as { txHash?: unknown }).txHash, "");
  const direction = normalizeDirection(form.direction);
  const route = bridgeRoute(direction);
  const asset = normalizeBridgeAsset(form.asset);
  const object = `${asset} transfer`;
  const sourceTransaction = form.sourceTransaction ?? "idle";
  const sourceEvent = form.sourceEvent ?? "unverified";
  const destinationEvent = form.destinationEvent ?? "unverified";
  const destinationReadback = form.destinationReadback ?? "unverified";

  const sourceState: TimelineState = sourceTransaction === "confirmed"
    ? "done"
    : sourceTransaction === "faulted"
      ? "error"
      : sourceTransaction === "unknown"
        ? "unknown"
        : sourceTx
          ? "active"
          : operation
            ? "active"
            : "waiting";
  const sourceDetailKey = sourceTransaction === "confirmed"
    ? "tlSourceConfirmed"
    : sourceTransaction === "faulted"
      ? "tlSourceFaulted"
      : sourceTransaction === "pending"
        ? "tlSourcePending"
        : sourceTransaction === "checking"
          ? "tlSourceChecking"
        : sourceTransaction === "unknown"
          ? "tlSourceUnknown"
          : sourceTx
            ? "tlSourceNeedsVerification"
            : "tlSourceWaiting";
  const sourceEventState: TimelineState = sourceEvent === "verified"
    ? "done"
    : sourceTransaction === "confirmed"
      ? "unknown"
      : "waiting";
  const destinationEventState: TimelineState = destinationEvent === "verified"
    ? "done"
    : sourceEvent === "verified"
      ? "active"
      : "waiting";
  const readbackState: TimelineState = destinationReadback === "verified"
    ? "done"
    : destinationEvent === "verified"
      ? "active"
      : "waiting";

  return [
    {
      key: "intent",
      label: "Intent prepared",
      labelKey: "tlIntentLabel",
      detail: operation
        ? `${operation} is ready for ${route}.`
        : `Prepare a ${object} intent from the operation panel.`,
      detailKey: operation ? "tlIntentReady" : "tlIntentPending",
      detailParams: { operation, route, object },
      state: operation ? "done" : "active",
    },
    {
      key: "official-wallet",
      label: "Official wallet review",
      labelKey: "tlOfficialWalletLabel",
      detail: sourceTx
        ? "A wallet-submitted source transaction is available for verification."
        : `Reconnect both wallets and review any required ${asset} approval on the official bridge.`,
      detailKey: sourceTx ? "tlOfficialWalletDone" : "tlOfficialWalletWaiting",
      detailParams: { asset },
      state: sourceTx ? "done" : operation ? "active" : "waiting",
    },
    {
      key: "source-submit",
      label: "Source transaction",
      labelKey: "tlSourceLabel",
      detail: sourceTx
        ? `Source tx ${compactHash(sourceTx)} still requires a chain read.`
        : "Waiting for the wallet-signed source-chain transaction.",
      detailKey: sourceDetailKey,
      detailParams: { sourceTx: sourceTx ? compactHash(sourceTx) : "" },
      state: sourceState,
    },
    {
      key: "source-event",
      label: "Source bridge event",
      labelKey: "tlSourceEventLabel",
      detail: sourceEvent === "verified"
        ? "An event from the expected source bridge contract was found."
        : "The source bridge event has not been verified.",
      detailKey: sourceEvent === "verified"
        ? "tlSourceEventVerified"
        : sourceTransaction === "confirmed"
          ? "tlSourceEventUnverified"
          : "tlSourceEventWaiting",
      detailParams: {},
      state: sourceEventState,
    },
    {
      key: "destination-event",
      label: "Destination bridge event",
      labelKey: "tlDestinationEventLabel",
      detail: "Destination delivery requires its own verified bridge event.",
      detailKey: destinationEvent === "verified"
        ? "tlDestinationEventVerified"
        : "tlDestinationEventWaiting",
      detailParams: {},
      state: destinationEventState,
    },
    {
      key: "destination-readback",
      label: "Destination balance readback",
      labelKey: "tlDestinationReadbackLabel",
      detail: "A destination-chain readback is required before delivery can be shown.",
      detailKey: destinationReadback === "verified"
        ? "tlDestinationReadbackVerified"
        : "tlDestinationReadbackWaiting",
      detailParams: {},
      state: readbackState,
    },
  ];
}

async function defaultRpcRequest(
  url: string,
  method: string,
  params: unknown[] = [],
): Promise<unknown> {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    timeoutMs: 8_000,
  });
  if (!response.ok) throw new Error(`Bridge RPC returned HTTP ${response.status}.`);
  const payload = await response.json() as { result?: unknown; error?: { message?: unknown } };
  if (payload.error) throw new Error(String(payload.error.message ?? "Bridge RPC request failed."));
  return payload.result;
}

/**
 * Exact native GAS balance read for a verified Neo X account. The public RPC
 * identity is checked before and after the balance read so a failover or stale
 * response can never be displayed under the wrong environment.
 */
export async function readNeoXGasBalance(
  address: string,
  environment: BridgeEnvironment,
  rpc: RpcRequest = defaultRpcRequest,
): Promise<{ units: bigint; display: string; network: string }> {
  if (!isNeoXAddress(address)) throw new Error("Neo X wallet returned an invalid account.");
  const network = environment === "testnet" ? "neo-x-testnet" : "neo-x-mainnet";
  const config = NEO_X_CONFIG[network];
  const expectedChainId = config.chainId;
  const readChainId = async () => Number.parseInt(String(
    await rpc(config.rpc, "eth_chainId", []),
  ), 16);
  const before = await readChainId();
  if (before !== expectedChainId) {
    throw new Error("Neo X balance RPC network identity does not match the selected environment.");
  }
  const raw = String(await rpc(config.rpc, "eth_getBalance", [address, "latest"]));
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(raw)) {
    throw new Error("Neo X balance RPC returned an invalid integer amount.");
  }
  const units = BigInt(raw);
  const after = await readChainId();
  if (after !== before) {
    throw new Error("Neo X balance RPC changed networks during the read.");
  }
  return { units, display: formatBridgeBaseUnits(units, 18), network };
}

export async function probeBridgeServiceBoundary(
  environment: BridgeEnvironment,
  rpc: RpcRequest = defaultRpcRequest,
  checkedAt = new Date().toISOString(),
): Promise<BridgeServiceBoundary> {
  const n3Expected = environment === "testnet" ? 894710606 : 860833102;
  const neoXNetwork = environment === "testnet" ? "neo-x-testnet" : "neo-x-mainnet";
  const neoXConfig = NEO_X_CONFIG[neoXNetwork];
  const [n3Result, neoXResult] = await Promise.allSettled([
    rpc(getRpcUrl(environment), "getversion", []),
    rpc(neoXConfig.rpc, "eth_chainId", []),
  ]);
  const n3Payload = n3Result.status === "fulfilled"
    ? n3Result.value as { protocol?: { network?: unknown } } | null
    : null;
  const neoXChainId = neoXResult.status === "fulfilled"
    ? Number.parseInt(String(neoXResult.value ?? ""), 16)
    : Number.NaN;
  return {
    environment,
    n3Rpc: Number(n3Payload?.protocol?.network) === n3Expected ? "ready" : "blocked",
    neoXRpc: neoXChainId === neoXConfig.chainId ? "ready" : "blocked",
    quoteService: "official-app-only",
    destinationStatusService: "unavailable",
    checkedAt,
  };
}

function evidenceReason(state: SourceTransactionState): BridgeVerificationEvidence["reason"] {
  if (state === "confirmed") return "confirmed-source-only";
  if (state === "pending") return "source-pending";
  if (state === "faulted") return "source-faulted";
  return "source-unavailable";
}

export async function verifyBridgeSourceTransaction(
  input: {
    environment: BridgeEnvironment;
    direction: BridgeDirection;
    sourceTx: string;
    requestId?: string;
    intentDigest?: string;
  },
  rpc: RpcRequest = defaultRpcRequest,
  checkedAt = new Date().toISOString(),
): Promise<BridgeVerificationEvidence> {
  const sourceTx = String(input.sourceTx ?? "").trim();
  if (!isBridgeTransactionHash(sourceTx)) {
    throw new Error("Enter a 0x-prefixed 32-byte transaction hash (64 hex characters).");
  }
  const networks = bridgeNetworks(input.direction, input.environment);
  const fingerprint = stableDigest([
    "bridge-source-verification-v2",
    input.environment,
    input.direction,
    networks.source.chainId,
    networks.destination.chainId,
    input.requestId ?? "",
    input.intentDigest ?? "",
    sourceTx.toLowerCase(),
  ]);
  const requestId = clean(input.requestId, `N3X-VERIFY-${fingerprint.slice(2, 10).toUpperCase()}`);
  let sourceTransaction: SourceTransactionState = "unknown";
  let sourceBlock = "";
  let sourceEvent: BridgeEvidenceState = "unverified";

  if (networks.source.key === "neo-n3") {
    const version = await rpc(getRpcUrl(input.environment), "getversion", []) as {
      protocol?: { network?: unknown };
    } | null;
    const expectedMagic = input.environment === "testnet" ? 894710606 : 860833102;
    if (Number(version?.protocol?.network) !== expectedMagic) {
      throw new Error("Source RPC network identity does not match the selected Neo N3 environment.");
    }
    const [txResult, logResult] = await Promise.allSettled([
      rpc(getRpcUrl(input.environment), "getrawtransaction", [sourceTx, true]),
      rpc(getRpcUrl(input.environment), "getapplicationlog", [sourceTx]),
    ]);
    const tx = txResult.status === "fulfilled"
      ? txResult.value as { blockhash?: unknown; blockindex?: unknown; confirmations?: unknown } | null
      : null;
    const appLog = logResult.status === "fulfilled"
      ? logResult.value as { executions?: Array<{ vmstate?: unknown }> } | null
      : null;
    const vmStates = (appLog?.executions ?? []).map((execution) =>
      String(execution.vmstate ?? "").toUpperCase()
    );
    if (vmStates.some((state) => state.includes("FAULT"))) {
      sourceTransaction = "faulted";
    } else if (vmStates.length > 0 && vmStates.every((state) => state.includes("HALT"))) {
      sourceTransaction = "confirmed";
    } else if (tx) {
      sourceTransaction = Number(tx.confirmations ?? 0) > 0 || Boolean(tx.blockhash)
        ? "confirmed"
        : "pending";
    }
    sourceBlock = String(tx?.blockindex ?? tx?.blockhash ?? "");
    // No canonical Neo N3 bridge-contract/event registry is shipped with this
    // app, so a successful source execution is never upgraded to event proof.
    sourceEvent = "unverified";
  } else {
    const neoXNetwork = input.environment === "testnet" ? "neo-x-testnet" : "neo-x-mainnet";
    const neoXConfig = NEO_X_CONFIG[neoXNetwork];
    try {
      const chainId = Number.parseInt(String(
        await rpc(neoXConfig.rpc, "eth_chainId", []),
      ), 16);
      if (chainId !== neoXConfig.chainId) {
        throw new Error("Source RPC network identity does not match the selected Neo X environment.");
      }
      const [receiptResult, transactionResult] = await Promise.allSettled([
        rpc(
          neoXConfig.rpc,
          "eth_getTransactionReceipt",
          [sourceTx],
        ),
        rpc(
          neoXConfig.rpc,
          "eth_getTransactionByHash",
          [sourceTx],
        ),
      ]);
      const receipt = receiptResult.status === "fulfilled"
        ? receiptResult.value as {
            status?: unknown;
            blockNumber?: unknown;
          } | null
        : null;
      const transaction = transactionResult.status === "fulfilled"
        ? transactionResult.value as { blockNumber?: unknown } | null
        : null;
      if (receiptResult.status === "rejected") {
        sourceTransaction = "unknown";
      } else if (!receipt) {
        sourceTransaction = transaction ? "pending" : "unknown";
      } else if (String(receipt.status ?? "").toLowerCase() === "0x0") {
        sourceTransaction = "faulted";
      } else if (String(receipt.status ?? "").toLowerCase() === "0x1") {
        sourceTransaction = "confirmed";
        sourceBlock = String(receipt.blockNumber ?? "");
        // A successful receipt — even one touching the known bridge proxy — is
        // not exact event proof. Without the authoritative ABI/topic plus
        // decoded direction/token/amount/recipient/request binding, unrelated
        // bridge activity could otherwise be mislabeled as this handoff.
        sourceEvent = "unverified";
      }
    } catch (error) {
      if (error instanceof Error && /network identity/i.test(error.message)) throw error;
      sourceTransaction = "unknown";
    }
  }

  return {
    requestId,
    fingerprint,
    environment: input.environment,
    direction: input.direction,
    source: networks.source,
    destination: networks.destination,
    sourceTx,
    sourceTransaction,
    sourceBlock,
    sourceEvent,
    // The repository has no authenticated cross-chain status/readback service.
    // These stay unverified even when the source transaction is confirmed.
    destinationEvent: "unverified",
    destinationReadback: "unverified",
    checkedAt,
    retryable: sourceTransaction === "pending" || sourceTransaction === "unknown",
    reason: evidenceReason(sourceTransaction),
  };
}

export function stringifyPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

export function compactHash(value: string): string {
  const text = clean(value, "");
  if (text.length <= 18) return text;
  return `${text.slice(0, 10)}...${text.slice(-8)}`;
}

function clean(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}
