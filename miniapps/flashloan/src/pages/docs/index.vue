<template>
  <view class="page-container">
    <FlashloanDocs :t="t as any" :contract-address="contractAddress" :network-label="networkLabel" />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import { useI18n } from "@/composables/useI18n";
import FlashloanDocs from "../index/components/FlashloanDocs.vue";

const { t } = useI18n();
const { chainId, appChainId, getContractAddress } = useWallet() as any;
const contractAddress = ref<string | null>(null);

const networkLabel = computed(() => {
  const id = String(appChainId?.value || chainId?.value || "");
  if (id.includes("mainnet")) return t("neoN3Mainnet");
  if (id.includes("testnet")) return t("neoN3Testnet");
  return t("neoN3Network");
});

onMounted(async () => {
  try {
    contractAddress.value = await getContractAddress();
  } catch {
    contractAddress.value = null;
  }
});
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: var(--bg-body);
}
</style>
