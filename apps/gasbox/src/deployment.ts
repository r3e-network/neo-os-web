import { normalizeScriptHash } from "@shared/utils/neo";

/**
 * The currently bound MainNet/TestNet deployment predates the fixed-beacon
 * source. Its live ABI has no `update` method and its manifest identifies
 * settle-block Runtime.GetRandom, which permits a failed settle transaction to
 * be retried against a later block. New paid writes stay paused on this hash.
 */
export const LEGACY_SETTLE_REROLL_HASH =
  "0x30e9d4a4758827361c3b51a0e8460b067e58b1db";

export type GasBoxDeploymentCompatibility =
  | { writeCompatible: true; reason: "compatible" }
  | { writeCompatible: false; reason: "legacy-settle-reroll" };

export function assessGasBoxDeployment(
  contractHash: string,
): GasBoxDeploymentCompatibility {
  return normalizeScriptHash(contractHash) === normalizeScriptHash(LEGACY_SETTLE_REROLL_HASH)
    ? { writeCompatible: false, reason: "legacy-settle-reroll" }
    : { writeCompatible: true, reason: "compatible" };
}
