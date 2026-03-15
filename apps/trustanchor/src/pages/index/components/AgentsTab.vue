<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { formatNumber, formatAddress as formatAddressText } from "@shared/utils/format";
import { NeoCard, AppIcon } from "@shared/components";
import type { AgentInfo } from "../composables/useTrustAnchor";

interface Props {
  agents: AgentInfo[];
}

defineProps<Props>();

const { t } = createUseI18n(messages)();
const formatNum = (n: number | string) => formatNumber(n, 2);
const formatAddress = (addr: string) => formatAddressText(addr, 6);
</script>

<template>
  <div class="agents-header mb-4 px-1">
    <span class="agents-title">{{ t("agentRanking") }}</span>
  </div>

  <div class="agents-list">
    <NeoCard v-for="(agent, index) in agents" :key="agent.address" variant="erobo" class="agent-card mb-3">
      <div class="agent-row">
        <div class="agent-rank">{{ index + 1 }}</div>
        <div class="agent-info">
          <span class="agent-name">{{ agent.name }}</span>
          <span class="agent-address">{{ formatAddress(agent.address) }}</span>
        </div>
        <div class="agent-stats">
          <div class="agent-stat">
            <span class="stat-number">{{ formatNum(agent.votingWeight) }}</span>
            <span class="stat-unit">{{ t("priority") }}</span>
          </div>
        </div>
      </div>
    </NeoCard>

    <div v-if="agents.length === 0" class="empty-state">
      <AppIcon name="users" :size="48" class="mb-4 opacity-50" />
      <span class="empty-text">{{ t("loading") }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.agents-header {
  margin-top: 16px;
}

.agents-title {
  font-size: 18px;
  font-weight: bold;
}

.agents-list {
  padding: 0 4px;
}

.agent-card {
  padding: 12px;
}

.agent-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.agent-rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--erobo-purple);
  border-radius: 50%;
  font-weight: bold;
  font-size: 14px;
}

.agent-info {
  flex: 1;
}

.agent-name {
  display: block;
  font-weight: bold;
  font-size: 14px;
}

.agent-address {
  display: block;
  font-size: 10px;
  opacity: 0.6;
}

.agent-stats {
  display: flex;
  gap: 16px;
}

.agent-stat {
  text-align: right;
}

.agent-stat .stat-number {
  display: block;
  font-weight: bold;
  font-size: 14px;
}

.agent-stat .stat-unit {
  display: block;
  font-size: 10px;
  opacity: 0.6;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.empty-text {
  opacity: 0.6;
}

@media (max-width: 767px) {
  .agent-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .agent-stats {
    width: 100%;
    justify-content: space-between;
  }
}

@media (min-width: 1024px) {
  .agents-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}
</style>
