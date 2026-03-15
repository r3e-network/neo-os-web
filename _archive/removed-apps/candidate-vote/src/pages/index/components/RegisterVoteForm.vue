<template>
  <NeoCard variant="erobo">
    <div class="vote-form">
      <!-- Selected Candidate Display -->
      <div v-if="selectedCandidate" class="selected-candidate">
        <span class="selected-label">{{ t("votingFor") }}</span>
        <div class="candidate-badge">
          <span class="candidate-name">{{ selectedCandidate.name || truncateAddress(selectedCandidate.address) }}</span>
          <span class="candidate-key">{{ truncateAddress(selectedCandidate.publicKey) }}</span>
        </div>
      </div>

      <div v-else class="no-candidate-warning">
        <span class="warning-text">{{ t("selectCandidateFirst") }}</span>
      </div>

      <!-- Vote Weight Input -->
      <NeoInput
        :modelValue="voteWeight"
        @update:modelValue="$emit('update:voteWeight', $event)"
        type="number"
        :label="t('voteWeight')"
        :placeholder="t('voteWeightPlaceholder')"
        :disabled="!selectedCandidate"
      >
        <template #suffix>
          <span class="token-symbol">NEO</span>
        </template>
        <template #hint>
          {{ t("minVoteWeight") }}
        </template>
      </NeoInput>

      <!-- Action Button -->
      <NeoButton
        variant="primary"
        size="lg"
        block
        :disabled="!selectedCandidate || !voteWeight || isLoading"
        :loading="isLoading"
        @click="$emit('register')"
      >
        {{ t("registerVote") }}
      </NeoButton>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { Candidate } from "@shared/utils/wallet-sdk";

defineProps<{
  voteWeight: string;
  selectedCandidate: Candidate | null;
  isLoading: boolean;
}>();

const { t } = createUseI18n(messages)();

defineEmits(["update:voteWeight", "register"]);

const truncateAddress = (addr: string) => {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.vote-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.selected-candidate {
  padding: 16px;
  background: rgba(0, 229, 153, 0.1);
  border: 1px solid rgba(0, 229, 153, 0.3);
  border-radius: 16px;
  backdrop-filter: blur(4px);
  box-shadow: 0 0 20px rgba(0, 229, 153, 0.1);
  animation: fadeIn 0.3s ease-out;
}

.selected-label {
  @include stat-label;
  font-size: 10px;
  color: var(--candidate-neo-green);
  display: block;
  margin-bottom: 4px;
}

.candidate-badge {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.candidate-name {
  font-weight: 700;
  font-size: 16px;
  color: var(--text-primary);
  font-family: $font-family;
}

.candidate-key {
  font-size: 11px;
  font-family: $font-mono;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
}

.no-candidate-warning {
  padding: 16px;
  background: var(--candidate-warning-bg);
  border: 1px solid var(--candidate-warning-border);
  border-radius: 16px;
  text-align: center;
  backdrop-filter: blur(4px);
}

.warning-text {
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--candidate-warning-text);
}

.token-symbol {
  font-weight: 700;
  color: var(--candidate-neo-green);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
