<template>
  <view v-if="result" class="result-section">
    <text class="section-title-neo mb-4">{{ t("searchResult") }}</text>

    <NeoCard v-if="result.type === 'transaction'" variant="erobo" class="mb-6">
      <template #header-extra>
        <text :class="['vm-state-neo', result.data.vmState]">{{
          result.data.vmState
        }}</text>
      </template>

      <view class="result-rows">
        <view class="result-row-neo">
          <text class="label-neo">{{ t("hash") }}</text>
          <text class="value-neo">{{ result.data.hash }}</text>
        </view>
        <view class="result-row-neo">
          <text class="label-neo">{{ t("block") }}</text>
          <text class="value-neo">{{ result.data.blockIndex }}</text>
        </view>
        <view class="result-row-neo">
          <text class="label-neo">{{ t("time") }}</text>
          <text class="value-neo">{{ formatTime(result.data.blockTime) }}</text>
        </view>
        <view class="result-row-neo">
          <text class="label-neo">{{ t("sender") }}</text>
          <text class="value-neo">{{ result.data.sender }}</text>
        </view>
      </view>
    </NeoCard>

    <NeoCard v-else-if="result.type === 'address'" :title="t('address')" variant="erobo" class="mb-6">
      <view class="result-rows mb-4">
        <view class="result-row-neo">
          <text class="label-neo">{{ t("addressLabel") }}</text>
          <text class="value-neo">{{ result.data.address }}</text>
        </view>
        <view class="result-row-neo">
          <text class="label-neo">{{ t("transactionsLabel") }}</text>
          <text class="value-neo">{{ result.data.txCount }}</text>
        </view>
      </view>

      <view class="tx-list-neo" v-if="result.data.transactions?.length">
        <text class="list-title-neo">{{
          t("recentTransactions")
        }}</text>
        <view
          v-for="tx in result.data.transactions"
          :key="tx.hash"
          class="tx-item-neo mb-2"
          @click="$emit('viewTx', tx.hash)"
        >
          <text class="tx-hash-neo">{{ truncateHash(tx.hash) }}</text>
          <text class="tx-time">{{ formatTime(tx.blockTime) }}</text>
        </view>
      </view>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  result: any;
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
@use "@shared/styles/variables.scss";

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

.vm-state-neo {
  padding: 4px 12px;
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

.result-rows { display: flex; flex-direction: column; gap: 8px; }

.result-row-neo {
  padding: 12px;
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: 12px;
  margin-bottom: 8px;
  backdrop-filter: blur(5px);
  transition: background 0.2s;
  
  &:hover {
    background: var(--bg-card, rgba(255, 255, 255, 0.05));
  }
}

.label-neo {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  margin-bottom: 4px;
  display: block;
  letter-spacing: 0.05em;
}

.value-neo {
  font-family: $font-mono;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-all;
}

.tx-list-neo {
  margin-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 16px;
}

.list-title-neo {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  opacity: 0.6;
  color: var(--text-primary);
  margin-bottom: 8px;
  display: block;
  letter-spacing: 0.05em;
}

.tx-item-neo {
  padding: 12px;
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: 12px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
  cursor: pointer;
  
  &:active {
    transform: scale(0.98);
    background: rgba(255, 255, 255, 0.08);
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

.mb-2 { margin-bottom: 8px; }
.mb-4 { margin-bottom: 16px; }
.mb-6 { margin-bottom: 24px; }
</style>
