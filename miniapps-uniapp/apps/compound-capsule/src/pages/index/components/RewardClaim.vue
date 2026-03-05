<template>
  <NeoCard variant="erobo-neo" class="position-card">
    <view class="position-stats">
      <view class="position-row primary">
        <text class="label">{{ t("deposited") }}</text>
        <text class="value">{{ fmt(position.deposited, 0) }} NEO</text>
      </view>
      <view class="position-row earned">
        <text class="label">{{ t("earned") }}</text>
        <text class="value growth">+{{ fmt(position.earned, 4) }} GAS</text>
      </view>
      <view class="position-row projection">
        <text class="label">{{ t("capsulesCount") }}</text>
        <text class="value">{{ position.capsules }}</text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { formatNumber } from "@shared/utils/format";

const props = defineProps<{
  position: {
    deposited: number;
    earned: number;
    capsules: number;
  };
}>();

const { t } = createUseI18n(messages)();
const fmt = (n: number, d = 2) => formatNumber(n, d);
</script>
