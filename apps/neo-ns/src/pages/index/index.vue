<template>
  <MiniAppPage
    name="neo-ns"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <div class="hero-container">
        <HeroSection variant="erobo-neo" icon="globe" compact>
          <template #stats>
            <HeroStatsStrip :items="heroStatsItems" />
          </template>
        </HeroSection>
      </div>

      <div v-if="error" class="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
        {{ error }}
      </div>

      <ManageDomain
        v-if="managingDomain"
        :domain="managingDomain"
        :loading="loading"
        @cancel="cancelManage"
        @setTarget="handleSetTarget"
        @transfer="handleTransfer"
      />

      <DomainManagement v-else :domains="myDomains" @manage="showManage" @renew="handleRenew" />
    </template>

    <template #operation>
      <DomainRegister :nns-contract="NNS_CONTRACT" @status="showStatus" @refresh="loadMyDomains" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage, HeroSection, HeroStatsStrip } from "@shared/components";
import AppIcon from "@shared/components/AppIcon.vue";
import type { HeroStatsStripItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useNeoNS } from "@/composables/useNeoNS";
import DomainManagement from "./components/DomainManagement.vue";
import ManageDomain from "./components/ManageDomain.vue";
import type { Domain } from "@/types";
const NNS_CONTRACT = "0x50ac1c37690cc2cfc594472833cf57505d5f46de";

const managingDomain = ref<Domain | null>(null);

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } =
  createMiniApp({
    name: "neo-ns",
    messages,
    template: {
      tabs: [{ key: "register", labelKey: "tabRegister", icon: "plus", default: true }],
    },
    sidebarItems: [
      { labelKey: "tabDomains", value: () => myDomains.value.length },
      { labelKey: "sidebarWallet", value: () => (address.value ? t("connected") : t("disconnected")) },
      {
        labelKey: "sidebarExpiringSoon",
        value: () => myDomains.value.filter((d) => d.expiry > 0 && d.expiry - Date.now() < 30 * 86400000).length,
      },
    ],
  });

const ns = useNeoNS(NNS_CONTRACT, t);
const { address, connect, loading, error, myDomains, loadMyDomains } = ns;

const showStatus = setStatus;

const appState = computed(() => ({
  domainCount: myDomains.value.length,
  walletConnected: !!address.value,
}));
const heroStatsItems = computed<HeroStatsStripItem[]>(() => [
  { value: myDomains.value.length, label: t("tabDomains") },
]);

function showManage(domain: Domain) {
  managingDomain.value = domain;
}

function cancelManage() {
  managingDomain.value = null;
}

async function handleRenew(domain: Domain) {
  try {
    await ns.handleRenew(domain, showStatus);
  } catch (_e: unknown) {
    showStatus(_e instanceof Error ? _e.message : String(_e), "error");
  }
}

async function handleSetTarget(targetAddress: string) {
  if (!managingDomain.value) return;
  try {
    await ns.handleSetTarget(managingDomain.value, targetAddress, showStatus);
  } catch (_e: unknown) {
    showStatus(_e instanceof Error ? _e.message : String(_e), "error");
  }
}

async function handleTransfer(transferAddress: string) {
  if (!managingDomain.value) return;
  try {
    const transferred = await ns.handleTransfer(managingDomain.value, transferAddress, showStatus);
    if (transferred) {
      managingDomain.value = null;
    }
  } catch (_e: unknown) {
    showStatus(_e instanceof Error ? _e.message : String(_e), "error");
  }
}

const isMounted = ref(true);

onMounted(async () => {
  if (!isMounted.value) return;
  try {
    await connect();
    if (address.value) {
      await loadMyDomains();
    }
  } catch (_e: unknown) {
    console.warn("[neo-ns] initial data load failed:", _e instanceof Error ? _e.message : String(_e));
  }
});
const stopAddressWatch = watch(address, async (newAddr) => {
  if (!isMounted.value) return;
  if (newAddr) {
    try {
      await loadMyDomains();
    } catch (_e: unknown) {
      console.warn("[neo-ns] domains load failed:", _e instanceof Error ? _e.message : String(_e));
    }
  } else {
    myDomains.value = [];
  }
});

onUnmounted(() => {
  stopAddressWatch();
  isMounted.value = false;
});

const resetAndReload = async () => {
  if (address.value) {
    await loadMyDomains();
  }
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./neo-ns-theme.scss" as *;

:global(body) {
  background: var(--dir-bg);
  font-family: var(--dir-font);
}

.hero-container {
  margin-bottom: 20px;
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
    content: "█";
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
