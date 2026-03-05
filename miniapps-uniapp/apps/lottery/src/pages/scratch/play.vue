<template>
  <ResponsiveLayout :desktop-breakpoint="1024" :title="t('scratchPlayTitle')" class="theme-chinese-lucky">
    <view class="scratch-play">
      <!-- Lottery Info -->
      <view class="lottery-info" v-if="currentLottery">
        <text class="lottery-name">{{ currentLottery.name }}</text>
        <text class="lottery-price">{{ currentLottery.priceDisplay }}</text>
      </view>

      <!-- Scratch Card Area -->
      <view class="scratch-area">
        <canvas
          canvas-id="scratchCanvas"
          class="scratch-canvas"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        />
        <view class="prize-layer" :class="{ revealed: isRevealed }">
          <text class="prize-amount" v-if="prize > 0">
            {{ t("scratchWinInline", { amount: formatPrize(prize) }) }}
          </text>
          <text class="no-prize" v-else>
            {{ t("scratchNoPrize") }}
          </text>
        </view>
      </view>

      <!-- Action Buttons -->
      <view class="actions">
        <button class="btn-buy" @click="buyTicket" :disabled="isLoading || hasTicket">
          {{ isLoading ? t("processing") : t("buyTicket") }}
        </button>
        <button class="btn-reveal" @click="revealAll" v-if="hasTicket && !isRevealed" :disabled="isLoading">
          {{ t("scratchRevealAll") }}
        </button>
      </view>

      <!-- Status Message -->
      <view class="status-message" v-if="status" :class="`status-message--${status.type}`">
        <text>{{ status.msg }}</text>
      </view>

      <!-- Prize Tiers -->
      <view class="prize-tiers">
        <text class="tiers-title">{{ t("prizeTiers") }}</text>
        <view class="tier-list">
          <view v-for="tier in PRIZE_TIERS" :key="tier.tier" class="tier-item">
            <text class="tier-label">{{ getPrizeTierLabel(tier.tier) }}</text>
            <text class="tier-odds">{{ tier.odds }}%</text>
            <text class="tier-prize">{{ tier.multiplier }}x</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Win Celebration Overlay -->
    <ChineseLuckyOverlay :visible="showWinOverlay" :prize="prize" :tier="prizeTier" @close="showWinOverlay = false" />
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useLotteryTypes, LotteryType, PRIZE_TIERS } from "../../shared/composables/useLotteryTypes";
import { useScratchCard } from "../../shared/composables/useScratchCard";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import ChineseLuckyOverlay from "./components/ChineseLuckyOverlay.vue";
import { useI18n } from "../../composables/useI18n";

const props = defineProps<{
  type?: string;
  ticketId?: string;
}>();

const { t } = useI18n();
const { getLotteryType } = useLotteryTypes();
const {
  isLoading,
  buyTicket: sdkBuyTicket,
  revealTicket: sdkRevealTicket,
  formatPrize,
  getPrizeTierLabel,
} = useScratchCard();

// Local state
const hasTicket = ref(false);
const isRevealed = ref(false);
const prize = ref(0);
const prizeTier = ref(0);
const currentTicketId = ref<string | null>(null);
const scratchProgress = ref(0);
const { status, setStatus } = useStatusMessage();
const showWinOverlay = ref(false);

const currentLottery = computed(() => {
  const typeNum = parseInt(props.type || "0");
  return getLotteryType(typeNum as LotteryType);
});

const getScratchCoating = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return "#c0c0c0";
  const value = getComputedStyle(document.documentElement).getPropertyValue("--lucky-scratch-coating").trim();
  return value || "#c0c0c0";
};

const buyTicket = async () => {
  if (!currentLottery.value) return;

  setStatus(t("scratchBuying"), "loading");
  try {
    const result = await sdkBuyTicket(currentLottery.value.type);
    currentTicketId.value = result.ticketId;
    hasTicket.value = true;
    setStatus(t("scratchBought"), "success");
    initCanvas();
  } catch (e: unknown) {
    setStatus(formatErrorMessage(e, t("scratchBuyFailed", { error: "" })), "error");
  }
};

const revealAll = async () => {
  if (!currentTicketId.value) return;

  setStatus(t("scratchRevealing"), "loading");
  try {
    const result = await sdkRevealTicket(currentTicketId.value);
    isRevealed.value = true;
    prize.value = result.prize;
    prizeTier.value = result.tier || 0;

    if (result.isWinner) {
      setStatus(t("scratchWinStatus", { amount: formatPrize(result.prize) }), "success");
      showWinOverlay.value = true;
    } else {
      setStatus(t("scratchTryAgain"), "info");
    }
  } catch (e: unknown) {
    setStatus(formatErrorMessage(e, t("scratchRevealFailed", { error: "" })), "error");
  }
};

let ctx: ReturnType<typeof uni.createCanvasContext> | null = null;
const initCanvas = () => {
  ctx = uni.createCanvasContext("scratchCanvas");
  ctx.setFillStyle(getScratchCoating());
  ctx.fillRect(0, 0, 300, 200);
  ctx.draw();
};

const onTouchStart = (e: Record<string, unknown>) => {
  if (!hasTicket.value || isRevealed.value) return;
};

const onTouchMove = async (e: Record<string, unknown>) => {
  if (!ctx || !hasTicket.value || isRevealed.value) return;
  const touch = e.touches[0];
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(touch.x, touch.y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.draw(true);
  scratchProgress.value += 1;

  // Auto-reveal when scratched enough
  if (scratchProgress.value > 50 && currentTicketId.value) {
    await revealAll();
  }
};

const onTouchEnd = () => {};

onMounted(() => {
  if (props.ticketId) {
    hasTicket.value = true;
    initCanvas();
  }
});
</script>

<style lang="scss" scoped>
@import "../../shared/styles/chinese-lucky.scss";

.scratch-play {
  padding: 20rpx;
  min-height: 100vh;
  background: var(--bg-primary);
}

.lottery-info {
  text-align: center;
  padding: 30rpx;
  .lottery-name {
    display: block;
    font-size: 40rpx;
    color: var(--lucky-gold-text);
    font-weight: bold;
  }
  .lottery-price {
    color: var(--text-muted);
  }
}

.scratch-area {
  position: relative;
  width: 600rpx;
  height: 400rpx;
  margin: 40rpx auto;
  border: 4rpx solid var(--lucky-gold);
  border-radius: 16rpx;
  overflow: hidden;
}

.scratch-canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 2;
}

.prize-layer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--lucky-red), var(--lucky-crimson));

  .prize-amount {
    font-size: 48rpx;
    color: var(--lucky-gold-light);
    font-weight: bold;
  }
  .no-prize {
    font-size: 36rpx;
    color: var(--button-on-accent);
  }
}

.actions {
  display: flex;
  gap: 20rpx;
  padding: 40rpx;
  justify-content: center;
}

.btn-buy,
.btn-reveal {
  padding: 24rpx 48rpx;
  border-radius: 12rpx;
  font-size: 32rpx;
  font-weight: bold;
}

.btn-buy {
  background: linear-gradient(135deg, var(--lucky-gold), var(--lucky-gold-light));
  color: var(--button-on-warning);
}

.btn-reveal {
  background: linear-gradient(135deg, var(--lucky-red), var(--lucky-crimson));
  color: var(--button-on-accent);
}

.status-message {
  text-align: center;
  padding: 20rpx;
  color: var(--lucky-gold-text);
  font-size: 28rpx;
}

.prize-tiers {
  padding: 30rpx;
  .tiers-title {
    display: block;
    font-size: 32rpx;
    color: var(--lucky-gold-text);
    margin-bottom: 20rpx;
  }
}

.tier-list {
  background: var(--bg-card);
  border-radius: 12rpx;
  padding: 20rpx;
}

.tier-item {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--lucky-gold-soft);
  &:last-child {
    border: none;
  }

  .tier-label {
    color: var(--text-primary);
  }
  .tier-odds {
    color: var(--text-muted);
  }
  .tier-prize {
    color: var(--lucky-gold-text);
    font-weight: bold;
  }
}
</style>
