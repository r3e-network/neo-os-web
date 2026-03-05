<template>
  <view class="grid-layout px-1">
    <view
      v-for="game in instantTypes"
      :key="game.key"
      class="game-card group relative flex h-full flex-col overflow-hidden rounded-2xl p-4"
      :class="[`card-${game.key.replace('neo-', '')}`]"
    >
      <!-- Shiny Animated Layer -->
      <view class="shine-effect pointer-events-none absolute inset-0 z-0" />

      <view class="game-header relative z-10 mb-1 text-center">
        <text class="game-title text-sm font-black tracking-tighter text-white uppercase decoration-2 opacity-80">
          {{ game.name }}
        </text>
        <view class="mt-1 flex justify-center">
          <text
            class="game-price-tag rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] font-bold tracking-widest text-white/90 uppercase"
          >
            {{ game.priceDisplay }}
          </text>
        </view>
      </view>

      <!-- Premium Ticket Visual Area -->
      <view class="game-visual relative my-3 flex h-32 items-center justify-center">
        <!-- Pulsing Glow behind icon -->
        <view
          class="pulsar absolute h-20 w-20 rounded-full opacity-60 blur-3xl"
          :style="{ backgroundColor: game.color }"
        />

        <view
          class="relative z-10 flex transform flex-col items-center transition-all duration-300 group-hover:scale-110"
        >
          <AppIcon name="ticket" :size="56" class="ticket-icon mb-1" />
          <text class="text-[9px] font-black tracking-[0.2em] text-white/40 uppercase">PREMIUM</text>
        </view>
      </view>

      <view class="game-stats relative z-10 mt-auto mb-5 text-center">
        <text class="mb-1 block text-[10px] font-bold tracking-[0.1em] text-white uppercase opacity-70"> >JACKPOT</text>
        <text class="glow-text block text-3xl leading-none font-black text-white italic">
          {{ game.maxJackpotDisplay.split(" ")[0] }}
          <text class="ml-1 text-xs italic opacity-70">GAS</text>
        </text>
      </view>

      <NeoButton
        class="buy-button relative z-10 w-full"
        variant="primary"
        :loading="isLoading && buyingType === game.type"
        :disabled="isLoading || !isConnected"
        @click="$emit('buy', game)"
      >
        <view class="flex items-center gap-2">
          <text class="text-xs font-black uppercase italic">{{ t("buyTicket") }}</text>
          <AppIcon name="arrow-right" :size="14" />
        </view>
      </NeoButton>

      <view class="mt-3 flex min-h-[32px] items-center justify-center">
        <text class="px-2 text-center text-[10px] leading-tight font-medium text-white opacity-60">
          {{ game.description }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoButton, AppIcon } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { LotteryTypeInfo } from "../../../shared/composables/useLotteryTypes";

const { t } = createUseI18n(messages)();

defineProps<{
  instantTypes: LotteryTypeInfo[];
  isLoading: boolean;
  buyingType: number | null;
  isConnected: boolean;
}>();

defineEmits<{
  buy: [game: LotteryTypeInfo];
}>();
</script>

<style lang="scss" scoped>
.grid-layout {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 20px;
  padding-bottom: 30px;
}

.game-card {
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--lottery-card-shadow);
  border: 1px solid var(--lottery-card-border);
}

.game-card:hover {
  transform: translateY(-5px) scale(1.02);
  box-shadow: var(--lottery-card-shadow-hover);
  border: 1px solid var(--lottery-card-border-hover);
}

/* Tier Specific Styling */
.card-bronze {
  background: var(--lottery-bronze-bg);
  box-shadow: var(--lottery-bronze-shadow);
}
.card-silver {
  background: var(--lottery-silver-bg);
  box-shadow: var(--lottery-silver-shadow);
}
.card-gold {
  background: var(--lottery-gold-bg);
  box-shadow: var(--lottery-gold-shadow);
  border: 1px solid var(--lottery-gold-border);
}
.card-platinum {
  background: var(--lottery-platinum-bg);
  box-shadow: var(--lottery-platinum-shadow);
  border: 1px solid var(--lottery-platinum-border);
}
.card-diamond {
  background: var(--lottery-diamond-bg);
  box-shadow: var(--lottery-diamond-shadow);
  border: 1px solid var(--lottery-diamond-border);
}

/* Visual Effects */
.shine-effect {
  background: var(--lottery-shine-gradient);
  background-size: 250% 250%;
  animation: shine 6s infinite linear;
}

@keyframes shine {
  0% {
    background-position: 200% 200%;
  }
  100% {
    background-position: -200% -200%;
  }
}

.pulsar {
  animation: pulse 4s infinite ease-in-out;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

.buy-button {
  background: var(--lottery-buy-bg);
  border: 1px solid var(--lottery-buy-border);
  backdrop-filter: blur(10px);
  height: 44px;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.buy-button:active {
  background: var(--lottery-buy-bg-active);
  transform: translateY(2px);
}

.card-gold .buy-button {
  border-color: var(--lottery-buy-border-gold);
}
.card-platinum .buy-button {
  border-color: var(--lottery-buy-border-platinum);
}
.card-diamond .buy-button {
  border-color: var(--lottery-buy-border-diamond);
  font-size: 14px;
}

.glow-text {
  text-shadow: var(--lottery-glow-text);
  letter-spacing: -1px;
}

.ticket-icon {
  color: var(--lottery-ticket-icon);
  filter: var(--lottery-ticket-shadow);
}
</style>
