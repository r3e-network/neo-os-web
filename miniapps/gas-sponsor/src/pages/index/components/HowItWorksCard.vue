<template>
  <NeoCard variant="default">
    <view class="help-item">
      <text class="help-num">1</text>
      <text class="help-text">{{ t("step1") }}</text>
    </view>
    <view class="help-item">
      <text class="help-num">2</text>
      <text class="help-text">{{ t("step2") }}</text>
    </view>
    <view class="help-item">
      <text class="help-num">3</text>
      <text class="help-text">{{ t("step3") }}</text>
    </view>
    <view class="help-item">
      <text class="help-num">4</text>
      <text class="help-text">{{ t("step4") }}</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  t: (key: string) => string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.help-item { display: flex; align-items: center; gap: $space-3; padding: $space-2 0; }
.help-num {
  width: 24px; height: 24px; background: var(--neo-green); border: 1px solid black;
  display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: $font-weight-black;
}
.help-text { font-size: 10px; font-weight: $font-weight-bold; opacity: 0.8; }
</style>
