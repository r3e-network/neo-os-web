<template>
  <NeoCard variant="erobo">
    <view v-if="loadingEnvelopes" class="empty-state">{{ t("loadingEnvelopes") }}</view>
    <view v-else-if="!envelopes.length" class="empty-state">{{ t("noEnvelopes") }}</view>
    <view v-else class="envelope-list">
      <view
        v-for="env in envelopes"
        :key="env.id"
        class="glass-envelope"
        :class="{ disabled: !env.canClaim }"
        @click="$emit('claim', env)"
      >
        <view class="envelope-content">
          <view class="envelope-icon">
            <text class="envelope-symbol">福</text>
          </view>
          <view class="envelope-info">
            <text v-if="env.name" class="envelope-name">{{ env.name }}</text>
            <text class="envelope-from">{{ env.from }}</text>
            <text class="envelope-detail">
              {{ t("remaining").replace("{0}", String(env.remaining)).replace("{1}", String(env.total)) }}
              · {{ env.totalAmount.toFixed(2) }} GAS
            </text>
            <view v-if="env.bestLuckAddress && env.bestLuckAmount" class="best-luck">
              <text class="best-luck-icon">🎉</text>
              <text class="best-luck-text"
                >{{ t("bestLuck") }}: {{ formatAddress(env.bestLuckAddress) }} ({{
                  (env.bestLuckAmount / 1e8).toFixed(4)
                }}
                GAS)</text
              >
            </view>
          </view>
          <view class="envelope-status">
            <text
              class="status-badge"
              :class="{
                'status-ready': env.canClaim,
                'status-pending': !env.ready && !env.expired,
                'status-expired': env.expired,
              }"
            >
              {{ env.expired ? t("expired") : env.ready ? t("ready") : t("notReady") }}
            </text>
            <view class="share-btn" @click.stop="$emit('share', env)">
              <text>🔗</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

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
  t: (key: string) => string;
}>();

defineEmits(["claim", "share"]);

const formatAddress = (addr: string): string => {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

$gold: #f1c40f;
$premium-red-light: #e74c3c;
$premium-red-dark: #922b21;

.envelope-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.glass-envelope {
  background: linear-gradient(135deg, $premium-red-light 0%, $premium-red-dark 100%);
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
    border-color: rgba($gold, 0.5);
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
  background: $gold;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  border: 2px solid #fff;
}

.envelope-symbol {
  font-size: 24px;
  font-weight: 700;
  color: $premium-red-dark; /* Red text on gold background */
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
  color: #fff;
  opacity: 0.9;
}

.envelope-detail {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.envelope-name {
  font-size: 16px;
  font-weight: 800;
  color: $gold;
  margin-bottom: 2px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.best-luck {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 4px 8px;
  background: rgba($gold, 0.2);
  border-radius: 6px;
  width: fit-content;
  border: 1px solid rgba($gold, 0.3);
}

.best-luck-icon {
  font-size: 12px;
}

.best-luck-text {
  font-size: 10px;
  font-weight: 700;
  color: $gold;
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
    color: #2ecc71;
    border: 1px solid rgba(46, 204, 113, 0.3);
  }

  &.status-pending {
    background: rgba($gold, 0.2);
    color: $gold;
    border: 1px solid rgba($gold, 0.3);
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
