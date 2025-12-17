export function getEnv(name: string): string | undefined {
  const raw = Deno.env.get(name);
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function mustGetEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`missing required env var: ${name}`);
  return value;
}

