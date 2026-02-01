<template>
  <view class="tab-content">
    <DomainSearch
      :t="t"
      v-model:search-query="searchQuery"
      :search-result="searchResult"
      :loading="loading"
      @search="checkAvailability"
      @register="handleRegister"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseInvokeResult } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import DomainSearch from "./DomainSearch.vue";

const props = defineProps<{
  t: (key: string) => string;
  nnsContract: string;
}>();

const emit = defineEmits<{
  (e: "status", msg: string, type: "success" | "error"): void;
  (e: "refresh"): void;
}>();

const { address, chainType, invokeRead, invokeContract } = useWallet() as WalletSDK;

interface SearchResult {
  available: boolean;
  price?: number;
  owner?: string;
}

const searchQuery = ref("");
const searchResult = ref<SearchResult | null>(null);
const loading = ref(false);
const searchDebounce = ref<ReturnType<typeof setTimeout> | null>(null);

// Convert domain name to token ID (UTF-8 bytes as base64)
function domainToTokenId(name: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(name.toLowerCase() + ".neo");
  return btoa(String.fromCharCode(...bytes));
}

async function checkAvailability() {
  if (!searchQuery.value || searchQuery.value.length < 1) {
    searchResult.value = null;
    return;
  }

  if (searchDebounce.value) {
    clearTimeout(searchDebounce.value);
  }

  searchDebounce.value = setTimeout(async () => {
    if (!requireNeoChain(chainType, props.t)) return;
    try {
      loading.value = true;
      const name = searchQuery.value.toLowerCase();

      const availableResult = await invokeRead({
        contractHash: props.nnsContract,
        operation: "isAvailable",
        args: [{ type: "String", value: name + ".neo" }],
      });
      const isAvailable = Boolean(parseInvokeResult(availableResult));

      const priceResult = await invokeRead({
        contractHash: props.nnsContract,
        operation: "getPrice",
        args: [{ type: "Integer", value: name.length }],
      });
      const priceRaw = Number(parseInvokeResult(priceResult) || 0);
      const price = priceRaw / 1e8;

      if (isAvailable) {
        searchResult.value = { available: true, price };
      } else {
        try {
          const ownerResult = await invokeRead({
            contractHash: props.nnsContract,
            operation: "ownerOf",
            args: [{ type: "ByteArray", value: domainToTokenId(name) }],
          });
          const owner = String(parseInvokeResult(ownerResult) || "");
          searchResult.value = { available: false, owner };
        } catch {
          searchResult.value = { available: false, owner: props.t("unknownOwner") };
        }
      }
    } catch (e: any) {
      searchResult.value = null;
      emit("status", e.message || props.t("availabilityFailed"), "error");
    } finally {
      loading.value = false;
    }
  }, 500);
}

async function handleRegister() {
  if (!searchResult.value?.available || searchResult.value.price === undefined || loading.value) return;
  if (!requireNeoChain(chainType, props.t)) return;
  if (!address.value) {
    emit("status", props.t("connectWalletFirst"), "error");
    return;
  }

  loading.value = true;
  try {
    const name = searchQuery.value.toLowerCase();

    await invokeContract({
      scriptHash: props.nnsContract,
      operation: "register",
      args: [
        { type: "String", value: name + ".neo" },
        { type: "Hash160", value: address.value },
      ],
    });

    emit("status", name + ".neo " + props.t("registered"), "success");
    searchQuery.value = "";
    searchResult.value = null;
    emit("refresh");
  } catch (e: any) {
    emit("status", e.message || props.t("registrationFailed"), "error");
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}
</style>
