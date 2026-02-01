/**
 * useSpecialEffects - Hook for triggering special effects from miniapp operations
 *
 * Maps miniapp SDK events to celebration effects:
 * - transaction_success -> coinrain
 * - win/jackpot -> fireworks
 * - achievement -> confetti
 * - reward -> sparkle + coinrain
 * - redpacket_open -> fireworks + coinrain
 */

import { useState, useCallback, useRef } from "react";
import type { EffectType } from "./CelebrationEffects";

export interface EffectTrigger {
  type: EffectType;
  intensity?: "low" | "medium" | "high";
  duration?: number;
  ripple?: boolean;
  ripplePosition?: { x: number; y: number };
}

export interface SpecialEffectsState {
  celebrationType: EffectType;
  celebrationActive: boolean;
  celebrationIntensity: "low" | "medium" | "high";
  celebrationDuration: number;
  rippleActive: boolean;
  ripplePosition?: { x: number; y: number };
}

// Event to effect mapping
const EVENT_EFFECTS: Record<string, EffectTrigger> = {
  // Transaction events
  transaction_success: { type: "sparkle", intensity: "low", duration: 1500, ripple: true },
  transaction_confirmed: { type: "confetti", intensity: "low", duration: 2000 },

  // Winning events
  win: { type: "fireworks", intensity: "medium", duration: 3000 },
  jackpot: { type: "fireworks", intensity: "high", duration: 4000 },
  big_win: { type: "fireworks", intensity: "high", duration: 3500 },

  // Achievement events
  achievement: { type: "confetti", intensity: "medium", duration: 2500 },
  level_up: { type: "confetti", intensity: "high", duration: 3000 },
  milestone: { type: "confetti", intensity: "medium", duration: 2000 },

  // Reward events
  reward: { type: "coinrain", intensity: "medium", duration: 2500, ripple: true },
  bonus: { type: "coinrain", intensity: "low", duration: 2000 },
  earnings: { type: "coinrain", intensity: "low", duration: 1500 },

  // Red packet events
  redpacket_open: { type: "fireworks", intensity: "high", duration: 3000, ripple: true },
  redpacket_claim: { type: "coinrain", intensity: "high", duration: 2500 },

  // Social events
  follow: { type: "sparkle", intensity: "low", duration: 1000 },
  like: { type: "sparkle", intensity: "low", duration: 800 },
  share_success: { type: "confetti", intensity: "low", duration: 1500 },
};

export function useSpecialEffects() {
  const [state, setState] = useState<SpecialEffectsState>({
    celebrationType: "none",
    celebrationActive: false,
    celebrationIntensity: "medium",
    celebrationDuration: 2000,
    rippleActive: false,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger effect by event name
  const triggerEvent = useCallback((eventName: string, position?: { x: number; y: number }) => {
    const effect = EVENT_EFFECTS[eventName];
    if (!effect) return;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setState({
      celebrationType: effect.type,
      celebrationActive: true,
      celebrationIntensity: effect.intensity || "medium",
      celebrationDuration: effect.duration || 2000,
      rippleActive: effect.ripple || false,
      ripplePosition: position || effect.ripplePosition,
    });

    // Auto-reset after duration
    timeoutRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        celebrationActive: false,
        rippleActive: false,
      }));
    }, effect.duration || 2000);
  }, []);

  // Direct effect trigger
  const triggerEffect = useCallback((trigger: EffectTrigger) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setState({
      celebrationType: trigger.type,
      celebrationActive: true,
      celebrationIntensity: trigger.intensity || "medium",
      celebrationDuration: trigger.duration || 2000,
      rippleActive: trigger.ripple || false,
      ripplePosition: trigger.ripplePosition,
    });

    timeoutRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        celebrationActive: false,
        rippleActive: false,
      }));
    }, trigger.duration || 2000);
  }, []);

  // Stop all effects
  const stopEffects = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setState({
      celebrationType: "none",
      celebrationActive: false,
      celebrationIntensity: "medium",
      celebrationDuration: 2000,
      rippleActive: false,
    });
  }, []);

  return {
    ...state,
    triggerEvent,
    triggerEffect,
    stopEffects,
  };
}

export default useSpecialEffects;
