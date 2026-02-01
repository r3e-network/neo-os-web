/**
 * useCelebration - Composable for triggering celebration effects
 *
 * Usage:
 * const { celebrate, fireworks, confetti, coinRain } = useCelebration();
 * celebrate('win'); // Trigger by event name
 * fireworks(); // Direct trigger
 */

import { ref, readonly } from "vue";

export type CelebrationType = "fireworks" | "confetti" | "coinrain" | "sparkle" | "none";

export interface CelebrationState {
  type: CelebrationType;
  active: boolean;
  intensity: "low" | "medium" | "high";
  duration: number;
}

// Event to effect mapping
const EVENT_EFFECTS: Record<string, Partial<CelebrationState>> = {
  // Transaction events
  transaction_success: { type: "sparkle", intensity: "low", duration: 1500 },
  transaction_confirmed: { type: "confetti", intensity: "low", duration: 2000 },

  // Winning events
  win: { type: "fireworks", intensity: "medium", duration: 3000 },
  jackpot: { type: "fireworks", intensity: "high", duration: 4000 },
  big_win: { type: "fireworks", intensity: "high", duration: 3500 },

  // Achievement events
  achievement: { type: "confetti", intensity: "medium", duration: 2500 },
  level_up: { type: "confetti", intensity: "high", duration: 3000 },

  // Reward events
  reward: { type: "coinrain", intensity: "medium", duration: 2500 },
  bonus: { type: "coinrain", intensity: "low", duration: 2000 },

  // Red packet events
  redpacket_open: { type: "fireworks", intensity: "high", duration: 3000 },
  redpacket_claim: { type: "coinrain", intensity: "high", duration: 2500 },
};

export function useCelebration() {
  const state = ref<CelebrationState>({
    type: "none",
    active: false,
    intensity: "medium",
    duration: 2000,
  });

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const trigger = (config: Partial<CelebrationState>) => {
    if (timeoutId) clearTimeout(timeoutId);

    state.value = {
      type: config.type || "confetti",
      active: true,
      intensity: config.intensity || "medium",
      duration: config.duration || 2000,
    };

    timeoutId = setTimeout(() => {
      state.value.active = false;
      state.value.type = "none";
    }, state.value.duration);
  };

  // Trigger by event name
  const celebrate = (eventName: string) => {
    const effect = EVENT_EFFECTS[eventName];
    if (effect) trigger(effect);
  };

  // Direct triggers
  const fireworks = (intensity: "low" | "medium" | "high" = "medium") => {
    trigger({ type: "fireworks", intensity, duration: 3000 });
  };

  const confetti = (intensity: "low" | "medium" | "high" = "medium") => {
    trigger({ type: "confetti", intensity, duration: 2500 });
  };

  const coinRain = (intensity: "low" | "medium" | "high" = "medium") => {
    trigger({ type: "coinrain", intensity, duration: 2500 });
  };

  const sparkle = () => {
    trigger({ type: "sparkle", intensity: "low", duration: 1500 });
  };

  const stop = () => {
    if (timeoutId) clearTimeout(timeoutId);
    state.value.active = false;
    state.value.type = "none";
  };

  return {
    state: readonly(state),
    celebrate,
    fireworks,
    confetti,
    coinRain,
    sparkle,
    stop,
  };
}

export default useCelebration;
