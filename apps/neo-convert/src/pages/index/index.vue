<template>
  <MiniAppPage
    name="neo-convert"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    @tab-change="activeTab = $event"
  >
    <!-- LEFT panel: Account Generator -->
    <template #content>
      <div class="hero-container">
        <HeroSection variant="erobo" icon="🛠️" compact>
          <template #background>
            <div class="converter-scene" aria-hidden="true">
              <div class="convert-arrow convert-arrow--left">⟵</div>
              <div class="convert-arrow convert-arrow--right">⟶</div>
            </div>
          </template>
        </HeroSection>
      </div>

      <div class="hero">
        <ScrollReveal animation="fade-down" :duration="800">
          <span class="hero-icon" aria-hidden="true">🛠️</span>
          <span class="hero-title">{{ t("heroTitle") }}</span>
          <span class="hero-subtitle">{{ t("heroSubtitle") }}</span>
        </ScrollReveal>
      </div>

      <ScrollReveal animation="fade-up" :delay="200" key="gen">
        <AccountGenerator />
      </ScrollReveal>
    </template>

    <template #tab-convert>
      <div class="hero">
        <ScrollReveal animation="fade-down" :duration="800">
          <span class="hero-icon" aria-hidden="true">🛠️</span>
          <span class="hero-title">{{ t("heroTitle") }}</span>
          <span class="hero-subtitle">{{ t("heroSubtitle") }}</span>
        </ScrollReveal>
      </div>

      <ScrollReveal animation="fade-up" :delay="200" key="conv">
        <ConverterTool />
      </ScrollReveal>
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('quickTools')">
        <div class="op-tools">
          <NeoButton size="sm" variant="primary" class="op-btn" @click="activeTab = 'generate'">
            {{ t("tabGenerate") }}
          </NeoButton>
          <NeoButton size="sm" variant="secondary" class="op-btn" @click="activeTab = 'convert'">
            {{ t("tabConvert") }}
          </NeoButton>
        </div>
        <div class="op-hint">
          <span class="op-hint-text">{{ t("heroSubtitle") }}</span>
        </div>
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { MiniAppPage, ScrollReveal, HeroSection } from "@shared/components";
import AccountGenerator from "./components/AccountGenerator.vue";
import { messages } from "@/locale/messages";
import { createMiniApp } from "@shared/utils/createMiniApp";

const windowWidth = ref(typeof window !== "undefined" ? window.innerWidth : 1024);
const isMobile = computed(() => windowWidth.value < 768);
const updateWindowWidth = () => {
  if (typeof window !== "undefined") {
    windowWidth.value = window.innerWidth;
  }
};

onMounted(() => {
  window.addEventListener("resize", updateWindowWidth);
  window.addEventListener("orientationchange", updateWindowWidth);
  updateWindowWidth();
});

onUnmounted(() => {
  window.removeEventListener("resize", updateWindowWidth);
  window.removeEventListener("orientationchange", updateWindowWidth);
});

const activeTab = ref("generate");

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, handleBoundaryError } = createMiniApp({
  name: "neo-convert",
  messages,
  template: {
    tabs: [
      { key: "generate", labelKey: "tabGenerate", icon: "👛", default: true },
      { key: "convert", labelKey: "tabConvert", icon: "🔄" },
    ],
    docTitleKey: "docTitle",
    docFeatureCount: 4,
    docStepPrefix: "docStep",
    docFeaturePrefix: "docFeature",
  },
  sidebarItems: [
    { labelKey: "sidebarActiveTab", value: () => activeTab.value },
    { labelKey: "sidebarMode", value: () => (isMobile.value ? t("sidebarMobile") : t("sidebarDesktop")) },
  ],
});

const appState = computed(() => ({
  activeTab: activeTab.value,
}));
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./neo-convert-theme.scss" as *;

:global(body) {
  background: var(--bg-primary);
}

.hero-container {
  margin-bottom: 20px;
}

.converter-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 40px;
  height: 60px;
}

.convert-arrow {
  font-size: 24px;
  color: rgba(159, 157, 243, 0.5);
  animation: arrow-pulse 2s ease-in-out infinite;
}

.convert-arrow--right {
  animation-delay: 1s;
}

@keyframes arrow-pulse {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.8;
  }
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

@keyframes convert-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 0 12px rgba(0, 229, 153, 0.2);
  }
  50% {
    box-shadow: 0 0 28px rgba(0, 229, 153, 0.5);
  }
}

.hero {
  background: radial-gradient(ellipse at center, rgba(0, 229, 153, 0.08) 0%, transparent 60%);
}

.hero-icon {
  animation: pulse-glow 3s ease-in-out infinite;
  border-radius: 50%;
}

.hero-title {
  background: linear-gradient(135deg, #fff, rgba(0, 229, 153, 0.8));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

</style>
