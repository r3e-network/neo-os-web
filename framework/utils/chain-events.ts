export function eventStateValue(ev: unknown, index: number): unknown {
  const state = (ev as { state?: unknown })?.state ?? ev;
  if (Array.isArray(state)) {
    const item = state[index];
    return (item as { value?: unknown })?.value ?? item;
  }
  return undefined;
}
