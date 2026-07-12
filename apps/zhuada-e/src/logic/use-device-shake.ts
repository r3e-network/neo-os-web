import { useCallback, useEffect, useRef, useState } from "react";
import {
  ShakeDetector,
  motionPermissionState,
  requestMotionPermission,
  type MotionPermissionState,
  type ShakeSignal,
} from "./device-motion";
import { gameStorage } from "./game-storage";

const MOTION_ENABLED_KEY = "zhuada-e:motion-enabled";
const MOTION_EVENT_TIMEOUT_MS = 2200;

function loadEnabledPref(): boolean {
  try {
    return gameStorage.getItem(MOTION_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveEnabledPref(enabled: boolean): void {
  try {
    gameStorage.setItem(MOTION_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    /* best-effort preference */
  }
}

export interface UseDeviceShakeOptions {
  active: boolean;
  onShake: (signal: ShakeSignal) => void;
}

export interface DeviceShakeBinding {
  permission: MotionPermissionState;
  enabled: boolean;
  requestEnable: () => Promise<MotionPermissionState>;
  disable: () => void;
}

/**
 * React binding around the pure ShakeDetector. Permission is never requested
 * implicitly: requestEnable must be called by a visible button/user gesture.
 */
export function useDeviceShake({ active, onShake }: UseDeviceShakeOptions): DeviceShakeBinding {
  const initialPermission = typeof window === "undefined" ? "unsupported" : motionPermissionState();
  const [permission, setPermission] = useState<MotionPermissionState>(initialPermission);
  const [enabled, setEnabled] = useState(
    () => initialPermission === "granted" && loadEnabledPref(),
  );
  const detectorRef = useRef(new ShakeDetector());
  const activeRef = useRef(active);
  const onShakeRef = useRef(onShake);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled || permission !== "granted") return;
    const detector = detectorRef.current;
    detector.reset();
    let firstEventSeen = false;
    const capabilityTimeout = window.setTimeout(() => {
      if (firstEventSeen) return;
      // Chromium exposes DeviceMotionEvent even when Permissions Policy or the
      // hardware blocks delivery. Do not leave the UI claiming it is ready.
      setPermission("blocked");
      setEnabled(false);
      saveEnabledPref(false);
    }, MOTION_EVENT_TIMEOUT_MS);
    const onMotion = (event: DeviceMotionEvent): void => {
      if (!firstEventSeen) {
        firstEventSeen = true;
        window.clearTimeout(capabilityTimeout);
      }
      if (!activeRef.current || document.hidden) return;
      const strength = detector.update({
        acceleration: event.acceleration,
        accelerationIncludingGravity: event.accelerationIncludingGravity,
      });
      if (strength) onShakeRef.current(strength);
    };
    window.addEventListener("devicemotion", onMotion, { passive: true });
    return () => {
      window.clearTimeout(capabilityTimeout);
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [enabled, permission]);

  const requestEnable = useCallback(async (): Promise<MotionPermissionState> => {
    const next = await requestMotionPermission();
    setPermission(next);
    const on = next === "granted";
    setEnabled(on);
    saveEnabledPref(on);
    return next;
  }, []);

  const disable = useCallback((): void => {
    setEnabled(false);
    saveEnabledPref(false);
    detectorRef.current.reset();
  }, []);

  return { permission, enabled, requestEnable, disable };
}
