<template>
  <NeoCard variant="erobo-neo" class="reward-card">
    <view class="reward-milestones">
      <view
        v-for="milestone in milestones"
        :key="milestone.day"
        class="milestone"
        :class="{
          reached: currentStreak >= milestone.day,
          next: currentStreak < milestone.day && currentStreak >= milestone.day - 7,
        }"
      >
        <view class="milestone-icon">
          <text>{{ currentStreak >= milestone.day ? "✅" : "🎯" }}</text>
        </view>
        <text class="milestone-day">{{ t("day") }} {{ milestone.day }}</text>
        <text class="milestone-reward">+{{ milestone.reward }} GAS</text>
        <text class="milestone-cumulative">({{ milestone.cumulative }} {{ t("total") }})</text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

defineProps<{
  milestones: Array<{ day: number; reward: number; cumulative: number }>;
  currentStreak: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.reward-milestones { display: flex; justify-content: space-between; gap: 12px; }

.milestone {
  flex: 1;
  text-align: center;
  padding: 12px;
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: 12px;
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

.milestone-icon { font-size: 24px; margin-bottom: 8px; }

.milestone-day {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
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
</style>
