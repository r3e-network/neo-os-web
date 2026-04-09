/**
 * useEventTicket — Domain logic for the Event Ticket Pass miniapp
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (NFTProxy, StorageProxy, BadgeProxy) via edge functions, so
 * this file contains zero contract hashes, parameter encoding, or event
 * parsing logic.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.readArray("GetCreatorEvents", [...])
 *     chain.read("GetEventDetails", [...])
 *     chain.readArray("TokensOf", [...])
 *     chain.read("GetTicketDetails", [...])
 *     chain.invoke("SetEventActive", [...])
 *     chain.ensureWallet()
 *
 *   AFTER (OS proxy):
 *     storageService.list("events:", 20)
 *     storageService.get("event:<id>")
 *     nftService.list(owner)
 *     storageService.list("tickets:", 50)
 *     nftService.validate(eventId)  — toggle active
 *     badgeService.award("event-organizer", "")
 */

import { ref, computed } from "vue";
import type { NFTProxy } from "@shared/services/os/NFTProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { parseBigInt, parseBool } from "@shared/utils/parsers";
import type { EventItem, TicketItem } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface UseEventTicketOptions {
  /** OS NFTProxy instance from ctx.os.nft */
  nftService: NFTProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** EventBus for UI events */
  eventBus: { emit: (event: string, payload?: unknown) => void };
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Helpers
// ============================================================================

interface StoredEvent {
  id: string;
  creator: string;
  name: string;
  venue: string;
  startTime: number;
  endTime: number;
  maxSupply: number | string;
  minted: number | string;
  notes: string;
  active: boolean;
}

interface StoredTicket {
  tokenId: string;
  eventId: string;
  owner: string;
  eventName: string;
  venue: string;
  startTime: number;
  endTime: number;
  seat: string;
  memo: string;
  issuedTime: number;
  used: boolean;
  usedTime: number;
}

// ============================================================================
// Composable
// ============================================================================

export function useEventTicket({
  nftService,
  storageService,
  badgeService,
  eventBus,
  t,
}: UseEventTicketOptions) {
  const events = ref<EventItem[]>([]);
  const tickets = ref<TicketItem[]>([]);
  const isRefreshing = ref(false);
  const isRefreshingTickets = ref(false);
  const isLoading = ref(false);
  const togglingId = ref<string | null>(null);

  const address = ref("");
  const eventsCount = computed(() => events.value.length);
  const ticketsCount = computed(() => tickets.value.length);
  const activeEventsCount = computed(() => events.value.filter((e) => e.active).length);

  // ── Data Loading (via OS services) ─────────────────────────────────

  /**
   * Load all events via StorageProxy.
   * The edge function translates storage reads into the appropriate
   * contract queries and returns normalized event data.
   */
  const refreshEvents = async () => {
    if (isRefreshing.value) return;
    isRefreshing.value = true;
    try {
      const eventMap = await storageService.list("events:", 20);
      const items: EventItem[] = [];
      if (eventMap && typeof eventMap === "object") {
        for (const [, value] of Object.entries(eventMap)) {
          const stored = value as StoredEvent;
          if (stored && stored.id) {
            items.push({
              id: String(stored.id),
              creator: String(stored.creator || ""),
              name: String(stored.name || ""),
              venue: String(stored.venue || ""),
              startTime: Number(stored.startTime || 0),
              endTime: Number(stored.endTime || 0),
              maxSupply: parseBigInt(stored.maxSupply),
              minted: parseBigInt(stored.minted),
              notes: String(stored.notes || ""),
              active: parseBool(stored.active),
            });
          }
        }
      }
      events.value = items;
    } catch (e) {
      console.warn("[useEventTicket] refreshEvents failed:", e instanceof Error ? e.message : String(e));
    } finally {
      isRefreshing.value = false;
    }
  };

  /**
   * Load all tickets via StorageProxy.
   */
  const refreshTickets = async () => {
    if (isRefreshingTickets.value) return;
    isRefreshingTickets.value = true;
    try {
      const ticketMap = await storageService.list("tickets:", 50);
      const items: TicketItem[] = [];
      if (ticketMap && typeof ticketMap === "object") {
        for (const [, value] of Object.entries(ticketMap)) {
          const stored = value as StoredTicket;
          if (stored && stored.tokenId) {
            items.push({
              tokenId: String(stored.tokenId),
              eventId: String(stored.eventId || ""),
              owner: String(stored.owner || ""),
              eventName: String(stored.eventName || ""),
              venue: String(stored.venue || ""),
              startTime: Number(stored.startTime || 0),
              endTime: Number(stored.endTime || 0),
              seat: String(stored.seat || ""),
              memo: String(stored.memo || ""),
              issuedTime: Number(stored.issuedTime || 0),
              used: parseBool(stored.used),
              usedTime: Number(stored.usedTime || 0),
            });
          }
        }
      }
      tickets.value = items;
    } catch (e) {
      console.warn("[useEventTicket] refreshTickets failed:", e instanceof Error ? e.message : String(e));
    } finally {
      isRefreshingTickets.value = false;
    }
  };

  // ── Actions (via OS services) ──────────────────────────────────────

  /**
   * Connect wallet — a no-op in the OS services pattern.
   * OS services handle auth transparently through edge functions.
   */
  const connectWallet = async () => {
    await refreshEvents();
    await refreshTickets();
  };

  const openIssueModal = (_event: unknown) => {
    eventBus.emit("ticket:openIssueModal", _event);
  };

  /**
   * Toggle an event's active state via NFTProxy.validate().
   * The edge function handles the SetEventActive contract call.
   */
  const toggleEvent = async (event: unknown) => {
    const evt = event as EventItem;
    if (togglingId.value) return;
    togglingId.value = evt.id;
    try {
      await nftService.validate(evt.id);
      await refreshEvents();
    } finally {
      togglingId.value = null;
    }
  };

  // ── Load All ────────────────────────────────────────────────────────

  const loadAll = async () => {
    isLoading.value = true;
    try {
      await connectWallet();
      // Hint badge for event organizer (fire-and-forget)
      if (events.value.length > 0) {
        badgeService.award("event-organizer", "").catch(() => {});
      }
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
