import { ref, reactive, type Ref } from "vue";
import QRCode from "qrcode";
import type { WalletSDK } from "@neo/types";
import { requireNeoChain } from "@shared/utils/chain";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { addressToScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { parseBigInt, parseBool, encodeTokenId, parseDateInput } from "@shared/utils/parsers";
import type { EventItem, TicketItem } from "@/types";

export function useEventTicketContract(
  wallet: WalletSDK,
  ensureContractAddress: () => Promise<string>,
  setStatus: (msg: string, type: "success" | "error") => void,
  t: (key: string, params?: Record<string, unknown>) => string
) {
  const { address, connect, invokeContract, invokeRead, chainType } = wallet;

  const isCreating = ref(false);
  const isRefreshing = ref(false);
  const isRefreshingTickets = ref(false);
  const isIssuing = ref(false);
  const isCheckingIn = ref(false);
  const isLookingUp = ref(false);
  const issueModalOpen = ref(false);
  const togglingId = ref<string | null>(null);
  const events = ref<EventItem[]>([]);
  const tickets = ref<TicketItem[]>([]);
  const ticketQrs = reactive<Record<string, string>>({});
  const lookup = ref<TicketItem | null>(null);

  const form = reactive({
    name: "",
    venue: "",
    start: "",
    end: "",
    maxSupply: "100",
    notes: "",
  });

  const issueForm = reactive({
    eventId: "",
    recipient: "",
    seat: "",
    memo: "",
  });

  const checkin = reactive({
    tokenId: "",
  });

  const parseEvent = (raw: Record<string, unknown> | null, id: string): EventItem | null => {
    if (!raw || typeof raw !== "object") return null;
    return {
      id,
      creator: String(raw.creator || ""),
      name: String(raw.name || ""),
      venue: String(raw.venue || ""),
      startTime: Number.parseInt(String(raw.startTime || "0"), 10) || 0,
      endTime: Number.parseInt(String(raw.endTime || "0"), 10) || 0,
      maxSupply: parseBigInt(raw.maxSupply),
      minted: parseBigInt(raw.minted),
      notes: String(raw.notes || ""),
      active: parseBool(raw.active),
    };
  };

  const parseTicket = (raw: Record<string, unknown> | null, tokenId: string): TicketItem | null => {
    if (!raw || typeof raw !== "object") return null;
    return {
      tokenId,
      eventId: String(raw.eventId || ""),
      eventName: String(raw.eventName || ""),
      venue: String(raw.venue || ""),
      startTime: Number.parseInt(String(raw.startTime || "0"), 10) || 0,
      endTime: Number.parseInt(String(raw.endTime || "0"), 10) || 0,
      seat: String(raw.seat || ""),
      memo: String(raw.memo || ""),
      issuedTime: Number.parseInt(String(raw.issuedTime || "0"), 10) || 0,
      used: parseBool(raw.used),
      usedTime: Number.parseInt(String(raw.usedTime || "0"), 10) || 0,
    };
  };

  const loadEventIds = async (creatorAddress: string) => {
    const contract = await ensureContractAddress();
    const result = await invokeRead({
      scriptHash: contract,
      operation: "GetCreatorEvents",
      args: [
        { type: "Hash160", value: creatorAddress },
        { type: "Integer", value: "0" },
        { type: "Integer", value: "20" },
      ],
    });
    const parsed = parseInvokeResult(result);
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed
      .map((value) => String(value || ""))
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));
  };

  const loadEventDetails = async (eventId: string) => {
    const contract = await ensureContractAddress();
    const details = await invokeRead({
      scriptHash: contract,
      operation: "GetEventDetails",
      args: [{ type: "Integer", value: eventId }],
    });
    const parsed = parseInvokeResult(details) as Record<string, unknown>;
    return parseEvent(parsed, eventId);
  };

  const refreshEvents = async () => {
    if (!address.value) return;
    if (isRefreshing.value) return;
    try {
      isRefreshing.value = true;
      const ids = await loadEventIds(address.value);
      const details = await Promise.all(ids.map(loadEventDetails));
      events.value = details.filter(Boolean) as EventItem[];
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isRefreshing.value = false;
    }
  };

  const refreshTickets = async () => {
    if (!address.value) return;
    if (isRefreshingTickets.value) return;
    try {
      isRefreshingTickets.value = true;
      const contract = await ensureContractAddress();
      const tokenResult = await invokeRead({
        scriptHash: contract,
        operation: "TokensOf",
        args: [{ type: "Hash160", value: address.value }],
      });
      const parsed = parseInvokeResult(tokenResult);
      if (!Array.isArray(parsed)) {
        tickets.value = [];
        return;
      }
      const tokenIds = parsed.map((value) => String(value || "")).filter(Boolean);
      const details = await Promise.all(
        tokenIds.map(async (tokenId) => {
          const detailResult = await invokeRead({
            scriptHash: contract,
            operation: "GetTicketDetails",
            args: [{ type: "ByteArray", value: encodeTokenId(tokenId) }],
          });
          const detailParsed = parseInvokeResult(detailResult) as Record<string, unknown>;
          return parseTicket(detailParsed, tokenId);
        })
      );
      tickets.value = details.filter(Boolean) as TicketItem[];
      await Promise.all(
        tickets.value.map(async (ticket) => {
          if (!ticketQrs[ticket.tokenId]) {
            try {
              ticketQrs[ticket.tokenId] = await QRCode.toDataURL(ticket.tokenId, { margin: 1 });
            } catch {
              /* QR generation is non-critical */
            }
          }
        })
      );
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isRefreshingTickets.value = false;
    }
  };

  const connectWallet = async () => {
    try {
      await connect();
      if (address.value) {
        await refreshEvents();
        await refreshTickets();
      }
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("walletNotConnected")), "error");
    }
  };

  const createEvent = async () => {
    if (isCreating.value) return;
    if (!requireNeoChain(chainType, t)) return;
    const name = form.name.trim();
    if (!name) {
      setStatus(t("nameRequired"), "error");
      return;
    }
    const startTime = parseDateInput(form.start);
    const endTime = parseDateInput(form.end);
    if (!startTime || !endTime || endTime < startTime) {
      setStatus(t("invalidTime"), "error");
      return;
    }
    const maxSupply = parseBigInt(form.maxSupply);
    if (maxSupply <= 0n) {
      setStatus(t("invalidSupply"), "error");
      return;
    }
    try {
      isCreating.value = true;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "CreateEvent",
        args: [
          { type: "Hash160", value: address.value },
          { type: "String", value: name },
          { type: "String", value: form.venue.trim() },
          { type: "Integer", value: String(startTime) },
          { type: "Integer", value: String(endTime) },
          { type: "Integer", value: maxSupply.toString() },
          { type: "String", value: form.notes.trim() },
        ],
      });
      setStatus(t("eventCreated"), "success");
      form.name = "";
      form.venue = "";
      form.start = "";
      form.end = "";
      form.maxSupply = "100";
      form.notes = "";
      await refreshEvents();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isCreating.value = false;
    }
  };

  const openIssueModal = (event: EventItem) => {
    issueForm.eventId = event.id;
    issueForm.recipient = "";
    issueForm.seat = "";
    issueForm.memo = "";
    issueModalOpen.value = true;
  };

  const closeIssueModal = () => {
    issueModalOpen.value = false;
  };

  const issueTicket = async () => {
    if (isIssuing.value) return;
    if (!requireNeoChain(chainType, t)) return;
    const recipient = issueForm.recipient.trim();
    if (!recipient || !addressToScriptHash(recipient)) {
      setStatus(t("invalidRecipient"), "error");
      return;
    }
    try {
      isIssuing.value = true;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "IssueTicket",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Hash160", value: recipient },
          { type: "Integer", value: issueForm.eventId },
          { type: "String", value: issueForm.seat.trim() },
          { type: "String", value: issueForm.memo.trim() },
        ],
      });
      setStatus(t("ticketIssued"), "success");
      issueModalOpen.value = false;
      await refreshEvents();
      await refreshTickets();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isIssuing.value = false;
    }
  };

  const toggleEvent = async (event: EventItem) => {
    if (togglingId.value) return;
    if (!requireNeoChain(chainType, t)) return;
    try {
      togglingId.value = event.id;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "SetEventActive",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: event.id },
          { type: "Boolean", value: !event.active },
        ],
      });
      await refreshEvents();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      togglingId.value = null;
    }
  };

  const lookupTicket = async () => {
    if (isLookingUp.value) return;
    if (!requireNeoChain(chainType, t)) return;
    const tokenId = checkin.tokenId.trim();
    if (!tokenId) {
      setStatus(t("invalidTokenId"), "error");
      return;
    }
    try {
      isLookingUp.value = true;
      const contract = await ensureContractAddress();
      const detailResult = await invokeRead({
        scriptHash: contract,
        operation: "GetTicketDetails",
        args: [{ type: "ByteArray", value: encodeTokenId(tokenId) }],
      });
      const detailParsed = parseInvokeResult(detailResult) as Record<string, unknown>;
      const parsed = parseTicket(detailParsed, tokenId);
      if (!parsed) {
        setStatus(t("ticketNotFound"), "error");
        lookup.value = null;
        return;
      }
      lookup.value = parsed;
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isLookingUp.value = false;
    }
  };

  const checkInTicket = async () => {
    if (isCheckingIn.value) return;
    if (!requireNeoChain(chainType, t)) return;
    const tokenId = checkin.tokenId.trim();
    if (!tokenId) {
      setStatus(t("invalidTokenId"), "error");
      return;
    }
    try {
      isCheckingIn.value = true;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "CheckIn",
        args: [
          { type: "Hash160", value: address.value },
          { type: "ByteArray", value: encodeTokenId(tokenId) },
        ],
      });
      setStatus(t("checkinSuccess"), "success");
      await lookupTicket();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isCheckingIn.value = false;
    }
  };

  const copyTokenId = (tokenId: string) => {
    uni.setClipboardData({
      data: tokenId,
      success: () => {
        setStatus(t("copied"), "success");
      },
    });
  };

  return {
    // State
    form,
    issueForm,
    checkin,
    events,
    tickets,
    ticketQrs,
    lookup,
    isCreating,
    isRefreshing,
    isRefreshingTickets,
    isIssuing,
    isCheckingIn,
    isLookingUp,
    issueModalOpen,
    togglingId,
    // Actions
    connectWallet,
    refreshEvents,
    refreshTickets,
    createEvent,
    openIssueModal,
    closeIssueModal,
    issueTicket,
    toggleEvent,
    lookupTicket,
    checkInTicket,
    copyTokenId,
  };
}
