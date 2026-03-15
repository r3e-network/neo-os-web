import { ref } from "vue";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { waitForEventByTransaction } from "@shared/utils";
import type { LeaderboardEntry } from "../pages/index/components/LeaderboardSection.vue";

const APP_ID = "miniapp-social-karma";

/** Manages karma points, endorsements, and leaderboard state. */
export function useSocialKarma(t: (key: string) => string) {
  const { address, read, ensureContractAddress, contractAddress } = useContractInteraction({ appId: APP_ID, t });
  const { processPayment } = usePaymentFlow(APP_ID);

  const leaderboard = ref<LeaderboardEntry[]>([]);
  const userKarma = ref(0);
  const userRank = ref(0);
  const checkInStreak = ref(0);
  const hasCheckedIn = ref(false);
  const nextCheckInTime = ref("-");
  const isCheckingIn = ref(false);
  const isGiving = ref(false);

  const loadLeaderboard = async (setStatus?: (msg: string, type: string) => void) => {
    try {
      await ensureContractAddress();
    } catch {
      return;
    }
    try {
      const parsed = (await read("getLeaderboard")) as unknown[];
      if (Array.isArray(parsed)) {
        leaderboard.value = parsed.map((e: unknown) => {
          const entry = e as Record<string, unknown>;
          return {
            address: String(entry.address || ""),
            karma: Number(entry.karma || 0),
          };
        });
      }
      const userEntry = leaderboard.value.find((e) => e.address === address.value);
      if (userEntry) {
        userKarma.value = userEntry.karma;
        userRank.value = leaderboard.value.indexOf(userEntry) + 1;
      }
    } catch (e: unknown) {
      setStatus?.(formatErrorMessage(e, t("leaderboardError")), "error");
    }
  };

  const loadUserState = async () => {
    if (!address.value) return;
    try {
      await ensureContractAddress();
    } catch {
      return;
    }
    try {
      const state = (await read("getUserCheckInState", [{ type: "Hash160", value: address.value }])) as Record<
        string,
        unknown
      >;
      if (state) {
        hasCheckedIn.value = Boolean(state.checkedIn) || false;
        checkInStreak.value = Number(state.streak || 0);
      }
    } catch (_e: unknown) {
      // User state load failure is non-critical
    }
  };

  const dailyCheckIn = async (setStatus: (msg: string, type: string) => void) => {
    if (!address.value) {
      setStatus(t("connectWallet"), "error");
      return;
    }
    try {
      await ensureContractAddress();
    } catch {
      return;
    }

    try {
      isCheckingIn.value = true;
      const { receiptId, invoke, waitForEvent } = await processPayment("0.1", "checkin");
      const tx = await invoke(
        "dailyCheckIn",
        [{ type: "Integer", value: String(receiptId) }],
        contractAddress.value as string
      );
      const earnedEvent = await waitForEventByTransaction(tx, "KarmaEarned", waitForEvent);
      if (earnedEvent) {
        hasCheckedIn.value = true;
        checkInStreak.value += 1;
        await loadLeaderboard();
      }
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isCheckingIn.value = false;
    }
  };

  const giveKarma = async (
    data: { address: string; amount: number; reason: string },
    setStatus: (msg: string, type: string) => void,
    onSuccess: () => void
  ) => {
    if (!address.value) return;
    try {
      await ensureContractAddress();
    } catch {
      return;
    }

    try {
      isGiving.value = true;
      const { receiptId, invoke, waitForEvent } = await processPayment("0.1", `reward:${data.amount}`);
      const tx = await invoke(
        "giveKarma",
        [
          { type: "Hash160", value: data.address },
          { type: "Integer", value: data.amount },
          { type: "String", value: data.reason },
          { type: "Integer", value: String(receiptId) },
        ],
        contractAddress.value as string
      );
      const givenEvent = await waitForEventByTransaction(tx, "KarmaGiven", waitForEvent);
      if (givenEvent) {
        onSuccess();
        await loadLeaderboard();
      }
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isGiving.value = false;
    }
  };

  return {
    address,
    leaderboard,
    userKarma,
    userRank,
    checkInStreak,
    hasCheckedIn,
    nextCheckInTime,
    isCheckingIn,
    isGiving,
    loadLeaderboard,
    loadUserState,
    dailyCheckIn,
    giveKarma,
  };
}
