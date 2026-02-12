<template>
  <view v-if="isOpen" class="scratch-modal-overlay" @click.self="handleClose">
    <view class="scratch-modal-container" role="dialog" aria-modal="true" :aria-label="typeInfo.name">
      <view class="modal-header">
        <text class="modal-title">{{ typeInfo.name }}</text>
        <view class="close-btn" role="button" tabindex="0" :aria-label="t('close')" @click="handleClose">×</view>
      </view>

      <view class="scratch-card-area">
        <!-- Result Layer (Underneath) -->
        <view class="result-layer">
          <view v-if="revealing" class="revealing-spinner">
            <AppIcon name="loader" size="32" class="animate-spin" />
            <text class="text-gold mt-2">{{ t("revealing") }}</text>
          </view>

          <view v-else-if="result" class="result-content">
            <template v-if="result.isWinner">
              <text class="win-icon">🎉</text>
              <text class="win-amount">{{ formatNum(result.prize) }} GAS</text>
              <text class="win-label">{{ t("youWon") }}</text>
            </template>
            <template v-else>
              <text class="lose-icon">😢</text>
              <text class="lose-label">{{ t("betterLuck") }}</text>
            </template>
          </view>
        </view>

        <!-- Scratch Layer (Cover) -->
        <view v-if="!isRevealed" class="scratch-cover" :class="{ scratching: isScratching }" role="button" tabindex="0" :aria-label="t('clickToScratch')" @click="scratch">
          <text class="scratch-hint">{{ t("clickToScratch") }}</text>
          <text class="scratch-price">{{ typeInfo.priceDisplay }}</text>
        </view>
      </view>

      <view class="modal-footer">
        <NeoButton v-if="!isRevealed" variant="primary" block size="lg" :loading="revealing" @click="scratch">
          {{ t("scratchNow") }}
        </NeoButton>
        <NeoButton v-else variant="secondary" block size="lg" @click="handleClose">
          {{ t("close") }}
        </NeoButton>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { AppIcon, NeoButton } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import type { LotteryTypeInfo } from "../../../shared/composables/useLotteryTypes";
import { formatNumber } from "@shared/utils/format";

const props = defineProps<{
  isOpen: boolean;
  typeInfo: LotteryTypeInfo;
  ticketId: string | null;
  onReveal: (id: string) => Promise<{ isWinner: boolean; prize: number }>;
}>();

const emit = defineEmits(["close"]);

const isScratching = ref(false);
const isRevealed = ref(false);
const revealing = ref(false);
const result = ref<{ isWinner: boolean; prize: number } | null>(null);

const { t } = useI18n();

const formatNum = (n: number) => formatNumber(n, 2);

let scratchTimer: ReturnType<typeof setTimeout> | null = null;

onUnmounted(() => {
  if (scratchTimer) {
    clearTimeout(scratchTimer);
    scratchTimer = null;
  }
});

const scratch = async () => {
  if (revealing.value || isRevealed.value || !props.ticketId) return;

  isScratching.value = true;
  revealing.value = true;
  isRevealed.value = true; // Immediately hide cover to show spinner

  // Simulate scratch delay
  scratchTimer = setTimeout(async () => {
    scratchTimer = null;
    try {
      const res = await props.onReveal(props.ticketId!);
      result.value = res;
    } catch (_e: unknown) {
      // Reset if error
      isRevealed.value = false;
    } finally {
      revealing.value = false;
      isScratching.value = false;
    }
  }, 800);
};

const handleClose = () => {
  if (revealing.value) return;
  emit("close");
  // Reset for next time (though typically this modal is unmounted)
  isRevealed.value = false;
  result.value = null;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.scratch-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--modal-overlay, rgba(0, 0, 0, 0.85));
  backdrop-filter: blur(8px);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.scratch-modal-container {
  width: 100%;
  max-width: 360px;
  background: linear-gradient(145deg, var(--bg-elevated), var(--bg-primary));
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 20px 40px var(--shadow-color);
  overflow: hidden;
  animation: modal-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modal-pop {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.modal-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);

  .modal-title {
    font-size: 18px;
    font-weight: bold;
    color: var(--text-primary);
  }

  .close-btn {
    font-size: 24px;
    color: var(--text-muted);
    padding: 0 8px;
  }
}

.scratch-card-area {
  position: relative;
  height: 240px;
  margin: 20px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-secondary);
  border: 2px dashed var(--border-color);
}

.result-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, var(--bg-elevated) 0%, var(--bg-primary) 100%);
  z-index: 1;
}

.result-content {
  display: flex;
  flex-direction: column;
  align-items: center;

  .win-icon {
    font-size: 48px;
    margin-bottom: 8px;
  }
  .lose-icon {
    font-size: 48px;
    margin-bottom: 8px;
  }

  .win-amount {
    font-size: 32px;
    font-weight: 800;
    color: var(--lottery-win-color);
    text-shadow: 0 0 20px var(--lottery-win-glow);
  }

  .win-label {
    font-size: 14px;
    letter-spacing: 2px;
    color: var(--text-primary);
    margin-top: 8px;
    font-weight: bold;
  }

  .lose-label {
    font-size: 14px;
    color: var(--text-muted);
  }
}

.scratch-cover {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    135deg,
    var(--scratch-cover-start) 0%,
    var(--scratch-cover-mid) 50%,
    var(--scratch-cover-start) 100%
  );
  // Hexagonal/Tech pattern for E-Robo feel
  background-image:
    linear-gradient(
      135deg,
      var(--scratch-cover-start) 0%,
      var(--scratch-cover-mid) 50%,
      var(--scratch-cover-start) 100%
    ),
    radial-gradient(circle at 1px 1px, var(--scratch-cover-dot) 1px, transparent 0);
  background-size:
    100% 100%,
    10px 10px;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition:
    opacity 0.5s ease-out,
    transform 0.5s ease-out; // Smoother fade
  cursor: pointer;

  &.scratching {
    opacity: 0;
    transform: scale(1.1); // Slight expansion when revealed
    pointer-events: none;
  }

  .scratch-hint {
    font-size: 14px;
    font-weight: bold;
    color: var(--scratch-cover-text);
    letter-spacing: 2px;
    margin-bottom: 8px;
    text-shadow: 0 1px 0 var(--scratch-cover-shadow);
  }

  .scratch-price {
    font-size: 24px;
    font-weight: 800;
    color: var(--scratch-cover-strong);
    text-shadow: 0 1px 0 var(--scratch-cover-shadow);
  }
}

.revealing-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.text-gold {
  color: var(--erobo-peach);
}

.modal-footer {
  padding: 16px;
  background: var(--bg-secondary);
}
</style>
