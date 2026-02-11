/**
 * Shared contract normalization utilities.
 *
 * Used by miniapp submission and developer app creation endpoints
 * to sanitize user-supplied contract configuration.
 */

export type ContractConfig = {
  address?: string | null;
  active?: boolean;
  entry_url?: string;
};

/**
 * Normalize a raw contracts payload into a consistent shape.
 *
 * Accepts either:
 *   - `{ chainId: "NxAddress..." }` (shorthand string → address)
 *   - `{ chainId: { address, active, entry_url } }` (full object)
 *
 * Returns a sanitized `Record<string, ContractConfig>`.
 */
export function normalizeContracts(raw: unknown): Record<string, ContractConfig> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, ContractConfig> = {};

  Object.entries(raw as Record<string, unknown>).forEach(([chainId, value]) => {
    if (typeof value === "string") {
      result[chainId] = { address: value };
      return;
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const obj = value as Record<string, unknown>;
    const address = typeof obj.address === "string" ? obj.address : undefined;
    const entryUrl =
      typeof obj.entry_url === "string" ? obj.entry_url : typeof obj.entryUrl === "string" ? obj.entryUrl : undefined;
    const active = typeof obj.active === "boolean" ? obj.active : undefined;

    result[chainId] = {
      ...(address ? { address } : {}),
      ...(entryUrl ? { entry_url: entryUrl } : {}),
      ...(active !== undefined ? { active } : {}),
    };
  });

  return result;
}
