<template>
  <NeoCard variant="erobo">
    <div class="winners-list">
      <span v-if="winners.length === 0" class="empty-text text-glass py-8 text-center">{{ t("noWinners") }}</span>
      <div
        v-for="(w, i) in winners"
        :key="i"
        class="winner-item glass-panel mb-2 flex items-center justify-between rounded-lg bg-white/5 p-3"
      >
        <div class="flex items-center gap-3">
          <div class="winner-medal flex h-8 w-8 items-center justify-center rounded-full bg-black/20">
            <span>{{
              i === 0 ? "\uD83E\uDD47" : i === 1 ? "\uD83E\uDD48" : i === 2 ? "\uD83E\uDD49" : "\uD83C\uDF96\uFE0F"
            }}</span>
          </div>
          <div>
            <span class="block text-sm font-bold">{{ formatAddress(w.address) }}</span>
            <span class="block text-xs opacity-60">{{ t("roundLabel", { round: w.round }) }}</span>
          </div>
        </div>
        <span class="font-bold text-green-400">{{ formatNum(w.prize) }} GAS</span>
      </div>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { formatAddress } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

defineProps<{
  winners: Array<{ address: string; round: number; prize: number }>;
  formatNum: (n: number | string) => string;
}>();
</script>
