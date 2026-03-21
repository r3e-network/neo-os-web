<template>
  <MiniAppPage
    name="neo-sign-anything"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    @tab-change="onTabChange"
  >
    <template #content>
      <div class="hero-container">
        <HeroSection variant="erobo" compact>
          <template #background>
            <div class="sign-scene" aria-hidden="true">
              <div class="pen-graphic" aria-hidden="true">✒️</div>
              <div class="checkmark-graphic" aria-hidden="true">✓</div>
            </div>
          </template>
        </HeroSection>
      </div>

      <div class="header">
        <span class="title">{{ t("signTitle") }}</span>
        <span class="subtitle">{{ t("signDesc") }}</span>
      </div>

      <div v-if="signature" class="result-card" role="status" aria-live="polite">
        <NeoCard variant="erobo-neo">
          <div class="result-header">
            <span class="result-title">{{ t("signatureResult") }}</span>
            <button type="button" class="copy-btn" :aria-label="t('copySignature')" @click="copyToClipboard(signature)">
              <span class="copy-text">{{ t("copy") }}</span>
            </button>
          </div>
          <span class="result-text">{{ signature }}</span>
        </NeoCard>
      </div>

      <div v-if="txHash" class="result-card" role="status" aria-live="polite">
        <NeoCard variant="erobo-purple">
          <div class="result-header">
            <span class="result-title">{{ t("broadcastResult") }}</span>
            <button type="button" class="copy-btn" :aria-label="t('copyTxHash')" @click="copyToClipboard(txHash)">
              <span class="copy-text">{{ t("copy") }}</span>
            </button>
          </div>
          <span class="result-text">{{ txHash }}</span>
          <span class="success-msg">{{ t("broadcastSuccess") }}</span>
        </NeoCard>
      </div>

      <div v-if="!address" class="connect-prompt">
        <span class="connect-text">{{ t("connectWallet") }}</span>
      </div>
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('signTitle')">
        <div class="input-group">
          <NeoInput
            type="textarea"
            v-model="message"
            :label="t('messageLabel')"
            :placeholder="t('messagePlaceholder')"
          />
          <div class="char-count">{{ message.length }}/1000</div>
        </div>

        <div class="actions">
          <NeoButton variant="primary" block :loading="isSigning" @click="signMessage" :disabled="!message || !address">
            {{ t("signBtn") }}
          </NeoButton>

          <NeoButton
            variant="ghost"
            block
            :loading="isBroadcasting"
            @click="broadcastMessage"
            :disabled="!message || !address"
            class="broadcast-btn"
          >
            {{ t("broadcastBtn") }}
          </NeoButton>
        </div>
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { MiniAppPage, NeoCard, HeroSection } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";
import { useSignAnything } from "./composables/useSignAnything";

const { t, templateConfig, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "neo-sign-anything",
  messages,
  template: {
    tabs: [{ key: "home", labelKey: "home", icon: "🏠", default: true }],
  },
});

const {
  address,
  message,
  signature,
  txHash,
  isSigning,
  isBroadcasting,
  status,
  appState,
  sidebarItems,
  onTabChange,
  signMessage,
  broadcastMessage,
  copyToClipboard,
} = useSignAnything(t);
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./neo-sign-anything-theme.scss" as *;
@use "./sign-anything-components" as *;

@include page-background(var(--bg-primary));

.hero-container {
  margin-bottom: 20px;
}

.sign-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  height: 70px;
}

.pen-graphic {
  font-size: 32px;
  transform: rotate(-30deg);
}

.checkmark-graphic {
  font-size: 28px;
  color: rgba(0, 229, 153, 0.6);
  font-weight: 900;
}

.header {
  margin-bottom: 8px;
}

.title {
  font-size: 28px;
  font-weight: 900;
  color: var(--text-primary);
  display: block;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.broadcast-btn {
  margin-top: 12px;
}

@media (max-width: 767px) {
  .title {
    font-size: 22px;
  }
  .subtitle {
    font-size: 13px;
  }
  .textarea {
    height: 100px;
  }
}

/* ── Neo Sign Hero Enhancements ── */
@keyframes sign-stroke-draw {
  0% {
    stroke-dashoffset: 200;
    opacity: 0.3;
  }
  50% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
  100% {
    stroke-dashoffset: -200;
    opacity: 0.3;
  }
}

@keyframes sign-seal-glow {
  0%,
  100% {
    box-shadow: 0 0 8px rgba(30, 64, 175, 0.2);
    transform: scale(1);
  }
  50% {
    box-shadow:
      0 0 28px rgba(30, 64, 175, 0.45),
      0 0 56px rgba(30, 64, 175, 0.15);
    transform: scale(1.05);
  }
}

@keyframes sign-ink-flow {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.hero-container {
  background: linear-gradient(135deg, rgba(30, 64, 175, 0.12), rgba(59, 130, 246, 0.06), rgba(99, 102, 241, 0.08));
  background-size: 200% 200%;
  animation: sign-ink-flow 6s ease-in-out infinite;
  box-shadow:
    0 0 30px rgba(30, 64, 175, 0.1),
    inset 0 1px 0 rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(30, 64, 175, 0.12);
  border-radius: 16px;
  padding: 24px 20px;
}

.sign-scene {
  position: relative;
}

.pen-graphic {
  animation: sign-seal-glow 3s ease-in-out infinite;
  border-radius: 50%;
  padding: 8px;
  background: radial-gradient(circle, rgba(30, 64, 175, 0.15), transparent 70%);
  filter: drop-shadow(0 0 10px rgba(30, 64, 175, 0.3));
}

.checkmark-graphic {
  animation: sign-seal-glow 3s ease-in-out infinite 0.5s;
  text-shadow:
    0 0 12px rgba(0, 229, 153, 0.4),
    0 0 24px rgba(0, 229, 153, 0.15);
}

/* ── Neo Sign Anything 🏆 Hero Enhancements: Signature Premium ── */
@keyframes pen-writing {
  0%,
  100% {
    transform: rotate(-30deg) translateX(0);
  }
  25% {
    transform: rotate(-25deg) translateX(4px) translateY(-2px);
  }
  50% {
    transform: rotate(-35deg) translateX(8px);
  }
  75% {
    transform: rotate(-28deg) translateX(4px) translateY(2px);
  }
}
@keyframes seal-stamp-press {
  0%,
  100% {
    transform: scale(1);
    filter: brightness(1);
  }
  15% {
    transform: scale(1.15);
    filter: brightness(1.3);
  }
  30% {
    transform: scale(0.95);
    filter: brightness(0.95);
  }
  50% {
    transform: scale(1.02);
    filter: brightness(1.05);
  }
}

.pen-graphic {
  animation: pen-writing 4s ease-in-out infinite;
}
.checkmark-graphic {
  animation: seal-stamp-press 3.5s ease-in-out infinite 0.3s;
}
.sign-scene {
  background: radial-gradient(circle at 50% 50%, rgba(30, 64, 175, 0.12), transparent 65%);
}
.hero-container {
  box-shadow:
    0 0 30px rgba(30, 64, 175, 0.15),
    0 8px 32px rgba(30, 64, 175, 0.08),
    inset 0 1px 0 rgba(59, 130, 246, 0.15);
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;
  &:hover {
    box-shadow:
      0 0 40px rgba(30, 64, 175, 0.25),
      0 12px 40px rgba(30, 64, 175, 0.12),
      inset 0 1px 0 rgba(59, 130, 246, 0.2);
    transform: translateY(-2px);
  }
}
.result-card {
  box-shadow: 0 4px 20px rgba(30, 64, 175, 0.1);
  background: linear-gradient(180deg, rgba(30, 64, 175, 0.03), transparent);
}
.header .title {
  text-shadow: 0 0 24px rgba(30, 64, 175, 0.15);
}
</style>
