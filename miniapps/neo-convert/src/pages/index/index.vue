<template>
  <view class="theme-neo-convert">
    <MiniAppTemplate :config="templateConfig" :state="appState" :t="t" @tab-change="activeTab = $event">
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t("overview") }}</text>
        </view>
      </template>

      <template #content>
        <view class="content-area">
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
        </view>
      </template>

      <template #tab-convert>
        <view class="content-area">
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
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";

// Responsive state
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value < 768);
const isDesktop = computed(() => windowWidth.value >= 1024);
const handleResize = () => {
  windowWidth.value = window.innerWidth;
};

onMounted(() => window.addEventListener("resize", handleResize));
onUnmounted(() => window.removeEventListener("resize", handleResize));
import { MiniAppTemplate, ScrollReveal } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import AccountGenerator from "./components/AccountGenerator.vue";
import ConverterTool from "./components/ConverterTool.vue";
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "swap-interface",
  tabs: [
    { key: "generate", labelKey: "tabGenerate", icon: "👛", default: true },
    { key: "convert", labelKey: "tabConvert", icon: "🔄" },
  ],
  features: {
    chainWarning: true,
    statusMessages: true,
  },
};
const activeTab = ref("generate");
const appState = computed(() => ({
  activeTab: activeTab.value,
}));
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./neo-convert-theme.scss";

.content-area {
  padding: 16px;
  min-height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
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

/* Mobile-specific styles */
@media (max-width: 767px) {
  .content-area {
    padding: 12px;
  }
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

/* Desktop styles */
@media (min-width: 1024px) {
  .content-area {
    padding: 24px;
    max-width: 900px;
    margin: 0 auto;
  }
  .hero-title {
    font-size: 32px;
  }
}

// Desktop sidebar
.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
