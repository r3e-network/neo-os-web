<template>
  <div class="converter-container">
    <NeoCard>
      <div class="header">
        <span class="title">{{ t("convTitle") }}</span>
      </div>

      <div class="input-section">
        <span class="label">{{ t("inputLabel") }}</span>
        <textarea
          class="key-input"
          v-model="inputKey"
          :placeholder="t('inputPlaceholder')"
          :aria-label="t('inputLabel')"
          @input="detectAndConvert"
          maxlength="-1"
        />
        <ScrollReveal animation="fade-down" :duration="400" v-if="statusMsg">
          <span class="status" :class="statusType">{{ t(statusMsg) || statusMsg }}</span>
        </ScrollReveal>
      </div>

      <div v-if="copyStatus" class="copy-status" :class="copyStatus.type">
        <span class="copy-status-text">{{ copyStatus.msg }}</span>
      </div>

      <div class="results" v-if="result.address">
        <ScrollReveal animation="slide-left" :delay="100">
          <div class="result-group">
            <span class="label">{{ t("address") }}</span>
            <div class="value-row">
              <span class="value">{{ result.address }}</span>
              <div class="copy-btn" @click="copy(result.address)" role="button" tabindex="0" :aria-label="t('copyAddress')" @keydown.enter="copy(result.address)">
                <span class="icon" aria-hidden="true">📋</span>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal animation="slide-left" :delay="200" v-if="result.publicKey">
          <div class="result-group">
            <span class="label">{{ t("pubKey") }}</span>
            <div class="value-row">
              <span class="value truncate">{{ result.publicKey }}</span>
              <div class="copy-btn" @click="copy(result.publicKey)" role="button" tabindex="0" :aria-label="t('copyPublicKey')" @keydown.enter="copy(result.publicKey)">
                <span class="icon" aria-hidden="true">📋</span>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal animation="slide-left" :delay="300" v-if="result.wif">
          <div class="result-group warning-group">
            <div class="label-row">
              <span class="label">{{ t("wifLabel") }}</span>
              <span class="badge-private">{{ t("privateBadge") }}</span>
            </div>
            <div class="value-row">
              <span class="value blur" :class="{ revealed: showSecrets }">{{ result.wif }}</span>
              <div
                class="action-btn"
                @click="showSecrets = !showSecrets"
                role="button"
                tabindex="0"
                :aria-label="showSecrets ? t('hideSecrets') : t('showSecrets')"
                @keydown.enter="showSecrets = !showSecrets"
              >
                <span class="icon" aria-hidden="true">{{ showSecrets ? "🙈" : "👁️" }}</span>
              </div>
              <div class="copy-btn" @click="copy(result.wif)" role="button" tabindex="0" :aria-label="t('copyWif')" @keydown.enter="copy(result.wif)">
                <span class="icon" aria-hidden="true">📋</span>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal animation="slide-left" :delay="400" v-if="result.privateKey">
          <div class="result-group warning-group">
            <div class="label-row">
              <span class="label">{{ t("privKeyLabel") }}</span>
              <span class="badge-private">{{ t("privateBadge") }}</span>
            </div>
            <div class="value-row">
              <span class="value blur" :class="{ revealed: showSecrets }">{{ result.privateKey }}</span>
              <div
                class="action-btn"
                @click="showSecrets = !showSecrets"
                role="button"
                tabindex="0"
                :aria-label="showSecrets ? t('hideSecrets') : t('showSecrets')"
                @keydown.enter="showSecrets = !showSecrets"
              >
                <span class="icon" aria-hidden="true">{{ showSecrets ? "🙈" : "👁️" }}</span>
              </div>
              <div class="copy-btn" @click="copy(result.privateKey)" role="button" tabindex="0" :aria-label="t('copyPrivateKey')" @keydown.enter="copy(result.privateKey)">
                <span class="icon" aria-hidden="true">📋</span>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>

      <ScrollReveal animation="fade-up" :delay="200" v-if="result.opcodes && result.opcodes.length > 0">
        <div class="result-group">
          <span class="label">{{ t("disassembledOpcodes") }}</span>
          <div class="opcodes-container">
            <span v-for="(op, idx) in result.opcodes" :key="idx" class="opcode-tag">{{ op }}</span>
          </div>
        </div>
      </ScrollReveal>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import ScrollReveal from "@shared/components/ScrollReveal.vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useConverter } from "@/composables/useConverter";

const { t } = createUseI18n(messages)();
const {
  inputKey,
  statusMsg,
  statusType,
  showSecrets,
  result,
  copyStatus,
  copy,
  detectAndConvert,
} = useConverter(t);
</script>

<style lang="scss" scoped>
@import "./_converter-tool.scss";
</style>
