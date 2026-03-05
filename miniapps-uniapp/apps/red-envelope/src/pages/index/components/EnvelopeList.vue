<template>
  <NeoCard variant="erobo">
    <ItemList
      :items="envelopes as unknown as Record<string, unknown>[]"
      item-key="id"
      :loading="loadingEnvelopes"
      :loading-text="t('loadingEnvelopes')"
      :empty-text="t('noEnvelopes')"
      :aria-label="t('ariaEnvelopes')"
    >
      <template #empty>
        <view class="empty-state">{{ t("noEnvelopes") }}</view>
      </template>
      <template #item="{ item }">
        <view
          class="glass-envelope"
          :class="{ disabled: !(item as unknown as EnvelopeItem).canClaim }"
          role="button"
          :aria-label="`${(item as unknown as EnvelopeItem).name || (item as unknown as EnvelopeItem).from} - ${(item as unknown as EnvelopeItem).totalAmount.toFixed(2)} GAS`"
          @click="$emit('claim', item)"
        >
          <view class="envelope-content">
            <view class="envelope-icon">
              <text class="envelope-symbol">福</text>
            </view>
            <view class="envelope-info">
              <text v-if="(item as unknown as EnvelopeItem).name" class="envelope-name">{{
                (item as unknown as EnvelopeItem).name
              }}</text>
              <text class="envelope-from">{{ (item as unknown as EnvelopeItem).from }}</text>
              <text class="envelope-detail">
                {{
                  t("remaining")
                    .replace("{0}", String((item as unknown as EnvelopeItem).remaining))
                    .replace("{1}", String((item as unknown as EnvelopeItem).total))
                }}
                · {{ (item as unknown as EnvelopeItem).totalAmount.toFixed(2) }} GAS
              </text>
              <view
                v-if="
                  (item as unknown as EnvelopeItem).bestLuckAddress && (item as unknown as EnvelopeItem).bestLuckAmount
                "
                class="best-luck"
              >
                <text class="best-luck-icon">🎉</text>
                <text class="best-luck-text"
                  >{{ t("bestLuck") }}: {{ formatAddress((item as unknown as EnvelopeItem).bestLuckAddress!) }} ({{
                    ((item as unknown as EnvelopeItem).bestLuckAmount! / 1e8).toFixed(4)
                  }}
                  GAS)</text
                >
              </view>
            </view>
            <view class="envelope-status">
              <text
                class="status-badge"
                :class="{
                  'status-ready': (item as unknown as EnvelopeItem).canClaim,
                  'status-pending':
                    !(item as unknown as EnvelopeItem).ready && !(item as unknown as EnvelopeItem).expired,
                  'status-expired': (item as unknown as EnvelopeItem).expired,
                }"
              >
                {{
                  (item as unknown as EnvelopeItem).expired
                    ? t("expired")
                    : (item as unknown as EnvelopeItem).ready
                      ? t("ready")
                      : t("notReady")
                }}
              </text>
              <view class="share-btn" role="button" :aria-label="t('ariaShare')" @click.stop="$emit('share', item)">
                <text aria-hidden="true">🔗</text>
              </view>
            </view>
          </view>
        </view>
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, ItemList } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

type EnvelopeItem = {
  id: string;
  creator: string;
  from: string;
  name?: string;
  description?: string;
  total: number;
  remaining: number;
  totalAmount: number;
  bestLuckAddress?: string;
  bestLuckAmount?: number;
  ready: boolean;
  expired: boolean;
  canClaim: boolean;
};

defineProps<{
  envelopes: EnvelopeItem[];
  loadingEnvelopes: boolean;
  openingId: string | null;
}>();

const { t } = createUseI18n(messages)();

defineEmits(["claim", "share"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.envelope-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.glass-envelope {
  background: linear-gradient(135deg, var(--envelope-premium-red-light) 0%, var(--envelope-premium-red-dark) 100%);
  border: 1px solid rgba(255, 230, 230, 0.2);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);

  &:hover:not(.disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
    border-color: var(--red-envelope-gold-border);
  }

  &.disabled {
    opacity: 0.6;
    filter: grayscale(0.8);
    pointer-events: none;
  }
}

.envelope-content {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  position: relative;
  z-index: 2;
}

.envelope-icon {
  width: 48px;
  height: 48px;
  background: var(--envelope-gold);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 2px solid var(--text-primary);
}

.envelope-symbol {
  font-size: 24px;
  font-weight: 700;
  color: var(--envelope-premium-red-dark); /* Red text on gold background */
}

.envelope-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.envelope-from {
  font-family: $font-mono;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  opacity: 0.9;
}

.envelope-detail {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.envelope-name {
  font-size: 16px;
  font-weight: 800;
  color: var(--envelope-gold);
  margin-bottom: 2px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.best-luck {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 4px 8px;
  background: var(--red-envelope-gold-glow);
  border-radius: 6px;
  width: fit-content;
  border: 1px solid var(--red-envelope-gold-border);
}

.best-luck-icon {
  font-size: 12px;
}

.best-luck-text {
  font-size: 10px;
  font-weight: 700;
  color: var(--envelope-gold);
}

.status-badge {
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  border-radius: 100px;
  display: inline-block;
  backdrop-filter: blur(4px);

  &.status-ready {
    background: rgba(46, 204, 113, 0.2);
    color: var(--red-envelope-success);
    border: 1px solid rgba(46, 204, 113, 0.3);
  }

  &.status-pending {
    background: var(--red-envelope-gold-glow);
    color: var(--envelope-gold);
    border: 1px solid var(--red-envelope-gold-border);
  }

  &.status-expired {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
}

.empty-state {
  text-align: center;
  padding: 40px;
  font-weight: 500;
  font-family: $font-family;
  color: var(--text-secondary);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.02);
}

.share-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }

  text {
    font-size: 14px;
    filter: grayscale(1) brightness(2);
  }
}
</style>
