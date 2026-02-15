import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseInvokeResult } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { domainToTokenId, ensureNeoWalletAndChain, handleNeoInvocation } from "@/utils/neoHelpers";
import type { Domain } from "@/types";
import type { NeoStatusNotifier } from "@/utils/neoHelpers";

export function useNeoNS(nnsContract: string, t: (key: string) => string) {
  const { address, connect, chainType, invokeRead, invokeContract } = useWallet() as WalletSDK;

  const loading = ref(false);
  const myDomains = ref<Domain[]>([]);

  const loadMyDomains = async () => {
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
        scriptHash: nnsContract,
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
            scriptHash: nnsContract,
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
              name,
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
    } catch {
      myDomains.value = [];
    }
  };

  const handleRenew = async (domain: Domain, showStatus: NeoStatusNotifier) => {
    if (!ensureNeoWalletAndChain(chainType, address.value, t, showStatus)) return;

    loading.value = true;
    try {
      const renewResult = await handleNeoInvocation(
        () =>
          invokeContract({
            scriptHash: nnsContract,
            operation: "renew",
            args: [{ type: "String", value: domain.name }],
          }),
        t,
        "renewalFailed",
        showStatus
      );
      if (renewResult === null) return;

      showStatus(domain.name + " " + t("renewed"), "success");
      await loadMyDomains();
    } finally {
      loading.value = false;
    }
  };

  const handleSetTarget = async (domain: Domain, targetAddress: string, showStatus: NeoStatusNotifier) => {
    if (!domain || !targetAddress) return;
    if (!ensureNeoWalletAndChain(chainType, address.value, t, showStatus)) return;

    loading.value = true;
    try {
      const setTargetResult = await handleNeoInvocation(
        () =>
          invokeContract({
            scriptHash: nnsContract,
            operation: "setTarget",
            args: [
              { type: "String", value: domain.name },
              { type: "Hash160", value: targetAddress },
            ],
          }),
        t,
        "error",
        showStatus
      );
      if (setTargetResult === null) return;

      showStatus(t("targetSet"), "success");
    } finally {
      loading.value = false;
    }
  };

  const handleTransfer = async (domain: Domain, transferAddress: string, showStatus: NeoStatusNotifier) => {
    if (!domain || !transferAddress) return;
    if (!requireNeoChain(chainType, t)) return;

    loading.value = true;
    try {
      const tokenId = domainToTokenId(domain.name.replace(".neo", ""));
      const transferResult = await handleNeoInvocation(
        () =>
          invokeContract({
            scriptHash: nnsContract,
            operation: "transfer",
            args: [
              { type: "Hash160", value: transferAddress },
              { type: "ByteArray", value: tokenId },
              { type: "Any", value: null },
            ],
          }),
        t,
        "error",
        showStatus
      );
      if (transferResult === null) return;

      showStatus(t("transferred"), "success");
      await loadMyDomains();
      return true;
    } finally {
      loading.value = false;
    }
  };

  return {
    address,
    connect,
    loading,
    myDomains,
    loadMyDomains,
    handleRenew,
    handleSetTarget,
    handleTransfer,
  };
}
