/**
 * Device-motion shake detection with permission-safe feature detection.
 *
 * The detector intentionally requires either one strong impulse or two weaker
 * impulses inside a short window. A low-pass gravity estimate, hysteresis and a
 * refractory period reject walking, orientation changes and a phone being set
 * down. The game engine still owns the longer five-second gameplay cooldown.
 */

export type ShakeStrength = "soft" | "strong";
export interface ShakeSignal {
  strength: ShakeStrength;
  /** Continuous, capped gameplay intensity. */
  intensity: number;
  magnitude: number;
}
export type MotionPermissionState =
  | "unsupported"
  | "insecure"
  | "prompt"
  | "granted"
  | "blocked"
  | "denied";

export interface MotionVector {
  x: number | null;
  y: number | null;
  z: number | null;
}

export interface MotionSample {
  acceleration?: MotionVector | null;
  accelerationIncludingGravity?: MotionVector | null;
}

export interface ShakeDetectorOptions {
  softThreshold?: number;
  strongThreshold?: number;
  resetThreshold?: number;
  pairWindowMs?: number;
  refractoryMs?: number;
  gravityAlpha?: number;
}

function finite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function length(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

export class ShakeDetector {
  private readonly softThreshold: number;
  private readonly strongThreshold: number;
  private readonly resetThreshold: number;
  private readonly pairWindowMs: number;
  private readonly refractoryMs: number;
  private readonly gravityAlpha: number;
  private gravity: [number, number, number] | null = null;
  private lastSoftAt = -Infinity;
  private lastSoftMagnitude = 0;
  private blockedUntil = -Infinity;
  private armed = true;

  constructor(options: ShakeDetectorOptions = {}) {
    this.softThreshold = options.softThreshold ?? 10.5;
    this.strongThreshold = options.strongThreshold ?? 19;
    this.resetThreshold = options.resetThreshold ?? 3.2;
    this.pairWindowMs = options.pairWindowMs ?? 420;
    this.refractoryMs = options.refractoryMs ?? 900;
    this.gravityAlpha = options.gravityAlpha ?? 0.82;
  }

  reset(): void {
    this.gravity = null;
    this.lastSoftAt = -Infinity;
    this.lastSoftMagnitude = 0;
    this.blockedUntil = -Infinity;
    this.armed = true;
  }

  update(sample: MotionSample, now = performance.now()): ShakeSignal | null {
    const magnitude = this.linearMagnitude(sample);
    if (now < this.blockedUntil) return null;

    if (!this.armed) {
      if (magnitude <= this.resetThreshold) this.armed = true;
      return null;
    }

    if (magnitude >= this.strongThreshold) {
      this.fire(now);
      return {
        strength: "strong",
        // Continuous at the soft/strong boundary: a slightly harder gesture
        // must never produce a weaker toss than the preceding soft pair.
        intensity: clamp(1 + ((magnitude - this.strongThreshold) / 13) * 0.35, 1, 1.35),
        magnitude,
      };
    }

    if (magnitude >= this.softThreshold) {
      if (now - this.lastSoftAt <= this.pairWindowMs) {
        const peak = Math.max(magnitude, this.lastSoftMagnitude);
        this.fire(now);
        return {
          strength: "soft",
          intensity: clamp(
            0.65 + ((peak - this.softThreshold) / (this.strongThreshold - this.softThreshold)) * 0.35,
            0.65,
            1,
          ),
          magnitude: peak,
        };
      }
      this.lastSoftAt = now;
      this.lastSoftMagnitude = magnitude;
      this.armed = false;
    }
    return null;
  }

  private fire(now: number): void {
    this.blockedUntil = now + this.refractoryMs;
    this.lastSoftAt = -Infinity;
    this.lastSoftMagnitude = 0;
    this.armed = false;
  }

  private linearMagnitude(sample: MotionSample): number {
    const direct = sample.acceleration;
    if (direct && [direct.x, direct.y, direct.z].some((value) => value !== null)) {
      return length(finite(direct.x), finite(direct.y), finite(direct.z));
    }

    const gravitySample = sample.accelerationIncludingGravity;
    if (!gravitySample) return 0;
    const current: [number, number, number] = [
      finite(gravitySample.x),
      finite(gravitySample.y),
      finite(gravitySample.z),
    ];
    if (!this.gravity) {
      this.gravity = current;
      return 0;
    }
    const a = this.gravityAlpha;
    this.gravity = [
      a * this.gravity[0] + (1 - a) * current[0],
      a * this.gravity[1] + (1 - a) * current[1],
      a * this.gravity[2] + (1 - a) * current[2],
    ];
    return length(
      current[0] - this.gravity[0],
      current[1] - this.gravity[1],
      current[2] - this.gravity[2],
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type PermissionAwareDeviceMotionEvent = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

export function motionPermissionState(): MotionPermissionState {
  if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) return "unsupported";
  if (!window.isSecureContext) return "insecure";
  const ctor = window.DeviceMotionEvent as PermissionAwareDeviceMotionEvent;
  return typeof ctor.requestPermission === "function" ? "prompt" : "granted";
}

/** Must be called inside a deliberate user gesture on iOS. */
export async function requestMotionPermission(): Promise<MotionPermissionState> {
  const initial = motionPermissionState();
  if (initial !== "prompt") return initial;
  try {
    const ctor = window.DeviceMotionEvent as PermissionAwareDeviceMotionEvent;
    return (await ctor.requestPermission?.()) === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}
