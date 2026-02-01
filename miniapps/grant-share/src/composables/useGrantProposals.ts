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
      const res = await new Promise<any>((resolve, reject) => {
        uni.request({
          url: "/api/grantshares/proposals",
          success: (r) => resolve(r.data),
          fail: (e) => reject(e),
        });
      });

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
