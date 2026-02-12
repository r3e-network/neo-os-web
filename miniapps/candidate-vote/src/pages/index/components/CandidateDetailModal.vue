<template>
  <view v-if="candidate" class="modal-overlay" @click.self="$emit('close')">
    <view class="modal-content" role="dialog" aria-modal="true" :aria-label="t('candidateDetails')">
      <view class="modal-header">
        <text class="modal-title">{{ t("candidateDetails") }}</text>
        <view class="close-btn" role="button" tabindex="0" :aria-label="t('close')" @click="$emit('close')">
          <text class="close-icon">×</text>
        </view>
      </view>

      <view class="modal-body">
        <CandidateInfoDisplay
          :candidate="candidate"
          :rank="rank"
          :total-votes="totalVotes"
          :is-user-voted="isUserVoted"
          @open-external="openExternal"
        />
      </view>

      <view class="modal-footer">
        <view v-if="governancePortalUrl" class="portal-link" role="link" tabindex="0" :aria-label="t('openGovernance')" @click="openExternal(governancePortalUrl)">
          {{ t("openGovernance") }}
        </view>
        <NeoButton
          v-if="!isUserVoted"
          variant="primary"
          size="lg"
          block
          :disabled="!canVote"
          @click="$emit('vote', candidate)"
        >
          {{ t("voteForCandidate") }}
        </NeoButton>
        <NeoCard v-else variant="erobo-neo" flat class="text-center">
          <text class="notice-text">{{ t("alreadyVotedFor") }}</text>
        </NeoCard>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoButton, NeoCard } from "@shared/components";
import type { GovernanceCandidate } from "../utils";
import { useI18n } from "@/composables/useI18n";
import type { UniAppGlobals } from "@shared/types/globals";
import CandidateInfoDisplay from "./CandidateInfoDisplay.vue";

const { t } = useI18n();

const props = defineProps<{
  candidate: GovernanceCandidate | null;
  rank: number;
  totalVotes: string;
  isUserVoted: boolean;
  canVote: boolean;
  governancePortalUrl: string;
}>();

defineEmits<{
  (e: "close"): void;
  (e: "vote", candidate: GovernanceCandidate): void;
}>();

function openExternal(url: string) {
  if (!url) return;
  const normalized = /^https?:\/\//i.test(url) || url.startsWith("mailto:") ? url : `https://${url}`;
  const g = globalThis as unknown as UniAppGlobals;
  const uniApi = g?.uni as Record<string, (...args: unknown[]) => unknown> | undefined;
  if (uniApi?.openURL) {
    uniApi.openURL({ url: normalized });
    return;
  }
  const plusApi = g?.plus as Record<string, Record<string, (...args: unknown[]) => unknown>> | undefined;
  if (plusApi?.runtime?.openURL) {
    plusApi.runtime.openURL(normalized);
    return;
  }
  if (typeof window !== "undefined" && window.open) {
    window.open(normalized, "_blank", "noopener,noreferrer");
    return;
  }

  if (typeof window !== "undefined") {
    window.location.href = normalized;
  }
}
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(10, 10, 20, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  width: 100%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-title {
  font-weight: 700;
  font-size: 18px;
  color: var(--text-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  cursor: pointer;
}

.close-icon {
  font-size: 20px;
  color: var(--text-primary);
  line-height: 1;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.portal-link {
  margin-bottom: 12px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 229, 153, 0.9);
  cursor: pointer;
}

.already-voted-notice {
  text-align: center;
  padding: 12px;
  background: rgba(0, 229, 153, 0.1);
  border: 1px solid rgba(0, 229, 153, 0.2);
  border-radius: 12px;
}

.notice-text {
  font-weight: 600;
  font-size: 14px;
  color: var(--candidate-neo-green);
}
</style>
