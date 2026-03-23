<template>
  <NeoCard class="converter-card" :title="t('convTitle')">
    <label class="field-label" for="neo-convert-input">{{ t("inputLabel") }}</label>
    <textarea
      id="neo-convert-input"
      v-model="inputKey"
      class="input-area"
      :placeholder="t('inputPlaceholder')"
      @input="detectAndConvert"
    />

    <div v-if="statusMsg" class="status" :data-type="statusType">
      {{ t(statusMsg as keyof typeof messages) }}
    </div>

    <div v-if="hasResult" class="result-grid">
      <div v-if="result.address" class="result-card">
        <span class="field-label">{{ t("address") }}</span>
        <code class="field-value">{{ result.address }}</code>
        <NeoButton size="sm" variant="secondary" type="button" @click="copy(result.address)">
          {{ t("copyAddress") }}
        </NeoButton>
      </div>

      <div v-if="result.publicKey" class="result-card">
        <span class="field-label">{{ t("pubKey") }}</span>
        <code class="field-value">{{ result.publicKey }}</code>
        <NeoButton size="sm" variant="secondary" type="button" @click="copy(result.publicKey)">
          {{ t("copyPublicKey") }}
        </NeoButton>
      </div>

      <div v-if="result.privateKey" class="result-card">
        <span class="field-label">{{ t("privKeyLabel") }}</span>
        <code class="field-value">{{ showSecrets ? result.privateKey : mask(result.privateKey) }}</code>
        <div class="button-row">
          <NeoButton size="sm" variant="secondary" type="button" @click="showSecrets = !showSecrets">
            {{ showSecrets ? t("hideSecrets") : t("showSecrets") }}
          </NeoButton>
          <NeoButton size="sm" variant="secondary" type="button" :disabled="!showSecrets" @click="copy(result.privateKey)">
            {{ t("copyPrivateKey") }}
          </NeoButton>
        </div>
      </div>

      <div v-if="result.wif" class="result-card">
        <span class="field-label">{{ t("wifLabel") }}</span>
        <code class="field-value">{{ showSecrets ? result.wif : mask(result.wif) }}</code>
        <NeoButton size="sm" variant="secondary" type="button" :disabled="!showSecrets" @click="copy(result.wif)">
          {{ t("copyWif") }}
        </NeoButton>
      </div>
    </div>

    <div v-if="result.opcodes.length" class="opcode-card">
      <span class="field-label">{{ t("disassembledOpcodes") }}</span>
      <ol class="opcode-list">
        <li v-for="opcode in result.opcodes" :key="opcode">
          <code>{{ opcode }}</code>
        </li>
      </ol>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoButton, NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useConverter } from "@/composables/useConverter";

const { t } = createUseI18n(messages)();
const { inputKey, statusMsg, statusType, showSecrets, result, copy, detectAndConvert } = useConverter(t);

const hasResult = computed(
  () => Boolean(result.value.address || result.value.publicKey || result.value.privateKey || result.value.wif || result.value.opcodes.length),
);

const mask = (value: string): string => (value ? `${value.slice(0, 6)}••••••${value.slice(-4)}` : "");
</script>

<style scoped lang="scss">
.converter-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.input-area {
  min-height: 150px;
  width: 100%;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
  padding: 14px 16px;
  line-height: 1.6;
  resize: vertical;
}

.status {
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
}

.status[data-type="success"] {
  background: rgba(0, 229, 153, 0.12);
  color: #7df2c3;
}

.status[data-type="error"] {
  background: rgba(248, 113, 113, 0.12);
  color: #fca5a5;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.result-card,
.opcode-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
}

.field-value {
  font-size: 12px;
  white-space: break-spaces;
  word-break: break-all;
  line-height: 1.55;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.opcode-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

@media (max-width: 767px) {
  .result-grid {
    grid-template-columns: 1fr;
  }
}
</style>
