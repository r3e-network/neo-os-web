<template>
  <div :class="['miniapp-page', `theme-${name}`]">
    <!-- Atmospheric background -->
    <div class="page-atmosphere" aria-hidden="true">
      <div class="atmo-grain" />
      <div class="atmo-gradient" />
    </div>

    <!-- Status Toast -->
    <Transition name="toast">
      <div v-if="statusMessage" :class="['status-toast', statusMessage.type]" role="alert">
        <span class="toast-dot" />
        <span>{{ statusMessage.msg }}</span>
      </div>
    </Transition>

    <!-- Fireworks overlay -->
    <Fireworks v-if="fireworksActive" :active="fireworksActive" :duration="3000" aria-hidden="true" />

    <!-- ═══ THREE-COLUMN LAYOUT ═══ -->
    <div class="page-grid">
      <!-- ═══ LEFT SIDEBAR ═══ -->
      <aside class="sidebar-left" :aria-label="t('navigationSidebar')">
        <div class="sidebar-brand">
          <div class="brand-mark" aria-hidden="true">{{ brandIcon }}</div>
          <div class="brand-text">
            <span class="brand-name">{{ t("title") }}</span>
            <span class="brand-tag">{{ t("neoN3") }}</span>
          </div>
        </div>

        <nav class="sidebar-nav" role="tablist" aria-orientation="vertical">
          <button
            type="button"
            v-for="(tab, idx) in allTabs"
            :key="tab.key"
            :class="['nav-item', { active: activeTab === tab.key }]"
            :style="{ '--delay': `${idx * 40}ms` }"
            role="tab"
            :aria-selected="activeTab === tab.key"
            :aria-label="t(tab.labelKey)"
            @click="setActiveTab(tab.key)"
          >
            <span class="nav-icon" aria-hidden="true">{{ tab.icon }}</span>
            <span class="nav-label">{{ t(tab.labelKey) }}</span>
            <span v-if="activeTab === tab.key" class="nav-indicator" />
          </button>
        </nav>

        <div v-if="sidebarItems?.length" class="sidebar-stats">
          <div class="stats-divider" />
          <div v-for="(item, i) in sidebarItems" :key="`stat-${i}`" class="stat-row" :style="{ '--i': i }">
            <span class="stat-label">{{ item.label }}</span>
            <span class="stat-value">{{ item.value ?? t("notAvailable") }}</span>
          </div>
        </div>
      </aside>

      <!-- ═══ MIDDLE — Main Content ═══ -->
      <main class="content-main" role="main">
        <section class="section-hero">
          <ErrorBoundary :fallback="fallbackMessage || t('errorFallback')" :on-error="onBoundaryError" @retry="onBoundaryRetry?.()">
            <slot name="content">
              <slot name="hero" />
            </slot>
          </ErrorBoundary>
        </section>

        <section v-if="hasInfoContent" class="section-info">
          <div v-if="infoTabs.length > 1" class="info-tabs">
            <button
              type="button"
              v-for="tab in infoTabs"
              :key="tab.key"
              :class="['info-tab', { active: activeInfoTab === tab.key }]"
              @click="activeInfoTab = tab.key"
            >
              {{ t(tab.labelKey) }}
            </button>
          </div>
          <div class="info-content">
            <div v-if="activeInfoTab === 'stats'">
              <slot name="tab-stats">
                <div v-if="sidebarItems?.length" class="auto-stats-grid">
                  <div v-for="(item, i) in sidebarItems" :key="`auto-stat-${i}`" class="auto-stat-card" :style="{ '--i': i }">
                    <span class="auto-stat-value">{{ item.value ?? t("notAvailable") }}</span>
                    <span class="auto-stat-label">{{ item.label }}</span>
                  </div>
                </div>
              </slot>
            </div>
            <div v-if="activeInfoTab === 'history'"><slot name="tab-history" /></div>
            <template v-for="tab in customInfoTabs" :key="tab.key">
              <div v-if="activeInfoTab === tab.key"><slot :name="`tab-${tab.key}`" /></div>
            </template>
          </div>
        </section>

        <section class="section-comments">
          <slot name="comments">
            <div class="comments-header">
              <h3 class="comments-title">{{ t("commentsTitle") }}</h3>
              <span class="comments-count">{{ comments.length }}</span>
            </div>
            <div class="comments-input">
              <input
                v-model="newComment"
                class="comment-input"
                :placeholder="t('commentPlaceholder')"
                :aria-label="t('commentPlaceholder')"
                @keyup.enter="submitComment"
              />
              <button type="button" class="comment-submit" :disabled="!newComment.trim()" :aria-label="t('postComment')" @click="submitComment">
                {{ t("post") }}
              </button>
            </div>
            <div v-if="comments.length === 0" class="comments-empty">
              <span>{{ t("noComments") }}</span>
            </div>
            <div v-else class="comments-list">
              <div v-for="comment in comments" :key="comment.id" class="comment-item">
                <div class="comment-avatar">{{ comment.author?.[0] || "?" }}</div>
                <div class="comment-body">
                  <div class="comment-meta">
                    <span class="comment-author">{{ comment.author }}</span>
                    <span class="comment-time">{{ comment.time }}</span>
                  </div>
                  <p class="comment-text">{{ comment.text }}</p>
                  <div class="comment-actions">
                    <button type="button" class="comment-action" :aria-label="t('likeComment')" @click="$emit('like-comment', comment.id)">
                      ♡ {{ comment.likes || 0 }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </slot>
        </section>

        <section class="section-docs">
          <slot name="docs">
            <details class="docs-accordion">
              <summary class="docs-title">{{ t("docSubtitle") || t("subtitle") }}</summary>
              <div class="docs-content">
                <p class="docs-description">{{ t("docDescription") || "" }}</p>
                <div v-if="docSteps.length" class="docs-steps">
                  <h4>{{ t("howToPlay") }}</h4>
                  <ol>
                    <li v-for="(step, i) in docSteps" :key="step + i">{{ step }}</li>
                  </ol>
                </div>
                <div v-if="docFeatures.length" class="docs-features">
                  <h4>{{ t("keyFeatures") }}</h4>
                  <div v-for="(feat, i) in docFeatures" :key="feat.name + i" class="docs-feature">
                    <strong>{{ feat.name }}</strong>
                    <span>{{ feat.desc }}</span>
                  </div>
                </div>
              </div>
            </details>
          </slot>
        </section>
      </main>

      <!-- ═══ RIGHT SIDEBAR ═══ -->
      <aside class="sidebar-right" :aria-label="t('operationsPanel')">
        <div class="operation-panel">
          <slot name="operation" />
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, useSlots } from "vue";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useI18n } from "@shared/composables";
import { type StatusMessage } from "@shared/composables/useStatusMessage";
import ErrorBoundary from "./ErrorBoundary.vue";
import Fireworks from "./Fireworks.vue";

const DEFAULT_BRAND_ICON = "📱";
const DEFAULT_DOCS_ICON = "📄";

const { t } = useI18n();

export interface Comment {
  id: string;
  author: string;
  text: string;
  time: string;
  likes?: number;
}

const props = withDefaults(
  defineProps<{
    name: string;
    config: MiniAppTemplateConfig;
    state: Record<string, unknown>;
    t: (key: string) => string;
    statusMessage?: StatusMessage | null;
    fireworksActive?: boolean;
    sidebarTitle?: string;
    sidebarItems?: Array<{ label: string; value: string | number | boolean | null | undefined }>;
    fallbackMessage?: string;
    onBoundaryError?: (error: Error) => void;
    onBoundaryRetry?: () => void;
    comments?: Comment[];
  }>(),
  {
    statusMessage: null,
    fireworksActive: false,
    sidebarTitle: "",
    sidebarItems: () => [],
    fallbackMessage: undefined,
    comments: () => [],
  },
);

const emit = defineEmits<{
  (e: "tab-change", tabKey: string): void;
  (e: "submit-comment", text: string): void;
  (e: "like-comment", commentId: string): void;
}>();

const slots = useSlots();
const brandIcon = computed(() => props.config.tabs[0]?.icon ?? DEFAULT_BRAND_ICON);
const defaultTabKey = computed(() => props.config.tabs.find((t) => t.default)?.key ?? props.config.tabs[0]?.key ?? "");
const activeTab = ref(defaultTabKey.value);

const allTabs = computed(() => {
  const tabs = [...props.config.tabs];
  if (!tabs.some((t) => t.key === "docs")) {
    tabs.push({ key: "docs", labelKey: "docs", icon: DEFAULT_DOCS_ICON });
  }
  return tabs;
});

const setActiveTab = (key: string) => {
  activeTab.value = key;
  emit("tab-change", key);
};

const infoTabs = computed(() => {
  const tabs: Array<{ key: string; labelKey: string }> = [];
  if (props.sidebarItems?.length || slots["tab-stats"]) tabs.push({ key: "stats", labelKey: "stats" });
  if (slots["tab-history"]) tabs.push({ key: "history", labelKey: "history" });
  props.config.tabs
    .filter((t) => !t.default && t.key !== "stats" && t.key !== "history" && t.key !== "docs")
    .forEach((t) => {
      if (slots[`tab-${t.key}`]) tabs.push({ key: t.key, labelKey: t.labelKey });
    });
  return tabs;
});

const activeInfoTab = ref(infoTabs.value[0]?.key ?? "stats");
const customInfoTabs = computed(() => infoTabs.value.filter((t) => t.key !== "stats" && t.key !== "history"));
const hasInfoContent = computed(() => infoTabs.value.length > 0);

const newComment = ref("");
const submitComment = () => {
  if (newComment.value.trim()) {
    emit("submit-comment", newComment.value.trim());
    newComment.value = "";
  }
};

const docSteps = computed(() => {
  const steps: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const step = props.t(`step${i}`);
    if (step && step !== `step${i}`) steps.push(step);
  }
  return steps;
});

const docFeatures = computed(() => {
  const features: Array<{ name: string; desc: string }> = [];
  const featureCount = props.config.docFeatureCount ?? 3;
  for (let i = 1; i <= featureCount; i++) {
    const name = props.t(`feature${i}Name`);
    const desc = props.t(`feature${i}Desc`);
    if (name && name !== `feature${i}Name`) {
      features.push({ name, desc: desc !== `feature${i}Desc` ? desc : "" });
    }
  }
  return features;
});
</script>

<style lang="scss" scoped>
/* ═══════════════════════════════════════════════════════════
   OBSIDIAN TERMINAL — Premium Crypto-Fintech Design System
   Typography: Satoshi (display) + JetBrains Mono (data)
   Aesthetic: Deep obsidian, glass morphism, ambient glow
   ═══════════════════════════════════════════════════════════ */

// ── Fonts ──
@import url("https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap");
@import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap");

// ── Tokens ──
$font-display:
  "Satoshi",
  -apple-system,
  sans-serif;
$font-mono: "JetBrains Mono", "Fira Code", monospace;

$sidebar-w: 240px;
$panel-w: 360px;
$mobile: 768px;
$desktop: 1280px;

$obsidian: #08090a;
$surface-1: rgba(255, 255, 255, 0.025);
$surface-2: rgba(255, 255, 255, 0.045);
$surface-3: rgba(255, 255, 255, 0.07);
$border: rgba(255, 255, 255, 0.06);
$border-hover: rgba(255, 255, 255, 0.12);
$text-1: rgba(255, 255, 255, 0.92);
$text-2: rgba(255, 255, 255, 0.48);
$text-3: rgba(255, 255, 255, 0.28);
$accent: #00e599;
$accent-dim: rgba(0, 229, 153, 0.15);
$accent-glow: rgba(0, 229, 153, 0.08);
$glass: rgba(255, 255, 255, 0.02);
$glass-border: rgba(255, 255, 255, 0.04);
$radius-sm: 8px;
$radius-md: 12px;
$radius-lg: 16px;

// ── Atmosphere (noise + gradient) ──
.page-atmosphere {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.atmo-grain {
  position: absolute;
  inset: 0;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 256px;
  mix-blend-mode: overlay;
}

.atmo-gradient {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 50% at 15% 20%, $accent-glow 0%, transparent 70%),
    radial-gradient(ellipse 40% 60% at 85% 80%, rgba(99, 102, 241, 0.04) 0%, transparent 70%);
}

// ── Page ──
.miniapp-page {
  position: relative;
  min-height: 100vh;
  background: $obsidian;
  color: $text-1;
  font-family: $font-display;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.page-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: $sidebar-w 1fr $panel-w;
  grid-template-areas: "left center right";
  max-width: 1680px;
  margin: 0 auto;
  min-height: 100vh;

  @media (max-width: $desktop) {
    grid-template-columns: 220px 1fr 320px;
  }
  @media (max-width: $mobile) {
    grid-template-columns: 1fr;
    grid-template-areas: "center" "right" "left";
  }
}

// ── LEFT SIDEBAR ──
.sidebar-left {
  grid-area: left;
  border-right: 1px solid $border;
  padding: 20px 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: $glass;
  backdrop-filter: blur(20px);

  // Custom scrollbar
  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: $border-hover;
    border-radius: 3px;
  }

  @media (max-width: $mobile) {
    position: static;
    height: auto;
    border-right: none;
    border-top: 1px solid $border;
    flex-direction: row;
    flex-wrap: wrap;
    padding: 12px 16px;
    gap: 6px;
    backdrop-filter: none;
  }
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 20px 24px;
  margin-bottom: 8px;
  border-bottom: 1px solid $border;

  @media (max-width: $mobile) {
    display: none;
  }
}

.brand-mark {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: $accent-dim;
  border: 1px solid rgba(0, 229, 153, 0.2);
  border-radius: 10px;
  box-shadow: 0 0 12px $accent-glow;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.brand-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.brand-tag {
  font-size: 10px;
  font-weight: 500;
  color: $text-3;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 12px;

  @media (max-width: $mobile) {
    flex-direction: row;
    gap: 6px;
    padding: 0;
  }
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: none;
  background: transparent;
  color: $text-2;
  font-family: $font-display;
  font-size: 13px;
  font-weight: 500;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  width: 100%;
  animation: nav-stagger 0.3s ease-out both;
  animation-delay: var(--delay);

  &:hover {
    background: $surface-2;
    color: $text-1;
    transform: translateX(2px);
  }

  &.active {
    background: $surface-2;
    color: $text-1;
    font-weight: 600;

    .nav-indicator {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 20px;
      background: $accent;
      border-radius: 0 3px 3px 0;
      box-shadow: 0 0 8px $accent-dim;
    }
  }

  .nav-icon {
    font-size: 15px;
    width: 20px;
    text-align: center;
    flex-shrink: 0;
  }
  .nav-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: $mobile) {
    padding: 7px 14px;
    font-size: 12px;
    border-radius: 20px;
    border: 1px solid $border;
    width: auto;
    animation: none;

    &:hover {
      transform: none;
    }
    &.active {
      border-color: rgba(0, 229, 153, 0.3);
      background: $accent-dim;
    }
    .nav-label {
      display: none;
    }
    .nav-indicator {
      display: none;
    }
  }
}

@keyframes nav-stagger {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.sidebar-stats {
  margin-top: auto;
  padding: 0 20px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  @media (max-width: $mobile) {
    display: none;
  }
}

.stats-divider {
  height: 1px;
  background: $border;
  margin-bottom: 12px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  padding: 4px 0;
  animation: stat-fade 0.4s ease both;
  animation-delay: calc(var(--i) * 60ms + 200ms);

  .stat-label {
    color: $text-3;
    font-weight: 500;
  }
  .stat-value {
    font-weight: 600;
    font-family: $font-mono;
    font-size: 11px;
    color: $text-2;
    letter-spacing: -0.01em;
  }
}

@keyframes stat-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

// ── MIDDLE CONTENT ──
.content-main {
  grid-area: center;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  border-right: 1px solid $border;
  border-left: 1px solid $border;

  // Clean scrollbar
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: $border-hover;
    border-radius: 4px;
  }

  @media (max-width: $mobile) {
    border: none;
  }
}

.section-hero {
  padding: 28px;
  border-bottom: 1px solid $border;
  min-height: 280px;
  display: flex;
  align-items: stretch;

  // Allow hero content to fill
  :deep(> *) {
    width: 100%;
  }

  @media (max-width: $mobile) {
    padding: 20px 16px;
    min-height: 200px;
  }
}

.section-info {
  border-bottom: 1px solid $border;
}

.info-tabs {
  display: flex;
  border-bottom: 1px solid $border;
  padding: 0 28px;
  gap: 0;
}

.info-tab {
  padding: 13px 18px;
  border: none;
  background: transparent;
  color: $text-3;
  font-family: $font-display;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  letter-spacing: -0.01em;

  &:hover {
    color: $text-2;
  }
  &.active {
    color: $text-1;
    border-bottom-color: $accent;
    font-weight: 600;
  }
}

.info-content {
  padding: 24px 28px;
  @media (max-width: $mobile) {
    padding: 16px;
  }
}

.auto-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}

.auto-stat-card {
  background: $surface-1;
  border: 1px solid $glass-border;
  border-radius: $radius-md;
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  animation: card-in 0.4s ease both;
  animation-delay: calc(var(--i) * 50ms);

  &:hover {
    background: $surface-2;
    border-color: $border-hover;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .auto-stat-value {
    font-size: 22px;
    font-weight: 700;
    font-family: $font-mono;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, $text-1, $text-2);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .auto-stat-label {
    font-size: 10px;
    color: $text-3;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
  }
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ── COMMENTS ──
.section-comments {
  padding: 28px;
  border-bottom: 1px solid $border;
  @media (max-width: $mobile) {
    padding: 20px 16px;
  }
}

.comments-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.comments-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.02em;
}

.comments-count {
  background: $surface-2;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  color: $text-3;
  font-family: $font-mono;
}

.comments-input {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.comment-input {
  flex: 1;
  padding: 11px 18px;
  background: $surface-1;
  border: 1px solid $border;
  border-radius: 24px;
  color: $text-1;
  font-family: $font-display;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;

  &:focus {
    border-color: rgba(0, 229, 153, 0.4);
    box-shadow: 0 0 0 3px $accent-glow;
    background: $surface-2;
  }
  &::placeholder {
    color: $text-3;
  }
}

.comment-submit {
  padding: 11px 22px;
  background: linear-gradient(135deg, $accent, #00c07f);
  color: $obsidian;
  border: none;
  border-radius: 24px;
  font-family: $font-display;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: -0.01em;

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 229, 153, 0.3);
  }
  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

.comments-empty {
  text-align: center;
  padding: 40px 20px;
  color: $text-3;
  font-size: 13px;
  font-style: italic;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.comment-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: $radius-md;
  transition: background 0.15s;
  &:hover {
    background: $surface-1;
  }
}

.comment-avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: linear-gradient(135deg, $surface-2, $surface-3);
  border: 1px solid $glass-border;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  color: $text-2;
}

.comment-body {
  flex: 1;
  min-width: 0;
}
.comment-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.comment-author {
  font-size: 13px;
  font-weight: 600;
}
.comment-time {
  font-size: 11px;
  color: $text-3;
}
.comment-text {
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  color: $text-2;
}
.comment-actions {
  margin-top: 6px;
}

.comment-action {
  background: none;
  border: none;
  color: $text-3;
  font-size: 12px;
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 6px;
  transition: all 0.15s;
  font-family: $font-display;
  &:hover {
    background: $surface-2;
    color: $text-1;
  }
}

// ── DOCS ──
.section-docs {
  padding: 28px;
  @media (max-width: $mobile) {
    padding: 20px 16px;
  }
}

.docs-accordion {
  border: 1px solid $border;
  border-radius: $radius-md;
  overflow: hidden;
  transition: border-color 0.2s;
  &[open] {
    border-color: $border-hover;
  }
}

.docs-title {
  padding: 16px 22px;
  font-family: $font-display;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: $surface-1;
  color: $text-2;
  list-style: none;
  transition: all 0.2s;
  letter-spacing: -0.01em;

  &::-webkit-details-marker {
    display: none;
  }
  &::before {
    content: "› ";
    margin-right: 8px;
    font-weight: 400;
    transition: transform 0.2s;
    display: inline-block;
  }
  [open] > &::before {
    transform: rotate(90deg);
  }
  &:hover {
    background: $surface-2;
    color: $text-1;
  }
}

.docs-content {
  padding: 22px;
  font-size: 13px;
  line-height: 1.7;
  color: $text-2;

  h4 {
    font-size: 13px;
    font-weight: 700;
    margin: 20px 0 8px;
    color: $text-1;
    letter-spacing: -0.01em;
  }
  ol {
    padding-left: 20px;
  }
  li {
    margin-bottom: 8px;
    color: $text-2;
  }
}

.docs-description {
  margin: 0 0 16px;
}

.docs-features {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.docs-feature {
  padding: 14px;
  background: $surface-1;
  border: 1px solid $glass-border;
  border-radius: $radius-sm;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.2s;

  &:hover {
    background: $surface-2;
    border-color: $border-hover;
  }
  strong {
    font-size: 13px;
    color: $text-1;
  }
  span {
    font-size: 12px;
    color: $text-3;
    line-height: 1.5;
  }
}

// ── RIGHT SIDEBAR ──
.sidebar-right {
  grid-area: right;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  background: $glass;
  backdrop-filter: blur(20px);

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: $border-hover;
    border-radius: 3px;
  }

  @media (max-width: $mobile) {
    position: static;
    height: auto;
    backdrop-filter: none;
  }
}

.operation-panel {
  padding: 24px 20px;
  @media (max-width: $mobile) {
    padding: 20px 16px;
  }
}

// ── STATUS TOAST ──
.status-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 24px;
  border-radius: 12px;
  font-family: $font-display;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  backdrop-filter: blur(16px);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05);

  &.success {
    background: rgba(5, 150, 105, 0.9);
    color: #fff;
    .toast-dot {
      background: #34d399;
      box-shadow: 0 0 8px #34d399;
    }
  }
  &.error {
    background: rgba(185, 28, 28, 0.9);
    color: #fff;
    .toast-dot {
      background: #f87171;
      box-shadow: 0 0 8px #f87171;
    }
  }
  &.warning {
    background: rgba(217, 119, 6, 0.9);
    color: #fff;
    .toast-dot {
      background: #fbbf24;
      box-shadow: 0 0 8px #fbbf24;
    }
  }
  &.info {
    background: rgba(37, 99, 235, 0.9);
    color: #fff;
    .toast-dot {
      background: #60a5fa;
      box-shadow: 0 0 8px #60a5fa;
    }
  }
  &.danger {
    background: rgba(220, 38, 38, 0.9);
    color: #fff;
    .toast-dot {
      background: #f87171;
      box-shadow: 0 0 8px #f87171;
    }
  }
  &.loading {
    background: rgba(75, 85, 99, 0.9);
    color: #fff;
    .toast-dot {
      background: #9ca3af;
      box-shadow: 0 0 8px #9ca3af;
    }
  }
}

.toast-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  animation: toast-pulse 1.5s ease-in-out infinite;
}

@keyframes toast-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-16px) scale(0.95);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px) scale(0.98);
}
</style>
