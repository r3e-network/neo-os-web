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
        <HeroSection variant="erobo-neo" icon="🌐" compact>
          <template #stats>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-value">{{ myDomains.length }}</span>
                <span class="hero-stat-label">{{ t("tabDomains") }}</span>
              </div>
            </div>
          </template>
        </HeroSection>
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
import { ref, computed, onMounted, watch } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage, HeroSection } from "@shared/components";
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
      tabs: [{ key: "register", labelKey: "tabRegister", icon: "➕", default: true }],
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
const { address, connect, loading, myDomains, loadMyDomains } = ns;

const showStatus = setStatus;

const appState = computed(() => ({
  domainCount: myDomains.value.length,
  walletConnected: !!address.value,
}));

function showManage(domain: Domain) {
  managingDomain.value = domain;
}

function cancelManage() {
  managingDomain.value = null;
}

async function handleRenew(domain: Domain) {
  await ns.handleRenew(domain, showStatus);
}

async function handleSetTarget(targetAddress: string) {
  if (!managingDomain.value) return;
  await ns.handleSetTarget(managingDomain.value, targetAddress, showStatus);
}

async function handleTransfer(transferAddress: string) {
  if (!managingDomain.value) return;
  const transferred = await ns.handleTransfer(managingDomain.value, transferAddress, showStatus);
  if (transferred) {
    managingDomain.value = null;
  }
}

onMounted(async () => {
  await connect();
  if (address.value) {
    await loadMyDomains();
  }
});

watch(address, async (newAddr) => {
  if (newAddr) {
    await loadMyDomains();
  } else {
    myDomains.value = [];
  }
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

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: rgba(0, 229, 153, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(0, 229, 153, 0.15);
}

.hero-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
  margin-top: 2px;
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

.hero-stat {
  animation: ns-dns-pulse 3s ease-in-out infinite;
  box-shadow: 0 0 16px rgba(0, 188, 212, 0.1);
  background: linear-gradient(135deg, rgba(0, 188, 212, 0.12), rgba(0, 229, 153, 0.06));
}
</style>
