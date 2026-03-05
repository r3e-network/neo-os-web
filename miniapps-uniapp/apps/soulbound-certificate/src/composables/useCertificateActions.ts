import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { addressToScriptHash } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { useCertificates } from "@/composables/useCertificates";

export function useCertificateActions(
  setStatus: (msg: string, type: string) => void,
) {
  const { t } = createUseI18n(messages)();
  const { address, connect, invokeContract, invokeRead, chainType } = useWallet() as WalletSDK;
  const { templates, certificates, certQrs, refreshTemplates, refreshCertificates, parseBigInt, ensureContractAddress } =
    useCertificates();

  const isCreating = ref(false);
  const isIssuing = ref(false);
  const isLookingUp = ref(false);
  const isRevoking = ref(false);
  const togglingId = ref<string | null>(null);
  const lookup = ref<Record<string, unknown> | null>(null);

  const connectWallet = async () => {
    try {
      await connect();
      if (address.value) {
        await refreshTemplates();
        await refreshCertificates();
      }
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("walletNotConnected")), "error");
    }
  };

  const createTemplate = async (data: {
    name: string; issuerName: string; category: string; maxSupply: string; description: string;
  }) => {
    if (isCreating.value) return;
    if (!requireNeoChain(chainType, t)) return;
    const name = data.name.trim();
    if (!name) { setStatus(t("nameRequired"), "error"); return; }
    const maxSupply = parseBigInt(data.maxSupply);
    if (maxSupply <= 0n) { setStatus(t("invalidSupply"), "error"); return; }

    try {
      isCreating.value = true;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "CreateTemplate",
        args: [
          { type: "Hash160", value: address.value },
          { type: "String", value: name },
          { type: "String", value: data.issuerName.trim() },
          { type: "String", value: data.category.trim() },
          { type: "Integer", value: maxSupply.toString() },
          { type: "String", value: data.description.trim() },
        ],
      });
      setStatus(t("templateCreated"), "success");
      await refreshTemplates();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isCreating.value = false;
    }
  };

  const issueCertificate = async (data: {
    templateId: string; recipient: string; recipientName: string; achievement: string; memo: string;
  }) => {
    if (isIssuing.value) return;
    if (!requireNeoChain(chainType, t)) return;
    const recipient = data.recipient.trim();
    if (!recipient || !addressToScriptHash(recipient)) {
      setStatus(t("invalidRecipient"), "error"); return;
    }
    try {
      isIssuing.value = true;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "IssueCertificate",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Hash160", value: recipient },
          { type: "Integer", value: data.templateId },
          { type: "String", value: data.recipientName.trim() },
          { type: "String", value: data.achievement.trim() },
          { type: "String", value: data.memo.trim() },
        ],
      });
      setStatus(t("issuedSuccess"), "success");
      await refreshTemplates();
      await refreshCertificates();
      return true;
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
      return false;
    } finally {
      isIssuing.value = false;
    }
  };

  const toggleTemplate = async (template: { id: string; active: boolean }) => {
    if (togglingId.value) return;
    if (!requireNeoChain(chainType, t)) return;
    try {
      togglingId.value = template.id;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "SetTemplateActive",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: template.id },
          { type: "Boolean", value: !template.active },
        ],
      });
      await refreshTemplates();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      togglingId.value = null;
    }
  };

  const lookupCertificate = async (tokenId: string) => {
    if (isLookingUp.value) return;
    if (!requireNeoChain(chainType, t)) return;
    if (!tokenId) { setStatus(t("invalidTokenId"), "error"); return; }
    try {
      isLookingUp.value = true;
      const contract = await ensureContractAddress();
      const detailResult = await invokeRead({
        scriptHash: contract,
        operation: "GetCertificateDetails",
        args: [{ type: "ByteArray", value: tokenId }],
      });
      const detailParsed = detailResult as Record<string, unknown> | null;
      if (!detailParsed) {
        setStatus(t("certificateNotFound"), "error");
        lookup.value = null;
        return;
      }
      lookup.value = detailParsed;
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isLookingUp.value = false;
    }
  };

  const revokeCertificate = async (tokenId: string) => {
    if (isRevoking.value) return;
    if (!requireNeoChain(chainType, t)) return;
    if (!tokenId) { setStatus(t("invalidTokenId"), "error"); return; }
    try {
      isRevoking.value = true;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "RevokeCertificate",
        args: [
          { type: "Hash160", value: address.value },
          { type: "ByteArray", value: tokenId },
        ],
      });
      setStatus(t("revokeSuccess"), "success");
      await lookupCertificate(tokenId);
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isRevoking.value = false;
    }
  };

  const copyTokenId = (tokenId: string) => {
    uni.setClipboardData({
      data: tokenId,
      success: () => setStatus(t("copied"), "success"),
    });
  };

  return {
    address, connect,
    templates, certificates, certQrs, refreshTemplates, refreshCertificates,
    isCreating, isIssuing, isLookingUp, isRevoking, togglingId, lookup,
    connectWallet, createTemplate, issueCertificate, toggleTemplate,
    lookupCertificate, revokeCertificate, copyTokenId,
  };
}
