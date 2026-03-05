<template>
  <ActionModal
    :visible="!!candidate"
    :title="t('candidateDetails')"
    :closeable="true"
    size="md"
    @close="$emit('close')"
  >
    <view class="modal-body">
      <CandidateInfoDisplay
        :candidate="candidate"
        :rank="rank"
        :total-votes="totalVotes"
        :is-user-voted="isUserVoted"
        @open-external="openExternal"
      />
    </view>

    <template #actions>
      <view class="modal-footer">
        <view
          v-if="governancePortalUrl"
          class="portal-link"
          role="link"
          tabindex="0"
          :aria-label="t('openGovernance')"
          @click="openExternal(governancePortalUrl)"
        >
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
    </template>
  </ActionModal>
</template>

<script setup lang="ts">
import { ActionModal, NeoButton, NeoCard } from "@shared/components";
import type { GovernanceCandidate } from "../utils";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { UniAppGlobals } from "@shared/types/globals";
import CandidateInfoDisplay from "./CandidateInfoDisplay.vue";

const { t } = createUseI18n(messages)();

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

.modal-body {
  padding: 0;
}

.modal-footer {
  width: 100%;
}

.portal-link {
  margin-bottom: 12px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 229, 153, 0.9);
  cursor: pointer;
}

.notice-text {
  font-weight: 600;
  font-size: 14px;
  color: var(--candidate-neo-green);
}
</style>
