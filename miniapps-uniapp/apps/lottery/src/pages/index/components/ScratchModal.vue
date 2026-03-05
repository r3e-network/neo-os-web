<template>
  <ActionModal :visible="isOpen" :title="typeInfo.name" :closeable="!revealing" size="md" @close="handleClose">
    <view class="scratch-card-area">
      <!-- Result Layer (Underneath) -->
      <view class="result-layer">
        <view v-if="revealing" class="revealing-spinner">
          <AppIcon name="loader" size="32" class="animate-spin" />
          <text class="text-gold mt-2">{{ t("revealing") }}</text>
        </view>

        <view v-else-if="result" class="result-content" aria-live="assertive">
          <template v-if="result.isWinner">
            <text class="win-icon" aria-hidden="true">🎉</text>
            <text class="win-amount">{{ formatNum(result.prize) }} GAS</text>
            <text class="win-label">{{ t("youWon") }}</text>
          </template>
          <template v-else>
            <text class="lose-icon" aria-hidden="true">😢</text>
            <text class="lose-label">{{ t("betterLuck") }}</text>
          </template>
        </view>
      </view>

      <!-- Scratch Layer (Cover) -->
      <view
        v-if="!isRevealed"
        class="scratch-cover"
        :class="{ scratching: isScratching }"
        role="button"
        tabindex="0"
        :aria-label="t('clickToScratch')"
        @click="scratch"
      >
        <text class="scratch-hint">{{ t("clickToScratch") }}</text>
        <text class="scratch-price">{{ typeInfo.priceDisplay }}</text>
      </view>
    </view>

    <template #actions>
      <view class="modal-actions">
        <NeoButton v-if="!isRevealed" variant="primary" block size="lg" :loading="revealing" @click="scratch">
          {{ t("scratchNow") }}
        </NeoButton>
        <NeoButton v-else variant="secondary" block size="lg" @click="handleClose">
          {{ t("close") }}
        </NeoButton>
      </view>
    </template>
  </ActionModal>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { ActionModal, AppIcon } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
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

const { t } = createUseI18n(messages)();

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

.scratch-card-area {
  position: relative;
  height: 240px;
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
    transform 0.5s ease-out;
  cursor: pointer;

  &.scratching {
    opacity: 0;
    transform: scale(1.1);
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

.modal-actions {
  width: 100%;
}
</style>
