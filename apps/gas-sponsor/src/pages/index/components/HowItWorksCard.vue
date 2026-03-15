<template>
  <NeoCard variant="default">
    <div class="help-item">
      <span class="help-num">1</span>
      <span class="help-text">{{ t("step1") }}</span>
    </div>
    <div class="help-item">
      <span class="help-num">2</span>
      <span class="help-text">{{ t("step2") }}</span>
    </div>
    <div class="help-item">
      <span class="help-num">3</span>
      <span class="help-text">{{ t("step3") }}</span>
    </div>
    <div class="help-item">
      <span class="help-num">4</span>
      <span class="help-text">{{ t("step4") }}</span>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.help-item {
  display: flex;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-2 0;
}
.help-num {
  width: 24px;
  height: 24px;
  background: var(--neo-green);
  border: 1px solid black;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: $font-weight-black;
}
.help-text {
  font-size: 10px;
  font-weight: $font-weight-bold;
  opacity: 0.8;
}
</style>
