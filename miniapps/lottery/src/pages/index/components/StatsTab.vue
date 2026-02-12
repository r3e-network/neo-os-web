<template>
  <view>
    <view class="stats-grid mb-6 grid grid-cols-2 gap-4">
      <NeoCard variant="erobo-neo" class="stat-box text-center">
        <text class="mb-1 block text-2xl font-bold">{{ totalTickets }}</text>
        <text class="block text-xs opacity-60">{{ t("totalTickets") }}</text>
      </NeoCard>
      <NeoCard variant="erobo" class="stat-box text-center">
        <text class="text-gold mb-1 block text-2xl font-bold">{{ formatNum(prizePool) }}</text>
        <text class="block text-xs opacity-60">{{ t("totalPaidOut") }}</text>
      </NeoCard>
    </view>

    <NeoCard variant="erobo" class="p-4">
      <text class="section-title mb-4 block border-b border-white/10 pb-2 font-bold">{{ t("yourStats") }}</text>
      <view class="mb-2 flex justify-between">
        <text class="opacity-80">{{ t("ticketsBought") }}</text>
        <text class="font-bold">{{ userTickets }}</text>
      </view>
      <view class="flex justify-between">
        <text class="opacity-80">{{ t("totalWinnings") }}</text>
        <text class="font-bold text-green-400">{{ formatNum(userWinnings) }} GAS</text>
      </view>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  totalTickets: string | number;
  prizePool: string | number;
  userTickets: number;
  userWinnings: number;
  formatNum: (n: number | string) => string;
  t: (key: string) => string;
}>();
</script>
