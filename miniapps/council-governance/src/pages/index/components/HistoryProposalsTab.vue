<template>
  <view class="tab-content scrollable">
    <view v-if="proposals.length === 0" class="empty-state">
      {{ t("noHistory") }}
    </view>
    <NeoCard v-for="p in proposals" :key="p.id" class="mb-6" variant="erobo" @click="$emit('select', p)">
      <view class="proposal-header-neo">
        <text
          :class="[
            'status-badge-neo',
            getStatusClass(p.status),
          ]"
        >
          {{ getStatusText(p.status) }}
        </text>
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
import { NeoCard } from "@shared/components";

const props = defineProps<{
  proposals: any[];
  t: (key: string) => string;
}>();

const STATUS_PASSED = 2;
const STATUS_REJECTED = 3;
const STATUS_REVOKED = 4;
const STATUS_EXPIRED = 5;
const STATUS_EXECUTED = 6;

const getStatusClass = (status: number) => {
  const classes: Record<number, string> = {
    [STATUS_PASSED]: "passed",
    [STATUS_REJECTED]: "rejected",
    [STATUS_REVOKED]: "revoked",
    [STATUS_EXPIRED]: "expired",
    [STATUS_EXECUTED]: "executed",
  };
  return classes[status] || "";
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
@use "@shared/styles/variables.scss";

.tab-content { padding: 20px; }
.scrollable { overflow-y: auto; -webkit-overflow-scrolling: touch; }

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

.status-badge-neo {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 99px;
  letter-spacing: 0.05em;

  &.passed { 
    background: rgba(0, 229, 153, 0.1); 
    color: #00E599; 
    border: 1px solid rgba(0, 229, 153, 0.2); 
    box-shadow: 0 0 10px rgba(0, 229, 153, 0.1);
  }
  &.rejected { 
    background: rgba(239, 68, 68, 0.1); 
    color: #ef4444; 
    border: 1px solid rgba(239, 68, 68, 0.2); 
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.1);
  }
  &.revoked, &.expired { 
    background: rgba(255, 255, 255, 0.1); 
    color: var(--text-secondary, rgba(255, 255, 255, 0.6)); 
    border: 1px solid rgba(255, 255, 255, 0.1); 
  }
  &.executed { 
    background: rgba(112, 0, 255, 0.1); 
    color: #7000FF; 
    border: 1px solid rgba(112, 0, 255, 0.2); 
    box-shadow: 0 0 10px rgba(112, 0, 255, 0.1);
  }
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

.text-success { color: #00E599; }
.text-danger { color: #ef4444; }

.mb-6 { margin-bottom: 24px; }
</style>
