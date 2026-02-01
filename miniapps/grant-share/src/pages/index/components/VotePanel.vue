<template>
  <view class="vote-panel">
    <view class="vote-header">
      <text class="vote-title">{{ t('voting') }}</text>
    </view>
    <view class="vote-actions">
      <NeoButton variant="primary" size="sm" @click="$emit('vote', 'accept')">
        {{ t('voteAccept') }}
      </NeoButton>
      <NeoButton variant="danger" size="sm" @click="$emit('vote', 'reject')">
        {{ t('voteReject') }}
      </NeoButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

defineEmits<{
  vote: [type: 'accept' | 'reject'];
}>();
</script>

<style lang="scss" scoped>
.vote-panel {
  padding: 16px;
  background: var(--eco-card-bg);
  border: 1px solid var(--eco-card-border);
  border-radius: 12px;
  margin-bottom: 16px;
}

.vote-header {
  margin-bottom: 12px;
}

.vote-title {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--eco-text-muted);
  letter-spacing: 0.08em;
}

.vote-actions {
  display: flex;
  gap: 12px;
}
</style>
