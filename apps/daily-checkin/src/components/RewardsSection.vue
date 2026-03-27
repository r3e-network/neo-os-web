<template>
  <!-- Reward Milestones -->
  <NeoCard variant="erobo-neo" class="milestones-card">
    <div class="milestones-row">
      <div
        v-for="milestone in MILESTONES"
        :key="milestone.day"
        class="milestone"
        :class="{
          reached: currentStreak >= milestone.day,
          next: currentStreak < milestone.day && currentStreak >= milestone.day - 7,
        }"
      >
        <div class="milestone-icon">
          <AppIcon
            :name="currentStreak >= milestone.day ? 'check' : 'milestone'"
            :size="24"
            aria-hidden="true"
          />
        </div>
        <span class="milestone-day">{{ t("day") }} {{ milestone.day }}</span>
        <span class="milestone-reward">+{{ milestone.reward }} {{ t("tokenGas") }}</span>
        <span class="milestone-cumulative">({{ milestone.cumulative }} {{ t("total") }})</span>
      </div>
    </div>
  </NeoCard>

  <!-- Rewards Claim (only shown when there are unclaimed rewards) -->
  <NeoCard v-if="unclaimedRewards > 0" variant="erobo" class="rewards-card">
    <div class="rewards-grid">
      <div class="reward-item">
        <span class="reward-value">{{ formatGas(unclaimedRewards) }}</span>
        <span class="reward-label">{{ t("unclaimed") }}</span>
      </div>
      <div class="reward-item">
        <span class="reward-value">{{ formatGas(totalClaimed) }}</span>
        <span class="reward-label">{{ t("totalClaimed") }}</span>
      </div>
    </div>
    <NeoButton
      variant="success"
      size="md"
      block
      type="button"
      :loading="isClaiming"
      class="claim-btn"
      @click="handleClaim"
    >
      {{ t("claimRewards") }} ({{ formatGas(unclaimedRewards) }} {{ t("tokenGas") }})
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { AppIcon, NeoCard, NeoButton } from "@shared/components";
import { formatGas } from "@shared/utils/format";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import { MILESTONES } from "../composables/useCheckin";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  currentStreak: number;
  unclaimedRewards: number;
  totalClaimed: number;
  isClaiming: boolean;
}>();

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleClaim = async () => {
  const handler = actions.get("claimRewards");
  if (handler) await handler();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.milestones-card {
  width: 100%;
  max-width: 400px;
}

.milestones-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.milestone {
  @include card-base(12px, 12px);
  flex: 1;
  text-align: center;
  opacity: 0.5;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;

  &.reached {
    opacity: 1;
    background: rgba(0, 229, 153, 0.1);
    border-color: rgba(0, 229, 153, 0.2);
    box-shadow: 0 0 10px rgba(0, 229, 153, 0.1);
  }

  &.next {
    opacity: 1;
    background: rgba(255, 222, 89, 0.05);
    border-color: rgba(255, 222, 89, 0.2);
    box-shadow: 0 0 15px rgba(255, 222, 89, 0.05);
  }
}

.milestone-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.milestone-day {
  @include stat-label;
  display: block;
  font-size: 10px;
}

.milestone-reward {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 4px 0;
  font-family: $font-family;
}

.milestone-cumulative {
  display: block;
  font-size: 10px;
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
}

/* ── Rewards Claim ── */
.rewards-card {
  width: 100%;
  max-width: 400px;
}

.rewards-grid {
  @include grid-layout(2, 16px);
}

.reward-item {
  @include card-base(12px, 16px);
  text-align: center;
}

.reward-value {
  @include stat-value;
  font-size: 24px;
  color: var(--sunrise-reward);
  text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
  margin-bottom: 4px;
}

.reward-label {
  @include stat-label;
  display: block;
  font-weight: 600;
}

.claim-btn {
  margin-top: 16px;
}

@media (prefers-reduced-motion: reduce) {
  .milestone {
    animation: none;
    transition: none;
  }
}
</style>
