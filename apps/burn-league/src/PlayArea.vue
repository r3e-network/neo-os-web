<template>
  <div class="burn-play-area">
    <!-- ── Total Burned Hero ── -->
    <div class="hero-section">
      <div class="fire-container" aria-hidden="true">
        <div class="flame flame-1"></div>
        <div class="flame flame-2"></div>
        <div class="flame flame-3"></div>
      </div>
      <div class="hero-content">
        <span class="hero-subtitle">{{ t("totalBurned") }}</span>
        <span class="hero-value">{{ formatNum(totalBurned) }}</span>
        <span class="hero-suffix">{{ t("tokenGas") }}</span>
      </div>
    </div>

    <!-- ── User Stats Row ── -->
    <div class="user-stats-row">
      <div class="user-stat">
        <span class="user-stat-value">{{ formatNum(userBurned) }}</span>
        <span class="user-stat-label">{{ t("youBurned") }} ({{ t("tokenGas") }})</span>
      </div>
      <div class="user-stat">
        <span class="user-stat-value">{{ formattedRank }}</span>
        <span class="user-stat-label">{{ t("rank") }}</span>
      </div>
    </div>

    <!-- ── Burn Action ── -->
    <NeoCard variant="erobo" class="burn-action-card">
      <NeoInput
        :modelValue="burnAmount"
        type="number"
        :placeholder="t('amountPlaceholder')"
        :suffix="t('tokenGas')"
        @update:modelValue="burnAmount = $event"
      />
      <div class="reward-info">
        <span class="reward-label">{{ t("estimatedRewards") }}</span>
        <span class="reward-value">+{{ formatNum(estimatedReward) }} {{ t("points") }}</span>
      </div>
      <NeoButton
        variant="primary"
        size="lg"
        block
        type="button"
        :disabled="isBurning"
        :loading="isBurning"
        class="burn-button"
        @click="handleBurn"
      >
        <span class="burn-button-text">
          <AppIcon name="flame" :size="14" aria-hidden="true" />
          {{ t("burnNow") }}
        </span>
      </NeoButton>
    </NeoCard>

    <!-- ── Leaderboard Preview ── -->
    <NeoCard variant="erobo" class="leaderboard-card">
      <div class="leaderboard-header">
        <AppIcon name="bar-chart" :size="16" aria-hidden="true" />
        <span>{{ t("leaderboard") }}</span>
      </div>
      <div class="leaderboard-list" :aria-label="t('ariaLeaderboard')">
        <div
          v-for="entry in leaderboardPreview"
          :key="entry.address"
          :class="['leader-item', entry.isUser && 'highlight']"
        >
          <div class="leader-rank-container">
            <AppIcon
              v-if="getMedalIcon(entry.rank)"
              :name="getMedalIcon(entry.rank)"
              :size="16"
              aria-hidden="true"
            />
            <span class="leader-rank">#{{ entry.rank }}</span>
          </div>
          <span class="leader-addr">{{ entry.address }}</span>
          <div class="leader-burned-container">
            <span class="leader-burned">{{ formatNum(entry.burned) }}</span>
            <span class="leader-burned-suffix">{{ t("gasSuffix") }}</span>
          </div>
        </div>
      </div>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — Presentation-only component for Burn League
 *
 * This is what makes the burn league miniapp unique: the fire hero section,
 * burn input, burn button, user rank display, and leaderboard preview.
 *
 * Everything else (sidebar, stats tab, docs tab, shell chrome) is rendered
 * by the platform based on manifest.ts configuration.
 *
 * Data flows in via props from defineMiniApp's render function, which passes:
 *   - t: translation function
 *   - state: reactive state object (values matching manifest valueKeys)
 *
 * All business logic, derived computations, and formatting live in the
 * composable (useBurnLeague.ts). This component only reads props.state
 * and dispatches actions — no inline logic.
 *
 * For actions, we use the injected action registry (MINIAPP_ACTIONS_KEY)
 * which defineMiniApp provides to the component tree.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { AppIcon, NeoCard, NeoInput, NeoButton } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import { formatNum, getMedalIcon } from "./composables/useBurnLeague";
import type { LeaderEntry } from "./composables/useBurnLeague";

// ── Props ─────────────────────────────────────────────────────────────
// Received from defineMiniApp's render function (playAreaProps).
const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

// ── Translation shorthand ─────────────────────────────────────────────
const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
// All values come from the composable via main.ts setup() state bindings.
const totalBurned = computed(() => Number(props.state.totalBurned?.value ?? 0));
const userBurned = computed(() => Number(props.state.userBurned?.value ?? 0));
const formattedRank = computed(() => String(props.state.formattedRank?.value ?? "--"));
const isBurning = computed(() => Boolean(props.state.isBurning?.value ?? false));
const burnAmount = computed({
  get: () => String(props.state.burnAmount?.value ?? "1"),
  set: (v: string) => {
    if (props.state.burnAmount) props.state.burnAmount.value = v;
  },
});
const estimatedReward = computed(() => Number(props.state.estimatedReward?.value ?? 0));
const leaderboardPreview = computed(
  () => (props.state.leaderboardPreview?.value ?? []) as LeaderEntry[],
);

// ── Action dispatch ───────────────────────────────────────────────────
// Actions are registered in main.ts setup() via ctx.registerAction().
// The action map is provided to the component tree by defineMiniApp.
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleBurn = async () => {
  const handler = actions.get("burnTokens");
  if (handler) {
    await handler();
  }
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.burn-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px 12px;
  min-height: 300px;
}

/* ── Hero Section ── */
.hero-section {
  position: relative;
  width: 100%;
  max-width: 400px;
  padding: 32px 20px;
  border-radius: 16px;
  background: linear-gradient(
    145deg,
    rgba(255, 80, 0, 0.08) 0%,
    rgba(200, 30, 0, 0.06) 50%,
    rgba(255, 120, 0, 0.04) 100%
  );
  border: 1px solid rgba(255, 100, 0, 0.15);
  text-align: center;
  overflow: hidden;
  animation: ember-glow 3s ease-in-out infinite;
}

.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.hero-subtitle {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.hero-value {
  font-size: 36px;
  font-weight: 900;
  font-family: $font-mono;
  background: linear-gradient(180deg, #ff6b00, #ff0000);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 12px rgba(255, 80, 0, 0.4));
  animation: flame-flicker 2s ease-in-out infinite;
}

.hero-suffix {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ── Fire Background ── */
.fire-container {
  position: absolute;
  bottom: -20px;
  left: 0;
  right: 0;
  height: 120px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  pointer-events: none;
  opacity: 0.6;
  filter: blur(10px);
}

.flame {
  width: 40px;
  height: 60px;
  background: radial-gradient(circle at bottom, var(--burn-flame-orange, #f97316), transparent 70%);
  border-radius: 50% 50% 20% 20%;
  animation: neo-flicker 2s infinite alternate ease-in-out;
  margin: 0 -10px;
  opacity: 0.7;

  &.flame-1 {
    animation-delay: 0s;
    height: 70px;
    background: radial-gradient(circle at bottom, var(--burn-flame-red, #ef4444), transparent 70%);
  }
  &.flame-2 {
    animation-delay: 0.5s;
    height: 90px;
    background: radial-gradient(circle at bottom, var(--burn-flame-amber, #f59e0b), transparent 70%);
    z-index: 1;
  }
  &.flame-3 {
    animation-delay: 1s;
    height: 60px;
    background: radial-gradient(circle at bottom, var(--burn-flame-red, #ef4444), transparent 70%);
  }
}

/* ── User Stats Row ── */
.user-stats-row {
  display: flex;
  gap: 16px;
  width: 100%;
  max-width: 400px;
}

.user-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
}

.user-stat-value {
  font-size: 20px;
  font-weight: 800;
  font-family: $font-mono;
  color: var(--text-primary);
}

.user-stat-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.4);
}

/* ── Burn Action Card ── */
.burn-action-card {
  width: 100%;
  max-width: 400px;
}

.reward-info {
  background: rgba(249, 115, 22, 0.1);
  backdrop-filter: blur(10px);
  padding: 16px;
  border: 1px solid rgba(249, 115, 22, 0.2);
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0;
  box-shadow: 0 0 20px rgba(249, 115, 22, 0.1);
}

.reward-label {
  @include stat-label;
}

.reward-value {
  font-size: 14px;
  font-weight: 800;
  font-family: $font-family;
  color: var(--burn-orange, #ff4500);
  text-shadow: 0 0 10px rgba(249, 115, 22, 0.3);
}

.burn-button {
  margin-top: 16px;
}

.burn-button-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Leaderboard Card ── */
.leaderboard-card {
  width: 100%;
  max-width: 400px;
}

.leaderboard-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}

.leader-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  transition: all 0.2s ease;

  &.highlight {
    background: rgba(0, 229, 153, 0.1);
    border-color: rgba(0, 229, 153, 0.3);
    box-shadow: 0 4px 12px rgba(0, 229, 153, 0.1);
  }
}

.leader-rank-container {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 50px;
}

.leader-rank {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-primary);
  font-family: $font-mono;
}

.leader-addr {
  @include text-truncate;
  font-size: 11px;
  font-family: $font-mono;
  color: var(--text-primary, rgba(255, 255, 255, 0.8));
  flex: 1;
  padding: 0 12px;
}

.leader-burned-container {
  display: flex;
  align-items: baseline;
  text-align: right;
  min-width: 80px;
  justify-content: flex-end;
}

.leader-burned {
  font-size: 14px;
  font-weight: 700;
  font-family: $font-mono;
  color: var(--text-primary);
}

.leader-burned-suffix {
  font-size: 9px;
  font-weight: 600;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  margin-left: 2px;
}

/* ── Animations ── */
@keyframes flame-flicker {
  0%,
  100% {
    text-shadow:
      0 0 10px rgba(255, 100, 0, 0.6),
      0 0 20px rgba(255, 60, 0, 0.4),
      0 0 40px rgba(255, 40, 0, 0.2);
    transform: scale(1);
    opacity: 0.85;
  }
  50% {
    text-shadow:
      0 0 15px rgba(255, 120, 0, 0.8),
      0 0 30px rgba(255, 80, 0, 0.5),
      0 0 50px rgba(255, 40, 0, 0.3);
    transform: scale(1.02);
    opacity: 1;
  }
}

@keyframes ember-glow {
  0%,
  100% {
    box-shadow:
      0 0 15px rgba(255, 80, 0, 0.15),
      0 0 30px rgba(255, 40, 0, 0.08);
  }
  50% {
    box-shadow:
      0 0 25px rgba(255, 100, 0, 0.3),
      0 0 50px rgba(255, 60, 0, 0.15);
  }
}

@keyframes neo-flicker {
  0% {
    transform: scaleY(1) translateY(0);
    opacity: 0.5;
  }
  100% {
    transform: scaleY(1.2) translateY(-10px);
    opacity: 0.8;
  }
}

/* ── Responsive ── */
@media (max-width: 480px) {
  .hero-value {
    font-size: 28px;
  }
  .user-stats-row {
    gap: 8px;
  }
  .user-stat {
    padding: 12px 8px;
  }
  .user-stat-value {
    font-size: 16px;
  }
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .hero-section,
  .hero-value,
  .flame {
    animation: none;
  }
}
</style>
