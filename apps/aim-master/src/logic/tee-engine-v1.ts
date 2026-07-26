export const RING_POINTS = [10, 8, 6, 4, 2, 0] as const;

export const AIM_CONFIG = {
  width: 300,
  centre: 150,
  bullseyeRadius: 6,
  ringWidth: 24,
  maxSpeed: 6,
  tickMs: 16,
} as const;

const ACCURACY_RING = 2;

export const PATTERN_TICKS = Math.ceil(5000 / AIM_CONFIG.tickMs);

export function generatePattern(problemSecret: Uint8Array): number[] {
  if (!(problemSecret instanceof Uint8Array) || problemSecret.length !== 32) {
    throw new Error("problemSecret must be 32 bytes");
  }

  let hash = 0;
  for (let index = 0; index < problemSecret.length; index += 1) {
    hash = ((hash << 5) - hash + problemSecret[index]!) | 0;
  }
  let rngState = Math.abs(hash);
  const pseudoRand = (): number => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };

  const positions: number[] = [];
  let position: number = AIM_CONFIG.centre;
  let direction = pseudoRand() < 0.5 ? 1 : -1;
  let speed = 1;
  let ticksUntilChange = 0;

  for (let tick = 0; tick < PATTERN_TICKS; tick += 1) {
    positions.push(position);
    if (ticksUntilChange <= 0) {
      direction = pseudoRand() < 0.5 ? 1 : -1;
      speed = 1 + Math.floor(pseudoRand() * (AIM_CONFIG.maxSpeed - 1));
      ticksUntilChange = 10 + Math.floor(pseudoRand() * 40);
    }
    ticksUntilChange -= 1;
    position += direction * speed;
    if (position < 0) {
      position = 0;
      direction = 1;
    } else if (position > AIM_CONFIG.width) {
      position = AIM_CONFIG.width;
      direction = -1;
    }
  }
  return positions;
}

export function patternView(problemSecret: Uint8Array): string {
  return generatePattern(problemSecret).join(",");
}

export function ringOf(stopPosition: number): number {
  const offset = stopPosition - AIM_CONFIG.centre;
  const absoluteDistance = Math.abs(offset);
  if (absoluteDistance <= AIM_CONFIG.bullseyeRadius) return 0;
  return Math.min(
    5,
    Math.floor((absoluteDistance - AIM_CONFIG.bullseyeRadius) / AIM_CONFIG.ringWidth) + 1,
  );
}

export function isAccuracyHit(ring: number): boolean {
  return ring <= ACCURACY_RING;
}

export function positionAtTick(pattern: number[], tick: number): number {
  if (pattern.length === 0) return AIM_CONFIG.centre;
  const index = tick < 0 ? 0 : tick % pattern.length;
  return pattern[index]!;
}

export function replayAim(pattern: number[], ticks: number[]): { accuracyHits: number; rings: number[] } {
  const rings: number[] = [];
  let accuracyHits = 0;
  for (const tick of ticks) {
    const position = positionAtTick(pattern, tick);
    const ring = ringOf(position);
    rings.push(ring);
    if (isAccuracyHit(ring)) accuracyHits += 1;
  }
  return { accuracyHits, rings };
}

export function aimAnswer(accuracyHits: number, rings: number[]): string {
  return `aim:${accuracyHits}:${rings.join("")}`;
}
