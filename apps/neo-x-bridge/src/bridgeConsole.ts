export type BridgeDirection = "n3-to-neox" | "neox-to-n3";
export type BridgeKind = "asset" | "message";
export type TimelineState = "done" | "active" | "waiting";

export interface AssetBridgeForm {
  direction?: string;
  asset?: string;
  amount?: string | number;
  recipient?: string;
}

export interface MessageBridgeForm {
  direction?: string;
  targetContract?: string;
  method?: string;
  payload?: string;
  gasLimit?: string | number;
}

export interface StatusProbeForm {
  bridgeKind?: string;
  direction?: string;
  operationId?: string;
  sourceTx?: string;
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
}

export const BRIDGE_RESOURCES = {
  bridgeAppMainnet: "https://xbridge.neo.org/",
  bridgeAppTestnet: "https://testnet.bridge.banelabs.org/",
  assetBridgeDocs: "https://xdocs.ngd.network/bridge/quick-start-bridging-assets",
  tokenBridgeDocs: "https://xdocs.ngd.network/bridge/token-bridge",
  messageBridgeDocs: "https://xdocs.ngd.network/bridge/messaging-bridge",
  bridgeSdk: "https://github.com/bane-labs/bridge-sdk-ts",
} as const;

const DIRECTION_META: Record<
  BridgeDirection,
  {
    route: string;
    source: string;
    target: string;
    action: "depositGas" | "withdrawGas";
    wallet: string;
  }
> = {
  "n3-to-neox": {
    route: "Neo N3 -> Neo X",
    source: "neo-n3",
    target: "neo-x",
    action: "depositGas",
    wallet: "NeoLine / NEP-21",
  },
  "neox-to-n3": {
    route: "Neo X -> Neo N3",
    source: "neo-x",
    target: "neo-n3",
    action: "withdrawGas",
    wallet: "MetaMask / EVM wallet",
  },
};

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const NEO_N3_ADDRESS_PATTERN = /^N[1-9A-HJ-NP-Za-km-z]{33}$/;

/** Accepts an EVM address / script hash (0x + 40 hex) or a Neo N3 base58 address. */
export function isSupportedBridgeAddress(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return EVM_ADDRESS_PATTERN.test(text) || NEO_N3_ADDRESS_PATTERN.test(text);
}

/** True when `value` is an EVM (Neo X) `0x...` address. */
export function isNeoXAddress(value: unknown): boolean {
  return EVM_ADDRESS_PATTERN.test(String(value ?? "").trim());
}

/** True when `value` is a Neo N3 base58 `N...` address. */
export function isNeoN3Address(value: unknown): boolean {
  return NEO_N3_ADDRESS_PATTERN.test(String(value ?? "").trim());
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

export function operationId(kind: BridgeKind, digest: string): string {
  const prefix = kind === "asset" ? "N3X-ASSET" : "N3X-MSG";
  return `${prefix}-${digest.slice(2, 10).toUpperCase()}`;
}

export function buildAssetBridgeIntent(
  form: AssetBridgeForm,
  createdAt = new Date().toISOString(),
): BuiltBridgeIntent {
  const direction = normalizeDirection(form.direction);
  const meta = DIRECTION_META[direction];
  const asset = clean(form.asset, "GAS").toUpperCase();
  const amount = normalizeAmount(form.amount);
  const recipient = clean(form.recipient, "");

  if (asset !== "GAS") {
    throw new Error("Neo X asset bridge currently exposes GAS as the production token path.");
  }
  if (!recipient) {
    throw new Error("Recipient address is required.");
  }
  if (!isValidTargetAddress(direction, recipient)) {
    throw new Error(
      meta.target === "neo-x"
        ? "Recipient must be a Neo X (0x...) address for this direction."
        : "Recipient must be a Neo N3 (N...) address for this direction.",
    );
  }

  const digest = stableDigest(["asset", direction, asset, amount, recipient]);
  const payload = {
    kind: "axlabs.assetBridge.intent",
    provider: "BaneLabs Native Bridge",
    environment: "testnet",
    route: meta.route,
    sourceChain: meta.source,
    targetChain: meta.target,
    action: meta.action,
    asset,
    amount,
    recipient,
    expectedSettlement: "1-2 minutes after source transaction confirmation",
    walletRequirement: meta.wallet,
    resources: {
      bridgeApp: BRIDGE_RESOURCES.bridgeAppTestnet,
      docs: BRIDGE_RESOURCES.assetBridgeDocs,
    },
    digest,
  };
  const operation: BridgeOperation = {
    id: operationId("asset", digest),
    kind: "asset",
    direction,
    route: meta.route,
    title: `${amount} ${asset} ${meta.route}`,
    digest,
    createdAt,
    status: "Intent prepared",
    statusKey: "statusIntentPrepared",
    payload,
  };

  return {
    operation,
    payloadText: stringifyPayload(payload),
    timeline: buildStatusTimeline({ bridgeKind: "asset", direction, operationId: operation.id }),
  };
}

export function buildMessageBridgeIntent(
  form: MessageBridgeForm,
  createdAt = new Date().toISOString(),
): BuiltBridgeIntent {
  const direction = normalizeDirection(form.direction);
  const meta = DIRECTION_META[direction];
  const targetContract = clean(form.targetContract, "");
  const method = clean(form.method, "onCrossChainMessage");
  const payloadBody = clean(form.payload || (form as { message?: unknown }).message, "");
  const gasLimit = normalizeGasLimit(form.gasLimit);

  if (!targetContract) {
    throw new Error("Target contract is required.");
  }
  if (!isValidTargetAddress(direction, targetContract)) {
    throw new Error(
      meta.target === "neo-x"
        ? "Target contract must be a Neo X (0x...) address for this direction."
        : "Target contract must be a Neo N3 (N...) address for this direction.",
    );
  }
  if (!payloadBody) {
    throw new Error("Message payload is required.");
  }

  const payloadDigest = stableDigest(["message-body", payloadBody]);
  const digest = stableDigest(["message", direction, targetContract, method, payloadDigest, gasLimit]);
  const payload = {
    kind: "axlabs.messageBridge.intent",
    provider: "BaneLabs MessageBridge",
    sdkPackage: "@bane-labs/bridge-sdk-ts",
    route: meta.route,
    sourceChain: meta.source,
    targetChain: meta.target,
    targetContract,
    method,
    gasLimit,
    payload: {
      encoding: "utf8",
      body: payloadBody,
      digest: payloadDigest,
    },
    orderingModel: "per-direction nonce/root hash chain",
    verificationModel: "validator-attested message batches",
    resources: {
      docs: BRIDGE_RESOURCES.messageBridgeDocs,
      sdk: BRIDGE_RESOURCES.bridgeSdk,
    },
    digest,
  };
  const operation: BridgeOperation = {
    id: operationId("message", digest),
    kind: "message",
    direction,
    route: meta.route,
    title: `${method} ${meta.route}`,
    digest,
    createdAt,
    status: "Message intent prepared",
    statusKey: "statusMessageIntentPrepared",
    payload,
  };

  return {
    operation,
    payloadText: stringifyPayload(payload),
    timeline: buildStatusTimeline({ bridgeKind: "message", direction, operationId: operation.id }),
  };
}

export function buildStatusTimeline(form: StatusProbeForm): TimelineStep[] {
  const kind = form.bridgeKind === "message" ? "message" : "asset";
  const operation = clean(form.operationId, "");
  const sourceTx = clean(form.sourceTx || (form as { txHash?: unknown }).txHash, "");
  const direction = normalizeDirection(form.direction);
  const route = bridgeRoute(direction);
  const object = kind === "message" ? "message batch" : "asset transfer";

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
      key: "source-submit",
      label: "Source transaction",
      labelKey: "tlSourceLabel",
      detail: sourceTx
        ? `Source tx ${compactHash(sourceTx)} captured.`
        : "Waiting for the wallet-signed source-chain transaction.",
      detailKey: sourceTx ? "tlSourceCaptured" : "tlSourceWaiting",
      detailParams: { sourceTx: sourceTx ? compactHash(sourceTx) : "" },
      state: sourceTx ? "done" : operation ? "active" : "waiting",
    },
    {
      key: "bridge-observed",
      label: "Bridge observation",
      labelKey: "tlObservationLabel",
      detail:
        kind === "message"
          ? "Relayer reconstructs the directional message hash chain."
          : "Relayer observes bridge events and reconstructs token hash-chain state.",
      detailKey: kind === "message" ? "tlObservationMessage" : "tlObservationAsset",
      detailParams: {},
      state: sourceTx ? "active" : "waiting",
    },
    {
      key: "attestation",
      label: "Validator attestation",
      labelKey: "tlAttestationLabel",
      detail: "Validator threshold signatures authenticate the next root commitment.",
      detailKey: "tlAttestationDetail",
      detailParams: {},
      state: "waiting",
    },
    {
      key: "destination-finalized",
      label: "Destination finalized",
      labelKey: "tlDestinationLabel",
      detail:
        kind === "message"
          ? "Destination contract receives the verified payload."
          : "Destination chain releases or mints the bridged GAS.",
      detailKey: kind === "message" ? "tlDestinationMessage" : "tlDestinationAsset",
      detailParams: {},
      state: "waiting",
    },
  ];
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

function normalizeAmount(value: unknown): string {
  const text = clean(value, "");
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
  return amount.toFixed(8).replace(/\.?0+$/, "");
}

function normalizeGasLimit(value: unknown): string {
  const text = clean(value, "250000");
  if (!/^\d+$/.test(text)) {
    throw new Error("Gas limit must be a whole number of at least 21000.");
  }
  const limit = Number(text);
  if (!Number.isInteger(limit) || limit < 21000) {
    throw new Error("Gas limit must be a whole number of at least 21000.");
  }
  return String(limit);
}
