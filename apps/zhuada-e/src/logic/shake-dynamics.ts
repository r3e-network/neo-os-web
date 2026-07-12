/** Pure tuning contract for the phone-driven pan-toss interaction. */
export interface ShakeDynamics {
  intensity: number;
  affectedRatio: number;
  lateralImpulse: number;
  verticalImpulseMin: number;
  verticalImpulseMax: number;
  angularVelocity: number;
  maxHorizontalVelocity: number;
  maxVerticalVelocity: number;
}

export function shakeDynamics(input: number): ShakeDynamics {
  const intensity = Math.max(0.65, Math.min(1.35, Number.isFinite(input) ? input : 1));
  const normalized = (intensity - 0.65) / 0.7;
  return {
    intensity,
    affectedRatio: 0.48 + normalized * 0.52,
    lateralImpulse: 1.15 + normalized * 1.05,
    verticalImpulseMin: 1.75 + normalized * 1.55,
    verticalImpulseMax: Math.min(4.75, 2.7 + normalized * 1.55),
    angularVelocity: 3.3 + normalized * 2.7,
    maxHorizontalVelocity: 3.8,
    maxVerticalVelocity: 5.35,
  };
}
