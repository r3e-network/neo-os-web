<template>
  <view class="converter-container">
    <NeoCard>
      <view class="header">
        <text class="title">{{ t("convTitle") }}</text>
      </view>

      <view class="input-section">
        <text class="label">{{ t("inputLabel") }}</text>
        <textarea
          class="key-input"
          v-model="inputKey"
          :placeholder="t('inputPlaceholder')"
          :aria-label="t('inputLabel')"
          @input="detectAndConvert"
          maxlength="-1"
        />
        <ScrollReveal animation="fade-down" :duration="400" v-if="statusMsg">
          <text class="status" :class="statusType">{{ t(statusMsg) || statusMsg }}</text>
        </ScrollReveal>
      </view>

      <view v-if="copyStatus" class="copy-status" :class="copyStatus.type">
        <text class="copy-status-text">{{ copyStatus.msg }}</text>
      </view>

      <view class="results" v-if="result.address">
        <ScrollReveal animation="slide-left" :delay="100">
          <view class="result-group">
            <text class="label">{{ t("address") }}</text>
            <view class="value-row">
              <text class="value">{{ result.address }}</text>
              <view class="copy-btn" @click="copy(result.address)" role="button" tabindex="0" :aria-label="t('copyAddress')" @keydown.enter="copy(result.address)">
                <text class="icon" aria-hidden="true">📋</text>
              </view>
            </view>
          </view>
        </ScrollReveal>

        <ScrollReveal animation="slide-left" :delay="200" v-if="result.publicKey">
          <view class="result-group">
            <text class="label">{{ t("pubKey") }}</text>
            <view class="value-row">
              <text class="value truncate">{{ result.publicKey }}</text>
              <view class="copy-btn" @click="copy(result.publicKey)" role="button" tabindex="0" :aria-label="t('copyPublicKey')" @keydown.enter="copy(result.publicKey)">
                <text class="icon" aria-hidden="true">📋</text>
              </view>
            </view>
          </view>
        </ScrollReveal>

        <ScrollReveal animation="slide-left" :delay="300" v-if="result.wif">
          <view class="result-group warning-group">
            <view class="label-row">
              <text class="label">{{ t("wifLabel") }}</text>
              <text class="badge-private">{{ t("privateBadge") }}</text>
            </view>
            <view class="value-row">
              <text class="value blur" :class="{ revealed: showSecrets }">{{ result.wif }}</text>
              <view
                class="action-btn"
                @click="showSecrets = !showSecrets"
                role="button"
                tabindex="0"
                :aria-label="showSecrets ? t('hideSecrets') : t('showSecrets')"
                @keydown.enter="showSecrets = !showSecrets"
              >
                <text class="icon" aria-hidden="true">{{ showSecrets ? "🙈" : "👁️" }}</text>
              </view>
              <view class="copy-btn" @click="copy(result.wif)" role="button" tabindex="0" :aria-label="t('copyWif')" @keydown.enter="copy(result.wif)">
                <text class="icon" aria-hidden="true">📋</text>
              </view>
            </view>
          </view>
        </ScrollReveal>

        <ScrollReveal animation="slide-left" :delay="400" v-if="result.privateKey">
          <view class="result-group warning-group">
            <view class="label-row">
              <text class="label">{{ t("privKeyLabel") }}</text>
              <text class="badge-private">{{ t("privateBadge") }}</text>
            </view>
            <view class="value-row">
              <text class="value blur" :class="{ revealed: showSecrets }">{{ result.privateKey }}</text>
              <view
                class="action-btn"
                @click="showSecrets = !showSecrets"
                role="button"
                tabindex="0"
                :aria-label="showSecrets ? t('hideSecrets') : t('showSecrets')"
                @keydown.enter="showSecrets = !showSecrets"
              >
                <text class="icon" aria-hidden="true">{{ showSecrets ? "🙈" : "👁️" }}</text>
              </view>
              <view class="copy-btn" @click="copy(result.privateKey)" role="button" tabindex="0" :aria-label="t('copyPrivateKey')" @keydown.enter="copy(result.privateKey)">
                <text class="icon" aria-hidden="true">📋</text>
              </view>
            </view>
          </view>
        </ScrollReveal>
      </view>

      <ScrollReveal animation="fade-up" :delay="200" v-if="result.opcodes && result.opcodes.length > 0">
        <view class="result-group">
          <text class="label">{{ t("disassembledOpcodes") }}</text>
          <view class="opcodes-container">
            <text v-for="(op, idx) in result.opcodes" :key="idx" class="opcode-tag">{{ op }}</text>
          </view>
        </view>
      </ScrollReveal>
    </NeoCard>
  </view>
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
