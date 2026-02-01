<template>
  <view class="claim-interface">
    <view class="claim-header">
      <text class="claim-title">{{ t('claimRedEnvelope') }}</text>
    </view>
    <view class="envelope-grid">
      <view 
        v-for="envelope in envelopes" 
        :key="envelope.id"
        class="envelope-item"
        :class="{ 'can-claim': envelope.canClaim, 'expired': envelope.expired }"
        @click="$emit('select', envelope)"
      >
        <text class="envelope-icon">🧧</text>
        <text class="envelope-from">{{ envelope.from }}</text>
        <text class="envelope-amount">{{ envelope.totalAmount }} GAS</text>
        <text class="envelope-remaining">{{ envelope.remaining }}/{{ envelope.total }} {{ t('remaining') }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  envelopes: Array<{
    id: string;
    from: string;
    totalAmount: number;
    total: number;
    remaining: number;
    canClaim: boolean;
    expired: boolean;
  }>;
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

defineEmits<{
  select: [envelope: any];
}>();
</script>

<style lang="scss" scoped>
.claim-interface {
  padding: 16px;
}

.claim-header {
  margin-bottom: 16px;
}

.claim-title {
  font-weight: 700;
  font-size: 16px;
  color: var(--red-envelope-text);
}

.envelope-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
}

.envelope-item {
  background: var(--red-envelope-card-bg);
  border: 1px solid var(--red-envelope-card-border);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s;

  &:active {
    transform: scale(0.98);
  }

  &.can-claim {
    border-color: var(--red-envelope-accent);
    box-shadow: 0 0 10px rgba(255, 107, 107, 0.3);
  }

  &.expired {
    opacity: 0.5;
  }
}

.envelope-icon {
  font-size: 32px;
  display: block;
  margin-bottom: 8px;
}

.envelope-from {
  font-size: 12px;
  color: var(--red-envelope-text-muted);
  margin-bottom: 4px;
  display: block;
}

.envelope-amount {
  font-weight: 700;
  font-size: 14px;
  color: var(--red-envelope-text);
  display: block;
  margin-bottom: 4px;
}

.envelope-remaining {
  font-size: 10px;
  color: var(--red-envelope-text-muted);
}
</style>
