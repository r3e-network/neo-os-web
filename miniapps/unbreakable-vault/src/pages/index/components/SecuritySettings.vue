<template>
  <view class="input-group">
    <text class="input-label">{{ t("difficultyLabel") }}</text>
    <view class="difficulty-actions">
      <NeoButton
        v-for="level in [1, 2, 3]"
        :key="level"
        size="sm"
        :variant="difficulty === level ? 'primary' : 'secondary'"
        @click="$emit('update:difficulty', level)"
      >
        {{ t(`difficulty${['Easy', 'Medium', 'Hard'][level - 1]}`) }}
      </NeoButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";

defineProps<{
  t: (key: string) => string;
  difficulty: number;
}>();

defineEmits<{
  (e: "update:difficulty", value: number): void;
}>();
</script>

<style lang="scss" scoped>
.input-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.input-label {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  margin-left: 4px;
  letter-spacing: 0.05em;
}
.difficulty-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.difficulty-actions :deep(.neo-button) {
  flex: 1;
  min-width: 80px;
}
</style>
