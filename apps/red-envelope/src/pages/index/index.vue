<template>
  <MiniAppPage
    name="red-envelope"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :fireworks-active="!!luckyMessage"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadEnvelopes"
  >
    <!-- Create Tab (default) - LEFT panel -->
    <template #content>
      <LuckyOverlay :lucky-message="luckyMessage" @close="luckyMessage = null" />
      <OpeningModal
        :visible="showOpeningModal"
        :envelope="openingEnvelope"
        :is-connected="!!address"
        :is-opening="!!openingId"
        @connect="handleConnect"
        @open="() => openingEnvelope && openEnvelope(openingEnvelope)"
        @close="showOpeningModal = false"
      />

      <div class="hero-container">
        <!-- Red Envelope Graphic (CSS-drawn) -->
        <div :class="['red-envelope-hero', { opening: !!luckyMessage }]">
          <!-- Envelope flap -->
          <div class="envelope-flap">
            <div class="flap-fold" />
          </div>
          <!-- Envelope body -->
          <div class="envelope-body">
            <div class="envelope-seal">
              <span class="seal-character">福</span>
            </div>
            <!-- Gold trim -->
            <div class="envelope-trim-top" />
            <div class="envelope-trim-bottom" />
          </div>
          <!-- Sparkle decorations -->
          <div class="envelope-sparkles">
            <span v-for="i in 5" :key="i" class="sparkle" :style="{ animationDelay: `${i * 0.3}s` }"><AppIcon name="sparkle" :size="14" aria-hidden="true" /></span>
          </div>
        </div>

        <!-- Stats -->
        <div class="hero-envelope-stats">
          <div class="hero-stat">
            <span class="hero-stat-value">{{ envelopes.length }}</span>
            <span class="hero-stat-label">{{ t("sidebarEnvelopes") }}</span>
          </div>
          <div class="hero-stat-divider" />
          <div class="hero-stat">
            <span class="hero-stat-value">{{ pools.length }}</span>
            <span class="hero-stat-label">{{ t("sidebarPools") }}</span>
          </div>
          <div class="hero-stat-divider" />
          <div class="hero-stat">
            <span class="hero-stat-value">{{ claims.length }}</span>
            <span class="hero-stat-label">{{ t("sidebarClaims") }}</span>
          </div>
        </div>
      </div>
    </template>
    <template #operation>
      <CreateForm
        :is-loading="isLoading"
        v-model:name="name"
        v-model:description="description"
        v-model:amount="amount"
        v-model:count="count"
        v-model:expiryHours="expiryHours"
        v-model:minNeoRequired="minNeoRequired"
        v-model:minHoldDays="minHoldDays"
        v-model:envelopeType="envelopeType"
        @create="create"
      />
    </template>

    <!-- Claim Tab -->
    <template #tab-claim>
      <ClaimPool :pools="pools" @claim="handleClaimFromPool" />
    </template>

    <!-- My Envelopes Tab -->
    <template #tab-myEnvelopes>
      <LuckyOverlay :lucky-message="luckyMessage" @close="luckyMessage = null" />
      <OpeningModal
        :visible="showOpeningModal"
        :envelope="openingEnvelope"
        :is-connected="!!address"
        :is-opening="!!openingId"
        @connect="handleConnect"
        @open="() => openingEnvelope && openEnvelope(openingEnvelope)"
        @close="showOpeningModal = false"
      />

      <MyEnvelopes
        :envelopes="envelopes"
        :claims="claims"
        :current-address="address || ''"
        @open="openFromList"
      />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { messages } from "@/locale/messages";
import { useRedEnvelopeCreation } from "@/composables/useRedEnvelopeCreation";
import { useRedEnvelopeOpen } from "@/composables/useRedEnvelopeOpen";
import type { EnvelopeType } from "@/composables/useRedEnvelopeOpen";
import { useEnvelopeActions } from "./composables/useEnvelopeActions";
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";

import LuckyOverlay from "./components/LuckyOverlay.vue";
import OpeningModal from "./components/OpeningModal.vue";
import AppIcon from "@shared/components/AppIcon.vue";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "red-envelope",
  messages,
  template: {
    tabs: [
      { key: "create", labelKey: "createTab", icon: "\uD83E\uDDE7", default: true },
      { key: "claim", labelKey: "claimTabLabel", icon: "\uD83C\uDFAF" },
      { key: "myEnvelopes", labelKey: "myEnvelopes", icon: "\uD83C\uDF81" },
    ],
    fireworks: true,
  },
  sidebarItems: [
    { labelKey: "sidebarEnvelopes", value: () => envelopes.value.length },
    { labelKey: "sidebarClaims", value: () => claims.value.length },
    { labelKey: "sidebarPools", value: () => pools.value.length },
  ],
});

const activeTab = ref<string>("create");

// Use composables
const {
  name,
  description,
  amount,
  count,
  expiryHours,
  minNeoRequired,
  minHoldDays,
  status,
  setStatus,
  clearStatus,
  isLoading,
  defaultBlessing,
  ensureContractAddress: ensureCreationContract,
} = useRedEnvelopeCreation();

const {
  envelopes,
  contractAddress,
  ensureContractAddress: ensureOpenContract,
  loadEnvelopeDetails,
  loadEnvelopes,
  claims,
  pools,
  claimEnvelope,
} = useRedEnvelopeOpen();

const envelopeType = ref<EnvelopeType>("spreading");

const {
  luckyMessage,
  openingId,
  showOpeningModal,
  openingEnvelope,
  handleConnect,
  create,
  openEnvelope,
  openFromList,
  handleClaimFromPool,
  address,
} = useEnvelopeActions({
  status,
  setStatus,
  clearStatus,
  isLoading,
  ensureCreationContract,
  loadEnvelopes,
  claimEnvelope,
  name,
  amount,
  count,
  expiryHours,
});

const appState = computed(() => ({
  envelopeCount: envelopes.value.length,
  hasLucky: !!luckyMessage.value,
}));

const isMounted = ref(true);

onMounted(async () => {
  if (!isMounted.value) return;
  try {
    await loadEnvelopes();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      if (id) {
        const found = envelopes.value.find((e) => e.id === id);
        if (found) {
          openFromList(found);
          activeTab.value = "myEnvelopes";
        } else {
          const contract = await ensureOpenContract();
          const env = await loadEnvelopeDetails(contract, id);
          if (env) {
            openingEnvelope.value = env;
            showOpeningModal.value = true;
            activeTab.value = "myEnvelopes";
          }
        }
      }
    }
  } catch (_e: unknown) {
    console.warn("[red-envelope] initial data load failed:", _e instanceof Error ? _e.message : String(_e));
  }
});
const stopActiveTabWatch = watch(activeTab, async (tab) => {
  if (!isMounted.value) return;
  if (tab === "myEnvelopes") {
    try {
      await loadEnvelopes();
    } catch (_e: unknown) {
      console.warn("[red-envelope] envelopes load failed:", _e instanceof Error ? _e.message : String(_e));
    }
  } else if (tab === "claim") {
    try {
      await loadEnvelopes();
    } catch (_e: unknown) {
      console.warn("[red-envelope] envelopes load failed:", _e instanceof Error ? _e.message : String(_e));
    }
  }
});

onUnmounted(() => {
  stopActiveTabWatch();
  isMounted.value = false;
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./red-envelope-theme.scss" as *;

:global(body) {
  background: var(--bg-primary);
}

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  padding: 24px 16px;
  gap: 24px;
}

/* ── Red Envelope CSS Art ── */
.red-envelope-hero {
  position: relative;
  width: 160px;
  height: 200px;
  transition: transform 0.5s ease;

  &.opening {
    animation: envelope-open 0.8s ease-out forwards;
  }
}

.envelope-flap {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 70px;
  background: linear-gradient(135deg, var(--envelope-flap-start), var(--envelope-flap-end));
  clip-path: polygon(0 0, 100% 0, 50% 100%);
  z-index: 2;
  transition: transform 0.5s ease;

  .opening & {
    transform: rotateX(180deg);
    transform-origin: top center;
  }
}

.flap-fold {
  position: absolute;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 15px;
  border-radius: 0 0 50% 50%;
  background: rgba(0, 0, 0, 0.1); /* Deliberate dark fold shadow */
}

.envelope-body {
  position: absolute;
  top: 30px;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--envelope-body-gradient);
  border-radius: 4px 4px 12px 12px;
  z-index: 1;
  box-shadow:
    0 10px 40px var(--envelope-shadow-red),
    inset 0 1px 0 var(--envelope-shadow-white);
  overflow: hidden;
}

.envelope-seal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--envelope-seal-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 20px var(--envelope-gold-glow),
    0 0 40px rgba(var(--envelope-gold-rgb), 0.2);
  animation: seal-glow 2s ease-in-out infinite alternate;
}

.seal-character {
  font-size: 30px;
  font-weight: 900;
  color: var(--envelope-premium-red-dark);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.envelope-trim-top {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--envelope-trim-gold), transparent);
}

.envelope-trim-bottom {
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 8px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--envelope-trim-gold), transparent);
}

.envelope-sparkles {
  position: absolute;
  inset: -20px;
  z-index: 3;
  pointer-events: none;
}

.sparkle {
  position: absolute;
  font-size: 14px;
  animation: sparkle-float 3s ease-in-out infinite;

  &:nth-child(1) {
    top: 0;
    left: 10%;
  }
  &:nth-child(2) {
    top: 20%;
    right: 0;
  }
  &:nth-child(3) {
    bottom: 10%;
    left: 0;
  }
  &:nth-child(4) {
    bottom: 0;
    right: 15%;
  }
  &:nth-child(5) {
    top: 40%;
    left: 50%;
  }
}

/* ── Stats Row ── */
.hero-envelope-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: var(--envelope-stat-bg);
  border: 1px solid var(--envelope-stat-border);
  border-radius: 12px;
  backdrop-filter: blur(8px);
}

.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.hero-stat-value {
  font-size: 22px;
  font-weight: 900;
  color: var(--envelope-stat-value);
  font-family: $font-mono;
}

.hero-stat-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--envelope-stat-label);
}

.hero-stat-divider {
  width: 1px;
  height: 32px;
  background: var(--envelope-divider);
}

@keyframes envelope-open {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05) translateY(-5px);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes seal-glow {
  0% {
    box-shadow:
      0 0 15px var(--envelope-gold-glow),
      0 0 30px rgba(var(--envelope-gold-rgb), 0.15);
  }
  100% {
    box-shadow:
      0 0 25px rgba(var(--envelope-gold-rgb), 0.6),
      0 0 50px rgba(var(--envelope-gold-rgb), 0.25);
  }
}

@keyframes sparkle-float {
  0%,
  100% {
    opacity: 0.3;
    transform: translateY(0) scale(0.8);
  }
  50% {
    opacity: 1;
    transform: translateY(-8px) scale(1.1);
  }
}

@media (max-width: 480px) {
  .red-envelope-hero {
    width: 130px;
    height: 170px;
  }
  .envelope-seal {
    width: 48px;
    height: 48px;
  }
  .seal-character {
    font-size: 24px;
  }
  .hero-envelope-stats {
    padding: 12px 16px;
    gap: 12px;
  }
  .hero-stat-value {
    font-size: 18px;
  }
  .hero-stat-label {
    font-size: 9px;
  }
  .hero-container {
    min-height: 250px;
    padding: 16px 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .envelope-seal,
  .sparkle {
    animation: none;
  }
}
</style>
