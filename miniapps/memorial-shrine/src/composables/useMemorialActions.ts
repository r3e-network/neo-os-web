import { ref, onUnmounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { readQueryParam } from "@shared/utils/url";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import type { Memorial } from "@/types";

const APP_ID = "miniapp-memorial-shrine";

export function useMemorialActions() {
  const { t } = createUseI18n(messages)();
  const { address, connect, invokeContract, invokeRead, getContractAddress } = useWallet() as WalletSDK;
  const { isLoading } = usePaymentFlow(APP_ID);

  const memorials = ref<Memorial[]>([]);
  const visitedMemorials = ref<Memorial[]>([]);
  const recentObituaries = ref<{ id: number; name: string; text: string }[]>([]);
  const selectedMemorial = ref<Memorial | null>(null);
  const contractAddress = ref<string | null>(null);
  const shareStatus = ref<string | null>(null);
  let shareStatusTimer: ReturnType<typeof setTimeout> | null = null;

  const ensureContract = async () => {
    if (!contractAddress.value) {
      contractAddress.value = await getContractAddress();
    }
    return contractAddress.value;
  };

  const loadMemorials = async () => {
    memorials.value = [
      {
        id: 1,
        name: "\u5F20\u5FB7\u660E",
        photoHash: "",
        birthYear: 1938,
        deathYear: 2024,
        relationship: "\u7236\u4EB2",
        biography: "\u4E00\u751F\u52E4\u52B3\u6734\u5B9E\uFF0C\u70ED\u7231\u5BB6\u5EAD\u3002",
        obituary: "",
        hasRecentTribute: true,
        offerings: { incense: 128, candle: 45, flower: 56, fruit: 34, wine: 12, feast: 3 },
      },
      {
        id: 2,
        name: "\u674E\u6DD1\u82AC",
        photoHash: "",
        birthYear: 1942,
        deathYear: 2023,
        relationship: "\u6BCD\u4EB2",
        biography: "\u6148\u6BCD\u4E00\u751F\u4E3A\u5BB6\u5EAD\u5949\u732E\u3002",
        obituary: "",
        hasRecentTribute: true,
        offerings: { incense: 89, candle: 32, flower: 67, fruit: 21, wine: 8, feast: 2 },
      },
      {
        id: 3,
        name: "\u738B\u5EFA\u56FD",
        photoHash: "",
        birthYear: 1950,
        deathYear: 2022,
        relationship: "\u7237\u7237",
        biography: "\u8001\u9769\u547D\uFF0C\u4E00\u751F\u6B63\u76F4\u3002",
        obituary: "",
        hasRecentTribute: false,
        offerings: { incense: 56, candle: 23, flower: 34, fruit: 12, wine: 5, feast: 1 },
      },
    ];

    recentObituaries.value = [
      { id: 1, name: "\u5F20\u8001\u5148\u751F", text: "\u5F20\u8001\u5148\u751F\u4E8E2024\u5E741\u6708\u9A7E\u9E64\u897F\u53BB" },
      { id: 2, name: "\u674E\u5976\u5976", text: "\u6148\u6BCD\u674E\u5976\u5976\u5B89\u8BE6\u79BB\u4E16" },
    ];
  };

  const loadVisitedMemorials = async () => {
    visitedMemorials.value = memorials.value.slice(0, 2);
  };

  const openMemorial = (id: number) => {
    const memorial = memorials.value.find((m) => m.id === id);
    if (memorial) {
      selectedMemorial.value = memorial;
      updateUrlWithMemorial(id);
    }
  };

  const closeMemorial = () => {
    selectedMemorial.value = null;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      window.history.replaceState({}, "", url.toString());
    }
  };

  const updateUrlWithMemorial = (id: number) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("id", String(id));
      window.history.replaceState({}, "", url.toString());
    }
  };

  const shareMemorial = (memorial?: Memorial) => {
    const target = memorial || selectedMemorial.value;
    if (!target || typeof window === "undefined") return;

    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${target.id}`;

    if (navigator.share) {
      navigator
        .share({
          title: `${target.name} - ${t("title")}`,
          text: `${t("tagline")} | ${target.name} (${target.birthYear}-${target.deathYear})`,
          url: shareUrl,
        })
        .catch(() => {
          copyToClipboard(shareUrl);
        });
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    uni.setClipboardData({
      data: text,
      success: () => {
        shareStatus.value = t("linkCopied");
        if (shareStatusTimer) clearTimeout(shareStatusTimer);
        shareStatusTimer = setTimeout(() => {
          shareStatus.value = null;
          shareStatusTimer = null;
        }, 3000);
      },
    });
  };

  const checkUrlForMemorial = async () => {
    const idParam = readQueryParam("id");
    if (idParam) {
      const id = parseInt(idParam, 10);
      if (!isNaN(id)) {
        await loadMemorials();
        const memorial = memorials.value.find((m) => m.id === id);
        if (memorial) {
          selectedMemorial.value = memorial;
        }
      }
    }
  };

  const onMemorialCreated = async (_data: Record<string, unknown>) => {
    await loadMemorials();
  };

  const onTributePaid = async (memorialId: number, _offeringType: number) => {
    await loadMemorials();
    if (selectedMemorial.value?.id === memorialId) {
      selectedMemorial.value = memorials.value.find((m) => m.id === memorialId) || null;
    }
  };

  const cleanupTimers = () => {
    if (shareStatusTimer) {
      clearTimeout(shareStatusTimer);
      shareStatusTimer = null;
    }
  };

  return {
    // State
    memorials,
    visitedMemorials,
    recentObituaries,
    selectedMemorial,
    shareStatus,
    // Actions
    loadMemorials,
    loadVisitedMemorials,
    openMemorial,
    closeMemorial,
    shareMemorial,
    checkUrlForMemorial,
    onMemorialCreated,
    onTributePaid,
    cleanupTimers,
  };
}
