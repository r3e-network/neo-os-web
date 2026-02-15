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
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useNeoNS } from "@/composables/useNeoNS";
import DomainManagement from "./components/DomainManagement.vue";
import ManageDomain from "./components/ManageDomain.vue";
import type { Domain } from "@/types";

const APP_ID = "miniapp-neo-ns";
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
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./neo-ns-theme.scss";

:global(page) {
  background: var(--dir-bg);
  font-family: var(--dir-font);
}
</style>
