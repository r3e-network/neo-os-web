<template>
  <NeoCard variant="erobo-neo" class="position-card">
    <div class="position-stats">
      <div class="position-row primary">
        <span class="label">{{ t("deposited") }}</span>
        <span class="value">{{ fmt(position.deposited, 0) }} NEO</span>
      </div>
      <div class="position-row earned">
        <span class="label">{{ t("earned") }}</span>
        <span class="value growth">+{{ fmt(position.earned, 4) }} GAS</span>
      </div>
      <div class="position-row projection">
        <span class="label">{{ t("capsulesCount") }}</span>
        <span class="value">{{ position.capsules }}</span>
      </div>
    </div>
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
