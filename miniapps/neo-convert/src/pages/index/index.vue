<template>
  <view class="theme-neo-convert">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <!-- LEFT panel: Account Generator -->
      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <view class="hero">
            <ScrollReveal animation="fade-down" :duration="800">
              <text class="hero-icon">🛠️</text>
              <text class="hero-title">{{ t("heroTitle") }}</text>
              <text class="hero-subtitle">{{ t("heroSubtitle") }}</text>
            </ScrollReveal>
          </view>

          <ScrollReveal animation="fade-up" :delay="200" key="gen">
            <AccountGenerator />
          </ScrollReveal>
        </ErrorBoundary>
      </template>

      <template #tab-convert>
        <view class="hero">
          <ScrollReveal animation="fade-down" :duration="800">
            <text class="hero-icon">🛠️</text>
            <text class="hero-title">{{ t("heroTitle") }}</text>
            <text class="hero-subtitle">{{ t("heroSubtitle") }}</text>
          </ScrollReveal>
        </view>

        <ScrollReveal animation="fade-up" :delay="200" key="conv">
          <ConverterTool />
        </ScrollReveal>
      </template>

      <template #operation>
        <NeoCard variant="erobo" :title="t('quickTools')">
          <view class="op-tools">
            <NeoButton size="sm" variant="primary" class="op-btn" @click="activeTab = 'generate'">
              {{ t("tabGenerate") }}
            </NeoButton>
            <NeoButton size="sm" variant="secondary" class="op-btn" @click="activeTab = 'convert'">
              {{ t("tabConvert") }}
            </NeoButton>
          </view>
          <view class="op-hint">
            <text class="op-hint-text">{{ t("heroSubtitle") }}</text>
          </view>
        </NeoCard>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useResponsive } from "@shared/composables/useResponsive";
import { MiniAppTemplate, NeoCard, NeoButton, ScrollReveal, SidebarPanel, ErrorBoundary } from "@shared/components";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import AccountGenerator from "./components/AccountGenerator.vue";
import ConverterTool from "./components/ConverterTool.vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";
import { messages } from "@/locale/messages";

const { isMobile } = useResponsive();

const { t } = createUseI18n(messages)();
const { status } = useStatusMessage();
const templateConfig = createTemplateConfig({
  tabs: [
    { key: "generate", labelKey: "tabGenerate", icon: "👛", default: true },
    { key: "convert", labelKey: "tabConvert", icon: "🔄" },
  ],
  docTitleKey: "docTitle",
  docFeatureCount: 4,
  docStepPrefix: "docStep",
  docFeaturePrefix: "docFeature",
});
const activeTab = ref("generate");
const appState = computed(() => ({
  activeTab: activeTab.value,
}));

const sidebarItems = createSidebarItems(t, [
  { labelKey: "sidebarActiveTab", value: () => activeTab.value },
  { labelKey: "sidebarMode", value: () => (isMobile.value ? t("sidebarMobile") : t("sidebarDesktop")) },
]);

const { handleBoundaryError, resetAndReload } = useHandleBoundaryError("neo-convert");
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./neo-convert-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.op-tools {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.op-btn {
  width: 100%;
}

.op-hint {
  padding: 8px;
  background: var(--bg-card-subtle, rgba(255, 255, 255, 0.04));
  border-radius: 8px;
  text-align: center;
}

.op-hint-text {
  font-size: 11px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  line-height: 1.4;
}

.hero {
  text-align: center;
  margin: 30px 0 40px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 24px;

  .hero-icon {
    font-size: 40px;
    display: block;
    margin-bottom: 16px;
  }

  .hero-title {
    display: block;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: var(--convert-hero-gradient);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 12px;
  }

  .hero-subtitle {
    display: block;
    font-size: 15px;
    color: var(--text-secondary);
    max-width: 80%;
    margin: 0 auto;
    line-height: 1.5;
  }
}

@media (max-width: 767px) {
  .hero {
    margin: 20px 0 30px;
    padding-bottom: 16px;
  }
  .hero-icon {
    font-size: 32px;
  }
  .hero-title {
    font-size: 22px;
  }
  .hero-subtitle {
    font-size: 13px;
    max-width: 100%;
  }
}
</style>
