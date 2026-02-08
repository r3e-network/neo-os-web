import { ref, computed, onMounted, onUnmounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "./useI18n";

interface Grant {
  id: string;
  title: string;
  proposer: string;
  state: string;
  votesAccept: number;
  votesReject: number;
  discussionUrl: string;
  createdAt: string;
  comments: number;
  onchainId: number | null;
}

export function useGrantProposals() {
  const { t, locale } = useI18n();
  const { chainType } = useWallet() as WalletSDK;

  const grants = ref<Grant[]>([]);
  const totalProposals = ref(0);
  const loading = ref(false);
  const fetchError = ref(false);

  const windowWidth = ref(window.innerWidth);
  const isMobile = computed(() => windowWidth.value < 768);
  const isDesktop = computed(() => windowWidth.value >= 1024);

  const handleResize = () => { windowWidth.value = window.innerWidth; };
  onMounted(() => window.addEventListener('resize', handleResize));
  onUnmounted(() => window.removeEventListener('resize', handleResize));

  const isLocalPreview =
    typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);
  const LOCAL_PROPOSALS_MOCK = {
    total: 3,
    items: [
      {
        offchain_id: "101",
        title: "Developer Education Sprint",
        proposer: "NfYhP6Yw5tM4oX2Qz7bR5mU8dC6jK9vW1Q",
        state: "active",
        votes_amount_accept: 152340,
        votes_amount_reject: 12340,
        discussion_url: "https://forum.grantshares.io/t/dev-education-sprint",
        offchain_creation_timestamp: "2026-01-30T08:12:00.000Z",
        offchain_comments_count: 18,
        onchain_id: 57,
        description: "Build a 6-week education sprint focused on secure NEO smart contract development.",
      },
      {
        offchain_id: "102",
        title: "Neo Wallet UX Research",
        proposer: "NQf1fY3mP8jC2rL7nD4sX9aV6kW3mP5tYH",
        state: "review",
        votes_amount_accept: 92340,
        votes_amount_reject: 4560,
        discussion_url: "https://forum.grantshares.io/t/wallet-ux-research",
        offchain_creation_timestamp: "2026-02-01T13:20:00.000Z",
        offchain_comments_count: 9,
        onchain_id: 58,
        description: "Research and prototype better onboarding and transaction clarity for first-time users.",
      },
      {
        offchain_id: "103",
        title: "Cross-Chain Tooling Maintenance",
        proposer: "NdR6mX4tW8qL2dP5sH9fV3bN1kJ7gC2qZT",
        state: "executed",
        votes_amount_accept: 210340,
        votes_amount_reject: 7830,
        discussion_url: "https://forum.grantshares.io/t/cross-chain-tooling-maintenance",
        offchain_creation_timestamp: "2025-12-18T10:45:00.000Z",
        offchain_comments_count: 24,
        onchain_id: 54,
        description: "Maintain bridge and indexing tooling to improve reliability and incident response.",
      },
    ],
  };

  const parseResponseData = (payload: unknown) => {
    if (typeof payload === "string") {
      try {
        return JSON.parse(payload);
      } catch {
        return null;
      }
    }
    return payload;
  };

  const activeProposals = computed(() => grants.value.filter((grant) => isActiveState(grant.state)).length);
  const displayedProposals = computed(() => grants.value.length);

  function decodeBase64(str: string) {
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch {
      return str;
    }
  }

  function normalizeState(state: string): string {
    return String(state || "").toLowerCase();
  }

  function isActiveState(state: string): boolean {
    const normalized = normalizeState(state);
    return ["active", "review", "voting", "discussion"].includes(normalized);
  }

  function formatCount(amount: number): string {
    return Number.isFinite(amount) ? amount.toLocaleString() : "0";
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";
    const dateLocale = locale.value === "zh" ? "zh-CN" : "en-US";
    return date.toLocaleDateString(dateLocale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getStatusLabel(state: string): string {
    const statusMap: Record<string, string> = {
      active: t("statusActive"),
      review: t("statusReview"),
      voting: t("statusVoting"),
      discussion: t("statusDiscussion"),
      executed: t("statusExecuted"),
      cancelled: t("statusCancelled"),
      rejected: t("statusRejected"),
      expired: t("statusExpired"),
    };
    return statusMap[normalizeState(state)] || state;
  }

  async function fetchGrants() {
    loading.value = true;
    fetchError.value = false;
    try {
      let res: any = null;

      if (isLocalPreview) {
        res = LOCAL_PROPOSALS_MOCK;
      }

      if (!res) {
        res = await new Promise<any>((resolve, reject) => {
          uni.request({
            url: "/api/grantshares/proposals",
            success: (r) => resolve(parseResponseData(r.data)),
            fail: (e) => reject(e),
          });
        });
      }

      if (res && Array.isArray(res.items)) {
        grants.value = res.items
          .map((item: any) => {
            const title = decodeBase64(item.title || "");
            return {
              id: String(item.offchain_id || item.id || ""),
              title,
              proposer: String(item.proposer || item.proposer_address || item.proposerAddress || ""),
              state: normalizeState(item.state || ""),
              votesAccept: Number(item.votes_amount_accept || item.votesAmountAccept || 0),
              votesReject: Number(item.votes_amount_reject || item.votesAmountReject || 0),
              discussionUrl: String(item.discussion_url || item.discussionUrl || ""),
              createdAt: String(item.offchain_creation_timestamp || item.offchainCreationTimestamp || ""),
              comments: Number(item.offchain_comments_count || item.offchainCommentsCount || 0),
              onchainId: item.onchain_id ?? item.onchainId ?? null,
            } as Grant;
          })
          .filter((item: Grant) => item.id && item.title);

        const totalCount = Number(res.total ?? res.totalCount ?? grants.value.length);
        totalProposals.value = Number.isFinite(totalCount) ? totalCount : grants.value.length;
      } else {
        grants.value = [];
        totalProposals.value = 0;
      }
    } catch (e) {
      grants.value = [];
      totalProposals.value = 0;
      fetchError.value = true;
    } finally {
      loading.value = false;
    }
  }

  return {
    grants,
    totalProposals,
    loading,
    fetchError,
    activeProposals,
    displayedProposals,
    isMobile,
    isDesktop,
    windowWidth,
    chainType,
    fetchGrants,
    formatCount,
    formatDate,
    getStatusLabel,
    normalizeState,
    isActiveState,
  };
}
