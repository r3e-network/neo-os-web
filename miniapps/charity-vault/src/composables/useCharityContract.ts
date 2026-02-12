import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseInvokeResult } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import type { CharityCampaign, Donation } from "@/types";

const APP_ID = "miniapp-charity-vault";

export function useCharityContract(t: (key: string) => string) {
  const { address, invokeContract, invokeRead, chainType } = useWallet() as WalletSDK;
  const { processPayment, waitForEvent } = usePaymentFlow(APP_ID);
  const { contractAddress, ensureSafe: ensureContractAddress } = useContractAddress(t);

  // State
  const selectedCampaign = ref<CharityCampaign | null>(null);
  const campaigns = ref<CharityCampaign[]>([]);
  const myDonations = ref<Donation[]>([]);
  const recentDonations = ref<Donation[]>([]);
  const selectedCategory = ref<string>("all");
  const loadingCampaigns = ref(false);
  const isDonating = ref(false);
  const isCreating = ref(false);
  const { status: errorStatus, setStatus: setErrorStatus, clearStatus: clearErrorStatus } = useStatusMessage(5000);
  const errorMessage = computed(() => errorStatus.value?.msg ?? null);

  // Filtered campaigns
  const filteredCampaigns = computed(() => {
    if (selectedCategory.value === "all") return campaigns.value;
    return campaigns.value.filter((c) => c.category === selectedCategory.value);
  });

  // Total donated
  const totalDonated = computed(() => {
    return myDonations.value.reduce((sum, d) => sum + d.amount, 0);
  });

  const totalRaised = computed(() =>
    campaigns.value.reduce((sum, c) => sum + (c.raisedAmount || 0), 0)
  );

  // Load campaigns
  const loadCampaigns = async () => {
    if (!(await ensureContractAddress())) return;

    try {
      loadingCampaigns.value = true;
      const result = await invokeRead({
        scriptHash: contractAddress.value as string,
        operation: "getCampaigns",
        args: [],
      });

      const parsed = parseInvokeResult(result) as unknown[];
      if (Array.isArray(parsed)) {
        campaigns.value = parsed.map((c: Record<string, unknown>) => ({
          id: Number(c.id || 0),
          title: String(c.title || ""),
          description: String(c.description || ""),
          story: String(c.story || ""),
          category: String(c.category || "other"),
          organizer: String(c.organizer || ""),
          beneficiary: String(c.beneficiary || ""),
          targetAmount: Number(c.targetAmount || 0) / 1e8,
          raisedAmount: Number(c.raisedAmount || 0) / 1e8,
          donorCount: Number(c.donorCount || 0),
          endTime: Number(c.endTime || 0) * 1000,
          createdAt: Number(c.createdAt || 0) * 1000,
          status: c.status || "active",
          multisigAddresses: Array.isArray(c.multisigAddresses) ? c.multisigAddresses : [],
        }));
      }
    } catch (e: unknown) {
      setErrorStatus(formatErrorMessage(e, t("failedToLoad")), "error");
    } finally {
      loadingCampaigns.value = false;
    }
  };

  // Load user's donations
  const loadMyDonations = async () => {
    if (!address.value || !(await ensureContractAddress())) return;

    try {
      const result = await invokeRead({
        scriptHash: contractAddress.value as string,
        operation: "getUserDonations",
        args: [{ type: "Hash160", value: address.value }],
      });

      const parsed = parseInvokeResult(result) as unknown[];
      if (Array.isArray(parsed)) {
        myDonations.value = parsed.map((d: Record<string, unknown>) => ({
          id: Number(d.id || 0),
          campaignId: Number(d.campaignId || 0),
          donor: String(d.donor || ""),
          amount: Number(d.amount || 0) / 1e8,
          message: String(d.message || ""),
          timestamp: Number(d.timestamp || 0) * 1000,
        }));
      }
    } catch (_e: unknown) {
      /* non-critical: my donations fetch */
    }
  };

  // Load recent donations for selected campaign
  const loadRecentDonations = async (campaignId: number) => {
    try {
      const result = await invokeRead({
        scriptHash: contractAddress.value as string,
        operation: "getCampaignDonations",
        args: [
          { type: "Integer", value: campaignId },
          { type: "Integer", value: 10 },
        ],
      });

      const parsed = parseInvokeResult(result) as unknown[];
      if (Array.isArray(parsed)) {
        recentDonations.value = parsed.map((d: Record<string, unknown>) => ({
          id: Number(d.id || 0),
          campaignId: Number(d.campaignId || 0),
          donor: String(d.donor || ""),
          amount: Number(d.amount || 0) / 1e8,
          message: String(d.message || ""),
          timestamp: Number(d.timestamp || 0) * 1000,
        }));
      }
    } catch (_e: unknown) {
      /* non-critical: recent donations fetch */
    }
  };

  // Make donation
  const makeDonation = async (data: { amount: number; message: string }) => {
    if (!address.value) {
      setErrorStatus(t("connectWallet"), "error");
      return;
    }
    if (!(await ensureContractAddress())) return;
    if (!selectedCampaign.value) return;

    if (data.amount < 0.1) {
      setErrorStatus(t("minimumDonation"), "error");
      return;
    }

    try {
      isDonating.value = true;

      const { receiptId, invoke } = await processPayment(
        data.amount.toFixed(8),
        `donate:${selectedCampaign.value.id}:${data.message.slice(0, 50)}`
      );

      const tx = (await invoke(
        "donate",
        [
          { type: "Integer", value: selectedCampaign.value.id },
          { type: "Integer", value: String(receiptId) },
          { type: "String", value: data.message },
        ],
        contractAddress.value as string
      )) as { txid: string };

      if (tx.txid) {
        await waitForEvent(tx.txid, "DonationMade");
        await loadCampaigns();
        await loadMyDonations();
        await loadRecentDonations(selectedCampaign.value.id);
      }
    } catch (e: unknown) {
      setErrorStatus(formatErrorMessage(e, t("donationFailed")), "error");
    } finally {
      isDonating.value = false;
    }
  };

  // Create campaign
  const createCampaign = async (data: {
    title: string;
    description: string;
    story: string;
    category: string;
    targetAmount: number;
    duration: number;
    beneficiary: string;
    multisigAddresses: string[];
  }) => {
    if (!address.value) {
      setErrorStatus(t("connectWallet"), "error");
      return;
    }
    if (!(await ensureContractAddress())) return;

    try {
      isCreating.value = true;

      const endTime = Math.floor(Date.now() / 1000) + data.duration * 86400;

      const { receiptId, invoke } = await processPayment("1", `create:${data.category}:${data.title.slice(0, 50)}`);

      const tx = (await invoke(
        "createCampaign",
        [
          { type: "String", value: data.title },
          { type: "String", value: data.description },
          { type: "String", value: data.story },
          { type: "String", value: data.category },
          { type: "Integer", value: Math.round(data.targetAmount * 1e8) },
          { type: "Integer", value: endTime },
          { type: "Hash160", value: data.beneficiary },
          { type: "Array", value: data.multisigAddresses },
          { type: "Integer", value: String(receiptId) },
        ],
        contractAddress.value as string
      )) as { txid: string };

      if (tx.txid) {
        await waitForEvent(tx.txid, "CampaignCreated");
        await loadCampaigns();
        return true; // signal success for tab switch
      }
    } catch (e: unknown) {
      setErrorStatus(formatErrorMessage(e, t("creationFailed")), "error");
    } finally {
      isCreating.value = false;
    }
    return false;
  };

  const init = async () => {
    await ensureContractAddress();
    await loadCampaigns();
    await loadMyDonations();
  };

  return {
    selectedCampaign,
    campaigns,
    myDonations,
    recentDonations,
    selectedCategory,
    loadingCampaigns,
    isDonating,
    isCreating,
    errorMessage,
    filteredCampaigns,
    totalDonated,
    totalRaised,
    loadRecentDonations,
    makeDonation,
    createCampaign,
    init,
  };
}
