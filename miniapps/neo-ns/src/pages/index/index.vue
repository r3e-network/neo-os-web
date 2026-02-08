<template>
  <view class="theme-neo-ns">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="statusMessage ? { msg: statusMessage, type: statusType } : null"
      @tab-change="activeTab = $event"
    >
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t("overview") }}</text>
        </view>
      </template>

      <template #content>
        <view class="app-container">
          <DomainRegister :t="t" :nns-contract="NNS_CONTRACT" @status="showStatus" @refresh="loadMyDomains" />
        </view>
      </template>

      <template #tab-domains>
        <view class="app-container">
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
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { parseInvokeResult } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { MiniAppTemplate, NeoCard } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import DomainRegister from "./components/DomainRegister.vue";
import DomainManagement from "./components/DomainManagement.vue";
import ManageDomain from "./components/ManageDomain.vue";

const { t } = useI18n();

const templateConfig: MiniAppTemplateConfig = {
  contentType: "form-panel",
  tabs: [
    { key: "register", labelKey: "tabRegister", icon: "➕", default: true },
    { key: "domains", labelKey: "tabDomains", icon: "📁" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      descriptionKey: "docDescription",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
      ],
    },
  },
};

const APP_ID = "miniapp-neo-ns";
const NNS_CONTRACT = "0x50ac1c37690cc2cfc594472833cf57505d5f46de";
const { address, connect, chainType, invokeRead, invokeContract } = useWallet() as WalletSDK;

interface Domain {
  name: string;
  owner: string;
  expiry: number;
  target?: string;
}

const activeTab = ref("register");
const appState = computed(() => ({
  domainCount: myDomains.value.length,
  walletConnected: !!address.value,
}));

const loading = ref(false);
const statusMessage = ref("");
const statusType = ref<"success" | "error">("success");
const myDomains = ref<Domain[]>([]);

const managingDomain = ref<Domain | null>(null);

function showStatus(msg: string, type: "success" | "error") {
  statusMessage.value = msg;
  statusType.value = type;
  setTimeout(() => (statusMessage.value = ""), 3000);
}

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
  } catch (e: any) {
    showStatus(e.message || t("renewalFailed"), "error");
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
  } catch (e: any) {
    showStatus(e.message || t("error"), "error");
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
  } catch (e: any) {
    showStatus(e.message || t("error"), "error");
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
      contractHash: NNS_CONTRACT,
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
          contractHash: NNS_CONTRACT,
          operation: "properties",
          args: [{ type: "ByteArray", value: tokenId }],
        });
        const props = parseInvokeResult(propsResult) as Record<string, any>;
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
      } catch {}
    }

    myDomains.value = domains.sort((a, b) => b.expiry - a.expiry);
  } catch (e: any) {
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
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./neo-ns-theme.scss";

:global(page) {
  background: var(--dir-bg);
  font-family: var(--dir-font);
}

.app-container {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background-color: var(--dir-bg);
  background-image:
    linear-gradient(var(--dir-scanline-top) 50%, var(--dir-scanline-bottom) 50%),
    linear-gradient(90deg, var(--dir-scanline-red), var(--dir-scanline-green), var(--dir-scanline-blue));
  background-size:
    100% 2px,
    3px 100%;
  min-height: 100vh;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

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
