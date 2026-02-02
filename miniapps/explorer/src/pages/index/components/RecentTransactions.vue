<template>
  <view class="recent-section">
    <text class="section-title-neo mb-4">{{ t("recentTransactions") }}</text>
    
    <!-- Skeleton State -->
    <view v-if="loading && transactions.length === 0">
      <view v-for="i in 5" :key="i" class="mb-3 skeleton-tx-card">
        <view class="flex justify-between items-center w-full">
          <view class="skeleton-line w-40"></view>
          <view class="skeleton-line w-20"></view>
        </view>
      </view>
    </view>

    <!-- Content -->
    <view v-else-if="transactions.length">
      <NeoCard v-for="tx in transactions" :key="tx.hash" variant="erobo" class="mb-3" @click="$emit('viewTx', tx.hash)">
        <view class="tx-item-content-neo">
          <view class="tx-info">
            <text class="tx-hash-neo">{{ truncateHash(tx.hash) }}</text>
            <text :class="['vm-state-small-neo', tx.vmState]">{{ tx.vmState }}</text>
          </view>
          <text class="tx-time">{{ formatTime(tx.blockTime) }}</text>
        </view>
      </NeoCard>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  transactions: any[];
  loading?: boolean;
  t: (key: string) => string;
}>();

defineEmits(["viewTx"]);

const formatTime = (time: string) => {
  const d = new Date(time);
  return d.toLocaleString();
};

const truncateHash = (hash: string) => {
  if (!hash) return "";
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.section-title-neo {
  font-size: 11px;
  font-weight: 700;
  color: #00E599;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 12px;
  display: block;
  text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
}

.vm-state-small-neo {
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  border-radius: 100px;
  
  &.HALT {
    background: rgba(0, 229, 153, 0.1);
    color: #00E599;
    border: 1px solid rgba(0, 229, 153, 0.2);
    box-shadow: 0 0 10px rgba(0, 229, 153, 0.1);
  }
  
  &.FAULT {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.2);
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.1);
  }
}

.tx-hash-neo {
  font-family: $font-mono;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.tx-time {
  font-size: 11px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  font-weight: 500;
}


.tx-item-content-neo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.tx-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mb-3 { margin-bottom: 12px; }
.mb-4 { margin-bottom: 16px; }

.skeleton-tx-card {
  padding: 20px;
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: 16px;
  backdrop-filter: blur(10px);
}

.skeleton-line {
  background: var(--bg-card, rgba(255, 255, 255, 0.05));
  height: 12px;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
    animation: shimmer 1.5s infinite;
  }
}

@keyframes shimmer {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}

.w-40 { width: 160px; }
.w-20 { width: 80px; }
</style>
