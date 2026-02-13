<template>
  <NeoCard variant="erobo" class="project-list">
    <view class="projects-header">
      <text class="section-title">{{ t("tabProjects") }}</text>
      <NeoButton size="sm" variant="secondary" :loading="isRefreshing" @click="emitRefresh">
        {{ t("refresh") }}
      </NeoButton>
    </view>

    <view v-if="projects.length === 0" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center opacity-70">
        <text class="text-xs">{{ t("emptyProjects") }}</text>
      </NeoCard>
    </view>

    <view v-else class="project-cards">
      <view v-for="project in projects" :key="`project-${project.id}`" class="project-card">
        <view class="project-card__header">
          <view>
            <text class="project-title">{{ project.name || `#${project.id}` }}</text>
            <text class="project-subtitle">{{ formatAddress(project.owner) }}</text>
          </view>
          <text :class="['status-pill', projectStatusClass(project)]">{{ projectStatusLabel(project) }}</text>
        </view>

        <text class="project-desc">{{ project.description || "--" }}</text>
        <text v-if="project.link" class="project-link">{{ project.link }}</text>

        <view class="project-metrics">
          <view>
            <text class="metric-label">{{ t("totalContributed") }}</text>
            <text class="metric-value">{{ formatAmount(assetSymbol, project.totalContributed) }} {{ assetSymbol }}</text>
          </view>
          <view>
            <text class="metric-label">{{ t("matchedAmount") }}</text>
            <text class="metric-value">{{ formatAmount(assetSymbol, project.matchedAmount) }} {{ assetSymbol }}</text>
          </view>
          <view>
            <text class="metric-label">{{ t("donors") }}</text>
            <text class="metric-value">{{ project.contributorCount.toString() }}</text>
          </view>
        </view>

        <view class="project-actions">
          <NeoButton size="sm" variant="secondary" @click="emitContribute(project)">
            {{ t("contributeNow") }}
          </NeoButton>
          <NeoButton
            size="sm"
            variant="primary"
            :loading="claimingProjectId === project.id"
            :disabled="!canClaimProject(project)"
            @click="emitClaim(project)"
          >
            {{ claimingProjectId === project.id ? t("claimingProject") : t("claimProject") }}
          </NeoButton>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { RoundItem } from "./RoundList.vue";

export interface ProjectItem {
  id: string;
  roundId: string;
  owner: string;
  name: string;
  description: string;
  link: string;
  totalContributed: bigint;
  contributorCount: bigint;
  matchedAmount: bigint;
  active: boolean;
  claimed: boolean;
}

const props = defineProps<{
  projects: ProjectItem[];
  assetSymbol: string;
  isRefreshing: boolean;
  claimingProjectId: string | null;
  canClaimProject: (project: ProjectItem) => boolean;
  formatAddress: (addr: string) => string;
  formatAmount: (symbol: string, amount: bigint) => string;
  projectStatusLabel: (project: ProjectItem) => string;
  projectStatusClass: (project: ProjectItem) => string;
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "contribute", project: ProjectItem): void;
  (e: "claim", project: ProjectItem): void;
}>();

const { t } = createUseI18n(messages)();

const emitRefresh = () => emit("refresh");
const emitContribute = (project: ProjectItem) => emit("contribute", project);
const emitClaim = (project: ProjectItem) => emit("claim", project);
</script>

<style lang="scss" scoped>
.project-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.projects-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.project-cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.project-card {
  background: var(--qf-card-bg);
  border: 1px solid var(--qf-card-border);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.project-title {
  font-size: 15px;
  font-weight: 700;
}

.project-subtitle {
  display: block;
  font-size: 11px;
  color: var(--qf-muted);
  margin-top: 2px;
}

.project-desc {
  font-size: 12px;
  color: var(--qf-muted);
  line-height: 1.5;
}

.project-link {
  font-size: 11px;
  color: var(--qf-accent);
  word-break: break-all;
}

.project-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
}

.metric-label {
  font-size: 10px;
  color: var(--qf-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.metric-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--qf-accent-strong);
}

.project-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.status-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: rgba(20, 184, 166, 0.2);
  color: var(--qf-accent);
}

.status-pill.inactive {
  background: rgba(148, 163, 184, 0.2);
  color: var(--qf-muted);
}

.status-pill.claimed {
  background: rgba(16, 185, 129, 0.2);
  color: var(--qf-success-alt);
}

.empty-state {
  margin-top: 10px;
}
</style>
