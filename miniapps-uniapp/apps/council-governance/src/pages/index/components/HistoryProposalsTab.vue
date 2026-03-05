<template>
  <view class="tab-content scrollable">
    <view v-if="proposals.length === 0" class="empty-state">
      {{ t("noHistory") }}
    </view>
    <NeoCard v-for="p in proposals" :key="p.id" class="mb-6" variant="erobo" @click="$emit('select', p)">
      <view class="proposal-header-neo">
        <StatusBadge :status="getStatusBadgeStatus(p.status)" :label="getStatusText(p.status)" />
        <text class="proposal-id-neo">#{{ p.id }}</text>
      </view>
      <text class="proposal-title-neo">{{ p.title }}</text>
      <view class="vote-stats-neo">
        <text class="stat-text text-success">{{ t("for") }}: {{ p.yesVotes }}</text>
        <text class="stat-text text-danger">{{ t("against") }}: {{ p.noVotes }}</text>
      </view>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { NeoCard, StatusBadge } from "@shared/components";

const props = defineProps<{
  proposals: {
    id: number;
    type: number;
    title: string;
    description: string;
    yesVotes: number;
    noVotes: number;
    status: number;
  }[];
  t: (key: string, ...args: unknown[]) => string;
}>();

const STATUS_PASSED = 2;
const STATUS_REJECTED = 3;
const STATUS_REVOKED = 4;
const STATUS_EXPIRED = 5;
const STATUS_EXECUTED = 6;

const getStatusBadgeStatus = (status: number): "success" | "error" | "inactive" | "pending" => {
  if (status === STATUS_PASSED || status === STATUS_EXECUTED) return "success";
  if (status === STATUS_REJECTED) return "error";
  if (status === STATUS_REVOKED || status === STATUS_EXPIRED) return "inactive";
  return "pending";
};

const getStatusText = (status: number) => {
  const texts: Record<number, string> = {
    [STATUS_PASSED]: props.t("passed"),
    [STATUS_REJECTED]: props.t("rejected"),
    [STATUS_REVOKED]: props.t("revoked"),
    [STATUS_EXPIRED]: props.t("expired"),
    [STATUS_EXECUTED]: props.t("executed"),
  };
  return texts[status] || "";
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.tab-content {
  padding: 20px;
}
.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.empty-state {
  text-align: center;
  padding: 48px;
  opacity: 0.4;
  font-style: italic;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  font-size: 14px;
}

.proposal-header-neo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.proposal-id-neo {
  font-family: $font-mono;
  font-size: 12px;
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
}

.proposal-title-neo {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  margin-bottom: 16px;
  display: block;
}

.vote-stats-neo {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 700;
  font-family: $font-mono;
}

.stat-text {
  text-transform: uppercase;
}

.text-success {
  color: var(--senate-success);
}
.text-danger {
  color: var(--senate-danger);
}

.mb-6 {
  margin-bottom: 24px;
}
</style>
