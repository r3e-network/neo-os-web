/**
 * useCapsuleUnlock — DEPRECATED: Legacy composable preserved for backward compatibility.
 *
 * All capsule unlock/fish logic has been migrated to useTimeCapsule.ts which receives
 * ChainService + EventBus from PlatformServices.
 *
 * This file is no longer imported by main.ts. It will be removed in a future cleanup.
 */
import { ref, computed } from "vue";
import { useEvents } from "@shared/utils/wallet-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import { useAllEvents } from "@shared/composables/useAllEvents";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { readCachedJSON } from "@shared/utils/runtime-cache";
import { ownerMatchesAddress, parseStackItem } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import type { Capsule } from "../pages/index/components/CapsuleList.vue";

const APP_ID = "miniapp-time-capsule";
const FISH_FEE = "0.05";
const CONTENT_STORE_KEY = "time-capsule-content";

/** Handles capsule listing, unlocking, and content retrieval. */
export function useCapsuleUnlock() {
  const { t } = createUseI18n(messages)();
  const {
    address,
    ensureWallet,
    ensureContractAddress,
    invokeDirectly,
    read,
    isProcessing: paymentProcessing,
    parseInvokeResult,
  } = useContractInteraction({
    appId: APP_ID,
    t: (key: string) => (key === "contractUnavailable" ? t("error") : t(key)),
  });
  const { list: listEvents } = useEvents();
  const { listAllEvents } = useAllEvents(listEvents, APP_ID);

  const isProcessing = ref(false);
  const localContent = ref<Record<string, string>>({});

  const isBusy = computed(() => paymentProcessing.value || isProcessing.value);

  const loadLocalContent = () => {
    try {
      const parsed = readCachedJSON<Record<string, string | { hash?: string; content?: string }>>(CONTENT_STORE_KEY);
      if (!parsed || typeof parsed !== "object") return {};
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") {
          normalized[key] = value;
        } else if (value && typeof value === "object") {
          const legacy = value as { hash?: string; content?: string };
          const hashKey = String(legacy.hash || key);
          if (legacy.content) {
            normalized[hashKey] = String(legacy.content);
          }
        }
      }
      return normalized;
    } catch (_e) {
      /* Local storage parse failure — start with empty content map */
      return {};
    }
  };

  localContent.value = loadLocalContent();

  const ownerMatches = (value: unknown) => ownerMatchesAddress(value, address.value);

  const open = async (cap: Capsule, onStatus?: (msg: string, type: string) => void) => {
    if (cap.locked) {
      onStatus?.(t("notUnlocked"), "error");
      return;
    }
    if (isBusy.value) return;

    try {
      isProcessing.value = true;

      await ensureWallet();

      if (!cap.revealed) {
        onStatus?.(t("revealing"), "loading");
        await invokeDirectly("Reveal", [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: cap.id },
        ]);
      }

      const content = cap.contentHash ? localContent.value[cap.contentHash] : "";
      if (content) {
        onStatus?.(`${t("message")} ${content}`, "success");
      } else if (cap.contentHash) {
        onStatus?.(`${t("contentUnavailable")} ${cap.contentHash}`, "success");
      } else {
        onStatus?.(t("capsuleRevealed"), "success");
      }
    } catch (e) {
      onStatus?.(formatErrorMessage(e, t("error")), "error");
    } finally {
      isProcessing.value = false;
    }
  };

  const fish = async (onStatus?: (msg: string, type: string) => void) => {
    if (isBusy.value) return;

    try {
      isProcessing.value = true;
      onStatus?.(t("fishing"), "loading");
      const requestStartedAt = Date.now();

      await ensureWallet();
      const contractHash = await ensureContractAddress();

      await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Hash160", value: contractHash },
          { type: "Integer", value: "5000000" },
          { type: "String", value: `time-capsule:fish:${Date.now()}` },
        ],
        BLOCKCHAIN_CONSTANTS.GAS_HASH,
      );

      await new Promise((resolve) => setTimeout(resolve, 4000));

      await invokeDirectly("fish", [
        { type: "Hash160", value: address.value as string },
      ], contractHash);

      const fishEvents = await listAllEvents("CapsuleFished");
      const match = fishEvents.find((evt) => {
        const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
        const timestamp = evt?.created_at ? new Date(evt.created_at).getTime() : 0;
        return ownerMatches(values[0]) && timestamp >= requestStartedAt - 1000;
      });

      if (match) {
        const values = Array.isArray(match?.state) ? match.state.map(parseStackItem) : [];
        const fishedId = String(values[1] || "");
        onStatus?.(t("fishResult", { id: fishedId || "?" }), "success");
      } else {
        onStatus?.(t("fishNone"), "success");
      }
    } catch (e) {
      onStatus?.(formatErrorMessage(e, t("error")), "error");
    } finally {
      isProcessing.value = false;
    }
  };

  const toNumber = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const buildCapsuleFromDetails = (
    id: string,
    data: Record<string, unknown>,
    fallback?: { unlockTime?: number; isPublic?: boolean }
  ): Capsule => {
    const contentHash = String(data.contentHash || "");
    const unlockTime = toNumber(data.unlockTime ?? fallback?.unlockTime ?? 0);
    const isPublic = typeof data.isPublic === "boolean" ? data.isPublic : Boolean(data.isPublic ?? fallback?.isPublic);
    const revealed = Boolean(data.isRevealed);
    const title = String(data.title || "");
    const unlockDate = unlockTime ? new Date(unlockTime * 1000).toISOString().split("T")[0] : t("notAvailable");
    const content = contentHash ? localContent.value[contentHash] : "";

    return {
      id,
      title,
      contentHash,
      unlockDate,
      unlockTime,
      locked: !revealed && Date.now() < unlockTime * 1000,
      revealed,
      isPublic,
      content,
    } as Capsule;
  };

  const loadCapsules = async (): Promise<Capsule[]> => {
    if (!address.value) return [];
    try {
      const contract = await ensureContractAddress();
      const buriedEvents = await listAllEvents("CapsuleBuried");

      const userCapsules = await Promise.all(
        buriedEvents.map(async (evt) => {
          const values = Array.isArray(evt?.state) ? evt.state.map((s: unknown) => parseInvokeResult(s)) : [];
          const owner = values[0];
          const id = String(values[1] || "");
          const unlockTimeEvent = toNumber(values[2] || 0);
          const isPublicEvent = Boolean(values[3]);
          if (!id || !ownerMatches(owner)) return null;

          try {
            const parsed = await read("getCapsuleDetails", [{ type: "Integer", value: id }]);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              const data = parsed as Record<string, unknown>;
              return buildCapsuleFromDetails(id, data, { unlockTime: unlockTimeEvent, isPublic: isPublicEvent });
            }
          } catch (_e) {
            console.warn("[useCapsuleUnlock] buildCapsuleFromDetails failed, falling back to event values:", _e instanceof Error ? _e.message : String(_e));
          }

          return buildCapsuleFromDetails(
            id,
            { contentHash: "", title: "", unlockTime: unlockTimeEvent, isPublic: isPublicEvent, isRevealed: false },
            { unlockTime: unlockTimeEvent, isPublic: isPublicEvent }
          );
        })
      );

      let resolvedCapsules = userCapsules.filter(Boolean) as Capsule[];

      if (resolvedCapsules.length === 0) {
        const totalCapsules = Number((await read("totalCapsules")) || 0);
        const discovered: Capsule[] = [];
        for (let i = 1; i <= totalCapsules; i++) {
          const parsed = await read("getCapsuleDetails", [{ type: "Integer", value: String(i) }]);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
          const data = parsed as Record<string, unknown>;
          if (!ownerMatches(data.owner)) continue;
          discovered.push(buildCapsuleFromDetails(String(i), data));
        }
        resolvedCapsules = discovered;
      }

      return resolvedCapsules.sort((a, b) => Number(b.id) - Number(a.id));
    } catch (_e) {
      return [];
    }
  };

  return {
    isBusy,
    ownerMatches,
    listAllEvents,
    open,
    fish,
    loadCapsules,
    ensureContractAddress,
    localContent,
  };
}
