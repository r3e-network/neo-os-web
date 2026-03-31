<template>
  <div class="neo-ns-play-area">
    <!-- ── Hero Section ── -->
    <div class="hero-container">
      <HeroSection variant="erobo-neo" icon="globe" compact>
        <template #stats>
          <HeroStatsStrip :items="heroStatsItems" />
        </template>
      </HeroSection>
    </div>

    <!-- ── Error Display ── -->
    <div v-if="error" class="error-banner">
      {{ error }}
    </div>

    <!-- ── Domain Management ── -->
    <ManageDomain
      v-if="managingDomain"
      :domain="managingDomain"
      :loading="loading"
      @cancel="handleCancelManage"
      @setTarget="handleSetTarget"
      @transfer="handleTransfer"
    />

    <DomainManagement v-else :domains="myDomains" @manage="handleShowManage" @renew="handleRenew" />
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — The custom play area for Neo Name Service
 *
 * Renders the hero stats, domain list, and domain management panel.
 * Everything else (sidebar, stats, operation panel for registration,
 * docs, shell chrome) is rendered by the platform based on manifest.ts.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { HeroSection, HeroStatsStrip } from "@shared/components";
import type { HeroStatsStripItem } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import DomainManagement from "./pages/index/components/DomainManagement.vue";
import ManageDomain from "./pages/index/components/ManageDomain.vue";

// ── Props ─────────────────────────────────────────────────────────────
const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

// ── Translation shorthand ─────────────────────────────────────────────
const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
const loading = computed(() => Boolean(props.state.loading?.value ?? false));
const error = computed(() => String(props.state.error?.value ?? ""));
const myDomains = computed(() => {
  const raw = props.state.myDomains?.value;
  return Array.isArray(raw) ? raw : [];
});
const managingDomain = computed(() => {
  const raw = props.state.managingDomain?.value;
  return raw ?? null;
});

const heroStatsItems = computed<HeroStatsStripItem[]>(() => [
  { value: myDomains.value.length, label: t("tabDomains") },
]);

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleShowManage = (domain: unknown) => {
  const handler = actions.get("showManage");
  if (handler) handler(domain);
};

const handleCancelManage = () => {
  const handler = actions.get("cancelManage");
  if (handler) handler();
};

const handleRenew = async (domain: unknown) => {
  const handler = actions.get("handleRenew");
  if (handler) await handler(domain);
};

const handleSetTarget = async (targetAddress: string) => {
  const handler = actions.get("handleSetTarget");
  if (handler) await handler(targetAddress);
};

const handleTransfer = async (transferAddress: string) => {
  const handler = actions.get("handleTransfer");
  if (handler) await handler(transferAddress);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.neo-ns-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
}

.error-banner {
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
  font-size: 13px;
  line-height: 1.5;
}

/* ── Neo NS Hero Enhancements ── */
@keyframes ns-typing-cursor {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

@keyframes ns-dns-pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0, 188, 212, 0.4);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 0 24px 4px rgba(0, 188, 212, 0.15);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0, 188, 212, 0);
  }
}

@keyframes ns-gradient-shift {
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

@media (prefers-reduced-motion: reduce) {
  .hero-container,
  .hero-container::after {
    animation: none;
  }
  :deep(.hero-stats-strip__item) {
    animation: none;
  }
}

.hero-container {
  background: linear-gradient(135deg, rgba(0, 188, 212, 0.12), rgba(0, 105, 148, 0.06), rgba(0, 229, 153, 0.08));
  background-size: 200% 200%;
  animation: ns-gradient-shift 8s ease-in-out infinite;
  box-shadow:
    0 0 30px rgba(0, 188, 212, 0.08),
    inset 0 1px 0 rgba(0, 188, 212, 0.1);
  border: 1px solid rgba(0, 188, 212, 0.1);
  border-radius: 16px;
  position: relative;
  overflow: hidden;

  &::after {
    content: "\2588";
    position: absolute;
    top: 16px;
    right: 20px;
    font-size: 14px;
    color: rgba(0, 188, 212, 0.5);
    animation: ns-typing-cursor 1s step-end infinite;
    font-family: monospace;
  }
}

:deep(.hero-stats-strip__item) {
  --hero-stat-bg: rgba(0, 188, 212, 0.12);
  --hero-stat-border: rgba(0, 188, 212, 0.15);
  animation: ns-dns-pulse 3s ease-in-out infinite;
  box-shadow: 0 0 16px rgba(0, 188, 212, 0.1);
}
</style>
