<template>
  <div class="neo-convert-play-area">
    <!-- ── Hero Section ── -->
    <div class="hero-container">
      <HeroSection variant="erobo" icon="repeat" compact>
        <template #background>
          <div class="converter-scene" aria-hidden="true">
            <div class="convert-arrow convert-arrow--left">&llarr;</div>
            <div class="convert-arrow convert-arrow--right">&rlarr;</div>
          </div>
        </template>
      </HeroSection>
    </div>

    <div class="hero">
      <ScrollReveal animation="fade-down" :duration="800">
        <span class="hero-icon" aria-hidden="true">&#x1F6E0;&#xFE0F;</span>
        <span class="hero-title">{{ t("heroTitle") }}</span>
        <span class="hero-subtitle">{{ t("heroSubtitle") }}</span>
      </ScrollReveal>
    </div>

    <!-- ── Account Generator ── -->
    <ScrollReveal animation="fade-up" :delay="200" key="gen">
      <AccountGenerator />
    </ScrollReveal>
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — The custom play area for Neo Convert
 *
 * Renders the hero section and account generator tool.
 * Everything else (sidebar, stats, converter tab, operation panel, docs,
 * shell chrome) is rendered by the platform based on manifest.ts configuration.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { HeroSection, ScrollReveal } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import AccountGenerator from "./pages/index/components/AccountGenerator.vue";

// ── Props ─────────────────────────────────────────────────────────────
const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

// ── Translation shorthand ─────────────────────────────────────────────
const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.neo-convert-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 12px;
  min-height: 300px;
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

@media (prefers-reduced-motion: reduce) {
  .convert-arrow,
  .hero-icon {
    animation: none;
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
  background: var(--convert-hero-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
