<template>
  <div v-if="result" class="result-section">
    <span class="section-title-neo mb-4">{{ t("searchResult") }}</span>

    <NeoCard v-if="result.type === 'transaction'" variant="erobo" class="mb-6">
      <template #header-extra>
        <span :class="['vm-state-neo', result.data.vmState]">{{ getVmStateLabel(result.data.vmState) }}</span>
      </template>

      <div class="result-rows">
        <div class="result-row-neo">
          <span class="label-neo">{{ t("hash") }}</span>
          <span class="value-neo">{{ result.data.hash }}</span>
        </div>
        <div class="result-row-neo">
          <span class="label-neo">{{ t("block") }}</span>
          <span class="value-neo">{{ result.data.blockIndex }}</span>
        </div>
        <div class="result-row-neo">
          <span class="label-neo">{{ t("time") }}</span>
          <span class="value-neo">{{ formatTime(result.data.blockTime) }}</span>
        </div>
        <div class="result-row-neo">
          <span class="label-neo">{{ t("sender") }}</span>
          <span class="value-neo">{{ result.data.sender }}</span>
        </div>
      </div>
    </NeoCard>

    <NeoCard v-else-if="result.type === 'address'" :title="t('address')" variant="erobo" class="mb-6">
      <div class="result-rows mb-4">
        <div class="result-row-neo">
          <span class="label-neo">{{ t("addressLabel") }}</span>
          <span class="value-neo">{{ result.data.address }}</span>
        </div>
        <div class="result-row-neo">
          <span class="label-neo">{{ t("transactionsLabel") }}</span>
          <span class="value-neo">{{ result.data.txCount }}</span>
        </div>
      </div>

      <div class="tx-list-neo" v-if="result.data.transactions?.length">
        <span class="list-title-neo">{{ t("recentTransactions") }}</span>
        <div
          v-for="tx in result.data.transactions"
          :key="tx.hash"
          class="tx-item-neo mb-2"
          @click="$emit('viewTx', tx.hash)"
        >
          <span class="tx-hash-neo">{{ truncateHash(tx.hash) }}</span>
          <span class="tx-time">{{ formatTime(tx.blockTime) }}</span>
        </div>
      </div>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

const props = withDefaults(
  defineProps<{
    result: Record<string, unknown> | null;
    t: (key: string, ...args: unknown[]) => string;
  }>(),
  {
    result: null,
    t: (key: string) => key,
  }
);

defineEmits<{
  (e: "viewTx", hash: string): void;
}>();

const formatTime = (time: unknown) => {
  const dateStr = typeof time === "string" ? time : String(time ?? "");
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat(undefined).format(d);
};

const truncateHash = (hash: unknown) => {
  const str = typeof hash === "string" ? hash : String(hash ?? "");
  if (!str) return "";
  return `${str.slice(0, 10)}${props.t("hashEllipsis")}${str.slice(-8)}`;
};

const getVmStateLabel = (vmState: unknown) => {
  const str = typeof vmState === "string" ? vmState : String(vmState ?? "");
  if (str === "HALT") return props.t("vmHalt");
  if (str === "FAULT") return props.t("vmFault");
  return str;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.section-title-neo {
  @include stat-label;
  color: var(--matrix-success);
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
    color: var(--matrix-success);
    border: 1px solid rgba(0, 229, 153, 0.2);
    box-shadow: 0 0 10px rgba(0, 229, 153, 0.1);
  }

  &.FAULT {
    background: rgba(239, 68, 68, 0.1);
    color: var(--matrix-error);
    border: 1px solid rgba(239, 68, 68, 0.2);
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.1);
  }
}

.result-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-row-neo {
  @include card-base(12px, 12px);
  margin-bottom: 8px;
  backdrop-filter: blur(5px);
  transition: background 0.2s;

  &:hover {
    background: var(--bg-card, rgba(255, 255, 255, 0.05));
  }
}

.label-neo {
  @include stat-label;
  font-weight: 600;
  margin-bottom: 4px;
  display: block;
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
  @include stat-label;
  opacity: 0.6;
  color: var(--text-primary);
  margin-bottom: 8px;
  display: block;
}

.tx-item-neo {
  @include card-base(12px, 12px);
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

.mb-2 {
  margin-bottom: 8px;
}
.mb-4 {
  margin-bottom: 16px;
}
.mb-6 {
  margin-bottom: 24px;
}
</style>
