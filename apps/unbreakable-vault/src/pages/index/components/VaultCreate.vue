<template>
  <NeoCard variant="erobo-neo">
    <div class="form-group">
      <div class="input-group">
        <span class="input-label">{{ t("bountyLabel") }}</span>
        <NeoInput v-model="localBounty" type="number" :placeholder="t('bountyPlaceholder')" suffix="GAS" />
        <span class="helper-text">{{ t("minBountyNote") }}</span>
      </div>

      <div class="input-group">
        <span class="input-label">{{ t("titleLabel") }}</span>
        <NeoInput v-model="localTitle" :placeholder="t('titlePlaceholder')" />
      </div>

      <div class="input-group">
        <span class="input-label">{{ t("descriptionLabel") }}</span>
        <NeoInput v-model="localDescription" :placeholder="t('descriptionPlaceholder')" type="textarea" />
      </div>

      <SecuritySettings :difficulty="localDifficulty" @update:difficulty="localDifficulty = $event" />

      <div class="input-group">
        <span class="input-label">{{ t("secretLabel") }}</span>
        <NeoInput v-model="localSecret" :placeholder="t('secretPlaceholder')" />
      </div>

      <div class="input-group">
        <span class="input-label">{{ t("confirmSecretLabel") }}</span>
        <NeoInput v-model="localConfirm" :placeholder="t('confirmSecretPlaceholder')" />
        <span v-if="mismatch" class="helper-text text-danger">{{ t("secretMismatch") }}</span>
      </div>

      <div v-if="hash" class="hash-preview">
        <span class="hash-label">{{ t("hashPreview") }}</span>
        <span class="hash-value">{{ hash }}</span>
      </div>

      <NeoButton
        variant="primary"
        size="lg"
        block
        :loading="loading"
        :disabled="!canCreate || loading"
        @click="$emit('create')"
      >
        {{ loading ? t("creating") : t("createVault") }}
      </NeoButton>

      <span class="helper-text">{{ t("secretNote") }}</span>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import SecuritySettings from "./SecuritySettings.vue";

const props = defineProps<{
  bounty: string;
  title: string;
  description: string;
  difficulty: number;
  secret: string;
  secretConfirm: string;
  secretHash: string;
  loading: boolean;
  minBounty: number;
}>();

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "update:bounty", value: string): void;
  (e: "update:title", value: string): void;
  (e: "update:description", value: string): void;
  (e: "update:difficulty", value: number): void;
  (e: "update:secret", value: string): void;
  (e: "update:secretConfirm", value: string): void;
  (e: "create"): void;
}>();

const localBounty = ref(props.bounty);
const localTitle = ref(props.title);
const localDescription = ref(props.description);
const localDifficulty = ref(props.difficulty);
const localSecret = ref(props.secret);
const localConfirm = ref(props.secretConfirm);

watch(localBounty, (v) => emit("update:bounty", v));
watch(localTitle, (v) => emit("update:title", v));
watch(localDescription, (v) => emit("update:description", v));
watch(localDifficulty, (v) => emit("update:difficulty", v));
watch(localSecret, (v) => emit("update:secret", v));
watch(localConfirm, (v) => emit("update:secretConfirm", v));

const mismatch = computed(() => {
  if (!localConfirm.value) return false;
  return localSecret.value !== localConfirm.value;
});

const canCreate = computed(() => {
  const amount = Number.parseFloat(localBounty.value);
  return amount >= props.minBounty && localTitle.value.trim() && localSecret.value.trim() && !mismatch.value;
});
</script>

<style lang="scss" scoped>
.form-group {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.input-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.input-label {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  margin-left: 4px;
  letter-spacing: 0.05em;
}
.helper-text {
  font-size: 12px;
  margin-left: 8px;
  margin-top: 4px;
}
.hash-preview {
  padding: 16px;
  border-radius: 12px;
  background: var(--vault-bg);
}
.hash-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.hash-value {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}
.text-danger {
  color: var(--vault-danger);
}
</style>
