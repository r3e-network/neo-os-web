/**
 * Single source of truth for 3D motion feel.
 *
 * These values coordinate the basket toss, camera kick, and item-to-tray
 * flight so gameplay reads as one continuous physical gesture.
 */
export const SCENE_MOTION = Object.freeze({
  cameraShakeMs: 420,
  panTossMs: 820,
  popMiniMs: 420,
  popBurstMs: 560,
  failRunMs: 900,
  winBobMs: 2_400,
  /** Confetti burst on win: 40 colorful quads rain for 2s. */
  winConfettiMs: 2_000,
  winConfettiCount: 40,
  hintPulseMs: 2_000,
  cameraShakeAmplitude: 0.1,
  panRollAmplitude: 0.105,
  panPitchAmplitude: 0.065,
  panOffsetX: 0.18,
  panOffsetZ: 0.12,
  panLiftY: 0.14,
  panDampingPower: 1.7,
  pickPressScale: 1.15,
  trayFlightArcY: 0.78,
  /** Increased from 0.014 for a satisfying 1/4 tumble during tray flight. */
  trayFlightSpinStep: 0.055,
  trayFlightEndScale: 0.46,
  qaTelemetryMs: 1_000,
});

/**
 * Portrait canvases need the physical pile lower than the geometric center so
 * the upper half can carry the HUD/environment while the tray still reads as
 * one continuous appliance. Landscape/desktop framing remains centered.
 */
export function portraitCameraBias(aspect: number): number {
  if (!Number.isFinite(aspect)) return 0;
  const t = Math.max(0, Math.min(1, (0.9 - aspect) / 0.3));
  return Number((t * 0.94).toFixed(3));
}
