/**
 * useEventTicket — Domain logic for the Event Ticket Pass miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import type { EventItem, TicketItem } from "../types";

export interface UseEventTicketOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useEventTicket({ chain, eventBus, t }: UseEventTicketOptions) {
  const events = ref<EventItem[]>([]);
  const tickets = ref<TicketItem[]>([]);
  const isRefreshing = ref(false);
  const isRefreshingTickets = ref(false);
  const isLoading = ref(false);
  const togglingId = ref<string | null>(null);

  const address = chain.address;
  const eventsCount = computed(() => events.value.length);
  const ticketsCount = computed(() => tickets.value.length);
  const activeEventsCount = computed(() => events.value.filter((e) => e.active).length);

  const parseBigInt = (value: unknown) => { try { return BigInt(String(value ?? "0")); } catch { return 0n; } };
  const parseBool = (value: unknown) => value === true || value === "true" || value === 1 || value === "1";

  const parseEvent = (raw: Record<string, unknown> | null, id: string): EventItem | null => {
    if (!raw || typeof raw !== "object") return null;
    return {
      id, creator: String(raw.creator || ""), name: String(raw.name || ""), venue: String(raw.venue || ""),
      startTime: Number.parseInt(String(raw.startTime || "0"), 10) || 0, endTime: Number.parseInt(String(raw.endTime || "0"), 10) || 0,
      maxSupply: parseBigInt(raw.maxSupply), minted: parseBigInt(raw.minted), notes: String(raw.notes || ""), active: parseBool(raw.active),
    };
  };

  const refreshEvents = async () => {
    if (!chain.address.value || isRefreshing.value) return;
    isRefreshing.value = true;
    try {
      const ids = await chain.readArray("GetCreatorEvents", [
        { type: "Hash160", value: chain.address.value },
        { type: "Integer", value: "0" },
        { type: "Integer", value: "20" },
      ]);
      const validIds = (Array.isArray(ids) ? ids : []).map((v) => String(v || "")).filter(Boolean);
      const details = await Promise.all(validIds.map(async (id) => {
        const detail = await chain.read("GetEventDetails", [{ type: "Integer", value: id }]);
        return parseEvent(detail as Record<string, unknown>, id);
      }));
      events.value = details.filter(Boolean) as EventItem[];
    } catch (e) {
      console.warn("[useEventTicket] refreshEvents failed:", e instanceof Error ? e.message : String(e));
    } finally {
      isRefreshing.value = false;
    }
  };

  const refreshTickets = async () => {
    if (!chain.address.value || isRefreshingTickets.value) return;
    isRefreshingTickets.value = true;
    try {
      const tokenIds = await chain.readArray("TokensOf", [{ type: "Hash160", value: chain.address.value }]);
      const validIds = (Array.isArray(tokenIds) ? tokenIds : []).map((v) => String(v || "")).filter(Boolean);
      const details = await Promise.all(validIds.map(async (tokenId) => {
        const detail = await chain.read("GetTicketDetails", [{ type: "ByteArray", value: tokenId }]);
        if (!detail || typeof detail !== "object") return null;
        const raw = detail as Record<string, unknown>;
        return {
          tokenId, eventId: String(raw.eventId || ""), owner: String(raw.owner || ""), eventName: String(raw.eventName || ""),
          venue: String(raw.venue || ""), startTime: Number.parseInt(String(raw.startTime || "0"), 10) || 0,
          endTime: Number.parseInt(String(raw.endTime || "0"), 10) || 0, seat: String(raw.seat || ""),
          memo: String(raw.memo || ""), issuedTime: Number.parseInt(String(raw.issuedTime || "0"), 10) || 0,
          used: parseBool(raw.used), usedTime: Number.parseInt(String(raw.usedTime || "0"), 10) || 0,
        } as TicketItem;
      }));
      tickets.value = details.filter(Boolean) as TicketItem[];
    } catch (e) {
      console.warn("[useEventTicket] refreshTickets failed:", e instanceof Error ? e.message : String(e));
    } finally {
      isRefreshingTickets.value = false;
    }
  };

  const connectWallet = async () => {
    await chain.ensureWallet();
    if (chain.address.value) {
      await refreshEvents();
      await refreshTickets();
    }
  };

  const openIssueModal = (_event: unknown) => {
    eventBus.emit("ticket:openIssueModal", _event);
  };

  const toggleEvent = async (event: unknown) => {
    const evt = event as EventItem;
    if (togglingId.value) return;
    togglingId.value = evt.id;
    try {
      await chain.ensureWallet();
      await chain.invoke("SetEventActive", [
        { type: "Hash160", value: chain.address.value as string },
        { type: "Integer", value: evt.id },
        { type: "Boolean", value: !evt.active },
      ]);
      await refreshEvents();
    } finally {
      togglingId.value = null;
    }
  };

  const loadAll = async () => {
    isLoading.value = true;
    try {
      await connectWallet();
    } finally {
      isLoading.value = false;
    }
  };

  return {
    events, tickets, address, isRefreshing, isRefreshingTickets, togglingId, isLoading,
    eventsCount, ticketsCount, activeEventsCount,
    refreshEvents, refreshTickets, connectWallet, openIssueModal, toggleEvent, loadAll,
  };
}

export type UseEventTicketReturn = ReturnType<typeof useEventTicket>;
