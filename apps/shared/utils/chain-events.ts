/**
 * Canonical helpers for reading positional state slots from contract event
 * payloads returned by ChainService.listEvents / the N3Index decoded-events
 * API.
 *
 * Promoted from the byte-identical copies that lived in 15+ miniapp
 * composables (gov-merc, gasbox, red-envelope, burn-league, time-capsule,
 * dev-tipping, fogplay, breakup-contract, graveyard, memorial-shrine,
 * on-chain-tarot, event-ticket-pass, soulbound-certificate, gas-lucky-pool,
 * dice-game).
 */

/** Read a single state slot from a contract event payload (positional). */
export function eventValue(entry: unknown, index: number): unknown {
  if (!entry || typeof entry !== "object") return undefined;
  const state = (entry as { state?: unknown }).state;
  if (!Array.isArray(state)) return undefined;
  const item = state[index] as unknown;
  if (item && typeof item === "object" && "value" in item) {
    return (item as { value?: unknown }).value;
  }
  return item;
}

/**
 * Read a Neo event-state field value defensively across indexer shapes.
 *
 * Unlike {@link eventValue} this also accepts a bare state array (some
 * indexers return the state list itself rather than an `{ state }` envelope)
 * and falls back to the raw item when its `value` is null/undefined.
 */
export function eventStateValue(ev: unknown, index: number): unknown {
  const state = (ev as { state?: unknown })?.state ?? ev;
  if (Array.isArray(state)) {
    const item = state[index];
    return (item as { value?: unknown })?.value ?? item;
  }
  return undefined;
}
