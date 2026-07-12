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
  hintPulseMs: 1_600,
  cameraShakeAmplitude: 0.1,
  panRollAmplitude: 0.105,
  panPitchAmplitude: 0.065,
  panOffsetX: 0.18,
  panOffsetZ: 0.12,
  panLiftY: 0.14,
  panDampingPower: 1.7,
  pickPressScale: 1.15,
  trayFlightArcY: 0.78,
  trayFlightSpinStep: 0.014,
  trayFlightEndScale: 0.46,
  qaTelemetryMs: 1_000,
});
