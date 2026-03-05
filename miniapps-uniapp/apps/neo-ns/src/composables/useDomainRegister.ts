import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseInvokeResult } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { domainToTokenId, ensureNeoWalletAndChain, handleNeoInvocation } from "@/utils/neoHelpers";
import type { SearchResult } from "@/types";
import type { NeoStatusNotifier } from "@/utils/neoHelpers";

export function useDomainRegister(nnsContract: string, t: (key: string) => string) {
  const { address, chainType, invokeRead, invokeContract } = useWallet() as WalletSDK;

  const searchQuery = ref("");
  const searchResult = ref<SearchResult | null>(null);
  const loading = ref(false);
  const searchDebounce = ref<ReturnType<typeof setTimeout> | null>(null);

  const checkAvailability = (notifyError: NeoStatusNotifier) => {
    if (!searchQuery.value || searchQuery.value.length < 1) {
      searchResult.value = null;
      return;
    }

    if (searchDebounce.value) {
      clearTimeout(searchDebounce.value);
    }

    searchDebounce.value = setTimeout(async () => {
      if (!requireNeoChain(chainType, t)) return;
      loading.value = true;
      try {
        const name = searchQuery.value.toLowerCase();
        const result = await handleNeoInvocation(
          async () => {
            const availableResult = await invokeRead({
              scriptHash: nnsContract,
              operation: "isAvailable",
              args: [{ type: "String", value: name + ".neo" }],
            });
            const isAvailable = Boolean(parseInvokeResult(availableResult));

            const priceResult = await invokeRead({
              scriptHash: nnsContract,
              operation: "getPrice",
              args: [{ type: "Integer", value: name.length }],
            });
            const priceRaw = Number(parseInvokeResult(priceResult) || 0);
            const price = priceRaw / 1e8;

            if (isAvailable) {
              return { available: true as const, price };
            }

            try {
              const ownerResult = await invokeRead({
                scriptHash: nnsContract,
                operation: "ownerOf",
                args: [{ type: "ByteArray", value: domainToTokenId(name) }],
              });
              const owner = String(parseInvokeResult(ownerResult) || "");
              return { available: false as const, owner };
            } catch {
              return { available: false as const, owner: t("unknownOwner") };
            }
          },
          t,
          "availabilityFailed",
          notifyError
        );

        searchResult.value = result;
      } finally {
        loading.value = false;
      }
    }, 500);
  };

  const handleRegister = async (notifyError: NeoStatusNotifier, onSuccess: () => void) => {
    if (!searchResult.value?.available || searchResult.value.price === undefined || loading.value) return;
    if (!ensureNeoWalletAndChain(chainType, address.value, t, notifyError)) return;

    loading.value = true;
    try {
      const name = searchQuery.value.toLowerCase();
      const registerResult = await handleNeoInvocation(
        async () =>
          invokeContract({
            scriptHash: nnsContract,
            operation: "register",
            args: [
              { type: "String", value: name + ".neo" },
              { type: "Hash160", value: address.value },
            ],
          }),
        t,
        "registrationFailed",
        notifyError
      );
      if (registerResult === null) return;

      notifyError(name + ".neo " + t("registered"), "success");
      searchQuery.value = "";
      searchResult.value = null;
      onSuccess();
    } finally {
      loading.value = false;
    }
  };

  return {
    searchQuery,
    searchResult,
    loading,
    checkAvailability,
    handleRegister,
  };
}
