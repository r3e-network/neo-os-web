<template>
  <NeoCard variant="erobo-neo">
    <view class="form-group">
      <view class="input-group">
        <text class="input-label">{{ t("bountyLabel") }}</text>
        <NeoInput v-model="localBounty" type="number" :placeholder="t('bountyPlaceholder')" suffix="GAS" />
        <text class="helper-text">{{ t("minBountyNote") }}</text>
      </view>

      <view class="input-group">
        <text class="input-label">{{ t("titleLabel") }}</text>
        <NeoInput v-model="localTitle" :placeholder="t('titlePlaceholder')" />
      </view>

      <view class="input-group">
        <text class="input-label">{{ t("descriptionLabel") }}</text>
        <NeoInput v-model="localDescription" :placeholder="t('descriptionPlaceholder')" type="textarea" />
      </view>

      <SecuritySettings :difficulty="localDifficulty" @update:difficulty="localDifficulty = $event" />

      <view class="input-group">
        <text class="input-label">{{ t("secretLabel") }}</text>
        <NeoInput v-model="localSecret" :placeholder="t('secretPlaceholder')" />
      </view>

      <view class="input-group">
        <text class="input-label">{{ t("confirmSecretLabel") }}</text>
        <NeoInput v-model="localConfirm" :placeholder="t('confirmSecretPlaceholder')" />
        <text v-if="mismatch" class="helper-text text-danger">{{ t("secretMismatch") }}</text>
      </view>

      <view v-if="hash" class="hash-preview">
        <text class="hash-label">{{ t("hashPreview") }}</text>
        <text class="hash-value">{{ hash }}</text>
      </view>

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

      <text class="helper-text">{{ t("secretNote") }}</text>
    </view>
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
