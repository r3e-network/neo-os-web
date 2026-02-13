<template>
  <view class="theme-neo-ns">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
    >
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <ManageDomain
            v-if="managingDomain"
            :t="t"
            :domain="managingDomain"
            :loading="loading"
            @cancel="cancelManage"
            @setTarget="handleSetTarget"
            @transfer="handleTransfer"
          />

          <DomainManagement v-else :t="t" :domains="myDomains" @manage="showManage" @renew="handleRenew" />
        </ErrorBoundary>
      </template>

      <template #operation>
        <DomainRegister :t="t" :nns-contract="NNS_CONTRACT" @status="showStatus" @refresh="loadMyDomains" />
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { parseInvokeResult } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { requireNeoChain } from "@shared/utils/chain";
import { MiniAppTemplate, SidebarPanel, ErrorBoundary } from "@shared/components";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig } from "@shared/utils/createTemplateConfig";
import DomainRegister from "./components/DomainRegister.vue";
import DomainManagement from "./components/DomainManagement.vue";
import ManageDomain from "./components/ManageDomain.vue";
import type { Domain } from "@/types";

const { t } = createUseI18n(messages)();

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "register", labelKey: "tabRegister", icon: "➕", default: true },
  ],
});

const APP_ID = "miniapp-neo-ns";
const NNS_CONTRACT = "0x50ac1c37690cc2cfc594472833cf57505d5f46de";
const { address, connect, chainType, invokeRead, invokeContract } = useWallet() as WalletSDK;

const activeTab = ref("register");
const appState = computed(() => ({
  domainCount: myDomains.value.length,
  walletConnected: !!address.value,
}));

const sidebarItems = computed(() => {
  const expiringSoon = myDomains.value.filter((d) => d.expiry > 0 && d.expiry - Date.now() < 30 * 86400000).length;
  return [
    { label: t("tabDomains"), value: myDomains.value.length },
    { label: t("sidebarWallet"), value: address.value ? t("connected") : t("disconnected") },
    { label: t("sidebarExpiringSoon"), value: expiringSoon },
  ];
});

const loading = ref(false);
const { status, setStatus: showStatus } = useStatusMessage();
const myDomains = ref<Domain[]>([]);

const managingDomain = ref<Domain | null>(null);

function showManage(domain: Domain) {
  managingDomain.value = domain;
}

function cancelManage() {
  managingDomain.value = null;
}

async function handleRenew(domain: Domain) {
  if (!requireNeoChain(chainType, t)) return;
  if (!address.value) {
    showStatus(t("connectWalletFirst"), "error");
    return;
  }

  loading.value = true;
  try {
    await invokeContract({
      scriptHash: NNS_CONTRACT,
      operation: "renew",
      args: [{ type: "String", value: domain.name }],
    });

    showStatus(domain.name + " " + t("renewed"), "success");
    await loadMyDomains();
  } catch (e: unknown) {
    showStatus(formatErrorMessage(e, t("renewalFailed")), "error");
  } finally {
    loading.value = false;
  }
}

async function handleSetTarget(targetAddress: string) {
  if (!managingDomain.value || !targetAddress) return;
  if (!requireNeoChain(chainType, t)) return;
  if (!address.value) {
    showStatus(t("connectWalletFirst"), "error");
    return;
  }

  loading.value = true;
  try {
    await invokeContract({
      scriptHash: NNS_CONTRACT,
      operation: "setTarget",
      args: [
        { type: "String", value: managingDomain.value.name },
        { type: "Hash160", value: targetAddress },
      ],
    });

    showStatus(t("targetSet"), "success");
  } catch (e: unknown) {
    showStatus(formatErrorMessage(e, t("error")), "error");
  } finally {
    loading.value = false;
  }
}

async function handleTransfer(transferAddress: string) {
  if (!managingDomain.value || !transferAddress) return;
  if (!requireNeoChain(chainType, t)) return;

  loading.value = true;
  try {
    const tokenId = domainToTokenId(managingDomain.value.name.replace(".neo", ""));

    await invokeContract({
      scriptHash: NNS_CONTRACT,
      operation: "transfer",
      args: [
        { type: "Hash160", value: transferAddress },
        { type: "ByteArray", value: tokenId },
        { type: "Any", value: null },
      ],
    });

    showStatus(t("transferred"), "success");
    managingDomain.value = null;
    await loadMyDomains();
  } catch (e: unknown) {
    showStatus(formatErrorMessage(e, t("error")), "error");
  } finally {
    loading.value = false;
  }
}

function domainToTokenId(name: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(name.toLowerCase() + ".neo");
  return btoa(String.fromCharCode(...bytes));
}

async function loadMyDomains() {
  if (!requireNeoChain(chainType, t)) {
    myDomains.value = [];
    return;
  }
  if (!address.value) {
    myDomains.value = [];
    return;
  }

  try {
    const tokensResult = await invokeRead({
      scriptHash: NNS_CONTRACT,
      operation: "tokensOf",
      args: [{ type: "Hash160", value: address.value }],
    });

    const tokens = parseInvokeResult(tokensResult);
    if (!tokens || !Array.isArray(tokens)) {
      myDomains.value = [];
      return;
    }

    const domains: Domain[] = [];
    for (const tokenId of tokens) {
      try {
        const propsResult = await invokeRead({
          scriptHash: NNS_CONTRACT,
          operation: "properties",
          args: [{ type: "ByteArray", value: tokenId }],
        });
        const props = parseInvokeResult(propsResult) as Record<string, unknown>;
        if (props) {
          let name = "";
          try {
            const bytes = Uint8Array.from(atob(tokenId), (c) => c.charCodeAt(0));
            name = new TextDecoder().decode(bytes);
          } catch {
            name = String(props.name || tokenId);
          }

          domains.push({
            name: name,
            owner: address.value,
            expiry: Number(props.expiration || 0) * 1000,
            target: props.target ? String(props.target) : undefined,
          });
        }
      } catch {
        /* Individual domain property fetch failure -- skip this domain */
      }
    }

    myDomains.value = domains.sort((a, b) => b.expiry - a.expiry);
  } catch (e: unknown) {
    /* non-critical: domain list fetch */
    myDomains.value = [];
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

const { handleBoundaryError } = useHandleBoundaryError("neo-ns");
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
