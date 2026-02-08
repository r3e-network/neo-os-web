<template>
  <view class="theme-event-ticket-pass">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="onTabChange"
    >
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t("overview") }}</text>
        </view>
      </template>

      <template #content>
        <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
          <text class="font-bold">{{ status.msg }}</text>
        </NeoCard>
        <EventCreateForm :t="t" v-model:form="form" :is-creating="isCreating" @create="createEvent" />
        <EventList
          :t="t"
          :address="address"
          :events="events"
          :is-refreshing="isRefreshing"
          :toggling-id="togglingId"
          @refresh="refreshEvents"
          @connect="connectWallet"
          @issue="openIssueModal"
          @toggle="toggleEvent"
        />
      </template>

      <template #tab-tickets>
        <TicketManagement
          :t="t"
          :address="address"
          :tickets="tickets"
          :ticket-qrs="ticketQrs"
          :is-refreshing="isRefreshingTickets"
          @refresh="refreshTickets"
          @connect="connectWallet"
          @copy="copyTokenId"
        />
      </template>

      <template #tab-checkin>
        <CheckinTab
          :t="t"
          v-model:token-id="checkin.tokenId"
          :lookup="lookup"
          :is-looking-up="isLookingUp"
          :is-checking-in="isCheckingIn"
          :status="status"
          @lookup="lookupTicket"
          @checkin="checkInTicket"
        />
      </template>
    </MiniAppTemplate>
  </view>
  <TicketIssueModal
    :t="t"
    :visible="issueModalOpen"
    v-model:recipient="issueForm.recipient"
    v-model:seat="issueForm.seat"
    v-model:memo="issueForm.memo"
    :is-issuing="isIssuing"
    @close="closeIssueModal"
    @issue="issueTicket"
  />
</template>
<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import QRCode from "qrcode";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, NeoCard } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { requireNeoChain } from "@shared/utils/chain";
import { addressToScriptHash, parseInvokeResult } from "@shared/utils/neo";
import { parseBigInt, parseBool, encodeTokenId, parseDateInput } from "@shared/utils/parsers";
import EventCreateForm from "./components/EventCreateForm.vue";
import EventList from "./components/EventList.vue";
import TicketManagement from "./components/TicketManagement.vue";
import CheckinTab from "./components/CheckinTab.vue";
import TicketIssueModal from "./components/TicketIssueModal.vue";
const { t } = useI18n();
const { address, connect, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
const templateConfig: MiniAppTemplateConfig = {
  contentType: "form-panel",
  tabs: [
    { key: "create", labelKey: "createTab", icon: "➕", default: true },
    { key: "tickets", labelKey: "ticketsTab", icon: "🎫" },
    { key: "checkin", labelKey: "checkinTab", icon: "✅" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: false,
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
        { nameKey: "feature3Name", descKey: "feature3Desc" },
      ],
    },
  },
};
const activeTab = ref("create");
const appState = computed(() => ({
  activeTab: activeTab.value,
  address: address.value,
  isCreating: isCreating.value,
  isRefreshing: isRefreshing.value,
  eventsCount: events.value.length,
  ticketsCount: tickets.value.length,
}));
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
const status = ref<{ msg: string; type: "success" | "error" } | null>(null);
const isCreating = ref(false);
const isRefreshing = ref(false);
const isRefreshingTickets = ref(false);
const isIssuing = ref(false);
const isCheckingIn = ref(false);
const isLookingUp = ref(false);
const issueModalOpen = ref(false);
const togglingId = ref<string | null>(null);
const contractAddress = ref<string | null>(null);
interface EventItem {
  id: string;
  creator: string;
  name: string;
  venue: string;
  startTime: number;
  endTime: number;
  maxSupply: bigint;
  minted: bigint;
  notes: string;
  active: boolean;
}
interface TicketItem {
  tokenId: string;
  eventId: string;
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
const events = ref<EventItem[]>([]);
const tickets = ref<TicketItem[]>([]);
const ticketQrs = reactive<Record<string, string>>({});
const lookup = ref<TicketItem | null>(null);
const ensureContractAddress = async () => {
  if (!requireNeoChain(chainType, t)) {
    throw new Error(t("wrongChain"));
  }
  if (!contractAddress.value) {
    contractAddress.value = await getContractAddress();
  }
  if (!contractAddress.value) {
    throw new Error(t("contractMissing"));
  }
  return contractAddress.value;
};
const setStatus = (msg: string, type: "success" | "error") => {
  status.value = { msg, type };
  setTimeout(() => {
    if (status.value?.msg === msg) status.value = null;
  }, 4000);
};
const parseEvent = (raw: any, id: string): EventItem | null => {
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
const parseTicket = (raw: any, tokenId: string): TicketItem | null => {
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
const fetchEventIds = async (creatorAddress: string) => {
  const contract = await ensureContractAddress();
  const result = await invokeRead({
    contractAddress: contract,
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
const fetchEventDetails = async (eventId: string) => {
  const contract = await ensureContractAddress();
  const details = await invokeRead({
    contractAddress: contract,
    operation: "GetEventDetails",
    args: [{ type: "Integer", value: eventId }],
  });
  const parsed = parseInvokeResult(details) as any;
  return parseEvent(parsed, eventId);
};
const refreshEvents = async () => {
  if (!address.value) return;
  if (isRefreshing.value) return;
  try {
    isRefreshing.value = true;
    const ids = await fetchEventIds(address.value);
    const details = await Promise.all(ids.map(fetchEventDetails));
    events.value = details.filter(Boolean) as EventItem[];
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
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
      contractAddress: contract,
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
          contractAddress: contract,
          operation: "GetTicketDetails",
          args: [{ type: "ByteArray", value: encodeTokenId(tokenId) }],
        });
        const detailParsed = parseInvokeResult(detailResult) as any;
        return parseTicket(detailParsed, tokenId);
      })
    );
    tickets.value = details.filter(Boolean) as TicketItem[];
    await Promise.all(
      tickets.value.map(async (ticket) => {
        if (!ticketQrs[ticket.tokenId]) {
          try {
            ticketQrs[ticket.tokenId] = await QRCode.toDataURL(ticket.tokenId, { margin: 1 });
          } catch {}
        }
      })
    );
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
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
  } catch (e: any) {
    setStatus(e.message || t("walletNotConnected"), "error");
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
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
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
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
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
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
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
      contractAddress: contract,
      operation: "GetTicketDetails",
      args: [{ type: "ByteArray", value: encodeTokenId(tokenId) }],
    });
    const detailParsed = parseInvokeResult(detailResult) as any;
    const parsed = parseTicket(detailParsed, tokenId);
    if (!parsed) {
      setStatus(t("ticketNotFound"), "error");
      lookup.value = null;
      return;
    }
    lookup.value = parsed;
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
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
  } catch (e: any) {
    setStatus(e.message || t("contractMissing"), "error");
  } finally {
    isCheckingIn.value = false;
  }
};
const copyTokenId = (tokenId: string) => {
  // @ts-ignore
  uni.setClipboardData({
    data: tokenId,
    success: () => {
      setStatus(t("copied"), "success");
    },
  });
};
const onTabChange = async (tab: string) => {
  activeTab.value = tab;
  if (tab === "tickets") {
    await refreshTickets();
  }
  if (tab === "create") {
    await refreshEvents();
  }
};
onMounted(async () => {
  await connect();
  if (address.value) {
    await refreshEvents();
    await refreshTickets();
  }
});
watch(address, async (newAddr) => {
  if (newAddr) {
    await refreshEvents();
    await refreshTickets();
  } else {
    events.value = [];
    tickets.value = [];
    lookup.value = null;
  }
});
</script>
<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./event-ticket-pass-theme.scss";
:global(page) {
  background: linear-gradient(135deg, var(--ticket-bg-start) 0%, var(--ticket-bg-end) 100%);
  color: var(--ticket-text);
}
.tab-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}
.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
