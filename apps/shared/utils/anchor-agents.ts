/**
 * Custom Anchor agent provisioning helpers (pure, no host/wallet deps).
 *
 * A PlatformAnchor "custom anchor" only earns once its 21 deterministic AA
 * agent accounts are registered AND the AA core has those accounts on file.
 * Registering the anchor app alone (registerCustomAnchorApp) leaves it at
 * agentCount = 0 — inert: staked NEO neither votes nor accrues GAS.
 *
 * These helpers reproduce, byte-for-byte, the provisioning that the host detail
 * page performs (platform/host-app/lib/custom-anchor.ts) so the standalone
 * Custom Anchor miniapp can provision agents itself at registration time. The
 * agent account derivation is delegated to {@link deriveAnchorAgentAccounts}
 * from ./aa-account, which is verified to produce identical accountId hashes to
 * the host (same `aa524701` registration payload: backup-owner hash, zero
 * verifier + zero hook contract, 30-day little-endian escape timelock, the
 * `anchor:<seed>:app:<appId>:agent:NN:nonce:<nonce>` verifier params).
 *
 * Everything here depends only on string/regex logic and @noble/hashes (via the
 * shared aa-account helper); there is no dependency on any host adapter, React,
 * or platform service, so it is unit-testable in isolation.
 */
import { deriveAnchorAgentAccounts, type AnchorAgentAccount } from "./aa-account";
import { addressToScriptHash } from "./neo";

/** AA-core escape-timelock baked into the registration account derivation (30 days). */
const DEFAULT_ESCAPE_TIMELOCK_SECONDS = 30 * 24 * 60 * 60;
/** All-zero Hash160 used for the AA-core verifier / hook slots. */
const ZERO_HASH160 = "0x0000000000000000000000000000000000000000";
/** A custom anchor always provisions the full 21-agent council. */
export const ANCHOR_AGENT_COUNT = 21;

/**
 * The deploy-script default council candidate (deploy/scripts/deploy_anchor_testnet.go).
 * The deploy flow registers every agent to this single candidate, so it is the
 * proven, working default for a Profit-mode anchor and the basis for
 * {@link defaultProfitCandidates}.
 */
export const DEFAULT_ANCHOR_CANDIDATE =
  "023e9b32ea89b94d066e649b124fd50e396ee91369e8e2a6ae1b11c170d022256d";

/** Compressed secp256r1 public key, as accepted by ECPoint candidate args. */
const COMPRESSED_PUBLIC_KEY = /^(02|03)[0-9a-fA-F]{64}$/;

export type { AnchorAgentAccount } from "./aa-account";

/**
 * A contract argument as handed to the chain layer. The runtime SDK tolerates
 * nested Array values (an array of args), which the static
 * `ChainService.ContractArg` type narrows to scalars — callers widen back to
 * the chain type at the invoke boundary (see neo-multisig's toChainArgs).
 */
export type AnchorContractArg = {
  type: "String" | "Integer" | "Boolean" | "Hash160" | "Hash256" | "PublicKey" | "ByteArray" | "Array";
  value: string | AnchorContractArg[];
};

/** A single anchor-provisioning contract call (operation + positional args). */
export type AnchorInvocation = {
  /** Target contract: "aaCore" for registerAccounts, "anchor" for the rest. */
  contract: "aaCore" | "anchor";
  operation: string;
  args: AnchorContractArg[];
};

export type AnchorRegistrationInvocations = {
  appId: string;
  mode: 1 | 2;
  agents: AnchorAgentAccount[];
  invocations: AnchorInvocation[];
};

/** Normalize one user-facing slug/nonce segment (lowercase, hyphenated, ≤24). */
function normalizeAnchorSegment(value: string, label: string, maxLength = 24): string {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

/** Build the canonical custom anchor appId (`custom-anchor:slug:nonce`). */
export function buildCustomAnchorAppId(slug: string, nonce: string): string {
  const safeSlug = normalizeAnchorSegment(slug, "anchor slug");
  const safeNonce = normalizeAnchorSegment(nonce, "anchor nonce");
  return `custom-anchor:${safeSlug}:${safeNonce}`;
}

/**
 * Parse the candidate council keys from free-form text into exactly 21 valid
 * compressed public keys.
 *
 * Duplicates are permitted: the PlatformAnchor `RegisterAgents` contract method
 * accepts any valid ECPoint per agent and does NOT require uniqueness, and the
 * canonical deploy flow registers all 21 agents to a single candidate. The
 * Profit-mode default ({@link defaultProfitCandidates}) likewise reuses one
 * proven candidate, so enforcing uniqueness here would reject the sanctioned
 * default. (The host UI's stricter unique check predated this default.)
 */
export function parseAnchorCandidateKeys(value: string): string[] {
  const keys = String(value || "")
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (keys.length !== ANCHOR_AGENT_COUNT) {
    throw new Error(`Custom Anchor requires exactly ${ANCHOR_AGENT_COUNT} council candidate public keys.`);
  }
  for (const key of keys) {
    if (!COMPRESSED_PUBLIC_KEY.test(key)) {
      throw new Error("Each candidate must be a compressed public key (02/03 + 64 hex chars).");
    }
  }
  return keys;
}

/**
 * The sensible default candidate set for a Profit-mode anchor: the deploy
 * script's working candidate, repeated for all 21 agents. Lets a first-time
 * operator register a yield-earning anchor without sourcing 21 keys, mirroring
 * the proven deploy default.
 */
export function defaultProfitCandidates(): string[] {
  return Array.from({ length: ANCHOR_AGENT_COUNT }, () => DEFAULT_ANCHOR_CANDIDATE);
}

/**
 * Normalize a Neo address (base58 N-address) or raw 0x-script-hash to a
 * 0x-prefixed lowercase Hash160.
 *
 * This mirrors the host detail page exactly: a 0x-prefixed input is taken
 * as-is (only lowercased), NOT byte-reversed — the host's chain helper
 * (platform/host-app/lib/chain) does this, and the standalone shared
 * {@link addressToScriptHash} would otherwise reverse a 0x-hash. A base58
 * address is decoded via the shared helper (both implementations agree there).
 * Getting this wrong would derive different agent accountIds than the deployed
 * host-provisioned ones.
 */
function toHash160(value: string, label: string): string {
  const trimmed = String(value || "").trim();
  const raw = trimmed.startsWith("0x")
    ? trimmed.slice(2)
    : addressToScriptHash(trimmed).replace(/^0x/i, "");
  if (!/^[0-9a-f]{40}$/i.test(raw)) {
    throw new Error(`${label} must be a Neo address or 20-byte script hash.`);
  }
  return `0x${raw.toLowerCase()}`;
}

function normalizeMode(mode: unknown): 1 | 2 {
  const raw = String(mode ?? "").trim().toLowerCase();
  if (raw === "1" || raw === "trust") return 1;
  if (raw === "2" || raw === "profit") return 2;
  throw new Error("Custom Anchor mode must be Trust or Profit.");
}

/**
 * Build the three ordered provisioning invocations for a new custom anchor:
 *
 *   1. aaCore.registerAccounts   — register the 21 AA agent accounts with the
 *                                  AA core (so the agents are real accounts).
 *   2. anchor.registerCustomAnchorApp — mint the anchor app (mode + admin).
 *   3. anchor.registerAgents     — bind the 21 agents (account, candidate,
 *                                  verification-script-hash) to the anchor.
 *
 * The host submits these atomically via invokeMultiple; the standalone chain
 * service has no batch invoke, so callers submit them sequentially (with a
 * deposit-confirmation wait between each).
 */
export function buildAnchorRegistrationInvocations({
  appId,
  mode,
  ownerAddress,
  candidateKeys,
}: {
  appId: string;
  mode: unknown;
  ownerAddress: string;
  candidateKeys: string[];
}): AnchorRegistrationInvocations {
  const anchorAppId = String(appId || "").trim();
  if (!anchorAppId) {
    throw new Error("Anchor appId is required.");
  }
  if (candidateKeys.length !== ANCHOR_AGENT_COUNT) {
    throw new Error(`Custom Anchor requires exactly ${ANCHOR_AGENT_COUNT} council candidate public keys.`);
  }
  for (const key of candidateKeys) {
    if (!COMPRESSED_PUBLIC_KEY.test(key)) {
      throw new Error("Each candidate must be a compressed public key (02/03 + 64 hex chars).");
    }
  }

  const numericMode = normalizeMode(mode);
  const ownerHash = toHash160(ownerAddress, "owner");
  // The seed prefix mirrors the host: the anchor slug segment of the appId.
  const seedPrefix = anchorAppId.startsWith("custom-anchor:")
    ? normalizeAnchorSegment(anchorAppId.split(":")[1] ?? "", "anchor slug")
    : normalizeAnchorSegment(anchorAppId, "anchor slug");
  // The nonce material is the appId's nonce segment (host uses the raw nonce).
  const nonce = anchorAppId.startsWith("custom-anchor:")
    ? String(anchorAppId.split(":")[2] ?? "").trim()
    : anchorAppId;

  const agents = deriveAnchorAgentAccounts({
    seedPrefix,
    appId: anchorAppId,
    nonce,
    backupOwnerAddress: ownerHash,
    // verifier + hook default to zero, escapeTimelock defaults to 30 days —
    // matching the host derivation exactly.
  });

  const invocations: AnchorInvocation[] = [
    {
      contract: "aaCore",
      operation: "registerAccounts",
      args: [
        { type: "Array", value: agents.map((agent) => ({ type: "Hash160", value: agent.accountId })) },
        { type: "Hash160", value: ZERO_HASH160 },
        { type: "Array", value: agents.map((agent) => ({ type: "ByteArray", value: agent.verifierParamsHex })) },
        { type: "Hash160", value: ZERO_HASH160 },
        { type: "Hash160", value: ownerHash },
        { type: "Integer", value: String(DEFAULT_ESCAPE_TIMELOCK_SECONDS) },
      ],
    },
    {
      contract: "anchor",
      operation: "registerCustomAnchorApp",
      args: [
        { type: "String", value: anchorAppId },
        { type: "Integer", value: String(numericMode) },
        { type: "Hash160", value: ownerHash },
      ],
    },
    {
      contract: "anchor",
      operation: "registerAgents",
      args: [
        { type: "String", value: anchorAppId },
        { type: "Array", value: agents.map((agent) => ({ type: "Hash160", value: agent.accountId })) },
        { type: "Array", value: candidateKeys.map((candidate) => ({ type: "PublicKey", value: candidate })) },
        { type: "Array", value: agents.map((agent) => ({ type: "ByteArray", value: agent.accountIdHash })) },
      ],
    },
  ];

  return { appId: anchorAppId, mode: numericMode, agents, invocations };
}
