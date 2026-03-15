import { ref } from "vue";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";

const APP_ID = "miniapp-compound-capsule";

type Vault = { totalLocked: number; totalCapsules: number };
type Position = { deposited: number; earned: number; capsules: number };
type Capsule = {
  id: string;
  amount: number;
  unlockTime: number;
  unlockDate: string;
  remaining: string;
  compound: number;
  status: "Ready" | "Locked";
};

export function useCompoundCapsule(t: (key: string) => string, setStatus: (msg: string, type: string) => void) {
  const { address, ensureWallet, read, invokeDirectly } = useContractInteraction({ appId: APP_ID, t });

  const isLoading = ref(false);
  const vault = ref<Vault>({ totalLocked: 0, totalCapsules: 0 });
  const position = ref<Position>({ deposited: 0, earned: 0, capsules: 0 });
  const stats = ref({ totalCapsules: 0, totalLocked: 0, totalAccrued: 0 });
  const activeCapsules = ref<Capsule[]>([]);

  const toTimestampMs = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value > 1e12 ? value : value * 1000;
  };

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return t("ready");
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (days > 0) return `${days}${t("daysShort")} ${hours}${t("hoursShort")}`;
    if (hours > 0) return `${hours}${t("hoursShort")} ${minutes}${t("minutesShort")}`;
    return `${minutes}${t("minutesShort")}`;
  };

  const formatUnlockDate = (ms: number) =>
    new Date(ms).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const loadData = async () => {
    try {
      const totalCapsules = Number((await read("TotalCapsules")) || 0);
      const platformLocked = Number((await read("TotalLocked")) || 0);
      const userCapsules: Capsule[] = [];
      let userLocked = 0;
      let userAccrued = 0;
      const now = Date.now();
      const userScriptHash = address.value ? addressToScriptHash(address.value) : "";

      for (let i = 1; i <= totalCapsules; i++) {
        const parsed = await read("GetCapsuleDetails", [{ type: "Integer", value: i.toString() }]);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const data = parsed as Record<string, unknown>;
          const owner = normalizeScriptHash(String(data?.owner ?? ""));
          const principal = Number(data?.principal || 0);
          const unlockTime = Number(data?.unlockTime || 0);
          const unlockTimeMs = toTimestampMs(unlockTime);
          const isActive = Boolean(data?.active);
          const compoundRaw = Number(data?.compound || 0);

          if (userScriptHash && isActive && owner === userScriptHash) {
            const isReady = unlockTimeMs <= now;
            const compound = compoundRaw / 1e8;
            userCapsules.push({
              id: i.toString(),
              amount: principal,
              unlockTime: unlockTimeMs,
              unlockDate: formatUnlockDate(unlockTimeMs),
              remaining: isReady ? t("ready") : formatCountdown(unlockTimeMs - now),
              compound,
              status: isReady ? "Ready" : "Locked",
            });

            userLocked += principal;
            userAccrued += compound;
          }
        }
      }

      vault.value = { totalLocked: platformLocked, totalCapsules };
      activeCapsules.value = userCapsules;
      position.value = { deposited: userLocked, earned: userAccrued, capsules: userCapsules.length };
      stats.value = { totalCapsules: userCapsules.length, totalLocked: userLocked, totalAccrued: userAccrued };
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("loadFailed")), "error");
    }
  };

  const createCapsule = async (lockDays: number): Promise<void> => {
    if (isLoading.value) return;
    isLoading.value = true;
    try {
      const addr = await ensureWallet();
      await invokeDirectly("CreateCapsule", [
        { type: "Hash160", value: addr },
        { type: "Integer", value: String(1) },
        { type: "Integer", value: String(lockDays) },
      ]);
      setStatus(t("capsuleCreated"), "success");
      await loadData();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractUnavailable")), "error");
    } finally {
      isLoading.value = false;
    }
  };

  const unlockCapsule = async (capsuleId: string) => {
    if (isLoading.value) return;
    isLoading.value = true;
    try {
      await ensureWallet();
      await invokeDirectly("UnlockCapsule", [{ type: "Integer", value: capsuleId }]);
      setStatus(t("capsuleUnlocked"), "success");
      await loadData();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("unlockFailed")), "error");
    } finally {
      isLoading.value = false;
    }
  };

  return {
    address,
    isLoading,
    vault,
    position,
    stats,
    activeCapsules,
    loadData,
    createCapsule,
    unlockCapsule,
  };
}
