<template>
  <NeoCard variant="erobo">
    <!--
      ItemList expects Record<string, unknown>[] but we have EnvelopeItem[].
      The double-cast is needed because ItemList is not generically typed.
      The inner cast 'as unknown' is necessary to go from EnvelopeItem[] to unknown first.
    -->
    <ItemList
      :items="(envelopes as unknown) as Record<string, unknown>[]"
      item-key="id"
      :loading="loadingEnvelopes"
      :loading-text="t('loadingEnvelopes')"
      :empty-text="t('noEnvelopes')"
      :aria-label="t('ariaEnvelopes')"
    >
      <template #empty>
        <div class="empty-state">{{ t("noEnvelopes") }}</div>
      </template>
      <template #item="{ item }">
        <button
          type="button"
          class="glass-envelope"
          :class="{ disabled: !(item as unknown as EnvelopeItem).canClaim }"
          :aria-label="`${(item as unknown as EnvelopeItem).name || (item as unknown as EnvelopeItem).from} - ${(item as unknown as EnvelopeItem).totalAmount.toFixed(2)} ${t('tokenGas')}`"
          @click="$emit('claim', item as EnvelopeItem)"
        >
          <div class="envelope-content">
            <div class="envelope-icon">
              <span class="envelope-symbol">福</span>
            </div>
            <div class="envelope-info">
              <span v-if="(item as unknown as EnvelopeItem).name" class="envelope-name">{{
                (item as unknown as EnvelopeItem).name
              }}</span>
              <span class="envelope-from">{{ (item as unknown as EnvelopeItem).from }}</span>
              <span class="envelope-detail">
                {{
                  t("remaining", { remaining: String((item as unknown as EnvelopeItem).remaining), total: String((item as unknown as EnvelopeItem).total) })
                }}
                · {{ (item as unknown as EnvelopeItem).totalAmount.toFixed(2) }} {{ t("tokenGas") }}
              </span>
              <div
                v-if="
                  (item as unknown as EnvelopeItem).bestLuckAddress && (item as unknown as EnvelopeItem).bestLuckAmount
                "
                class="best-luck"
              >
                <AppIcon name="party" :size="12" class="best-luck-icon" />
                <span class="best-luck-text"
                  >{{ t("bestLuck") }}: {{ formatAddress((item as unknown as EnvelopeItem).bestLuckAddress!) }} ({{
                    ((item as unknown as EnvelopeItem).bestLuckAmount! / 1e8).toFixed(4)
                  }}
                  {{ t("tokenGas") }})</span
          >
              </div>
            </div>
            <div class="envelope-status">
              <span
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
              </span>
              <button type="button" class="share-btn" :aria-label="t('ariaShare')" @click.stop="$emit('share', item)">
                <AppIcon name="link" :size="14" />
              </button>
            </div>
          </div>
        </button>
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import { AppIcon, NeoCard, ItemList } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { formatAddress } from "@shared/utils/format";
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

defineEmits<{
  (e: "claim", item: EnvelopeItem): void;
  (e: "share", item: EnvelopeItem): void;
}>();
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
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  border: none;
  appearance: none;
  width: 100%;
  text-align: left;

  &:hover:not(.disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
    border-color: var(--red-envelope-gold-border);
  }

  &.disabled,
  &:disabled {
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
    background: var(--badge-expired-bg, rgba(255, 255, 255, 0.1));
    color: var(--text-disabled, rgba(255, 255, 255, 0.6));
    border: 1px solid var(--badge-expired-border, rgba(255, 255, 255, 0.2));
  }
}

.empty-state {
  text-align: center;
  padding: 40px;
  font-weight: 500;
  font-family: $font-family;
  color: var(--text-secondary);
  border: 1px dashed var(--border-dashed, rgba(255, 255, 255, 0.1));
  border-radius: 16px;
  background: var(--bg-empty, rgba(255, 255, 255, 0.02));
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
  border: none;
  appearance: none;
  padding: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }

  &:focus-visible {
    outline: 2px solid var(--envelope-gold);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(255, 222, 89, 0.15);
  }

  text {
    font-size: 14px;
    filter: grayscale(1) brightness(2);
  }
}
</style>
