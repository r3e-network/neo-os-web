const SECOND_EPOCH_THRESHOLD = 1_000_000_000_000;

export function normalizeUnlockTimeMs(value: unknown): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.floor(
    numeric < SECOND_EPOCH_THRESHOLD ? numeric * 1000 : numeric,
  );
}
