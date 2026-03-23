<template>
  <div class="converter-container">
    <NeoCard>
      <div class="header">
        <span class="title">{{ t("convTitle") }}</span>
      </div>

      <div class="input-section">
        <span class="label">{{ t("inputLabel") }}</span>
        <textarea
          id="converter-key-input"
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
              <button type="button" class="copy-btn" @click="copy(result.address)" :aria-label="t('copyAddress')">
                <AppIcon name="copy" :size="16" aria-hidden="true" />
              </button>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal animation="slide-left" :delay="200" v-if="result.publicKey">
          <div class="result-group">
            <span class="label">{{ t("pubKey") }}</span>
            <div class="value-row">
              <span class="value truncate">{{ result.publicKey }}</span>
              <button type="button" class="copy-btn" @click="copy(result.publicKey)" :aria-label="t('copyPublicKey')">
                <AppIcon name="copy" :size="16" aria-hidden="true" />
              </button>
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
              <button
                type="button"
                class="action-btn"
                @click="showSecrets = !showSecrets"
                :aria-label="showSecrets ? t('hideSecrets') : t('showSecrets')"
              >
                <AppIcon :name="showSecrets ? 'eye_hidden' : 'eye_visible'" :size="16" aria-hidden="true" />
              </button>
              <button type="button" class="copy-btn" @click="copy(result.wif)" :aria-label="t('copyWif')">
                <AppIcon name="copy" :size="16" aria-hidden="true" />
              </button>
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
              <button
                type="button"
                class="action-btn"
                @click="showSecrets = !showSecrets"
                :aria-label="showSecrets ? t('hideSecrets') : t('showSecrets')"
              >
                <AppIcon :name="showSecrets ? 'eye_hidden' : 'eye_visible'" :size="16" aria-hidden="true" />
              </button>
              <button type="button" class="copy-btn" @click="copy(result.privateKey)" :aria-label="t('copyPrivateKey')">
                <AppIcon name="copy" :size="16" aria-hidden="true" />
              </button>
            </div>
          </div>
        </ScrollReveal>
      </div>

      <ScrollReveal animation="fade-up" :delay="200" v-if="result.opcodes && result.opcodes.length > 0">
        <div class="result-group">
          <span class="label">{{ t("disassembledOpcodes") }}</span>
          <div class="opcodes-container">
            <span v-for="(op, idx) in result.opcodes" :key="op + idx" class="opcode-tag">{{ op }}</span>
          </div>
        </div>
      </ScrollReveal>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { NeoCard, AppIcon } from "@shared/components";
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
